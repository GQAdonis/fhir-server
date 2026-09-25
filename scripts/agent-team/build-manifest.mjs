#!/usr/bin/env node
// Build the portable agent-team manifest (.agent-team/team.json) from the
// reviewable role catalog (.agent-team/roles/<id>.md) and the team config
// (.agent-team/team.config.json). Every role prompt gets a generated PHI-lane
// block and a Harness card, so the 14 roles share one structure.
//
//   node scripts/agent-team/build-manifest.mjs           # write team.json
//   node scripts/agent-team/build-manifest.mjs --check   # verify only (exit 1 on problems or drift)
//   ... --check --skip-validate      # offline only: skip agent-team-creator validate, with a warning
//
// --check runs `agent-team-creator validate` on the built manifest and fails
// when it reports errors or cannot be found. The skill is located via
// $AGENT_TEAM_CREATOR (the skill directory) or ~/.claude/skills/agent-team-creator.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HARNESSES = ["claude", "codex", "opencode", "kimi", "minimax"];
const HARNESS_NAMES = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", kimi: "Kimi Code", minimax: "MiniMax Code" };
const PHI_LANES = ["none", "policy-only", "tribe-only"];
const REQUIRED_FIELDS = ["id", "description", "tier", "phiLane", "tools", "skills", "invoke", "owns", "inputs", "outputs", "dependsOn"];
const LIST_FIELDS = ["tools", "disallowedTools", "skills", "invoke", "owns", "inputs", "outputs", "dependsOn"];
export const PHI_HEADING = "## Patient-data lane";
export const CARD_HEADING = "## Harness card";

