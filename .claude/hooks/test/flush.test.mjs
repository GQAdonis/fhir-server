import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { flush, renderNote, readDelta } from "../dist/lib/flush.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const hook = path.join(here, "..", "dist", "karpathy-flush.mjs");
const NOW = new Date("2026-09-24T13:00:00.000Z");

function fixture(lines) {
  const root = mkdtempSync(path.join(tmpdir(), "flush-"));
  mkdirSync(path.join(root, ".prometheus"), { recursive: true });
  const text = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  writeFileSync(path.join(root, ".prometheus", "agent-ledger.jsonl"), text);
  return root;
}

/** A fake `pk` that records its argv, cross-platform (run through node). */
function fakePk(root, exitCode) {
  const script = path.join(root, "fake-pk.mjs");
  writeFileSync(script, `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(path.join(root, "pk-calls.txt"))}, process.argv.slice(2).join(" ") + "\\n");\nprocess.exit(${exitCode});\n`);
  return script;
}

const LINES = [
  { ts: "2026-09-24T12:00:00.000Z", event: "SubagentStart", outcome: "started", session_id: "s1", agent_type: "fhir-architect", kbd_phase: "agent-dev-team", kbd_change: "c1" },
  { ts: "2026-09-24T12:05:00.000Z", event: "SubagentStop", outcome: "stopped", session_id: "s1", agent_type: "fhir-architect" },
  { ts: "2026-09-24T12:06:00.000Z", event: "PostToolUseFailure", outcome: "failed", session_id: "s1", tool_name: "Bash" },
];

test("renderNote is a metadata summary", () => {
  const note = renderNote(LINES);
  assert.match(note, /\| `fhir-architect` \| 1 \| 1 \| 0 \| 0 \|/);
  assert.match(note, /- `Bash`: 1/);
  assert.match(note, /Ledger lines summarized: 3/);
});

