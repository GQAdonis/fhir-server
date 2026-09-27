// Tests for build-manifest.mjs: node --test scripts/agent-team/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildManifest,
  capabilitiesOf,
  cardProblems,
  CARD_HEADING,
  globsOverlap,
  ownershipProblems,
  ownsStatementProblems,
  parseRole,
  prerequisiteEntries,
  usedByProblems,
  rosterDocProblems,
  PHI_HEADING,
  serialize,
  skillProblems,
} from "./build-manifest.mjs";

const config = {
  id: "t",
  outcome: "test team",
  scope: "project",
  harness: "claude",
  roster: ["writer", "reviewer"],
  models: {
    claude: { hard: "opus", medium: "sonnet", low: "haiku" },
    codex: { hard: { model: "m", model_reasoning_effort: "high" }, medium: { model: "m", model_reasoning_effort: "medium" }, low: { model: "m", model_reasoning_effort: "low" } },
    opencode: { hard: "o", medium: "o", low: "o" },
    kimi: { hard: "k", medium: "k", low: "k" },
    minimax: { hard: "x", medium: "x", low: "x" },
  },
};

const role = (id, extra = {}) => {
  const h = {
    id,
    description: `"${id} role, with a comma"`,
    tier: "medium",
    phiLane: "none",
    tools: "[Read, Grep, Edit, Write]",
    skills: "[karpathy-guidelines]",
    invoke: '[kbd-apply, "superpowers:brainstorming"]',
    owns: `[docs/${id}/**]`,
    inputs: "[a]",
    outputs: "[b]",
    dependsOn: "[]",
    ...extra,
  };
  return `---\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n# ${id}\n\nBody.\n`;
};

const texts = () => ({ writer: role("writer"), reviewer: role("reviewer", { tools: "[Read, Grep]", tier: "hard", phiLane: "tribe-only" }) });

test("parseRole reads quoted strings and flow lists, CRLF-tolerant", () => {
  const { header, body } = parseRole(role("writer").replace(/\n/g, "\r\n"));
  assert.equal(header.description, "writer role, with a comma");
  assert.deepEqual(header.invoke, ["kbd-apply", "superpowers:brainstorming"]);
  assert.deepEqual(header.dependsOn, []);
  assert.equal(body, "# writer\n\nBody.");
});

test("parseRole rejects a missing field and an unknown phiLane", () => {
  assert.throws(() => parseRole(role("w").replace(/^owns:.*\n/m, "")), /missing "owns"/);
  assert.throws(() => parseRole(role("w", { phiLane: "maybe" })), /phiLane/);
});

test("buildManifest is deterministic and follows roster order", () => {
  const a = serialize(buildManifest(config, texts()));
  const b = serialize(buildManifest(config, texts()));
  assert.equal(a, b);
  assert.deepEqual(JSON.parse(a).roles.map((r) => r.id), ["writer", "reviewer"]);
});

test("every prompt gets the PHI-lane block and a five-harness card", () => {
  const m = buildManifest(config, texts());
  assert.deepEqual(cardProblems(m), []);
  const reviewer = m.roles[1];
  assert.match(reviewer.prompt, new RegExp(PHI_HEADING));
  assert.match(reviewer.prompt, /PHI_LANE=tribe/);
  assert.match(reviewer.prompt, new RegExp(CARD_HEADING));
  for (const h of ["Claude Code", "Codex", "OpenCode", "Kimi Code", "MiniMax Code"]) assert.match(reviewer.prompt, new RegExp(`\\| ${h} \\|`));
});

test("read-only roles get native read-only settings; writers do not", () => {
  const m = buildManifest(config, texts());
  const [writer, reviewer] = m.roles;
  assert.equal(reviewer.native.codex.sandbox_mode, "read-only");
  assert.equal(reviewer.native.opencode.permission.edit, "deny");
  assert.equal(reviewer.native.opencode.permission.bash["*"], "ask");
  assert.equal(reviewer.native.opencode.permission.bash["git diff*"], "allow");
  assert.equal(reviewer.native.claude.model, "opus");
  assert.equal(writer.native.codex.sandbox_mode, undefined);
  assert.equal(writer.native.codex.model_reasoning_effort, "medium");
  assert.deepEqual(Object.keys(writer.native).sort(), ["claude", "codex", "kimi", "minimax", "opencode"]);
  assert.equal(writer.native.kimi.model, "k");
});