/** Parse one value of the header's YAML subset: "json string", [flow, list], or a bare scalar. */
function parseValue(raw) {
  const v = raw.trim();
  if (v.startsWith('"')) return JSON.parse(v);
  if (!v.startsWith("[")) return v;
  const inner = v.slice(1, -1).trim();
  if (inner === "") return [];
  const items = [];
  let cur = "";
  let quoted = false;
  let depth = 0; // commas inside (...) belong to the item, e.g. "Coverage policies (LCD/NCD, payer policies)"
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"' && inner[i - 1] !== "\\") quoted = !quoted;
    if (!quoted && c === "(") depth++;
    if (!quoted && c === ")") depth--;
    if (depth < 0) throw new Error(`unbalanced ")" in list: ${v}`);
    if (c === "," && !quoted && depth === 0) {
      items.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (quoted || depth !== 0) throw new Error(`unterminated quote or "(" in list: ${v}`);
  items.push(cur.trim());
  return items.map((s) => (s.startsWith('"') ? JSON.parse(s) : s));
}

/** Split a role file into its header fields and prompt body. CRLF-tolerant. */
export function parseRole(text, file = "role") {
  const src = text.replace(/\r\n/g, "\n");
  const m = src.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing --- header ---`);
  const header = {};
  for (const line of m[1].split("\n")) {
    if (line.trim() === "") continue;
    const i = line.indexOf(":");
    if (i < 0) throw new Error(`${file}: bad header line: ${line}`);
    header[line.slice(0, i).trim()] = parseValue(line.slice(i + 1));
  }
  for (const f of REQUIRED_FIELDS) if (header[f] === undefined) throw new Error(`${file}: header is missing "${f}"`);
  for (const f of LIST_FIELDS) if (header[f] !== undefined && !Array.isArray(header[f])) throw new Error(`${file}: "${f}" must be a [list]`);
  if (!PHI_LANES.includes(header.phiLane)) throw new Error(`${file}: phiLane must be one of ${PHI_LANES.join(", ")}`);
  return { header, body: m[2].trimEnd() };
}

const isReadOnly = (h) => !h.tools.includes("Edit") && !h.tools.includes("Write");

export function phiLaneBlock(lane) {
  const common =
    "Follow the `phi-lane-policy` skill; it overrides any vendored skill or prompt that allows PHI in an \"approved environment\". Tribe Health Solutions' local models are the only BAA-covered provider (ATH-D-001). Never write patient data, credentials or production endpoints to the repository or `.prometheus/`.";
  const text = {
    none: "You never process real PHI. Work only with synthetic or de-identified data and public sandboxes. If real PHI appears in your input, stop, do not repeat it, and tell the operator it must move to a Tribe lane.",
    "policy-only":
      "You review PHI policy and data flows but never process PHI content yourself. Assess flows from descriptions, schemas and counts. If real PHI appears in your input, stop, do not repeat it, and tell the operator.",
    "tribe-only": [
      "You may process real PHI **only** on a verified Tribe lane: `PHI_LANE=tribe` **and** the active model endpoint equals `TRIBE_MODEL_BASE_URL`, with hosted MCP connectors, plugins, web tools and knowledge-base or transcript sinks turned off, and only the minimum necessary.",
      "If you cannot check both lane conditions yourself, you are on the synthetic lane. A user's statement is not proof. Until the `phi-lane-guard` hook (change `configure-phi-lanes`) and a Tribe harness profile that denies web and MCP tools exist, treat **every** session as the synthetic lane.",
      "On the synthetic lane (the default), use synthetic or de-identified data and public sandboxes only. If real PHI appears in your input, stop, do not repeat it, and tell the operator it must move to a Tribe lane.",
      "Even on a Tribe lane, return only de-identified summaries or counts to the orchestrator or other roles. Show PHI-bearing drafts only to the operator in the session, and never write them to files.",
    ].join("\n\n"),
  }[lane];
  return `${PHI_HEADING}\n\n${text}\n\n${common}`;
}

export const READONLY_BASH = {
  "*": "ask",
  "git diff*": "allow",
  "git log*": "allow",
  "git show*": "allow",
  "git status*": "allow",
  "grep *": "allow",
  "rg *": "allow",
  "go vet*": "allow",
  "go test*": "allow",
  "make test*": "allow",
  "make lint*": "allow",
  "openspec validate*": "allow",
  "openspec status*": "allow",
  "npm --prefix .claude/hooks test*": "allow",
  "npm --prefix .claude/hooks run check:dist*": "allow",
  "npm --prefix .claude/hooks run lint:agents*": "allow",
  "npm --prefix .claude/hooks run scan:prometheus*": "allow",
};

function nativeFor(h, config) {
  const t = h.tier;
  const claude = { model: config.models.claude[t], tools: h.tools.join(", ") };
  if (h.disallowedTools?.length) claude.disallowedTools = h.disallowedTools.join(", ");
  if (h.color) claude.color = h.color;
  const codex = { ...config.models.codex[t] };
  const opencode = { model: config.models.opencode[t] };
  if (isReadOnly(h)) {
    codex.sandbox_mode = "read-only";
    // OpenCode has no read-only sandbox: deny edits and make every shell
    // command ask, except the read-only inspection and verification commands.
    opencode.permission = { edit: "deny", bash: READONLY_BASH };
  }
  // Kimi ignores per-agent model frontmatter; the intended model is still recorded so every harness has an entry.
  return { claude, codex, opencode, kimi: { model: config.models.kimi[t] }, minimax: { model: config.models.minimax[t] } };
}

// Capabilities derived from the role's Claude tool list, named with each
// harness's own tools (MiniMax Code publishes no stable tool names, so its
// entries are descriptive).
const CAPABILITIES = [
  { cap: "read", from: ["Read", "Grep", "Glob"] },
  { cap: "shell", from: ["Bash"] },
  { cap: "edit", from: ["Edit", "Write"] },
  { cap: "web", from: ["WebSearch", "WebFetch"] },
  { cap: "firecrawl", from: ["mcp__mcp-server-firecrawl__firecrawl_search", "mcp__mcp-server-firecrawl__firecrawl_scrape"] },
  { cap: "delegate", from: ["Agent", "SendMessage"] },
];
const TOOL_NAMES = {
  codex: { read: "shell read commands", shell: "shell", edit: "apply_patch", web: "web_search", firecrawl: "Firecrawl MCP (if configured)", delegate: "subagents" },
  opencode: { read: "read, grep, glob, list", shell: "bash", edit: "edit, write, patch", web: "webfetch, websearch", firecrawl: "Firecrawl MCP (if configured)", delegate: "task" },
  kimi: { read: "ReadFile, Glob, Grep", shell: "Shell", edit: "WriteFile, StrReplaceFile", web: "SearchWeb, FetchURL", firecrawl: "Firecrawl MCP (if configured)", delegate: "Task" },
  minimax: { read: "file read and search", shell: "shell", edit: "file edit and write", web: "web search and fetch", firecrawl: "Firecrawl MCP (if configured)", delegate: "subagents" },
};

export function capabilitiesOf(h) {
  return CAPABILITIES.filter((c) => c.from.some((tool) => h.tools.includes(tool))).map((c) => c.cap);
}

function toolsFor(h, harness) {
  if (harness === "claude") return h.tools.join(", ");
  return capabilitiesOf(h).map((c) => TOOL_NAMES[harness][c]).join("; ");
}

function permissionsFor(h, harness) {
  const ro = isReadOnly(h);
  switch (harness) {
    case "claude":
      return h.disallowedTools?.length ? `disallowed: ${h.disallowedTools.join(", ")}` : "as listed";
    case "codex":
      return ro ? "`sandbox_mode = \"read-only\"`" : "workspace-write (session default)";
    case "opencode":
      return ro ? "`permission.edit = deny`; shell commands ask except read-only verification commands (a bash write is still possible if approved)" : "session default permissions";
    default:
      return ro ? "read-only by instruction (no native per-agent permission)" : "session default permissions";
  }
}