test("clean flush writes a note, ingests it, and advances the cursor", () => {
  const root = fixture(LINES);
  try {
    const result = flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 0) });
    assert.equal(result.status, "ingested");
    assert.ok(existsSync(result.note));
    const calls = readFileSync(path.join(root, "pk-calls.txt"), "utf8");
    assert.match(calls, /^ingest --scope project --source claude-hooks .*agent-activity\.md\n$/);
    assert.equal(readdirSync(path.join(root, ".prometheus", "outbox")).length, 0, "delivered note leaves the outbox");
    assert.equal(flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 0) }).status, "empty");
    assert.equal(readDelta(root).entries.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("seeded SSN blocks the note: nothing written to raw/, flush_blocked recorded", () => {
  const root = fixture([{ ts: "2026-09-24T12:00:00.000Z", event: "SubagentStop", outcome: "stopped", session_id: "123-45-6789" }]);
  try {
    const result = flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 0) });
    assert.deepEqual(result, { status: "blocked", matches: 1 });
    const raw = path.join(root, ".prometheus", "raw");
    assert.ok(!existsSync(raw) || readdirSync(raw).length === 0);
    assert.ok(!existsSync(path.join(root, "pk-calls.txt")));
    const ledger = readFileSync(path.join(root, ".prometheus", "agent-ledger.jsonl"), "utf8");
    const last = JSON.parse(ledger.trim().split("\n").pop());
    assert.equal(last.event, "flush_blocked");
    assert.equal(last.outcome, "blocked:1");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pk absent: note queued in outbox, hook exits 0 with a warning", () => {
  const root = fixture(LINES);
  try {
    const r = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ hook_event_name: "Stop", session_id: "s1" }),
      encoding: "utf8",
      env: { ...process.env, KARPATHY_FLUSH_SYNC: "1", CLAUDE_PROJECT_DIR: root, PK_BIN: path.join(root, "no-such-pk-binary") },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(JSON.parse(r.stdout).systemMessage, /pk not found; session note queued/);
    assert.equal(readdirSync(path.join(root, ".prometheus", "outbox")).length, 1);
    assert.equal(readdirSync(path.join(root, ".prometheus", "raw")).filter((f) => f.endsWith(".md")).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pk failure exit code queues the note too", () => {
  const root = fixture(LINES);
  try {
    const result = flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 3) });
    assert.equal(result.status, "queued");
    assert.equal(result.reason, "pk exited 3");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("partial trailing line is left for the next flush", () => {
  const root = fixture(LINES);
  try {
    appendFileSync(path.join(root, ".prometheus", "agent-ledger.jsonl"), '{"ts":"x","event":"Sub');
    const { entries } = readDelta(root);
    assert.equal(entries.length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("two flushes at the same instant never overwrite each other", () => {
  const root = fixture(LINES);
  try {
    const env = { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 1) };
    const first = flush(root, NOW, env);
    appendFileSync(path.join(root, ".prometheus", "agent-ledger.jsonl"), JSON.stringify(LINES[0]) + "\n");
    const second = flush(root, NOW, env);
    assert.notEqual(first.note, second.note);
    assert.equal(readdirSync(path.join(root, ".prometheus", "raw")).filter((f) => f.endsWith(".md")).length, 2);
    assert.equal(readdirSync(path.join(root, ".prometheus", "outbox")).length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a held lock makes a concurrent flush a no-op", () => {
  const root = fixture(LINES);
  try {
    writeFileSync(path.join(root, ".prometheus", ".flush.lock"), "");
    assert.equal(flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 0) }).status, "locked");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("default mode returns queued-async and a detached drainer empties the outbox", async () => {
  const root = fixture(LINES);
  try {
    const result = flush(root, NOW, { ...process.env, PK_BIN: fakePk(root, 0) });
    assert.equal(result.status, "queued-async");
    const outbox = path.join(root, ".prometheus", "outbox");
    const ledgerFile = path.join(root, ".prometheus", "agent-ledger.jsonl");
    // The detached drainer empties the outbox and then appends its ledger line;
    // wait for both (up to 20 s under load) before asserting.
    const drained = () => readdirSync(outbox).length === 0 && /"event":"kb_ingested"/.test(readFileSync(ledgerFile, "utf8"));
    for (let i = 0; i < 200 && !drained(); i++) await new Promise((r) => setTimeout(r, 100));
    assert.equal(readdirSync(outbox).length, 0);
    assert.match(readFileSync(ledgerFile, "utf8"), /"event":"kb_ingested","outcome":"delivered:1,remaining:0"/);
  } finally {
    // The drainer may still be closing files; retry instead of failing with ENOTEMPTY.
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("a failed delivery stays queued and is retried by the next drain", () => {
  const root = fixture(LINES);
  try {
    assert.equal(flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 1) }).status, "queued");
    const outbox = path.join(root, ".prometheus", "outbox");
    assert.equal(readdirSync(outbox).length, 1);
    const drain = spawnSync(process.execPath, [path.join(here, "..", "dist", "pk-drain.mjs"), root], {
      encoding: "utf8",
      env: { ...process.env, PK_BIN: fakePk(root, 0) },
    });
    assert.equal(drain.status, 0);
    assert.match(drain.stdout, /delivered 1, remaining 0/);
    assert.equal(readdirSync(outbox).length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed note write does not advance the cursor", () => {
  const root = fixture(LINES);
  try {
    // A file where the raw/ directory should be makes mkdir/write fail.
    writeFileSync(path.join(root, ".prometheus", "raw"), "not a directory");
    assert.throws(() => flush(root, NOW, { ...process.env, KARPATHY_FLUSH_SYNC: "1", PK_BIN: fakePk(root, 0) }));
    assert.equal(readDelta(root).entries.length, 3, "delta must still be pending");
    assert.ok(!existsSync(path.join(root, ".prometheus", ".flush.lock")), "lock released");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
