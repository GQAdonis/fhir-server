import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "agent-ledger.mjs");

function run(root, payload) {
  return spawnSync(process.execPath, [hook], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
}

test("SubagentStop fixture appends exactly one valid ledger line", () => {
  const root = mkdtempSync(path.join(tmpdir(), "agent-ledger-"));
  try {
    const r = run(root, { hook_event_name: "SubagentStop", agent_type: "fhir-architect", agent_id: "x1", session_id: "s1" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, "");
    const lines = readFileSync(path.join(root, ".prometheus", "agent-ledger.jsonl"), "utf8").split("\n").filter(Boolean);
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.event, "SubagentStop");
    assert.equal(entry.agent_type, "fhir-architect");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unrecorded events and malformed input write nothing and exit 0", () => {
  const root = mkdtempSync(path.join(tmpdir(), "agent-ledger-"));
  try {
    assert.equal(run(root, { hook_event_name: "PreToolUse", tool_name: "Edit" }).status, 0);
    assert.equal(run(root, "not json").status, 0);
    assert.equal(existsSync(path.join(root, ".prometheus", "agent-ledger.jsonl")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
