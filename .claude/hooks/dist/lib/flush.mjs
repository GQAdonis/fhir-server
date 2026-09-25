// Karpathy flush: condense new ledger lines into a session note, scan it, and
// queue it for the project knowledge base. Pure helpers are exported for tests;
// `flush()` performs the filesystem work and starts the background drainer.
import { closeSync, existsSync, linkSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, } from "node:fs";
import path from "node:path";
import { appendEntry, ledgerPath, makeEntry, parseLedger } from "./ledger.mjs";
import { drainOutbox, outboxDir, startDetachedDrain } from "./pk.mjs";
import { parseAllowlist, scanText, validateAllowlist } from "./scan.mjs";
const LOCK_STALE_MS = 60_000;
function prometheusDir(root) {
    return path.join(root, ".prometheus");
}
function readCursor(root) {
    try {
        const value = JSON.parse(readFileSync(path.join(prometheusDir(root), ".flush-cursor"), "utf8"));
        return typeof value.offset === "number" && value.offset >= 0 ? value.offset : 0;
    }
    catch {
        return 0;
    }
}
function writeCursor(root, offset) {
    writeFileSync(path.join(prometheusDir(root), ".flush-cursor"), `${JSON.stringify({ offset })}\n`);
}
/** Read ledger bytes appended since the cursor; resets when the ledger was rotated. */
export function readDelta(root) {
    const file = ledgerPath(root);
    if (!existsSync(file))
        return { entries: [], end: 0 };
    const buf = readFileSync(file);
    let start = readCursor(root);
    if (start > buf.length)
        start = 0;
    // Only consume whole lines so a concurrent partial append is left for next time.
    const lastNewline = buf.lastIndexOf(0x0a);
    const end = lastNewline < start ? start : lastNewline + 1;
    return { entries: parseLedger(buf.subarray(start, end).toString("utf8")), end };
}
function count(items, key) {
    const out = new Map();
    for (const item of items) {
        const k = key(item);
        if (k !== undefined)
            out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
}
/** Render a metadata-only markdown summary of ledger entries. */
export function renderNote(entries) {
    const first = entries[0]?.ts ?? "";
    const last = entries[entries.length - 1]?.ts ?? "";
    const sessions = [...count(entries, (e) => e.session_id).keys()];
    const phases = [...count(entries, (e) => e.kbd_phase).keys()];
    const changes = [...count(entries, (e) => e.kbd_change).keys()];
    const agents = new Map();
    for (const e of entries) {
        const agent = e.agent_type ?? "(main session)";
        const row = agents.get(agent) ?? new Map();
        row.set(e.event, (row.get(e.event) ?? 0) + 1);
        agents.set(agent, row);
    }
    const events = [...count(entries, (e) => e.event).entries()].sort();
    const failedTools = [...count(entries.filter((e) => e.event === "PostToolUseFailure"), (e) => e.tool_name).entries()].sort();
    const lines = [
        `# Agent activity ${first.slice(0, 10)}`,
        "",
        `- Window: \`${first}\` → \`${last}\``,
        `- Sessions: ${sessions.length > 0 ? sessions.map((s) => `\`${s}\``).join(", ") : "none recorded"}`,
        `- KBD phase: ${phases.map((p) => `\`${p}\``).join(", ") || "none"}; changes: ${changes.map((c) => `\`${c}\``).join(", ") || "none"}`,
        `- Ledger lines summarized: ${entries.length}`,
        "",
        "## Events",
        "",
        ...events.map(([event, n]) => `- \`${event}\`: ${n}`),
        "",
        "## Agents",
        "",
        "| Agent | Started | Stopped | Tool failures | Tasks completed |",
        "|---|---|---|---|---|",
        ...[...agents.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([agent, row]) => `| \`${agent}\` | ${row.get("SubagentStart") ?? 0} | ${row.get("SubagentStop") ?? 0} | ${row.get("PostToolUseFailure") ?? 0} | ${row.get("TaskCompleted") ?? 0} |`),
    ];
    if (failedTools.length > 0) {
        lines.push("", "## Failing tools", "", ...failedTools.map(([tool, n]) => `- \`${tool}\`: ${n}`));
    }
    const degraded = entries.filter((e) => e.event === "boundary_degraded" || e.event === "flush_blocked").length;
    if (degraded > 0)
        lines.push("", `> Karpathy loop health: ${degraded} degraded or blocked record(s) — see the ledger.`);
    return `${lines.join("\n")}\n`;
}
function acquireLock(root) {
    const lock = path.join(prometheusDir(root), ".flush.lock");
    try {
        if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS)
            rmSync(lock, { force: true });
        closeSync(openSync(lock, "wx"));
        return () => rmSync(lock, { force: true });
    }
    catch {
        return null;
    }
}
/** `2026-09-24T13:00:00.123Z` → `20260924T130000123Z` (millisecond precision). */
function compactTs(iso) {
    return iso.replace(/[-:.]/g, "");
}
/**
 * Atomically create `<dir>/<stem>.md` without ever overwriting: the content is
 * written to a temp file, then hard-linked to the final name (link fails with
 * EEXIST instead of replacing), retrying with `-1`, `-2`, … on collision. A
 * crash leaves at most a stray temp file, never a partial note.
 */
