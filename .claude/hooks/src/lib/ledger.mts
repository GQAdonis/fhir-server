// Metadata-only agent ledger (.prometheus/agent-ledger.jsonl).
//
// `.prometheus/` is committed to git, so this module is the privacy boundary:
// every line is built from a fixed allowlist of fields whose values are either
// enumerated by this code or sanitized identifiers. Tool inputs, tool outputs,
// prompt text and file contents can never reach the ledger — a new field in a
// hook payload is ignored by construction, not by remembering to strip it.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { HookInput } from "./hook-io.mjs";
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

/**
 * Append one line. Lines are kept well under 4 KB so a single O_APPEND write
 * stays line-atomic when hooks run concurrently.
 */
export function appendEntry(projectRoot: string, entry: LedgerEntry): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (Buffer.byteLength(line) > 4000) throw new Error("ledger line exceeds 4000 bytes");
  const file = ledgerPath(projectRoot);
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, line, { encoding: "utf8" });
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
