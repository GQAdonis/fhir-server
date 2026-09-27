// Metadata-only agent ledger (.prometheus/agent-ledger.jsonl).
//
// `.prometheus/` is committed to git, so this module is the privacy boundary:
// every line is built from a fixed allowlist of fields whose values are either
// enumerated by this code or sanitized identifiers. Tool inputs, tool outputs,
// prompt text and file contents can never reach the ledger — a new field in a
// hook payload is ignored by construction, not by remembering to strip it.
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { HookInput } from "./hook-io.mjs";
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
] as const;

export type LedgerField = (typeof LEDGER_FIELDS)[number];
export type LedgerEntry = Partial<Record<LedgerField, string | number>> & {
  readonly ts: string;
  readonly event: string;
};

/** Hook events recorded by the agent-ledger hook, and the outcome each implies. */
const EVENT_OUTCOMES: Readonly<Record<string, string>> = {
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
export function sanitizeId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_ID) return undefined;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return undefined;
  return scanText(trimmed).length === 0 ? trimmed : undefined;
}

export interface KbdPosition {
  readonly phase?: string;
  readonly change?: string;
}

/** Current KBD phase/change from the runtime waypoint; empty when absent. */
export function readKbdPosition(projectRoot: string): KbdPosition {
  try {
    const raw = readFileSync(path.join(projectRoot, ".kbd-orchestrator", "current-waypoint.json"), "utf8");
    const wp = JSON.parse(raw) as Record<string, unknown>;
    const phase = sanitizeId(wp["phase"]);
    const change = sanitizeId(wp["nextChange"]) ?? sanitizeId(wp["change"]);
    return { ...(phase !== undefined ? { phase } : {}), ...(change !== undefined ? { change } : {}) };
  } catch {
    return {};
  }
}

/** Assemble an entry from explicit parts, dropping undefined and non-allowlisted keys. */
export function makeEntry(parts: Readonly<Record<string, string | number | undefined>>): LedgerEntry {
  const entry: Record<string, string | number> = {};
  for (const field of LEDGER_FIELDS) {
    const value = parts[field];
    if (value !== undefined) entry[field] = value;
  }
  if (typeof entry["ts"] !== "string" || typeof entry["event"] !== "string") {
    throw new Error("ledger entry requires ts and event");
  }
  return entry as LedgerEntry;
}

/**
 * Build the ledger entry for a Claude Code hook payload, or null when the
 * event is not one the ledger records.
 */
