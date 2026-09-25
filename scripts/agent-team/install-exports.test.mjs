// Tests for install-exports.mjs: node --test scripts/agent-team/install-exports.test.mjs
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { applyPlan, CODEX_BEGIN, CODEX_END, codexConfigText, mergeCodexConfig, MARKER, planTarget, TARGETS } from "./install-exports.mjs";

function fixture(ids) {
  const root = mkdtempSync(path.join(os.tmpdir(), "inst-root-"));
  const exp = mkdtempSync(path.join(os.tmpdir(), "inst-exp-"));
  for (const id of ids) {
    for (const [target, spec] of Object.entries(TARGETS)) {
      const f = path.join(exp, target, spec.exported(id));
      mkdirSync(path.dirname(f), { recursive: true });
      writeFileSync(f, `${target}:${id}\n`);
    }
  }
  return { root, exp: (t) => path.join(exp, t) };
}

const install = (root, exp, ids) => {
  for (const t of Object.keys(TARGETS)) applyPlan(root, t, ids, planTarget(root, t, ids, exp(t)));
};

test("install writes every role for every harness and is idempotent", () => {
  const { root, exp } = fixture(["a", "b"]);
  install(root, exp, ["a", "b"]);
  assert.equal(readFileSync(path.join(root, ".minimax/agents/b/agent.md"), "utf8"), "minimax:b\n");
  assert.equal(readFileSync(path.join(root, ".codex/agents/a.toml"), "utf8"), "codex:a\n");
  for (const t of Object.keys(TARGETS)) {
    const plan = planTarget(root, t, ["a", "b"], exp(t));
    assert.deepEqual([plan.writes.length, plan.stale.length, plan.markerStale], [0, 0, false], t);
  }
});

test("non-team files in a target directory are never touched", () => {
  const { root, exp } = fixture(["a"]);
  mkdirSync(path.join(root, ".claude/agents"), { recursive: true });
  writeFileSync(path.join(root, ".claude/agents/someone-else.md"), "keep me\n");
  install(root, exp, ["a"]);
  assert.equal(readFileSync(path.join(root, ".claude/agents/someone-else.md"), "utf8"), "keep me\n");
});

test("a hand edit is reported as drift and repaired by install", () => {
  const { root, exp } = fixture(["a"]);
  install(root, exp, ["a"]);
  writeFileSync(path.join(root, ".opencode/agents/a.md"), "hand edit\n");
  const plan = planTarget(root, "opencode", ["a"], exp("opencode"));
  assert.deepEqual(plan.writes.map((w) => w.why), ["content differs"]);
  applyPlan(root, "opencode", ["a"], plan);
  assert.equal(readFileSync(path.join(root, ".opencode/agents/a.md"), "utf8"), "opencode:a\n");
});

test("comparison is byte-exact: a CRLF copy is drift (.gitattributes keeps generated files LF)", () => {
  const { root, exp } = fixture(["a"]);
  install(root, exp, ["a"]);
  writeFileSync(path.join(root, ".kimi-code/agents/a.md"), "kimi:a\r\n");
  writeFileSync(path.join(root, ".kimi-code/agents", MARKER), readFileSync(path.join(root, ".kimi-code/agents", MARKER), "utf8").replace(/\n/g, "\r\n"));
  const plan = planTarget(root, "kimi", ["a"], exp("kimi"));
  assert.deepEqual([plan.writes.length, plan.markerStale], [1, true]);
});

test("a role dropped from the roster is removed, including MiniMax directories", () => {
  const { root, exp } = fixture(["a", "b"]);
  install(root, exp, ["a", "b"]);
  const plan = planTarget(root, "minimax", ["a"], exp("minimax"));
  assert.deepEqual(plan.stale, ["b"]);
  applyPlan(root, "minimax", ["a"], plan);
  assert.equal(existsSync(path.join(root, ".minimax/agents/b")), false);
  assert.equal(existsSync(path.join(root, ".minimax/agents/a/agent.md")), true);
});

test("refuses unsafe role ids and missing exports", () => {
  const { root, exp } = fixture(["a"]);
  assert.throws(() => planTarget(root, "claude", ["../escape"], exp("claude")), /unsafe role id/);
  assert.throws(() => planTarget(root, "claude", ["a", "missing"], exp("claude")), /export has no file for missing/);
});

test("codexConfigText registers every role with a relative config_file", () => {
  const text = codexConfigText({ roles: [{ id: "a", description: 'Says "hi"' }, { id: "b", description: "B" }] });
  assert.match(text, /\[agents\.a\]\ndescription = "Says \\"hi\\""\nconfig_file = "agents\/a\.toml"/);
  assert.match(text, /\[agents\.b\]/);
  assert.ok(text.startsWith(CODEX_BEGIN) && text.trimEnd().endsWith(CODEX_END));
});

test("refuses a symlinked export file", (t) => {
  const { root, exp } = fixture(["a"]);
  const f = path.join(exp("claude"), TARGETS.claude.exported("a"));
  rmSync(f);
  try {
    symlinkSync("/etc/hosts", f);
  } catch {
    t.skip("symlinks not permitted on this platform");
    return;
  }
  assert.throws(() => planTarget(root, "claude", ["a"], exp("claude")), /refusing non-regular export file/);
});

test("the Claude marker is byte-compared like the others (a CRLF copy is drift)", () => {
  const { root, exp } = fixture(["a"]);
  install(root, exp, ["a"]);
  const m = path.join(root, ".claude/agents", MARKER);
  writeFileSync(m, readFileSync(m, "utf8").replace(/\n/g, "\r\n"));
  assert.equal(planTarget(root, "claude", ["a"], exp("claude")).markerStale, true);
});

test("refuses to write through an installed-path symlink or a directory that escapes the repo", (t) => {
  const { root, exp } = fixture(["a"]);
  const outside = mkdtempSync(path.join(os.tmpdir(), "inst-outside-"));
  mkdirSync(path.join(root, ".claude/agents"), { recursive: true });
  try {
    symlinkSync(path.join(outside, "victim.md"), path.join(root, ".claude/agents/a.md"));
  } catch {
    t.skip("symlinks not permitted on this platform");
    return;
  }
  assert.throws(() => planTarget(root, "claude", ["a"], exp("claude")), /refusing to overwrite non-regular file/);
  symlinkSync(outside, path.join(root, ".codex"));
  assert.throws(() => planTarget(root, "codex", ["a"], exp("codex")), /resolves outside the repository/);
  assert.equal(existsSync(path.join(outside, "victim.md")), false);
});

test("mergeCodexConfig preserves native settings outside the generated block", () => {
  const block = codexConfigText({ roles: [{ id: "a", description: "A" }] });
  assert.equal(mergeCodexConfig(undefined, block), block);
  const native = 'model = "x"\n\n[profiles.dev]\napproval_policy = "on-request"\n';
  const merged = mergeCodexConfig(native, block);
  assert.ok(merged.startsWith(native));
  assert.ok(merged.endsWith(block));
  // Re-running replaces only the block and is idempotent.
  const newer = codexConfigText({ roles: [{ id: "b", description: "B" }] });
  const again = mergeCodexConfig(merged, newer);
  assert.ok(again.startsWith(native) && again.includes("[agents.b]") && !again.includes("[agents.a]"));
  assert.equal(mergeCodexConfig(again, newer), again);
  assert.throws(() => mergeCodexConfig(`${CODEX_END}\n${CODEX_BEGIN}\n`, block), /damaged agent-team block/);
});
