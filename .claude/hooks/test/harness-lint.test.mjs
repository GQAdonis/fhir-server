import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { lintHarnesses, minimaxCommittableProblems, parseFlatToml, rosterIds } from "../dist/lib/harness-lint.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DIRS = [".agent-team/team.json", ".claude/agents", ".codex/agents", ".opencode/agents", ".kimi-code/agents", ".minimax/agents"];

/** A copy of the real generated harness files, safe to damage. */
function copyRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "harness-lint-"));
  for (const d of DIRS) {
    mkdirSync(path.dirname(path.join(root, d)), { recursive: true });
    cpSync(path.join(repoRoot, d), path.join(root, d), { recursive: true });
  }
  return root;
}

test("parseFlatToml reads the exporter's quoted keys and basic strings", () => {
  const t = parseFlatToml('"name" = "a"\n"developer_instructions" = "line\\nnext \\"q\\""\nmodel_reasoning_effort = "high"\n');
  assert.deepEqual(t, { name: "a", developer_instructions: 'line\nnext "q"', model_reasoning_effort: "high" });
  assert.throws(() => parseFlatToml("[table]\n"), /unsupported TOML line/);
});

test("the real generated harness files are clean", () => {
  assert.deepEqual(lintHarnesses(repoRoot, rosterIds(repoRoot)), []);
});

test("a hand edit that drops a generated section fails in each harness", () => {
  const root = copyRepo();
  try {
    const roster = rosterIds(root);
    const strip = (rel) => {
      const f = path.join(root, rel);
      writeFileSync(f, readFileSync(f, "utf8").replace("## Patient-data lane", "## Something else"));
    };
    strip(".codex/agents/fhir-architect.toml");
    strip(".opencode/agents/fhir-architect.md");
    strip(".kimi-code/agents/fhir-architect.md");
    strip(".minimax/agents/fhir-architect/agent.md");
    strip(".claude/agents/fhir-architect.md");
    const problems = lintHarnesses(root, roster).join("\n");
    for (const h of ["codex", "opencode", "kimi", "minimax", "claude"]) assert.match(problems, new RegExp(`${h}: .*fhir-architect.*Patient-data lane`), h);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing and extra role files are reported", () => {
  const root = copyRepo();
  try {
    rmSync(path.join(root, ".kimi-code/agents/data-sync-coordinator.md"));
    writeFileSync(path.join(root, ".opencode/agents/stray-role.md"), "---\n{}\n---\n");
    const problems = lintHarnesses(root, rosterIds(root)).join("\n");
    assert.match(problems, /kimi: .kimi-code\/agents\/data-sync-coordinator.md is missing/);
    assert.match(problems, /opencode: .opencode\/agents\/stray-role.md is not a roster role/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex agents may not carry unexpected keys, and gate roles must be read-only", () => {
  const root = copyRepo();
  try {
    const f = path.join(root, ".codex/agents/fhir-code-reviewer.toml");
    writeFileSync(f, readFileSync(f, "utf8").replace('"sandbox_mode" = "read-only"', '"sandbox_mode" = "danger-full-access"\n"approval_policy" = "never"'));
    const problems = lintHarnesses(root, rosterIds(root)).join("\n");
    assert.match(problems, /key "approval_policy" is not allowed/);
    assert.match(problems, /sandbox_mode "danger-full-access" is not allowed/);
    assert.match(problems, /gate role must have sandbox_mode = "read-only"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the real .minimax tree exposes only generated team files to git", () => {
  assert.deepEqual(minimaxCommittableProblems(repoRoot, rosterIds(repoRoot)), []);
});

test("every harness requires the standard prompt sections", () => {
  const root = copyRepo();
  try {
    for (const rel of [".codex/agents/fhir-go-developer.toml", ".opencode/agents/fhir-go-developer.md", ".kimi-code/agents/fhir-go-developer.md", ".minimax/agents/fhir-go-developer/agent.md"]) {
      const f = path.join(root, rel);
      writeFileSync(f, readFileSync(f, "utf8").replace("## Hand-offs", "## Handoffs"));
    }
    const problems = lintHarnesses(root, rosterIds(root)).join("\n");
    for (const h of ["codex", "opencode", "kimi", "minimax"]) assert.match(problems, new RegExp(`${h}: .*fhir-go-developer.*missing section "## Hand-offs"`), h);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