export function entryFromHook(input: HookInput, now: Date, kbd: KbdPosition): LedgerEntry | null {
  const event = sanitizeId(input.hook_event_name);
  if (event === undefined) return null;
  const outcome = EVENT_OUTCOMES[event];
  if (outcome === undefined) return null;

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

export function ledgerPath(projectRoot: string): string {
  return path.join(projectRoot, ".prometheus", "agent-ledger.jsonl");
}

export function ledgerDir(projectRoot: string): string {
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
export function monthKey(ts: string): string | undefined {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 1970 || year > 9999) return undefined;
  return `${year}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface LedgerPartition {
  /** Raw lines to append to `ledger/<month>.jsonl`, grouped by month, each group in original order. */
  readonly rotated: ReadonlyMap<string, readonly string[]>;
  /** Raw lines that stay in `agent-ledger.jsonl`, in original order. */
  readonly kept: readonly string[];
}

/**
 * Split raw ledger lines (rotate-ledger.mts) into ones to move out (month
 * strictly before `beforeMonth`, "yyyy-mm") and ones to keep. Lines move
 * verbatim: a line whose `ts` is missing or unparseable is kept rather than
 * dropped or misfiled, since we cannot prove which month it belongs to.
 */
export function partitionLedgerLines(lines: readonly string[], beforeMonth: string): LedgerPartition {
  const rotated = new Map<string, string[]>();
  const kept: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    let ts: string | undefined;
    try {
      const value = JSON.parse(line) as unknown;
      if (value !== null && typeof value === "object" && typeof (value as { ts?: unknown }).ts === "string") {
        ts = (value as { ts: string }).ts;
      }
    } catch {
      ts = undefined;
    }
    const month = ts !== undefined ? monthKey(ts) : undefined;
    if (month !== undefined && month < beforeMonth) {
      const bucket = rotated.get(month) ?? [];
      bucket.push(line);
      rotated.set(month, bucket);
    } else {
      kept.push(line);
    }
  }
  return { rotated, kept };
}

/** True for a ledger-shaped file, whose JSON lines must use only LEDGER_FIELDS: `agent-ledger.jsonl` or `ledger/<yyyy-mm>.jsonl`. */
export function isLedgerFile(relPath: string): boolean {
  const posix = relPath.split(path.sep).join("/");
  return posix === "agent-ledger.jsonl" || /^ledger\/\d{4}-\d{2}\.jsonl$/.test(posix);
}

export interface LedgerKeyFinding {
  readonly line: number;
  readonly key: string;
}

/**
 * Keys outside LEDGER_FIELDS found in a ledger-shaped file's JSON lines. This
 * is a schema check, not the PHI/secret scan: it catches a future hook (or a
 * hand edit) adding a field the ledger's allowlist design was built to
 * exclude, even if that field's value happens not to match a scan rule.
 * Malformed lines are not this check's concern (the PHI scan and
 * `parseLedger` already handle those).
 */
export function ledgerKeyFindings(text: string): LedgerKeyFinding[] {
  const findings: LedgerKeyFinding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim() === "") return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (!(LEDGER_FIELDS as readonly string[]).includes(key)) findings.push({ line: index + 1, key });
    }
  });
  return findings;
}

const LOCK_RETRY_MS = 20;

function lockPath(projectRoot: string): string {
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
export function acquireLedgerLock(projectRoot: string, timeoutMs = 3000): () => void {
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
        } catch {
          // already released or removed: fine
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") return () => {}; // can't create a lock file at all: proceed rather than hang
      if (Date.now() >= deadline) {
        try {
          unlinkSync(lock); // clear a stale/contended lock so the *next* caller isn't blocked forever
        } catch {
          // already gone
        }
        return () => {};
      }
      sleepSync(LOCK_RETRY_MS);
    }
  }
}

/** Write `content` to `target` atomically (write to a sibling temp file, then rename), refusing to follow a symlink at either path. */
function writeFileAtomic(target: string, content: string): void {
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
export function appendEntry(projectRoot: string, entry: LedgerEntry): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (Buffer.byteLength(line) > 4000) throw new Error("ledger line exceeds 4000 bytes");
  const dir = path.join(projectRoot, ".prometheus");
  refuseSymlink(dir);
  mkdirSync(dir, { recursive: true });
  const file = ledgerPath(projectRoot);
  const release = acquireLedgerLock(projectRoot);
  try {
    refuseSymlink(file);
    appendFileSync(file, line, { encoding: "utf8" });
  } finally {
    release();
  }
}

export interface RotateResult {
  readonly moved: number;
  readonly monthFiles: number;
}

/**
 * Rotate lines strictly before `beforeMonth` ("yyyy-mm") out of the live
 * ledger into `ledger/<yyyy-mm>.jsonl`, holding the ledger lock for the whole
 * read-partition-write sequence so a concurrent `appendEntry` (which takes the
 * same lock) can never be silently overwritten by the rewrite. Returns null
 * when there is no ledger file at all.
 */
export function rotateLedgerNow(projectRoot: string, beforeMonth: string): RotateResult | null {
  const file = ledgerPath(projectRoot);
  if (!existsSync(file)) return null;
  const prometheusDir = path.join(projectRoot, ".prometheus");
  const dir = ledgerDir(projectRoot);
  const release = acquireLedgerLock(projectRoot);
  try {
    refuseSymlink(prometheusDir);
    refuseSymlink(file);
    const lines = readFileSync(file, "utf8").split("\n").filter((l) => l !== "");
    const { rotated, kept } = partitionLedgerLines(lines, beforeMonth);
    if (rotated.size === 0) return { moved: 0, monthFiles: 0 };
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
  } finally {
    release();
  }
}

/** Parse ledger text, skipping blank or corrupt lines. */
export function parseLedger(text: string): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (value !== null && typeof value === "object" && typeof (value as LedgerEntry).event === "string") {
        out.push(value as LedgerEntry);
      }
    } catch {
      // A torn or hand-edited line is skipped, never fatal.
    }
  }
  return out;
}