function modelLabel(harness, tier, config) {
  const m = config.models[harness][tier];
  if (harness === "codex") return `\`${m.model}\`, reasoning effort \`${m.model_reasoning_effort}\``;
  if (harness === "kimi") return `\`${m}\` (Kimi ignores per-agent model; choose at invocation)`;
  if (harness === "minimax") return `\`${m}\` (\`mcode exec\` has no agent selector; pick the agent interactively)`;
  return `\`${m}\``;
}

export function harnessCard(h, config) {
  const rows = HARNESSES.map((x) => `| ${HARNESS_NAMES[x]} | ${modelLabel(x, h.tier, config)} | ${toolsFor(h, x)} | ${permissionsFor(h, x)} |`);
  const list = (a) => (a.length ? a.map((s) => `\`${s}\``).join(", ") : "none");
  return [
    CARD_HEADING,
    "",
    `Tier: \`${h.tier}\`. Model and permissions per harness (generated from \`.agent-team/team.config.json\`):`,
    "",
    "| Harness | Model | Tools | Permissions |",
    "|---|---|---|---|",
    ...rows,
    "",
    `- Preloaded skills (repo-resident, mirrored to every harness): ${list(h.skills)}.`,
    `- Invoke when needed (machine-local or plugin; see \`docs/agent-team.md\` prerequisites): ${list(h.invoke)}.`,
    `- Owns: ${list(h.owns)}.`,
    ...(h.phiLane === "tribe-only"
      ? ["- **None of the models above is BAA-covered.** They are synthetic-lane defaults. A Tribe lane uses the `TRIBE_MODEL_*` endpoint configuration instead (see `phi-lane-policy`)."]
      : []),
  ].join("\n");
}

export function buildRole(h, body, config) {
  return {
    id: h.id,
    description: h.description,
    prompt: `${body}\n\n${phiLaneBlock(h.phiLane)}\n\n${harnessCard(h, config)}\n`,
    skills: h.skills,
    owns: h.owns,
    inputs: h.inputs,
    outputs: h.outputs,
    dependsOn: h.dependsOn,
    modelPolicy: { tier: h.tier },
    native: nativeFor(h, config),
  };
}

