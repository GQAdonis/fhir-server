import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { globMatch, protectionFor, targetPath, PROTECTED_PATHS } from "../dist/lib/protected-paths.mjs";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "guard-generated.mjs");

function run(projectDir, filePath, tool = "Write") {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: { file_path: filePath } }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
  return { status: r.status, body: r.stdout === "" ? null : JSON.parse(r.stdout) };
}

test("glob matcher handles * within a segment and ** across segments", () => {
  assert.ok(globMatch("internal/basedef/*.gz", "internal/basedef/profiles-types.min.json.gz"));
  assert.ok(!globMatch("internal/basedef/*.gz", "internal/basedef/sub/x.gz"));
  assert.ok(globMatch("internal/store/testdata/**", "internal/store/testdata/a/b/golden.json"));
  assert.ok(globMatch(".kbd-orchestrator/phases/*/progress.json", ".kbd-orchestrator/phases/agent-dev-team/progress.json"));
  assert.ok(!globMatch(".kbd-orchestrator/phases/*/progress.json", ".kbd-orchestrator/phases/p/plan.md"));
  assert.ok(globMatch("internal/basedef/*.gz", "Internal/BaseDef/Profiles.GZ"), "case-insensitive");
});

const PROTECTED = [
  "internal/basedef/profiles-types.min.json.gz",
  "internal/store/testdata/bundle_golden.json",
  ".claude/hooks/dist/agent-ledger.mjs",
  ".kbd-orchestrator/phases/agent-dev-team/progress.json",
  ".kbd-orchestrator/current-waypoint.json",
  ".kbd-orchestrator/current-waypoint.md",
  ".kbd-orchestrator/position-reminder.txt",
  ".claude/agents/fhir-architect.md",
  ".codex/agents/fhir-architect.toml",
  ".opencode/agents/fhir-architect.md",
  ".kimi-code/agents/fhir-architect.md",
  ".minimax/agents/fhir-architect/agent.md",
  ".agent-team/team.json",
  "AGENTS.md",
];

for (const p of PROTECTED) {
  test(`denies ${p} (relative, absolute POSIX, and Windows forms)`, () => {
    for (const [root, target] of [["/repo", p], ["/repo", `/repo/${p}`], ["C:\\repo", `C:\\repo\\${p.split("/").join("\\")}`]]) {
      const { status, body } = run(root, target);
      assert.equal(status, 0);
      assert.equal(body?.hookSpecificOutput?.permissionDecision, "deny", `${target} under ${root}`);
      assert.match(body.hookSpecificOutput.permissionDecisionReason, /is protected\./);
    }
  });
}

test("relative paths that climb out and back in are still denied", () => {
  for (const target of ["../repo/internal/basedef/x.gz", "internal/../internal/basedef/x.gz", "./.kbd-orchestrator/current-waypoint.json"]) {
    const { body } = run("/work/repo", target);
    assert.equal(body?.hookSpecificOutput?.permissionDecision, "deny", target);
  }
});

test("basedef denial names make refresh-definitions", () => {
  const { body } = run("/repo", "/repo/internal/basedef/profiles-types.min.json.gz");
  assert.match(body.hookSpecificOutput.permissionDecisionReason, /make refresh-definitions/);
});

test("ordinary source files and outside paths are allowed", () => {
  for (const target of ["/repo/internal/store/search.go", "/repo/.claude/hooks/src/agent-ledger.mts", "/elsewhere/internal/basedef/x.gz", "/repo/.kbd-orchestrator/phases/p/plan.md"]) {
    const { status, body } = run("/repo", target);
    assert.equal(status, 0);
    assert.equal(body, null, target);
  }
});

test("tool calls without a file path are allowed", () => {
  assert.equal(targetPath({ command: "ls" }), undefined);
  assert.equal(targetPath({ notebook_path: "/repo/x.ipynb" }), "/repo/x.ipynb");
  assert.equal(protectionFor("go.mod"), undefined);
  assert.equal(PROTECTED_PATHS.length, 14);
});
