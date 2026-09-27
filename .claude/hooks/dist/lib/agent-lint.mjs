// Lint rules for .claude/agents/*.md, checked against docs/agent-team.md.
// Dependency-free: a frontmatter parser for the YAML subset agent files use
// (scalars, comma-separated inline lists, and `- item` block lists), plus the
// JSON frontmatter (valid YAML) that the team exporter generates.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
export const MODELS = new Set(["opus", "sonnet", "haiku", "fable", "inherit"]);
export const REQUIRED_FIELDS = ["name", "description", "model", "tools"];
export const REQUIRED_SECTIONS = [
    "## Role",
    "## Owns",
    "## Domain rules",
    "## Workflow",
    "## Hand-offs",
    "## Skills",
    "## Karpathy",
    "## Output contract",
];
/** Parse the leading `---` block. Throws on constructs outside the supported subset. */
export function parseAgent(source) {
    const text = source.replace(/\r\n/g, "\n");
    const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (match === null)
        throw new Error("missing YAML frontmatter");
    const frontmatter = {};
    if (match[1].trimStart().startsWith("{")) {
        let obj;
        try {
            obj = JSON.parse(match[1]);
        }
        catch (err) {
            throw new Error(`invalid JSON frontmatter: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (obj === null || typeof obj !== "object" || Array.isArray(obj))
            throw new Error("JSON frontmatter must be an object");
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string")
                frontmatter[key] = value;
            else if (Array.isArray(value) && value.every((v) => typeof v === "string"))
                frontmatter[key] = value;
            // Nested native settings (e.g. OpenCode `permission`) are kept as JSON text.
            else
                frontmatter[key] = JSON.stringify(value);
        }
        return { frontmatter, body: text.slice(match[0].length) };
    }
    let listKey;
    for (const line of match[1].split("\n")) {
        if (line.trim() === "")
            continue;
        const item = /^\s+-\s+(.+)$/.exec(line);
        if (item !== null && listKey !== undefined) {
            frontmatter[listKey].push(item[1].trim());
            continue;
        }
        const kv = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
        if (kv === null)
            throw new Error(`unsupported frontmatter line: ${line}`);
        const [, key, value] = kv;
        if (value === "") {
            frontmatter[key] = [];
            listKey = key;
        }
        else {
            frontmatter[key] = value.trim();
            listKey = undefined;
        }
    }
    return { frontmatter, body: text.slice(match[0].length) };
}
/** A field as a list: block lists as-is, scalars split on commas. */
export function asList(value) {
    if (value === undefined)
        return [];
    if (Array.isArray(value))
        return value;
    return value.split(",").map((s) => s.trim()).filter((s) => s !== "");
}
/** Skill names listed on the prompt's "Invoke when needed" line. */
export function invokeSkills(body) {
    const section = body.replace(/\r\n/g, "\n").split("## Skills")[1]?.split("\n## ")[0] ?? "";
    const line = section.split("\n").find((l) => l.includes("Invoke when needed")) ?? "";
    return [...line.matchAll(/`([a-z0-9][a-z0-9:-]*)`/g)].map((m) => m[1]);
}
/** Names in the ```yaml prerequisites block of docs/agent-team.md. */
export function documentedPrerequisites(doc) {
    // Windows checkouts may use CRLF; normalize before matching line structure.
    const block = /```yaml\n([\s\S]*?)```/.exec(doc.replace(/\r\n/g, "\n"))?.[1] ?? "";
    return new Set([...block.matchAll(/^\s*- name: (\S+)\s*$/gm)].map((m) => m[1]));
}
/** Skill/agent names are plain identifiers; anything path-like is never looked up. */
const NAME = /^[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)?$/;
function repoResident(ctx, skill) {
    if (!NAME.test(skill))
        return false;
    return existsSync(path.join(ctx.repoRoot, ".claude", "skills", skill, "SKILL.md"));
}
function resolvesLocally(ctx, name) {
    if (!NAME.test(name))
        return false;
    const bare = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
    return (repoResident(ctx, bare) ||
        ctx.localSkillDirs.some((d) => existsSync(path.join(d, bare, "SKILL.md"))) ||
        ctx.localAgentDirs.some((d) => existsSync(path.join(d, `${bare}.md`))));
}
/** Lint one agent file; returns human-readable problems (empty when clean). */
export function lintAgent(file, source, ctx, prerequisites, doc) {
    const problems = [];
    const expectedName = path.basename(file, ".md");
    let parsed;
    try {
        parsed = parseAgent(source);
    }
    catch (err) {
        return [`${expectedName}: ${err instanceof Error ? err.message : String(err)}`];
    }
    const fm = parsed.frontmatter;
    for (const field of REQUIRED_FIELDS) {
        if (fm[field] === undefined || asList(fm[field]).length === 0)
            problems.push(`${expectedName}: missing frontmatter field "${field}"`);
    }
    for (const scalar of ["name", "description", "model"]) {
        if (Array.isArray(fm[scalar]))
            problems.push(`${expectedName}: "${scalar}" must be a single value, not a list`);
    }
    if (typeof fm["name"] === "string" && fm["name"] !== expectedName)
        problems.push(`${expectedName}: name "${fm["name"]}" does not match the file name`);
    if (typeof fm["model"] === "string" && !MODELS.has(fm["model"]))
        problems.push(`${expectedName}: unknown model "${fm["model"]}"`);
    for (const skill of asList(fm["skills"])) {
        if (!NAME.test(skill)) {
            problems.push(`${expectedName}: skill name "${skill}" is not a valid identifier`);
            continue;
        }
        if (!repoResident(ctx, skill))
            problems.push(`${expectedName}: preloaded skill "${skill}" is not repo-resident (.claude/skills/${skill}/SKILL.md); preload only vendored skills`);
    }
    for (const skill of invokeSkills(parsed.body)) {
        if (repoResident(ctx, skill.replace(/^[a-z0-9-]+:/, "")))
            continue;
        if (!resolvesLocally(ctx, skill) && !prerequisites.has(skill)) {
            problems.push(`${expectedName}: skill "${skill}" neither resolves locally nor appears in docs/agent-team.md prerequisites`);
        }
    }
    for (const heading of REQUIRED_SECTIONS) {
        if (!new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(parsed.body)) {
            problems.push(`${expectedName}: missing section "${heading}"`);
        }
    }
    const disallowed = new Set(asList(fm["disallowedTools"]));
    const tools = new Set(asList(fm["tools"]));
    for (const tool of disallowed) {
        if (tools.has(tool))
            problems.push(`${expectedName}: "${tool}" is both granted in tools and listed in disallowedTools`);
    }
    if (!doc.includes(`\`${expectedName}\``))
        problems.push(`${expectedName}: not listed in docs/agent-team.md`);
    return problems;
}
export function lintAll(ctx) {
    const dir = path.join(ctx.repoRoot, ".claude", "agents");
    const docPath = path.join(ctx.repoRoot, "docs", "agent-team.md");
    const doc = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
    const problems = doc === "" ? ["docs/agent-team.md is missing"] : [];
    const prerequisites = documentedPrerequisites(doc);
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^[a-z0-9][a-z0-9-]*\.md$/.test(f)).sort() : [];
    if (files.length === 0)
        problems.push("no .claude/agents/*.md files found");
    for (const f of files) {
        problems.push(...lintAgent(f, readFileSync(path.join(dir, f), "utf8"), ctx, prerequisites, doc));
    }
    return { agents: files.length, problems };
}
