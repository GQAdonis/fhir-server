import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAgent, asList, invokeSkills, documentedPrerequisites, lintAll } from "../dist/lib/agent-lint.mjs";

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const repoRoot = path.resolve(dist, "..", "..", "..");
const cli = path.join(dist, "lint-agents.mjs");

/** A minimal repo with one agent, one vendored skill and a doc. */
function fixtureRepo({ agentSkills = ["karpathy-guidelines"], invoke = "`golang-patterns`", prereqs = ["golang-patterns"], model = "sonnet" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "lint-"));
  mkdirSync(path.join(root, ".claude", "agents"), { recursive: true });
  mkdirSync(path.join(root, ".claude", "skills", "karpathy-guidelines"), { recursive: true });
  writeFileSync(path.join(root, ".claude", "skills", "karpathy-guidelines", "SKILL.md"), "---\nname: karpathy-guidelines\n---\n");
  const sections = ["Role", "Owns", "Domain rules", "Workflow", "Hand-offs", "Skills", "Karpathy", "Output contract"]
    .map((h) => (h === "Skills" ? `## Skills\n\n- Invoke when needed: ${invoke}.\n` : `## ${h}\n\ntext\n`))
    .join("\n");
  writeFileSync(
    path.join(root, ".claude", "agents", "fhir-demo.md"),
    `---\nname: fhir-demo\ndescription: demo agent\nmodel: ${model}\ntools: Read, Grep\nskills:\n${agentSkills.map((s) => `  - ${s}`).join("\n")}\n---\n\n# fhir-demo\n\n${sections}`,
  );
  mkdirSync(path.join(root, "docs"));
  writeFileSync(
    path.join(root, "docs", "agent-team.md"),
    `# Agent team\n\n| \`fhir-demo\` |\n\n\`\`\`yaml\nprerequisites:\n${prereqs.map((p) => `  - name: ${p}\n    kind: skill\n    source: x\n    used_by: [fhir-demo]`).join("\n")}\n\`\`\`\n`,
  );
  return root;
}

const noLocal = (root) => ({ repoRoot: root, localSkillDirs: [], localAgentDirs: [] });

test("parseAgent handles scalars, inline lists and block lists", () => {
  const { frontmatter } = parseAgent("---\nname: a\ntools: Read, Grep\nskills:\n  - x\n  - y\n---\nbody\n");
  assert.equal(frontmatter.name, "a");
  assert.deepEqual(asList(frontmatter.tools), ["Read", "Grep"]);
  assert.deepEqual(frontmatter.skills, ["x", "y"]);
  // A YAML flow map is not JSON; it is still rejected (by the JSON branch).
  assert.throws(() => parseAgent("---\n{ flow: map }\n---\n"), /invalid JSON frontmatter/);
  assert.throws(() => parseAgent("---\nkey value\n---\n"), /unsupported frontmatter line/);
  assert.throws(() => parseAgent("no frontmatter"), /missing YAML frontmatter/);
});

test("invokeSkills and documentedPrerequisites extract names", () => {
  assert.deepEqual(invokeSkills("## Skills\n\n- Invoke when needed: `a-b`, `superpowers:c` (x).\n\n## Karpathy\n"), ["a-b", "superpowers:c"]);
  assert.deepEqual([...documentedPrerequisites("```yaml\nprerequisites:\n  - name: foo\n    kind: skill\n```")], ["foo"]);
});

test("CRLF checkouts (Windows) parse the same as LF", () => {
  const doc = "```yaml\r\nprerequisites:\r\n  - name: foo\r\n    kind: skill\r\n```\r\n";
  assert.deepEqual([...documentedPrerequisites(doc)], ["foo"]);
  assert.deepEqual(invokeSkills("## Skills\r\n\r\n- Invoke when needed: `a-b`.\r\n\r\n## Karpathy\r\n"), ["a-b"]);
  const { frontmatter } = parseAgent("---\r\nname: a\r\ntools: Read\r\n---\r\nbody\r\n");
  assert.equal(frontmatter.name, "a");
});

