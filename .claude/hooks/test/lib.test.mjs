// Tests run against the compiled dist/ so they exercise exactly what ships.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { parseInput, renderResult, deny, feedback, context, warn, allow } from "../dist/lib/hook-io.mjs";
import { toPosix, rel, projectDir } from "../dist/lib/paths.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const hookIoUrl = pathToFileURL(path.join(here, "..", "dist", "lib", "hook-io.mjs")).href;

/** Run a throwaway hook through runHook with the given stdin. */
function runInlineHook(handlerSource, stdin) {
  const script = `import { runHook, deny, allow } from ${JSON.stringify(hookIoUrl)};\n` +
    `await runHook("t", ${handlerSource});`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], { input: stdin, encoding: "utf8" });
}

test("parseInput rejects empty, non-JSON, and non-object input", () => {
  assert.equal(parseInput(""), null);
  assert.equal(parseInput("not json"), null);
  assert.equal(parseInput("[1,2]"), null);
  assert.equal(parseInput("null"), null);
  assert.deepEqual(parseInput('{"hook_event_name":"Stop"}'), { hook_event_name: "Stop" });
});

test("malformed stdin warns once and exits 0", () => {
  const r = runInlineHook("() => deny('should not run')", "{{{");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /warning: ignoring malformed hook input/);
  assert.equal(r.stderr.trim().split("\n").length, 1);
});

test("handler exceptions never block", () => {
  const r = runInlineHook("() => { throw new Error('boom'); }", '{"hook_event_name":"Stop"}');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /hook failed: boom/);
});

test("deny on PreToolUse emits a permission decision and exits 0", () => {
  const out = renderResult(deny("generated file"), "PreToolUse");
  assert.equal(out.exitCode, 0);
  assert.deepEqual(JSON.parse(out.stdout), {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "generated file",
    },
  });
});

test("deny on other events exits 2 with the reason on stderr", () => {
  const out = renderResult(deny("stop here"), "UserPromptSubmit");
  assert.equal(out.exitCode, 2);
  assert.equal(out.stderr, "stop here\n");
  const r = runInlineHook("() => deny('blocked')", '{"hook_event_name":"UserPromptSubmit"}');
  assert.equal(r.status, 2);
  assert.equal(r.stderr, "blocked\n");
});

test("feedback and context use hookSpecificOutput.additionalContext", () => {
  for (const [result, event] of [[feedback("fix header"), "PostToolUse"], [context("phase: x"), "SessionStart"]]) {
    const out = renderResult(result, event);
    assert.equal(out.exitCode, 0);
    const body = JSON.parse(out.stdout);
    assert.equal(body.hookSpecificOutput.hookEventName, event);
    assert.equal(typeof body.hookSpecificOutput.additionalContext, "string");
  }
});

test("warn uses systemMessage and allow is silent", () => {
  assert.deepEqual(JSON.parse(renderResult(warn("pk offline"), "Stop").stdout), { systemMessage: "pk offline" });
  assert.deepEqual(renderResult(allow(), "Stop"), { stdout: "", stderr: "", exitCode: 0 });
});

test("toPosix normalizes Windows separators", () => {
  assert.equal(toPosix("C:\\repo\\internal\\\\store\\x.go"), "C:/repo/internal/store/x.go");
  assert.equal(toPosix("a/b"), "a/b");
});

test("rel resolves POSIX, Windows, and relative targets", () => {
  assert.equal(rel("/repo", "/repo/internal/store/search.go"), "internal/store/search.go");
  assert.equal(rel("C:\\repo", "C:\\repo\\.kbd-orchestrator\\current-waypoint.json"), ".kbd-orchestrator/current-waypoint.json");
  assert.equal(rel("C:/Repo", "c:\\Repo\\a.go"), "a.go");
  assert.equal(rel("/repo", "./internal/./db/../db/schema.sql"), "internal/db/schema.sql");
  assert.equal(rel("/repo", "/repo"), "");
});

test("rel rejects paths outside the project", () => {
  assert.equal(rel("/repo", "/other/x.go"), null);
  assert.equal(rel("/repo", "/repository/x.go"), null);
  assert.equal(rel("/repo", "../secrets.txt"), null);
  assert.equal(rel("/repo", "a/../../b"), null);
  assert.equal(rel("/work/repo", "../repo/internal/x.go"), "internal/x.go", "climb out and back in");
});

test("projectDir prefers CLAUDE_PROJECT_DIR over cwd", () => {
  assert.equal(projectDir({ CLAUDE_PROJECT_DIR: "C:\\work\\repo" }, "/ignored"), "C:/work/repo");
  assert.equal(projectDir({}, "/tmp/x/"), "/tmp/x");
});