test("buildManifest rejects roster/file mismatches", () => {
  assert.throws(() => buildManifest(config, { writer: role("writer") }), /no .agent-team\/roles\/reviewer.md/);
  assert.throws(() => buildManifest(config, { ...texts(), stray: role("stray") }), /not in roster: stray/);
  assert.throws(() => buildManifest(config, { ...texts(), writer: role("other") }), /header id is "other"/);
});

test("globsOverlap distinguishes real overlaps", () => {
  assert.equal(globsOverlap("docs/**", "docs/billing/**"), true);
  assert.equal(globsOverlap("docs/*.md", "docs/billing/**"), false);
  assert.equal(globsOverlap("docs/*.md", "docs/agent-team.md"), true);
  assert.equal(globsOverlap("internal/store/*.go", "internal/store/testdata/**"), false);
  assert.equal(globsOverlap(".kbd/phases/*/plan.md", ".kbd/phases/*/reflection.md"), false);
  assert.equal(globsOverlap(".kbd/phases/*/evidence/**", ".kbd/phases/x/evidence/a.md"), true);
});

test("ownershipProblems flags overlapping and empty ownership", () => {
  const bad = { ...texts(), reviewer: role("reviewer", { owns: "[docs/**]" }) };
  assert.match(ownershipProblems(buildManifest(config, bad)).join("\n"), /ownership overlap: writer "docs\/writer\/\*\*" vs reviewer "docs\/\*\*"/);
  const empty = { ...texts(), reviewer: role("reviewer", { owns: "[]" }) };
  assert.match(ownershipProblems(buildManifest(config, empty)).join("\n"), /reviewer: owns nothing/);
  assert.deepEqual(ownershipProblems(buildManifest(config, texts())), []);
});

test("skillProblems requires repo-resident preloads and documented invokes", () => {
  const t = texts();
  const m = buildManifest(config, t);
  const headers = Object.fromEntries(Object.entries(t).map(([id, x]) => [id, parseRole(x).header]));
  assert.deepEqual(skillProblems(m, headers, new Set(["karpathy-guidelines"]), new Set(["kbd-apply", "superpowers:brainstorming"])), []);
  const problems = skillProblems(m, headers, new Set(), new Set(["kbd-apply"])).join("\n");
  assert.match(problems, /preloaded skill "karpathy-guidelines" is not repo-resident/);
  assert.match(problems, /"superpowers:brainstorming" is neither repo-resident nor in docs\/agent-team.md prerequisites/);
});

test("cardProblems flags a prompt without the generated sections", () => {
  const m = buildManifest(config, texts());
  m.roles[0].prompt = "# stripped";
  assert.match(cardProblems(m).join("\n"), /writer: missing PHI-lane block[\s\S]*writer: missing Harness card/);
});

test("team-level native wrappers carry version and source for every harness", () => {
  const native = Object.fromEntries(["claude", "codex", "opencode", "kimi", "minimax"].map((x) => [x, { version: `${x} 1; creator abc`, source: `https://example.org/${x}` }]));
  const m = buildManifest({ ...config, native }, texts());
  assert.equal(m.native.codex.version, "codex 1; creator abc");
  assert.equal(Object.keys(m.native).length, 5);
  assert.throws(() => buildManifest({ ...config, native: { ...native, kimi: { source: "x" } } }, texts()), /native.kimi needs version and source/);
});

test("Harness card names each harness's tools for the role's capabilities", () => {
  const m = buildManifest(config, texts());
  const [writer, reviewer] = m.roles;
  assert.deepEqual(capabilitiesOf({ tools: ["Read", "Grep", "Edit", "Write"] }), ["read", "edit"]);
  assert.match(writer.prompt, /\| Codex \| [^|]+ \| shell read commands; apply_patch \|/);
  assert.match(writer.prompt, /\| OpenCode \| [^|]+ \| read, grep, glob, list; edit, write, patch \|/);
  assert.match(writer.prompt, /\| Kimi Code \| [^|]+ \| ReadFile, Glob, Grep; WriteFile, StrReplaceFile \|/);
  assert.match(writer.prompt, /\| MiniMax Code \| [^|]+ \| file read and search; file edit and write \|/);
  assert.doesNotMatch(reviewer.prompt, /apply_patch/);
});

