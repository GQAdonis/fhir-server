// Metadata-only agent ledger (.prometheus/agent-ledger.jsonl).
//
// `.prometheus/` is committed to git, so this module is the privacy boundary:
// every line is built from a fixed allowlist of fields whose values are either
// enumerated by this code or sanitized identifiers. Tool inputs, tool outputs,
// prompt text and file contents can never reach the ledger — a new field in a
// hook payload is ignored by construction, not by remembering to strip it.
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { refuseSymlink, sleepSync } from "./fsguard.mjs";
import { scanText } from "./scan.mjs";
export const LEDGER_FIELDS = [
    "ts",
    "session_id",
    "agent_type",
    "agent_id",
    "event",
    "tool_name",
    "outcome",
    "kbd_phase",
    "kbd_change",
    "prompt_chars",
];
/** Hook events recorded by the agent-ledger hook, and the outcome each implies. */
const EVENT_OUTCOMES = {
    SubagentStart: "started",
    SubagentStop: "stopped",
    PostToolUseFailure: "failed",
    TaskCompleted: "completed",
    UserPromptSubmit: "submitted",
};
export const RECORDED_EVENTS = Object.keys(EVENT_OUTCOMES);
const MAX_ID = 128;
/**
 * Keep only identifier-shaped values (agent names like `plugin:reviewer`, UUIDs,
 * tool names such as `mcp__server__tool`, KBD ids). Anything else is dropped
 * rather than escaped. The charset excludes `@`, `/` and `+` so emails, URLs
 * and DSNs cannot pass, and every value is also run through the PHI/secret
 * scanner, so identifier-shaped PHI (e.g. an SSN) is dropped too.
 */
export function sanitizeId(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.length > MAX_ID)
        return undefined;
    if (!/^[A-Za-z0-9._:-]+$/.test(trimmed))
        return undefined;
    return scanText(trimmed).length === 0 ? trimmed : undefined;
}
/** Current KBD phase/change from the runtime waypoint; empty when absent. */
export function readKbdPosition(projectRoot) {
    try {
        const raw = readFileSync(path.join(projectRoot, ".kbd-orchestrator", "current-waypoint.json"), "utf8");
        const wp = JSON.parse(raw);
        const phase = sanitizeId(wp["phase"]);
        const change = sanitizeId(wp["nextChange"]) ?? sanitizeId(wp["change"]);
        return { ...(phase !== undefined ? { phase } : {}), ...(change !== undefined ? { change } : {}) };
    }
    catch {
        return {};
    }
}
/** Assemble an entry from explicit parts, dropping undefined and non-allowlisted keys. */
export function makeEntry(parts) {
    const entry = {};
    for (const field of LEDGER_FIELDS) {
        const value = parts[field];
        if (value !== undefined)
            entry[field] = value;
    }
    if (typeof entry["ts"] !== "string" || typeof entry["event"] !== "string") {
        throw new Error("ledger entry requires ts and event");
    }
    return entry;
}
/**
 * Build the ledger entry for a Claude Code hook payload, or null when the
 * event is not one the ledger records.
 */
export function entryFromHook(input, now, kbd) {
    const event = sanitizeId(input.hook_event_name);
    if (event === undefined)
        return null;
    const outcome = EVENT_OUTCOMES[event];
    if (outcome === undefined)
        return null;
    const prompt = event === "UserPromptSubmit" && typeof input["prompt"] === "string" ? input["prompt"] : undefined;
    return makeEntry({
        ts: now.toISOString(),
        event,
        outcome,
        session_id: sanitizeId(input.session_id),
        agent_type: sanitizeId(input.agent_type),
        agent_id: sanitizeId(input.agent_id),
        tool_name: event === "PostToolUseFailure" ? sanitizeId(input.tool_name) : undefined,
        kbd_phase: kbd.phase,
        kbd_change: kbd.change,
        // Length only: an unsalted hash of a short prompt could be brute-forced (D-007).
        prompt_chars: prompt?.length,
    });
}
export function ledgerPath(projectRoot) {
    return path.join(projectRoot, ".prometheus", "agent-ledger.jsonl");
}
export function ledgerDir(projectRoot) {
    return path.join(projectRoot, ".prometheus", "ledger");
}
/**
 * The "yyyy-mm" UTC month key for a `ts` string, or undefined when it does not
 * parse *or* its year falls outside 1970-9999: `isLedgerFile`/rotation always
 * expect an exactly-4-digit year, and an out-of-range year (unpadded below
 * 1000, or more than 4 digits above 9999) would otherwise produce a month key
 * that can never match `ledger/<yyyy-mm>.jsonl`, silently losing a line during
 * rotation instead of keeping it (partitionLedgerLines keeps what monthKey
 * can't place).
 */
