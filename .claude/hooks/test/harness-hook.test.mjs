import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { editedPaths, guardInputs, ledgerInput } from "../dist/lib/harness-payload.mjs";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "harness-hook.mjs");

function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), "harness-hook-"));
  mkdirSync(path.join(root, ".prometheus"), { recursive: true });
  return root;
}

function run(harness, hook, payload) {
  const r = spawnSync(process.execPath, [cli, "--harness", harness, "--hook", hook], { input: JSON.stringify(payload), encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const PATCH = (file) => `*** Begin Patch\n*** Update File: ${file}\n@@\n-a\n+b\n*** End Patch\n`;

test("editedPaths finds direct path fields, nested edits and patch headers", () => {
  assert.deepEqual(editedPaths({ file_path: "a.go" }), ["a.go"]);
  assert.deepEqual(editedPaths({ filePath: "b.go" }), ["b.go"]);
  assert.deepEqual(editedPaths({ path: "c.go" }), ["c.go"]);
  assert.deepEqual(editedPaths({ edits: [{ file_path: "d.go" }, { file_path: "e.go" }] }), ["d.go", "e.go"]);
  assert.deepEqual(editedPaths({ command: `*** Begin Patch\n*** Add File: x/new.go\n*** Update File: y.go\n*** Move to: z.go\n*** Delete File: old.go\n*** End Patch` }), ["x/new.go", "y.go", "z.go", "old.go"]);
  assert.deepEqual(editedPaths({ command: "ls -la" }), []);
});

test("non-writing tools produce no guard inputs", () => {
  assert.deepEqual(guardInputs("codex", { tool_name: "shell", tool_input: { command: "cat x" } }), []);
  assert.deepEqual(guardInputs("opencode", { tool: "read", args: { filePath: "x" } }), []);
  assert.equal(guardInputs("kimi", { tool_name: "WriteFile", tool_input: { path: "x" } }).length, 1);
});

const PROTECTED = "internal/basedef/profiles-types.min.json.gz";
const cases = [
  ["codex", (root, f) => ({ hook_event_name: "PreToolUse", cwd: root, tool_name: "apply_patch", tool_input: { command: PATCH(f) } })],
  ["opencode", (root, f) => ({ tool: "edit", directory: root, args: { filePath: path.join(root, f) } })],
  ["opencode", (root, f) => ({ tool: "patch", directory: root, args: { patchText: PATCH(f) } })],
  ["kimi", (root, f) => ({ hook_event_name: "PreToolUse", cwd: root, tool_name: "WriteFile", tool_input: { path: path.join(root, f) } })],
  ["minimax", (root, f) => ({ hook_event_name: "PreToolUse", cwd: root, tool_name: "Write", tool_input: { file_path: f } })],
];

for (const [harness, make] of cases) {
  test(`${harness}: a protected-path edit is denied in the native contract; an ordinary edit is allowed`, () => {
    const root = sandbox();
    try {
      const denied = run(harness, "guard", make(root, PROTECTED));
      assert.equal(denied.status, 0, denied.stderr);
      const out = JSON.parse(denied.stdout);
      if (harness === "opencode") {
        assert.equal(out.decision, "deny");
        assert.match(out.reason, /make refresh-definitions/);
      } else {
        assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
        assert.match(out.hookSpecificOutput.permissionDecisionReason, /is protected/);
      }
      const allowed = run(harness, "guard", make(root, "internal/handler/x.go"));
      assert.equal(allowed.status, 0);
      assert.equal(allowed.stdout, "");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("generated agent files are protected for every harness", () => {
  const root = sandbox();
  try {
    const out = JSON.parse(run("codex", "guard", { hook_event_name: "PreToolUse", cwd: root, tool_name: "apply_patch", tool_input: { command: PATCH(".codex/agents/fhir-architect.toml") } }).stdout);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /Generated from the team manifest/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ledger: a harness session start appends one metadata-only line", () => {
  const root = sandbox();
  try {
    assert.equal(ledgerInput("codex", { hook_event_name: "Stop" }), undefined, "per-turn Stop is not recorded");
    const r = run("codex", "ledger", { hook_event_name: "SessionStart", session_id: "s-1", cwd: root });
    assert.equal(r.status, 0, r.stderr);
    const file = path.join(root, ".prometheus", "agent-ledger.jsonl");
    assert.ok(existsSync(file));
    const lines = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].event, "SubagentStart");
    assert.equal(lines[0].agent_type, "codex");
    const opencode = run("opencode", "ledger", { hook_event_name: "session.error", sessionID: "s-2", directory: root, tool: "bash" });
    assert.equal(opencode.status, 0);
    assert.equal(readFileSync(file, "utf8").trim().split("\n").length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("bad usage and malformed input never block (exit 0 with a warning)", () => {
  const bad = spawnSync(process.execPath, [cli, "--harness", "nope", "--hook", "guard"], { input: "{}", encoding: "utf8" });
  assert.equal(bad.status, 0);
  assert.match(bad.stderr, /usage/);
  const malformed = spawnSync(process.execPath, [cli, "--harness", "codex", "--hook", "guard"], { input: "not json", encoding: "utf8" });
  assert.equal(malformed.status, 0);
  assert.match(malformed.stderr, /malformed/);
});

test("the OpenCode project plugin blocks a protected edit and records sessions (loaded as OpenCode does)", async () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const { FhirGuards } = await import(pathToFileURL(path.join(repo, ".opencode", "plugins", "fhir-guards.js")).href);
  const root = sandbox();
  try {
    // The plugin resolves the adapter from the project directory: the real repo has it, the sandbox does not.
    const hooks = await FhirGuards({ directory: repo });
    await assert.rejects(
      hooks["tool.execute.before"]({ tool: "write", sessionID: "t" }, { args: { filePath: path.join(repo, "internal", "basedef", "x.gz") } }),
      /is protected/,
    );
    await hooks["tool.execute.before"]({ tool: "write", sessionID: "t" }, { args: { filePath: path.join(repo, "internal", "handler", "x.go") } });
    await hooks["tool.execute.before"]({ tool: "read", sessionID: "t" }, { args: { filePath: path.join(repo, "AGENTS.md") } });
    const sandboxHooks = await FhirGuards({ directory: root });
    await sandboxHooks["tool.execute.before"]({ tool: "write" }, { args: { filePath: path.join(root, "x") } }); // no adapter in sandbox: allow
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the Kimi/MiniMax launcher runs only for allowlisted repositories", async () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const launcher = path.join(repo, "scripts", "agent-team", "plugins", "fhir-guards", "hooks", "run.mjs");
  const cfgDir = mkdtempSync(path.join(tmpdir(), "fhir-guards-cfg-"));
  const env = { ...process.env, FHIR_GUARDS_CONFIG: path.join(cfgDir, "roots.json") };
  const payload = JSON.stringify({ hook_event_name: "PreToolUse", cwd: path.join(repo, "internal", "store"), tool_name: "WriteFile", tool_input: { path: path.join(repo, "AGENTS.md") } });
  const launch = () => spawnSync(process.execPath, [launcher, "kimi", "guard"], { input: payload, encoding: "utf8", env });
  try {
    // Not allowed yet: the repo's adapter must not run at all.
    const before = launch();
    assert.equal(before.status, 0);
    assert.equal(before.stdout, "");
    // Allow the repo (by a subdirectory; the git top level is recorded).
    const refused = spawnSync(process.execPath, [launcher, "--allow", path.join(repo, "internal")], { encoding: "utf8", env, stdio: ["pipe", "pipe", "pipe"] });
    assert.equal(refused.status, 1, "non-interactive --allow without --yes is refused");
    const allowed = spawnSync(process.execPath, [launcher, "--allow", path.join(repo, "internal"), "--yes"], { encoding: "utf8", env });
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.deepEqual(JSON.parse(readFileSync(env.FHIR_GUARDS_CONFIG, "utf8")).roots, [repo]);
    const after = launch();
    // Importing the launcher (not running it) must not do anything, even with --allow in argv.
    const imported = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(launcher).href)})`, "--", "--allow", "/tmp", "--yes"], { encoding: "utf8", env });
    assert.equal(imported.status, 0);
    assert.deepEqual(JSON.parse(readFileSync(env.FHIR_GUARDS_CONFIG, "utf8")).roots, [repo], "import did not modify the allowlist");
    assert.match(JSON.parse(after.stdout).hookSpecificOutput.permissionDecisionReason, /AGENTS\.md is protected/);
    // Another (non-allowed) git repo containing an adapter-shaped file is ignored.
    const evil = mkdtempSync(path.join(tmpdir(), "evil-repo-"));
    mkdirSync(path.join(evil, ".git"));
    mkdirSync(path.join(evil, ".claude", "hooks", "dist"), { recursive: true });
    writeFileSync(path.join(evil, ".claude", "hooks", "dist", "harness-hook.mjs"), "console.log('PWNED')\n");
    const r = spawnSync(process.execPath, [launcher, "kimi", "ledger"], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: evil }), encoding: "utf8", env });
    assert.equal(r.stdout, "");
    // An allowlist file inside the judged repo is ignored.
    writeFileSync(path.join(evil, "roots.json"), JSON.stringify({ roots: [realpathSync.native(evil)] }));
    const self = spawnSync(process.execPath, [launcher, "kimi", "ledger"], { input: JSON.stringify({ hook_event_name: "SessionStart", cwd: evil }), encoding: "utf8", env: { ...env, FHIR_GUARDS_CONFIG: path.join(evil, "roots.json") } });
    assert.equal(self.stdout, "");
    rmSync(evil, { recursive: true, force: true });
  } finally {
    rmSync(cfgDir, { recursive: true, force: true });
  }
});

test("a session in a subdirectory is guarded against root-relative paths", () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const sub = path.join(repo, "internal", "store");
  const patch = (f) => ({ hook_event_name: "PreToolUse", cwd: sub, tool_name: "apply_patch", tool_input: { command: `*** Begin Patch\n  *** Update File: ${f}\n*** End Patch` } });
  // Relative paths are relative to the session directory, not the repo root.
  assert.match(JSON.parse(run("codex", "guard", patch("../../AGENTS.md")).stdout).hookSpecificOutput.permissionDecisionReason, /^AGENTS\.md is protected/);
  assert.match(JSON.parse(run("codex", "guard", patch("testdata/golden.json")).stdout).hookSpecificOutput.permissionDecisionReason, /internal\/store\/testdata\/golden\.json is protected/);
  assert.equal(run("codex", "guard", patch("AGENTS.md")).stdout, "", "internal/store/AGENTS.md is not protected");
  const kimi = run("kimi", "guard", { hook_event_name: "PreToolUse", cwd: sub, tool_name: "WriteFile", tool_input: { path: "../../AGENTS.md" } });
  assert.match(JSON.parse(kimi.stdout).hookSpecificOutput.permissionDecisionReason, /AGENTS\.md is protected/);
});
