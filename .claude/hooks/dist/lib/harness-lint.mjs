// Cross-harness checks for the agent definitions generated from
// .agent-team/team.json: each harness holds exactly the roster, each file has
// the structure its harness needs, and every generated prompt carries the
// PHI-lane block and the Harness card. Drift (hand edits, stale exports) is
// checked by re-running the team scripts in check mode.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseAgent, REQUIRED_SECTIONS } from "./agent-lint.mjs";
export const PHI_HEADING = "## Patient-data lane";
/** Keys a generated Codex agent file may carry; anything else (approval_policy, model_provider, …) is rejected. */
export const CODEX_KEYS = new Set(["name", "description", "developer_instructions", "model", "model_reasoning_effort", "sandbox_mode"]);
export const CODEX_SANDBOX = new Set(["read-only", "workspace-write"]);
/** Review and archive-gate roles must be read-only in Codex. */
export const GATE_ROLES = new Set(["fhir-code-reviewer", "fhir-security-compliance-reviewer", "fhir-conformance-validator"]);
export const CARD_HEADING = "## Harness card";
/** Roster ids from .agent-team/team.json, or undefined when there is no manifest. */
export function rosterIds(repoRoot) {
    const f = path.join(repoRoot, ".agent-team", "team.json");
    if (!existsSync(f))
        return undefined;
    const manifest = JSON.parse(readFileSync(f, "utf8"));
    return manifest.roles.map((r) => r.id);
}
/** Minimal TOML reader for the flat `"key" = value` files Codex agents use. */
export function parseFlatToml(source) {
    const out = {};
    for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
        const line = raw.trim();
        if (line === "" || line.startsWith("#"))
            continue;
        const m = /^"?([A-Za-z0-9_-]+)"?\s*=\s*(.+)$/.exec(line);
        if (m === null)
            throw new Error(`unsupported TOML line: ${line.slice(0, 80)}`);
        const value = m[2];
        // Basic strings are JSON-compatible for the escapes the exporter emits.
        out[m[1]] = value.startsWith('"') ? JSON.parse(value) : value;
    }
    return out;
}
function generatedSections(where, text) {
    const problems = [];
    for (const heading of REQUIRED_SECTIONS) {
        if (!new RegExp(`^${heading}\\b`, "m").test(text))
            problems.push(`${where}: missing section "${heading}"`);
    }
    if (!text.includes(PHI_HEADING))
        problems.push(`${where}: missing "${PHI_HEADING}" block`);
    if (!text.includes(CARD_HEADING))
        problems.push(`${where}: missing "${CARD_HEADING}"`);
    return problems;
}
const mdIds = (dir) => readdirSync(dir).filter((f) => /^[a-z0-9][a-z0-9-]*\.md$/.test(f)).map((f) => f.slice(0, -3));
function mdAgent(requireName, extra) {
    return (where, source, id) => {
        try {
            const { frontmatter: fm, body } = parseAgent(source);
            const problems = [];
            if (typeof fm["description"] !== "string" || fm["description"] === "")
                problems.push(`${where}: missing description`);
            if (requireName && fm["name"] !== id)
                problems.push(`${where}: name "${String(fm["name"])}" does not match ${id}`);
            if (extra)
                problems.push(...extra(fm).map((p) => `${where}: ${p}`));
            return [...problems, ...generatedSections(where, body)];
        }
        catch (err) {
            return [`${where}: ${err instanceof Error ? err.message : String(err)}`];
        }
    };
}
export const HARNESSES = {
    codex: {
        dir: ".codex/agents",
        list: (dir) => readdirSync(dir).filter((f) => /^[a-z0-9][a-z0-9-]*\.toml$/.test(f)).map((f) => f.slice(0, -5)),
        file: (id) => `${id}.toml`,
        check: (where, source, id) => {
            try {
                const t = parseFlatToml(source);
                const problems = [];
                for (const k of ["name", "description", "developer_instructions"])
                    if (!t[k])
                        problems.push(`${where}: missing "${k}"`);
                for (const k of Object.keys(t))
                    if (!CODEX_KEYS.has(k))
                        problems.push(`${where}: key "${k}" is not allowed in a generated Codex agent`);
                if (t["sandbox_mode"] !== undefined && !CODEX_SANDBOX.has(t["sandbox_mode"]))
                    problems.push(`${where}: sandbox_mode "${t["sandbox_mode"]}" is not allowed`);
                if (GATE_ROLES.has(id) && t["sandbox_mode"] !== "read-only")
                    problems.push(`${where}: gate role must have sandbox_mode = "read-only"`);
                if (t["name"] !== undefined && t["name"] !== id)
                    problems.push(`${where}: name "${t["name"]}" does not match ${id}`);
                return [...problems, ...generatedSections(where, t["developer_instructions"] ?? "")];
            }
            catch (err) {
                return [`${where}: ${err instanceof Error ? err.message : String(err)}`];
            }
        },
    },
    opencode: {
        dir: ".opencode/agents",
        list: mdIds,
        file: (id) => `${id}.md`,
        check: mdAgent(false, (fm) => (fm["mode"] === "subagent" ? [] : [`mode must be "subagent", got "${String(fm["mode"])}"`])),
    },
    kimi: { dir: ".kimi-code/agents", list: mdIds, file: (id) => `${id}.md`, check: mdAgent(true) },
    minimax: {
        dir: ".minimax/agents",
        list: (dir) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "agent.md"))).map((e) => e.name),
        file: (id) => `${id}/agent.md`,
        check: mdAgent(true),
    },
};
/** Structure and roster checks for Codex, OpenCode, Kimi and MiniMax, plus generated sections in Claude files. */
export function lintHarnesses(repoRoot, roster) {
    const problems = [];
    for (const [name, spec] of Object.entries(HARNESSES)) {
        const dir = path.join(repoRoot, spec.dir);
        if (!existsSync(dir)) {
            problems.push(`${spec.dir}: missing (run node scripts/agent-team/install-exports.mjs)`);
            continue;
        }
        const present = spec.list(dir);
        for (const id of roster)
            if (!present.includes(id))
                problems.push(`${name}: ${spec.dir}/${spec.file(id)} is missing`);
        for (const id of present)
            if (!roster.includes(id))
                problems.push(`${name}: ${spec.dir}/${spec.file(id)} is not a roster role`);
        for (const id of roster.filter((r) => present.includes(r))) {
            problems.push(...spec.check(`${name}: ${spec.dir}/${spec.file(id)}`, readFileSync(path.join(dir, spec.file(id)), "utf8"), id));
        }
    }
    const codexConfig = path.join(repoRoot, ".codex", "config.toml");
    const registered = existsSync(codexConfig) ? readFileSync(codexConfig, "utf8") : "";
    for (const id of roster)
        if (!registered.includes(`[agents.${id}]`))
            problems.push(`codex: .codex/config.toml does not register ${id} (Codex does not auto-discover agent files)`);
    const claude = path.join(repoRoot, ".claude", "agents");
    if (existsSync(claude))
        for (const id of mdIds(claude))
            if (!roster.includes(id))
                problems.push(`claude: .claude/agents/${id}.md is not a roster role`);
    for (const id of roster) {
        const f = path.join(claude, `${id}.md`);
        if (!existsSync(f))
            problems.push(`claude: .claude/agents/${id}.md is missing`);
        else
            problems.push(...generatedSections(`claude: .claude/agents/${id}.md`, readFileSync(f, "utf8")));
    }
    return problems;
}
/** Paths under .minimax/ that git would commit: only the marker, roster agent.md files and mirrored skills are allowed. */
export function minimaxCommittableProblems(repoRoot, roster) {
    const r = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "--", ".minimax"], { cwd: repoRoot, encoding: "utf8", windowsHide: true });
    // Fail closed: if git cannot list files we cannot prove no credentials would be committed.
    if (r.status !== 0 || r.error !== undefined)
        return [`minimax: cannot list .minimax files with git (${(r.stderr || String(r.error ?? "")).trim().slice(0, 200)}); refusing to assume it is clean`];
    const allowed = new Set([".minimax/agents/.team-agents.json", ...roster.map((id) => `.minimax/agents/${id}/agent.md`)]);
    return r.stdout
        .split("\n")
        .filter((f) => f !== "" && !allowed.has(f) && !f.startsWith(".minimax/skills/"))
        .map((f) => `minimax: ${f} would be committed; only generated team files belong under .minimax (runtime data can hold credentials)`);
}
/** Run the team scripts in check mode; each failing script contributes its stderr. */
export function driftProblems(repoRoot) {
    const scripts = [
        ["scripts/agent-team/build-manifest.mjs", ["--check"]],
        ["scripts/agent-team/install-exports.mjs", ["--check"]],
        ["scripts/agent-team/gen-agents-md.mjs", ["--check"]],
        ["scripts/agent-team/mirror-skills.mjs", ["--check"]],
    ];
    const problems = [];
    for (const [script, args] of scripts) {
        const file = path.join(repoRoot, script);
        if (!existsSync(file)) {
            problems.push(`drift: ${script} is missing`);
            continue;
        }
        const r = spawnSync(process.execPath, [file, ...args], { cwd: repoRoot, encoding: "utf8", windowsHide: true });
        if (r.status !== 0) {
            const detail = (r.stderr || r.stdout).trim().split("\n").slice(0, 8).join(" | ");
            problems.push(`drift: ${script} ${args.join(" ")} failed: ${detail}`);
        }
    }
    return problems;
}
