import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { activeAgentType, clearAgentScope, isWithinOwnedScope, recordAgentStart, rolesWithScope } from "../dist/lib/agent-scope.mjs";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "agent-scope-guard.mjs");

function sandboxRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "agent-scope-guard-"));
  mkdirSync(path.join(root, ".agent-team"), { recursive: true });
  writeFileSync(
    path.join(root, ".agent-team", "team.json"),
    JSON.stringify({
      roles: [
        { id: "fhir-tech-lead", owns: [".kbd-orchestrator/phases/*/execution.md", ".prometheus/raw/**"] },
        { id: "fhir-go-developer", owns: [] },
      ],
    }),
  );
  return root;
}

function run(root, payload) {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  return { status: r.status, body: r.stdout === "" ? null : JSON.parse(r.stdout) };
}

test("lib: session state round-trips through SubagentStart/Stop", () => {
  const id = `test-${Math.random().toString(36).slice(2)}`;
  assert.equal(activeAgentType(id), undefined);
  recordAgentStart(id, "fhir-tech-lead");
  assert.equal(activeAgentType(id), "fhir-tech-lead");
  clearAgentScope(id);
  assert.equal(activeAgentType(id), undefined);
});

test("lib: isWithinOwnedScope matches the manifest owns globs, and is undefined for an unscoped/unknown role", () => {
  const root = sandboxRepo();
  try {
    assert.equal(isWithinOwnedScope(root, "fhir-tech-lead", ".kbd-orchestrator/phases/p1/execution.md"), true);
    assert.equal(isWithinOwnedScope(root, "fhir-tech-lead", "internal/store/search.go"), false);
    assert.equal(isWithinOwnedScope(root, "fhir-go-developer", "internal/handler/x.go"), undefined, "empty owns: nothing to enforce");
    assert.equal(isWithinOwnedScope(root, "no-such-role", "internal/handler/x.go"), undefined);
    assert.deepEqual(rolesWithScope(root).map((r) => r.id).sort(), ["fhir-go-developer", "fhir-tech-lead"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: SubagentStart records the persona, then an allowed path is allowed and a denied path is denied", () => {
  const root = sandboxRepo();
  const sessionId = `s-${Math.random().toString(36).slice(2)}`;
  try {
    const started = run(root, { hook_event_name: "SubagentStart", session_id: sessionId, agent_type: "fhir-tech-lead" });
    assert.equal(started.status, 0);
    assert.equal(started.body, null);

    const allowed = run(root, {
      hook_event_name: "PreToolUse",
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: { file_path: path.join(root, ".prometheus", "raw", "note.md") },
    });
    assert.equal(allowed.status, 0);
    assert.equal(allowed.body, null);

    const denied = run(root, {
      hook_event_name: "PreToolUse",
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: { file_path: path.join(root, "internal", "store", "search.go") },
    });
    assert.equal(denied.status, 0);
    assert.equal(denied.body?.hookSpecificOutput?.permissionDecision, "deny");
    assert.match(denied.body.hookSpecificOutput.permissionDecisionReason, /outside fhir-tech-lead's documented write scope/);
  } finally {
    clearAgentScope(sessionId);
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: SubagentStop clears the scope, so a later edit in the same session is unaffected", () => {
  const root = sandboxRepo();
  const sessionId = `s-${Math.random().toString(36).slice(2)}`;
  try {
    run(root, { hook_event_name: "SubagentStart", session_id: sessionId, agent_type: "fhir-tech-lead" });
    run(root, { hook_event_name: "SubagentStop", session_id: sessionId });
    const after = run(root, {
      hook_event_name: "PreToolUse",
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: { file_path: path.join(root, "internal", "store", "search.go") },
    });
    assert.equal(after.body, null, "no active scope after SubagentStop: not this guard's concern");
  } finally {
    clearAgentScope(sessionId);
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: a non-tech-lead agent is unaffected, even editing a path outside fhir-tech-lead's scope", () => {
  const root = sandboxRepo();
  const sessionId = `s-${Math.random().toString(36).slice(2)}`;
  try {
    run(root, { hook_event_name: "SubagentStart", session_id: sessionId, agent_type: "fhir-go-developer" });
    const result = run(root, {
      hook_event_name: "PreToolUse",
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: { file_path: path.join(root, "internal", "store", "search.go") },
    });
    assert.equal(result.body, null);
  } finally {
    clearAgentScope(sessionId);
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: no active scope at all (e.g. the main session, or a harness that never fires SubagentStart) is unaffected", () => {
  const root = sandboxRepo();
  const sessionId = `s-${Math.random().toString(36).slice(2)}`;
  const result = run(root, {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Edit",
    tool_input: { file_path: path.join(root, "internal", "store", "search.go") },
  });
  assert.equal(result.status, 0);
  assert.equal(result.body, null);
  rmSync(root, { recursive: true, force: true });
});

test("hook: malformed input and a missing manifest never block", () => {
  const bare = mkdtempSync(path.join(tmpdir(), "agent-scope-guard-bare-"));
  const sessionId = `s-${Math.random().toString(36).slice(2)}`;
  try {
    run(bare, { hook_event_name: "SubagentStart", session_id: sessionId, agent_type: "fhir-tech-lead" });
    const result = run(bare, {
      hook_event_name: "PreToolUse",
      session_id: sessionId,
      tool_name: "Edit",
      tool_input: { file_path: path.join(bare, "internal", "store", "search.go") },
    });
    assert.equal(result.status, 0);
    assert.equal(result.body, null, "no manifest: nothing to enforce");

    const r = spawnSync(process.execPath, [hook], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /malformed/);
  } finally {
    clearAgentScope(sessionId);
    rmSync(bare, { recursive: true, force: true });
  }
});
