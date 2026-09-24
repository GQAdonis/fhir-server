import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  LEDGER_FIELDS,
  entryFromHook,
  sanitizeId,
  appendEntry,
  ledgerPath,
  parseLedger,
  readKbdPosition,
  makeEntry,
} from "../dist/lib/ledger.mjs";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const SECRET_PROMPT = "Patient John Doe SSN 123-45-6789, token sk-abcdefghijklmnop";

test("payload content fields never reach the entry", () => {
  const input = {
    hook_event_name: "PostToolUseFailure",
    session_id: "0f8e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
    tool_name: "Bash",
    tool_input: { command: "psql postgres://admin:hunter2@db/fhir" },
    tool_response: { stderr: SECRET_PROMPT },
    prompt: SECRET_PROMPT,
    error: SECRET_PROMPT,
    transcript_path: "/Users/someone/.claude/x.jsonl",
    cwd: "/Users/someone/repo",
  };
  const entry = entryFromHook(input, NOW, {});
  const line = JSON.stringify(entry);
  for (const needle of ["hunter2", "123-45-6789", "sk-abc", "John Doe", "transcript", "/Users/someone"]) {
    assert.ok(!line.includes(needle), `leaked ${needle}`);
  }
  for (const key of Object.keys(entry)) assert.ok(LEDGER_FIELDS.includes(key), `unexpected field ${key}`);
  assert.equal(entry.tool_name, "Bash");
  assert.equal(entry.outcome, "failed");
});

test("prompts are recorded by length only (no hash, D-007)", () => {
  const entry = entryFromHook({ hook_event_name: "UserPromptSubmit", prompt: SECRET_PROMPT }, NOW, {});
  assert.equal(entry.prompt_chars, SECRET_PROMPT.length);
  assert.equal("prompt_sha256" in entry, false);
  assert.ok(!JSON.stringify(entry).includes("123-45-6789"));
});

test("subagent stop carries agent identity and KBD position", () => {
  const entry = entryFromHook(
    { hook_event_name: "SubagentStop", agent_type: "fhir-code-reviewer", agent_id: "a1b2c3", session_id: "s-1" },
    NOW,
    { phase: "agent-dev-team", change: "add-karpathy-agent-ledger" },
  );
  assert.deepEqual(entry, {
    ts: "2026-09-24T12:00:00.000Z",
    session_id: "s-1",
    agent_type: "fhir-code-reviewer",
    agent_id: "a1b2c3",
    event: "SubagentStop",
    outcome: "stopped",
    kbd_phase: "agent-dev-team",
    kbd_change: "add-karpathy-agent-ledger",
  });
});

test("unrecorded events produce no entry", () => {
  assert.equal(entryFromHook({ hook_event_name: "PreToolUse" }, NOW, {}), null);
  assert.equal(entryFromHook({}, NOW, {}), null);
});

test("sanitizeId drops free text and oversize values", () => {
  assert.equal(sanitizeId("fhir-tech-lead"), "fhir-tech-lead");
  assert.equal(sanitizeId("mcp__plugin_x__tool"), "mcp__plugin_x__tool");
  assert.equal(sanitizeId("my-plugin:reviewer"), "my-plugin:reviewer");
  assert.equal(sanitizeId("John Doe"), undefined);
  assert.equal(sanitizeId("a".repeat(129)), undefined);
  assert.equal(sanitizeId(42), undefined);
  assert.equal(sanitizeId("postgres://u:p@h"), undefined, "DSN");
  assert.equal(sanitizeId("jane@example.org"), undefined, "email");
  assert.equal(sanitizeId("123-45-6789"), undefined, "SSN-shaped id");
  assert.equal(sanitizeId("0f8e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b"), "0f8e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b", "UUID");
});

test("makeEntry ignores non-allowlisted keys and requires ts/event", () => {
  const entry = makeEntry({ ts: "t", event: "boundary_degraded", outcome: "no-python", detail: "x" });
  assert.deepEqual(entry, { ts: "t", event: "boundary_degraded", outcome: "no-python" });
  assert.throws(() => makeEntry({ event: "x" }));
});

test("appendEntry writes exactly one line per call and parseLedger skips corrupt lines", () => {
  const root = mkdtempSync(path.join(tmpdir(), "ledger-"));
  try {
    appendEntry(root, makeEntry({ ts: "t1", event: "SubagentStart" }));
    appendEntry(root, makeEntry({ ts: "t2", event: "SubagentStop" }));
    const text = readFileSync(ledgerPath(root), "utf8");
    assert.equal(text.split("\n").filter(Boolean).length, 2);
    const parsed = parseLedger(`${text}{torn\n\n`);
    assert.deepEqual(parsed.map((e) => e.ts), ["t1", "t2"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readKbdPosition prefers nextChange and tolerates a missing waypoint", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kbd-"));
  try {
    assert.deepEqual(readKbdPosition(root), {});
    mkdirSync(path.join(root, ".kbd-orchestrator"));
    writeFileSync(
      path.join(root, ".kbd-orchestrator", "current-waypoint.json"),
      JSON.stringify({ phase: "p1", change: "old", nextChange: "c2" }),
    );
    assert.deepEqual(readKbdPosition(root), { phase: "p1", change: "c2" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