test("ownsStatementProblems keeps prompt Writable paths in step with owns", () => {
  const header = { owns: ["docs/a/**", "Makefile"] };
  assert.deepEqual(ownsStatementProblems("r", header, "- Writable paths, and only these: `docs/a/**` and `Makefile`.\n- Other."), []);
  assert.match(ownsStatementProblems("r", header, "- Writable paths, and only these: `docs/**` and `Makefile`.").join("\n"), /owns "docs\/a\/\*\*" is not stated[\s\S]*states writable "docs\/\*\*" that is not in owns/);
  assert.deepEqual(ownsStatementProblems("r", header, "# no statement"), []);
});

test("list items keep commas inside parentheses or quotes; malformed lists fail", () => {
  const { header } = parseRole(role("w", { inputs: '[Plain item, Coverage policies (LCD/NCD, payer policies), "Quoted, with comma"]' }));
  assert.deepEqual(header.inputs, ["Plain item", "Coverage policies (LCD/NCD, payer policies)", "Quoted, with comma"]);
  assert.throws(() => parseRole(role("w", { inputs: "[Open (paren, never closed]" })), /unterminated/);
  assert.throws(() => parseRole(role("w", { inputs: '["unterminated]' })), /unterminated/);
});

test("review roles must own exactly their findings path", () => {
  const ok = { ...texts(), reviewer: role("reviewer", { tools: "[Read, Grep]", owns: "[.agent-team/findings/reviewer/**]" }) };
  assert.deepEqual(ownershipProblems(buildManifest(config, ok), new Set(["reviewer"])), []);
  const bad = { ...texts(), reviewer: role("reviewer", { tools: "[Read, Grep]", owns: "[.agent-team/findings/reviewer/**, docs/x/**]" }) };
  assert.match(ownershipProblems(buildManifest(config, bad), new Set(["reviewer"])).join("\n"), /reviewer: review role must own only ".agent-team\/findings\/reviewer\/\*\*"/);
});

test("rosterDocProblems requires the doc roster to equal the manifest roster", () => {
  const m = buildManifest(config, texts());
  const doc = (ids) => `# T\n\n## Portable team roster\n\n| Role |\n|---|\n${ids.map((i) => `| \`${i}\` | x |`).join("\n")}\n\n## Next\n| \`other\` |\n`;
  assert.deepEqual(rosterDocProblems(m, doc(["writer", "reviewer"])), []);
  assert.match(rosterDocProblems(m, doc(["writer"])).join(""), /differs from the manifest roster/);
  assert.match(rosterDocProblems(m, "# no section").join(""), /no "## Portable team roster" section/);
});

test("usedByProblems flags a prerequisite claiming a role that never uses it", () => {
  const t = texts();
  const m = buildManifest(config, t);
  const headers = Object.fromEntries(Object.entries(t).map(([id, x]) => [id, parseRole(x).header]));
  const doc = "```yaml\nprerequisites:\n  - name: kbd-apply\n    kind: skill\n    used_by: [writer, retired-agent]\n  - name: other\n    used_by: [reviewer]\n```";
  const entries = prerequisiteEntries(doc);
  assert.deepEqual(entries.map((e) => e.name), ["kbd-apply", "other"]);
  assert.deepEqual(usedByProblems(m, headers, entries), ['docs/agent-team.md: prerequisite "other" claims used_by reviewer, which neither preloads nor invokes it']);
});

test("tribe-only card and lane block state the BAA and assume-synthetic rules", () => {
  const reviewer = buildManifest(config, texts()).roles[1];
  assert.match(reviewer.prompt, /None of the models above is BAA-covered/);
  assert.match(reviewer.prompt, /If you cannot check both lane conditions yourself, you are on the synthetic lane/);
  assert.match(reviewer.prompt, /never write them to files/);
});

test("team.json drift is byte-exact (a CRLF copy is not current)", () => {
  const text = serialize(buildManifest(config, texts()));
  assert.notEqual(Buffer.compare(Buffer.from(text.replace(/\n/g, "\r\n")), Buffer.from(text)), 0);
});