export function monthKey(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime()))
        return undefined;
    const year = d.getUTCFullYear();
    if (year < 1970 || year > 9999)
        return undefined;
    return `${year}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/**
 * Split raw ledger lines (rotate-ledger.mts) into ones to move out (month
 * strictly before `beforeMonth`, "yyyy-mm") and ones to keep. Lines move
 * verbatim: a line whose `ts` is missing or unparseable is kept rather than
 * dropped or misfiled, since we cannot prove which month it belongs to.
 */
export function partitionLedgerLines(lines, beforeMonth) {
    const rotated = new Map();
    const kept = [];
    for (const line of lines) {
        if (line.trim() === "")
            continue;
        let ts;
        try {
            const value = JSON.parse(line);
            if (value !== null && typeof value === "object" && typeof value.ts === "string") {
                ts = value.ts;
            }
        }
        catch {
            ts = undefined;
        }
        const month = ts !== undefined ? monthKey(ts) : undefined;
        if (month !== undefined && month < beforeMonth) {
            const bucket = rotated.get(month) ?? [];
            bucket.push(line);
            rotated.set(month, bucket);
        }
        else {
            kept.push(line);
        }
    }
    return { rotated, kept };
}
/** True for a ledger-shaped file, whose JSON lines must use only LEDGER_FIELDS: `agent-ledger.jsonl` or `ledger/<yyyy-mm>.jsonl`. */
export function isLedgerFile(relPath) {
    const posix = relPath.split(path.sep).join("/");
    return posix === "agent-ledger.jsonl" || /^ledger\/\d{4}-\d{2}\.jsonl$/.test(posix);
}
/**
 * Keys outside LEDGER_FIELDS found in a ledger-shaped file's JSON lines. This
 * is a schema check, not the PHI/secret scan: it catches a future hook (or a
 * hand edit) adding a field the ledger's allowlist design was built to
 * exclude, even if that field's value happens not to match a scan rule.
 * Malformed lines are not this check's concern (the PHI scan and
 * `parseLedger` already handle those).
 */
export function ledgerKeyFindings(text) {
    const findings = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
        if (line.trim() === "")
            return;
        let value;
        try {
            value = JSON.parse(line);
        }
        catch {
            return;
        }
        if (value === null || typeof value !== "object" || Array.isArray(value))
            return;
        for (const key of Object.keys(value)) {
            if (!LEDGER_FIELDS.includes(key))
                findings.push({ line: index + 1, key });
        }
    });
    return findings;
}
const LOCK_RETRY_MS = 20;
function lockPath(projectRoot) {
    return path.join(projectRoot, ".prometheus", ".ledger.lock");
}
/**
 * Acquire an exclusive, cross-process lock coordinating ledger appends and
 * rotation, so rotation's read-partition-rewrite never overwrites a line
 * appended in that window (the two operations serialize instead of racing).
 * Returns a release function. Never blocks indefinitely: past `timeoutMs`
 * (contention, or a lock orphaned by a crashed process) the lock is cleared
 * and the caller proceeds without it — a hook must never hang a tool call
 * forever, and rare timeout-window contention is a smaller risk than that.
 */
export function acquireLedgerLock(projectRoot, timeoutMs = 3000) {
    const lock = lockPath(projectRoot);
    mkdirSync(path.dirname(lock), { recursive: true });
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        refuseSymlink(lock);
        try {
            const fd = openSync(lock, "wx");
            closeSync(fd);
            return () => {
                try {
                    unlinkSync(lock);
                }
                catch {
                    // already released or removed: fine
                }
            };
        }
        catch (err) {
            if (err.code !== "EEXIST")
                return () => { }; // can't create a lock file at all: proceed rather than hang
            if (Date.now() >= deadline) {
                try {
                    unlinkSync(lock); // clear a stale/contended lock so the *next* caller isn't blocked forever
                }
                catch {
                    // already gone
                }
                return () => { };
            }
            sleepSync(LOCK_RETRY_MS);
        }
    }
}
/** Write `content` to `target` atomically (write to a sibling temp file, then rename), refusing to follow a symlink at either path. */
function writeFileAtomic(target, content) {
    refuseSymlink(target);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, target);
}
/**
 * Append one line, holding the ledger lock for the write. Lines are kept well
 * under 4 KB so the write itself is small and fast; the lock (not O_APPEND
 * atomicity alone) is what protects against rotation's read-modify-write.
 */
export function appendEntry(projectRoot, entry) {
    const line = `${JSON.stringify(entry)}\n`;
    if (Buffer.byteLength(line) > 4000)
        throw new Error("ledger line exceeds 4000 bytes");
    const dir = path.join(projectRoot, ".prometheus");
    refuseSymlink(dir);
    mkdirSync(dir, { recursive: true });
    const file = ledgerPath(projectRoot);
    const release = acquireLedgerLock(projectRoot);
    try {
        refuseSymlink(file);
        appendFileSync(file, line, { encoding: "utf8" });
    }
    finally {
        release();
    }
}
/**
 * Rotate lines strictly before `beforeMonth` ("yyyy-mm") out of the live
 * ledger into `ledger/<yyyy-mm>.jsonl`, holding the ledger lock for the whole
 * read-partition-write sequence so a concurrent `appendEntry` (which takes the
 * same lock) can never be silently overwritten by the rewrite. Returns null
 * when there is no ledger file at all.
 */
export function rotateLedgerNow(projectRoot, beforeMonth) {
    const file = ledgerPath(projectRoot);
    if (!existsSync(file))
        return null;
    const prometheusDir = path.join(projectRoot, ".prometheus");
    const dir = ledgerDir(projectRoot);
    const release = acquireLedgerLock(projectRoot);
    try {
        refuseSymlink(prometheusDir);
        refuseSymlink(file);
        const lines = readFileSync(file, "utf8").split("\n").filter((l) => l !== "");
        const { rotated, kept } = partitionLedgerLines(lines, beforeMonth);
        if (rotated.size === 0)
            return { moved: 0, monthFiles: 0 };
        refuseSymlink(dir);
        mkdirSync(dir, { recursive: true });
        let moved = 0;
        for (const [month, monthLines] of [...rotated.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
            const monthFile = path.join(dir, `${month}.jsonl`);
            refuseSymlink(monthFile);
            const existing = existsSync(monthFile) ? readFileSync(monthFile, "utf8") : "";
            writeFileAtomic(monthFile, existing + monthLines.map((l) => `${l}\n`).join(""));
            moved += monthLines.length;
        }
        writeFileAtomic(file, kept.length > 0 ? `${kept.join("\n")}\n` : "");
        writeFileAtomic(path.join(prometheusDir, ".flush-cursor"), `${JSON.stringify({ offset: 0 })}\n`);
        return { moved, monthFiles: rotated.size };
    }
    finally {
        release();
    }
}
/** Parse ledger text, skipping blank or corrupt lines. */
export function parseLedger(text) {
    const out = [];
    for (const line of text.split("\n")) {
        if (line.trim() === "")
            continue;
        try {
            const value = JSON.parse(line);
            if (value !== null && typeof value === "object" && typeof value.event === "string") {
                out.push(value);
            }
        }
        catch {
            // A torn or hand-edited line is skipped, never fatal.
        }
    }
    return out;
}
