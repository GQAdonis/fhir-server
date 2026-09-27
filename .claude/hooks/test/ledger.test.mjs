import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  LEDGER_FIELDS,
  entryFromHook,
  sanitizeId,
  acquireLedgerLock,
  appendEntry,
  ledgerDir,
  ledgerPath,
  parseLedger,
  readKbdPosition,
  makeEntry,
  isLedgerFile,
  ledgerKeyFindings,
  monthKey,
  rotateLedgerNow,
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

test("isLedgerFile recognizes agent-ledger.jsonl and ledger/<yyyy-mm>.jsonl only", () => {
  assert.equal(isLedgerFile("agent-ledger.jsonl"), true);
  assert.equal(isLedgerFile("ledger/2026-08.jsonl"), true);
  assert.equal(isLedgerFile("ledger/2026-8.jsonl"), false);
  assert.equal(isLedgerFile("raw/2026-08-note.md"), false);
  assert.equal(isLedgerFile("outbox/agent-ledger.jsonl.bak"), false);
});

test("ledgerKeyFindings flags a key outside LEDGER_FIELDS and ignores malformed lines", () => {
  const clean = JSON.stringify({ ts: "t", event: "SubagentStart", agent_type: "fhir-architect" });
  const dirty = JSON.stringify({ ts: "t", event: "SubagentStart", prompt_text: "leaked" });
  const findings = ledgerKeyFindings(`${clean}\n${dirty}\n{torn\n`);
  assert.deepEqual(findings, [{ line: 2, key: "prompt_text" }]);
  for (const key of Object.keys(JSON.parse(clean))) assert.ok(LEDGER_FIELDS.includes(key));
});

test("monthKey rejects years outside 1970-9999 so it never produces a key isLedgerFile can't match", () => {
  assert.equal(monthKey("2026-08-15T00:00:00.000Z"), "2026-08");
  assert.equal(monthKey("0099-01-01T00:00:00.000Z"), undefined, "3-digit year would break the ledger/<yyyy-mm>.jsonl pattern");
  assert.equal(monthKey("+275760-09-13T00:00:00.000Z"), undefined, "year above 9999");
});

// Cross-process reproduction: appendEntry and rotateLedgerNow must serialize
// through the same lock, so rotation's read-partition-rewrite can never
// silently drop a line appended in that window. A same-process async test
// cannot exercise this: the lock's retry wait is a genuine synchronous block
// (Atomics.wait), so it would freeze the test's own event loop too. A real
// child process gives us independent execution to observe the block from.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const ledgerModuleUrl = pathToFileURL(path.join(dist, "lib", "ledger.mjs")).href;

function runChild(code) {
  return spawn(process.execPath, ["--input-type=module", "-e", code]);
}

test("appendEntry waits for an externally held ledger lock instead of writing past it", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ledger-lock-"));
  try {
    const release = acquireLedgerLock(root, 5000);
    const child = runChild(
      `import { appendEntry, makeEntry } from ${JSON.stringify(ledgerModuleUrl)};\n` +
        `appendEntry(${JSON.stringify(root)}, makeEntry({ ts: "2026-09-24T12:00:00.000Z", event: "SubagentStart" }));\n`,
    );
    let exited = false;
    child.on("exit", () => {
      exited = true;
    });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(exited, false, "the append must block on the externally held lock, not proceed past it");
    assert.equal(existsSync(ledgerPath(root)), false, "no write happened while the lock was held");
    release();
    await new Promise((resolve, reject) => child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`child exited ${code}`)))));
    const lines = readFileSync(ledgerPath(root), "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rotateLedgerNow waits for an externally held ledger lock before reading, instead of racing a concurrent writer", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ledger-lock-"));
  try {
    mkdirSync(path.dirname(ledgerPath(root)), { recursive: true });
    writeFileSync(ledgerPath(root), `${JSON.stringify({ ts: "2026-07-01T00:00:00.000Z", event: "SubagentStart" })}\n`);
    const release = acquireLedgerLock(root, 5000);
    const child = runChild(
      `import { rotateLedgerNow } from ${JSON.stringify(ledgerModuleUrl)};\n` +
        `process.stdout.write(JSON.stringify(rotateLedgerNow(${JSON.stringify(root)}, "2026-09")));\n`,
    );
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    let exited = false;
    child.on("exit", () => {
      exited = true;
    });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(exited, false, "rotation must wait for the externally held lock before reading");
    assert.equal(existsSync(ledgerDir(root)), false, "no rotation happened while the lock was held");
    release();
    await new Promise((resolve, reject) => child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`child exited ${code}`)))));
    assert.equal(JSON.parse(out).moved, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("appendEntry refuses to follow a symlinked .prometheus directory or ledger file", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "ledger-symlink-"));
  const outside = mkdtempSync(path.join(tmpdir(), "ledger-symlink-target-"));
  try {
    try {
      symlinkSync(outside, path.join(root, ".prometheus"));
    } catch {
      t.skip("symlink creation not permitted in this environment");
      return;
    }
    assert.throws(() => appendEntry(root, makeEntry({ ts: "t", event: "SubagentStart" })), /symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("rotateLedgerNow refuses to follow a symlinked ledger directory or month file", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "ledger-symlink-"));
  const outside = mkdtempSync(path.join(tmpdir(), "ledger-symlink-target-"));
  try {
    mkdirSync(path.dirname(ledgerPath(root)), { recursive: true });
    writeFileSync(ledgerPath(root), `${JSON.stringify({ ts: "2026-07-01T00:00:00.000Z", event: "SubagentStart" })}\n`);
    try {
      symlinkSync(outside, ledgerDir(root));
    } catch {
      t.skip("symlink creation not permitted in this environment");
      return;
    }
    assert.throws(() => rotateLedgerNow(root, "2026-09"), /symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
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
