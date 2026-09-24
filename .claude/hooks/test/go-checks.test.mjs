import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hasLicenseHeader } from "../dist/lib/go-checks.mjs";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const repoRoot = path.resolve(dist, "..", "..", "..");
const HEADER = readFileSync(path.join(repoRoot, "internal", "config", "config.go"), "utf8").split("\n").slice(0, 16).join("\n");
const hasGofmt = spawnSync("gofmt", ["-h"], { encoding: "utf8" }).error === undefined;

/** process.env with PATH replaced case-insensitively (Windows exposes it as `Path`). */
function withPath(pathValue) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== "PATH"));
  return { ...env, PATH: pathValue };
}

function run(hook, root, file, env = {}) {
  const r = spawnSync(process.execPath, [path.join(dist, `${hook}.mjs`)], {
    input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: file } }),
    encoding: "utf8",
    env: { ...(env.PATH !== undefined ? withPath(env.PATH) : process.env), CLAUDE_PROJECT_DIR: root, ...env },
  });
  return { status: r.status, context: r.stdout === "" ? null : JSON.parse(r.stdout).hookSpecificOutput.additionalContext };
}

function sandbox(files) {
  const root = mkdtempSync(path.join(tmpdir(), "gocheck-"));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), body);
  }
  return root;
}

test("hasLicenseHeader recognises the project header", () => {
  assert.ok(hasLicenseHeader(`${HEADER}\npackage x\n`));
  assert.ok(!hasLicenseHeader("package x\n"));
  assert.ok(!hasLicenseHeader("// See the Apache License for details.\npackage x\n"), "stray mention");
  assert.ok(!hasLicenseHeader(`package x\n${HEADER}\n`), "header after package");
  assert.ok(hasLicenseHeader(`//go:build integration\n\n${HEADER}\npackage x\n`), "build tag first");
});

test("license-header: feedback for a headerless file, none for a real source file", () => {
  const root = sandbox({ "internal/x/x.go": "package x\n" });
  try {
    const bad = run("license-header", root, path.join(root, "internal/x/x.go"));
    assert.equal(bad.status, 0);
    assert.match(bad.context, /internal\/x\/x\.go is missing the Apache 2\.0 license header/);
    const good = run("license-header", repoRoot, path.join(repoRoot, "internal", "store", "store.go"));
    assert.equal(good.context, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("non-Go files and missing files are ignored", () => {
  const root = sandbox({ "README.md": "hi\n" });
  try {
    assert.equal(run("license-header", root, path.join(root, "README.md")).context, null);
    assert.equal(run("gofmt-check", root, path.join(root, "gone.go")).context, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("gofmt-check: feedback for an unformatted file, silent for a clean one", { skip: !hasGofmt && "gofmt not installed" }, () => {
  const root = sandbox({ "bad.go": `${HEADER}\npackage x\nfunc  f( ) {\n}\n`, "good.go": `${HEADER}\npackage x\n\nfunc f() {\n}\n` });
  try {
    const bad = run("gofmt-check", root, path.join(root, "bad.go"));
    assert.equal(bad.status, 0);
    assert.match(bad.context, /bad\.go is not gofmt-clean/);
    assert.equal(run("gofmt-check", root, path.join(root, "good.go")).context, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("gofmt-check: silent exit 0 when gofmt is not on PATH", () => {
  const root = sandbox({ "bad.go": "package x\nfunc  f( ) {}\n" });
  const emptyBin = path.join(root, "empty-bin");
  mkdirSync(emptyBin);
  try {
    const r = run("gofmt-check", root, path.join(root, "bad.go"), { PATH: emptyBin });
    assert.equal(r.status, 0);
    assert.equal(r.context, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
