import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSessionContext, MAX_CONTEXT_BYTES } from "../dist/lib/session.mjs";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "session-context.mjs");

function run(root) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { status: r.status, stdout: r.stdout };
}

test("active phase: context names the phase and next change", () => {
  const root = mkdtempSync(path.join(tmpdir(), "session-"));
  try {
    mkdirSync(path.join(root, ".kbd-orchestrator"));
    writeFileSync(path.join(root, ".kbd-orchestrator", "current-waypoint.json"), JSON.stringify({ phase: "agent-dev-team", nextChange: "add-guardrail-hooks", status: "ready", exactNextCommand: "/stale" }));
    writeFileSync(path.join(root, ".kbd-orchestrator", "position-reminder.txt"), "POSITION REMINDER\nPosition: agent-dev-team\n");
    const { status, stdout } = run(root);
    assert.equal(status, 0);
    const body = JSON.parse(stdout);
    assert.equal(body.hookSpecificOutput.hookEventName, "SessionStart");
    const text = body.hookSpecificOutput.additionalContext;
    assert.match(text, /Active phase: agent-dev-team/);
    assert.match(text, /Next change \(derived from task state\): add-guardrail-hooks/);
    assert.ok(!text.includes("/stale"), "exactNextCommand is not presented as next work");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no .kbd-orchestrator: silent exit 0", () => {
  const root = mkdtempSync(path.join(tmpdir(), "session-"));
  try {
    assert.deepEqual(run(root), { status: 0, stdout: "" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("context is bounded to 2 KB", () => {
  const text = buildSessionContext(JSON.stringify({ phase: "p" }), "x".repeat(10_000));
  assert.ok(Buffer.byteLength(text) <= MAX_CONTEXT_BYTES);
  assert.equal(buildSessionContext(undefined, undefined), undefined);
});