test("a clean fixture passes", () => {
  const root = fixtureRepo();
  try {
    assert.deepEqual(lintAll(noLocal(root)), { agents: 1, problems: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unknown skill that is neither local nor documented fails", () => {
  const root = fixtureRepo({ invoke: "`golang-patterns`, `mystery-skill`" });
  try {
    const { problems } = lintAll(noLocal(root));
    assert.equal(problems.length, 1);
    assert.match(problems[0], /skill "mystery-skill" neither resolves locally nor appears in docs\/agent-team\.md prerequisites/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a machine-local preload and a bad model are rejected", () => {
  const root = fixtureRepo({ agentSkills: ["karpathy-guidelines", "golang-patterns"], model: "gpt" });
  try {
    const { problems } = lintAll(noLocal(root));
    assert.ok(problems.some((p) => /preloaded skill "golang-patterns" is not repo-resident/.test(p)));
    assert.ok(problems.some((p) => /unknown model "gpt"/.test(p)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("path-like skill names are rejected and never resolved", () => {
  const root = fixtureRepo({ agentSkills: ["karpathy-guidelines", "../../etc"] });
  try {
    const { problems } = lintAll(noLocal(root));
    assert.ok(problems.some((p) => /skill name "\.\.\/\.\.\/etc" is not a valid identifier/.test(p)), problems.join("\n"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("list-valued model/name/description are rejected", () => {
  const root = fixtureRepo();
  try {
    const f = path.join(root, ".claude", "agents", "fhir-demo.md");
    writeFileSync(f, readFileSync(f, "utf8").replace("model: sonnet\n", "model:\n  - opus\n"));
    const { problems } = lintAll(noLocal(root));
    assert.ok(problems.some((p) => /"model" must be a single value, not a list/.test(p)), problems.join("\n"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a tool both granted and disallowed is reported", () => {
  const root = fixtureRepo();
  try {
    const f = path.join(root, ".claude", "agents", "fhir-demo.md");
    writeFileSync(f, readFileSync(f, "utf8").replace("tools: Read, Grep\n", "tools: Read, Grep, Write\ndisallowedTools: Write\n"));
    const { problems } = lintAll(noLocal(root));
    assert.ok(problems.some((p) => /"Write" is both granted in tools and listed in disallowedTools/.test(p)), problems.join("\n"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const realAgentCount = () => readdirSync(path.join(repoRoot, ".claude", "agents")).filter((f) => f.endsWith(".md")).length;

test("the real .claude/agents pass with only documented prerequisites (as on a CI runner)", () => {
  const { agents, problems } = lintAll(noLocal(repoRoot));
  assert.equal(agents, realAgentCount());
  assert.deepEqual(problems, []);
});

test("JSON frontmatter (generated by the team exporter) parses like YAML", () => {
  const { frontmatter, body } = parseAgent('---\n{\n  "name": "x",\n  "skills": ["a", "b"],\n  "tools": "Read, Grep"\n}\n---\n\n# x\n');
  assert.equal(frontmatter.name, "x");
  assert.deepEqual(frontmatter.skills, ["a", "b"]);
  assert.deepEqual(asList(frontmatter.tools), ["Read", "Grep"]);
  assert.equal(body, "\n# x\n");
  assert.equal(parseAgent('---\n{ "permission": { "edit": "deny" } }\n---\n').frontmatter.permission, '{"edit":"deny"}');
  assert.throws(() => parseAgent("---\n{ nope\n---\n"), /invalid JSON frontmatter/);
});

test("CLI exits 1 on problems and 0 when clean", () => {
  const root = fixtureRepo({ invoke: "`nope-skill`" });
  try {
    const bad = spawnSync(process.execPath, [cli, root], { encoding: "utf8", env: { ...process.env, HOME: root, USERPROFILE: root } });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /nope-skill/);
    // Structure is clean, but a skipped drift check never exits 0.
    const skipped = spawnSync(process.execPath, [cli, repoRoot, "--skip-drift"], { encoding: "utf8" });
    assert.equal(skipped.status, 3, skipped.stderr);
    assert.match(skipped.stderr, new RegExp(`structure OK \\(${realAgentCount()} agents; 14 roles x 5 harnesses\\) but drift NOT verified`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