/** Build the manifest from a config object and { id: roleFileText } in roster order. */
export function buildManifest(config, roleTexts) {
  const roles = config.roster.map((id) => {
    if (roleTexts[id] === undefined) throw new Error(`roster role ${id} has no .agent-team/roles/${id}.md`);
    const { header, body } = parseRole(roleTexts[id], `${id}.md`);
    if (header.id !== id) throw new Error(`${id}.md: header id is "${header.id}"`);
    return buildRole(header, body, config);
  });
  const extra = Object.keys(roleTexts).filter((id) => !config.roster.includes(id));
  if (extra.length) throw new Error(`role files not in roster: ${extra.join(", ")}`);
  const manifest = { schemaVersion: 1, id: config.id, outcome: config.outcome, scope: config.scope, harness: config.harness, roles };
  // Team-level native wrappers record the harness contract and exporter version each export targets.
  if (config.native) {
    for (const x of HARNESSES) if (!config.native[x]?.version || !config.native[x]?.source) throw new Error(`team.config.json native.${x} needs version and source`);
    manifest.native = Object.fromEntries(HARNESSES.map((x) => [x, { version: config.native[x].version, source: config.native[x].source }]));
  }
  return manifest;
}

export const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;

// ---- checks ----------------------------------------------------------------

/** Glob segments overlap? `**` spans any depth; `*` stays in one segment. */
function segMatch(a, b) {
  if (a === b || a === "*" || b === "*") return true;
  const wild = (s) => s.includes("*");
  const re = (s) => new RegExp(`^${s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
  if (wild(a) && !wild(b)) return re(a).test(b);
  if (wild(b) && !wild(a)) return re(b).test(a);
  return wild(a) && wild(b); // two wildcard segments: assume they can overlap
}

export function globsOverlap(a, b) {
  const walk = (x, y) => {
    if (x.length === 0 || y.length === 0) return x.length === y.length || x[0] === "**" || y[0] === "**";
    if (x[0] === "**" || y[0] === "**") return true;
    return segMatch(x[0], y[0]) && walk(x.slice(1), y.slice(1));
  };
  return walk(a.split("/"), b.split("/"));
}

export const findingsPath = (id) => `.agent-team/findings/${id}/**`;

/** Disjoint write ownership; review (read-only) roles own exactly their findings path. */
export function ownershipProblems(manifest, readOnlyIds = new Set()) {
  const problems = [];
  const roles = manifest.roles;
  for (const r of roles) {
    if (readOnlyIds.has(r.id) && (r.owns.length !== 1 || r.owns[0] !== findingsPath(r.id))) {
      problems.push(`${r.id}: review role must own only "${findingsPath(r.id)}"`);
    }
  }
  for (let i = 0; i < roles.length; i++) {
    if (roles[i].owns.length === 0) problems.push(`${roles[i].id}: owns nothing`);
    for (let j = i + 1; j < roles.length; j++) {
      for (const a of roles[i].owns) for (const b of roles[j].owns) {
        if (globsOverlap(a, b)) problems.push(`ownership overlap: ${roles[i].id} "${a}" vs ${roles[j].id} "${b}"`);
      }
    }
  }
  return problems;
}

/** Preloaded skills must be repo-resident; invoke skills must be repo-resident or documented prerequisites. */
export function skillProblems(manifest, roleHeaders, repoSkills, prerequisites) {
  const problems = [];
  for (const r of manifest.roles) {
    for (const s of r.skills) if (!repoSkills.has(s)) problems.push(`${r.id}: preloaded skill "${s}" is not repo-resident`);
    for (const s of roleHeaders[r.id].invoke) {
      if (!repoSkills.has(s) && !prerequisites.has(s)) problems.push(`${r.id}: skill "${s}" is neither repo-resident nor in docs/agent-team.md prerequisites`);
    }
  }
  return problems;
}

/** A prompt line "Writable paths, and only these: ..." must agree with the header's owns. */
export function ownsStatementProblems(id, header, body) {
  const line = body.split("\n").find((l) => l.includes("Writable paths, and only these:"));
  if (line === undefined) return [];
  // Paths continue onto the following sentence(s) of the same bullet (e.g. "Agent tooling: ...").
  const bullet = body.slice(body.indexOf(line)).split(/\n(?=- |\n|#)/)[0];
  const ticked = [...bullet.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const problems = [];
  for (const o of header.owns) if (!ticked.includes(o)) problems.push(`${id}: owns "${o}" is not stated in the prompt's Writable paths`);
  for (const t of ticked) if (/[/*]/.test(t) && !header.owns.includes(t) && !t.includes("{")) problems.push(`${id}: prompt states writable "${t}" that is not in owns`);
  return problems;
}

/** docs/agent-team.md "## Portable team roster" must list exactly the manifest roster, in order. */
export function rosterDocProblems(manifest, doc) {
  const text = doc.replace(/\r\n/g, "\n");
  const start = text.indexOf("\n## Portable team roster\n");
  if (start < 0) return ['docs/agent-team.md has no "## Portable team roster" section'];
  const section = text.slice(start + 1).split("\n## ")[0];
  const listed = [...section.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);
  const want = manifest.roles.map((r) => r.id);
  return listed.join(",") === want.join(",") ? [] : [`docs/agent-team.md roster (${listed.join(", ")}) differs from the manifest roster (${want.join(", ")})`];
}

export function cardProblems(manifest) {
  const problems = [];
  for (const r of manifest.roles) {
    if (!r.prompt.includes(PHI_HEADING)) problems.push(`${r.id}: missing PHI-lane block`);
    const card = r.prompt.slice(r.prompt.indexOf(CARD_HEADING));
    if (!r.prompt.includes(CARD_HEADING)) problems.push(`${r.id}: missing Harness card`);
    else for (const x of HARNESSES) if (!card.includes(`| ${HARNESS_NAMES[x]} |`)) problems.push(`${r.id}: Harness card lacks ${HARNESS_NAMES[x]}`);
  }
  return problems;
}

// ---- CLI -------------------------------------------------------------------

function repoSkillSet(root) {
  const dir = path.join(root, ".agents", "skills");
  const names = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md"))).map((e) => e.name);
  // karpathy-guidelines is vendored under .claude/skills (previous phase).
  const claude = path.join(root, ".claude", "skills");
  for (const e of readdirSync(claude, { withFileTypes: true })) if (e.isDirectory() && existsSync(path.join(claude, e.name, "SKILL.md"))) names.push(e.name);
  return new Set(names);
}

/** used_by claims in the prerequisites block: [{ name, usedBy: [...] }]. */
export function prerequisiteEntries(doc) {
  const block = doc.replace(/\r\n/g, "\n").match(/```yaml\nprerequisites:\n([\s\S]*?)```/);
  if (!block) return [];
  return block[1].split(/\n(?=\s+- name:)/).map((e) => ({
    name: e.match(/- name:\s*(\S+)/)?.[1],
    usedBy: (e.match(/used_by:\s*\[([^\]]*)\]/)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  })).filter((e) => e.name);
}

/** Every manifest role a prerequisite claims as a user must actually preload or invoke it. */
export function usedByProblems(manifest, roleHeaders, entries) {
  const ids = new Set(manifest.roles.map((r) => r.id));
  const problems = [];
  for (const e of entries) for (const role of e.usedBy) {
    if (!ids.has(role)) continue; // installed-but-retiring agents are linted by lint:agents
    const h = roleHeaders[role];
    if (!h.invoke.includes(e.name) && !h.skills.includes(e.name)) problems.push(`docs/agent-team.md: prerequisite "${e.name}" claims used_by ${role}, which neither preloads nor invokes it`);
  }
  return problems;
}

function prerequisiteSet(root) {
  const doc = readFileSync(path.join(root, "docs", "agent-team.md"), "utf8").replace(/\r\n/g, "\n");
  const block = doc.match(/```yaml\nprerequisites:\n([\s\S]*?)```/);
  return new Set(block ? [...block[1].matchAll(/^\s+- name:\s*(\S+)/gm)].map((m) => m[1]) : []);
}

export function creatorCli() {
  const dirs = [process.env["AGENT_TEAM_CREATOR"], path.join(os.homedir(), ".claude", "skills", "agent-team-creator")].filter(Boolean);
  return dirs.map((d) => path.join(d, "scripts", "cli.mjs")).find((f) => existsSync(f));
}

/** Run agent-team-creator validate on the manifest; returns problems, or undefined when the CLI is unavailable. */
function creatorValidate(manifest) {
  const cli = creatorCli();
  if (cli === undefined) return undefined;
  const dir = mkdtempSync(path.join(os.tmpdir(), "team-validate-"));
  try {
    const input = path.join(dir, "request.json");
    writeFileSync(input, JSON.stringify({ team: manifest }));
    const r = spawnSync(process.execPath, [cli, "validate", "--input", input], { encoding: "utf8", windowsHide: true });
    let valid = false;
    try {
      valid = JSON.parse(r.stdout).valid === true;
    } catch {
      valid = false;
    }
    return r.status === 0 && valid ? [] : [`agent-team-creator validate failed: ${(r.stdout || r.stderr).trim().slice(0, 500)}`];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const check = process.argv.includes("--check");
  const config = JSON.parse(readFileSync(path.join(root, ".agent-team", "team.config.json"), "utf8"));
  const rolesDir = path.join(root, ".agent-team", "roles");
  const texts = Object.fromEntries(readdirSync(rolesDir).filter((f) => f.endsWith(".md")).map((f) => [f.slice(0, -3), readFileSync(path.join(rolesDir, f), "utf8")]));
  const manifest = buildManifest(config, texts);
  const headers = Object.fromEntries(Object.entries(texts).map(([id, t]) => [id, parseRole(t, id).header]));
  const statements = Object.entries(texts).flatMap(([id, t]) => {
    const { header, body } = parseRole(t, id);
    return ownsStatementProblems(id, header, body);
  });
  const readOnly = new Set(Object.entries(headers).filter(([, h]) => isReadOnly(h)).map(([id]) => id));
  const doc = readFileSync(path.join(root, "docs", "agent-team.md"), "utf8");
  const problems = [...rosterDocProblems(manifest, doc), ...usedByProblems(manifest, headers, prerequisiteEntries(doc)), ...ownershipProblems(manifest, readOnly), ...skillProblems(manifest, headers, repoSkillSet(root), prerequisiteSet(root)), ...cardProblems(manifest), ...statements];
  const out = path.join(root, ".agent-team", "team.json");
  const text = serialize(manifest);
  if (check) {
    if (process.argv.includes("--skip-validate")) {
      console.log("build-manifest: WARNING agent-team-creator validate skipped (--skip-validate); CI still enforces it");
    } else {
      const v = creatorValidate(manifest);
      if (v === undefined) problems.push("agent-team-creator not found: set AGENT_TEAM_CREATOR to the skill directory (or pass --skip-validate offline)");
      else problems.push(...v);
    }
  }
  // Byte-exact (.gitattributes keeps .agent-team/** LF): a CRLF copy is drift.
  if (check && (!existsSync(out) || Buffer.compare(readFileSync(out), Buffer.from(text)) !== 0)) problems.push(".agent-team/team.json is out of date; run node scripts/agent-team/build-manifest.mjs");
  for (const p of problems) console.error(`build-manifest: ${p}`);
  if (problems.length) process.exit(1);
  if (!check) writeFileSync(out, text);
  console.log(`build-manifest: ${check ? "OK" : "wrote .agent-team/team.json"} (${manifest.roles.length} roles)`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