function writeExclusive(dir, stem, text) {
    const tmp = path.join(dir, `.${stem}.${process.pid}.tmp`);
    writeFileSync(tmp, text);
    try {
        for (let n = 0; n < 1000; n++) {
            const name = `${stem}${n === 0 ? "" : `-${n}`}.md`;
            try {
                linkSync(tmp, path.join(dir, name));
                return name;
            }
            catch (err) {
                if (err.code !== "EEXIST")
                    throw err;
            }
        }
        throw new Error(`could not allocate a unique note name for ${stem}`);
    }
    finally {
        rmSync(tmp, { force: true });
    }
}
export function flush(root, now = new Date(), env = process.env) {
    const dir = prometheusDir(root);
    mkdirSync(dir, { recursive: true });
    const release = acquireLock(root);
    if (release === null)
        return { status: "locked" };
    try {
        const { entries, end } = readDelta(root);
        if (entries.length === 0) {
            writeCursor(root, end);
            return { status: "empty" };
        }
        const text = renderNote(entries);
        const allowFile = path.join(dir, "scan-allowlist.json");
        const matches = scanText(text, validateAllowlist(parseAllowlist(existsSync(allowFile) ? readFileSync(allowFile, "utf8") : undefined)).accepted);
        if (matches.length > 0) {
            // Deliberately skip a blocked delta: retrying it would block every later
            // flush. The flush_blocked line records that (and how many) were withheld.
            writeCursor(root, end);
            appendEntry(root, makeEntry({ ts: now.toISOString(), event: "flush_blocked", outcome: `blocked:${matches.length}` }));
            return { status: "blocked", matches: matches.length };
        }
        const rawDir = path.join(dir, "raw");
        mkdirSync(rawDir, { recursive: true });
        const name = writeExclusive(rawDir, `${compactTs(now.toISOString())}-agent-activity`, text);
        const note = path.join(rawDir, name);
        const outbox = outboxDir(root);
        mkdirSync(outbox, { recursive: true });
        writeFileSync(path.join(outbox, name), text, { flag: "wx" });
        // Advance only once the note is durable in raw/ and queued in outbox/, so a
        // failed write leaves the delta to be summarized by the next flush.
        writeCursor(root, end);
        // KARPATHY_FLUSH_SYNC=1 drains inline (tests, CI); otherwise a detached
        // drainer delivers the outbox so the Stop hook never waits on `pk`.
        if (env["KARPATHY_FLUSH_SYNC"] !== "1") {
            startDetachedDrain(root, env);
            return { status: "queued-async", note };
        }
        const report = drainOutbox(root, env);
        return report.lastError === undefined
            ? { status: "ingested", note }
            : { status: "queued", note, reason: report.lastError };
    }
    finally {
        release();
    }
}
