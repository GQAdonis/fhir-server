// Files that agents must never edit by hand, each with the reason and the
// correct way to produce it. Paths are project-relative POSIX globs; `*`
// matches within one segment, `**` matches zero or more segments.
export const PROTECTED_PATHS = [
    {
        glob: "internal/basedef/*.gz",
        reason: "Embedded FHIR R4 definition bundles are generated. Regenerate them with `make refresh-definitions`.",
    },
    {
        glob: "internal/store/testdata/**",
        reason: "Golden snapshots are generated. Regenerate with `UPDATE_GOLDEN=1 go test -tags integration ./internal/store -run <Test>`.",
    },
    {
        glob: ".claude/hooks/dist/**",
        reason: "Compiled hook output. Edit `.claude/hooks/src/*.mts`, then run `npm --prefix .claude/hooks run build`.",
    },
    {
        glob: ".kbd-orchestrator/phases/*/progress.json",
        reason: "KBD runtime projection. Change state with `prometheus kbd …` or the `kbd-apply` driver, never by editing the file.",
    },
    {
        glob: ".kbd-orchestrator/current-waypoint.json",
        reason: "KBD runtime projection. Use `prometheus kbd phase|stage|change|task|revise` commands.",
    },
    {
        glob: ".kbd-orchestrator/current-waypoint.md",
        reason: "KBD runtime projection. Use `prometheus kbd` commands.",
    },
    {
        glob: ".claude/agents/**",
        reason: "Generated from the team manifest. Edit `.agent-team/roles/<id>.md` or `.agent-team/team.config.json`, then run `node scripts/agent-team/build-manifest.mjs && node scripts/agent-team/install-exports.mjs`.",
    },
    {
        glob: ".codex/agents/**",
        reason: "Generated from the team manifest. Edit `.agent-team/roles/<id>.md` or `.agent-team/team.config.json`, then run `node scripts/agent-team/build-manifest.mjs && node scripts/agent-team/install-exports.mjs`.",
    },
    {
        glob: ".opencode/agents/**",
        reason: "Generated from the team manifest. Edit `.agent-team/roles/<id>.md` or `.agent-team/team.config.json`, then run `node scripts/agent-team/build-manifest.mjs && node scripts/agent-team/install-exports.mjs`.",
    },
    {
        glob: ".kimi-code/agents/**",
        reason: "Generated from the team manifest. Edit `.agent-team/roles/<id>.md` or `.agent-team/team.config.json`, then run `node scripts/agent-team/build-manifest.mjs && node scripts/agent-team/install-exports.mjs`.",
    },
    {
        glob: ".minimax/agents/**",
        reason: "Generated from the team manifest. Edit `.agent-team/roles/<id>.md` or `.agent-team/team.config.json`, then run `node scripts/agent-team/build-manifest.mjs && node scripts/agent-team/install-exports.mjs`.",
    },
    {
        glob: ".agent-team/team.json",
        reason: "Generated from the team manifest. Edit `.agent-team/roles/<id>.md` or `.agent-team/team.config.json`, then run `node scripts/agent-team/build-manifest.mjs && node scripts/agent-team/install-exports.mjs`.",
    },
    {
        glob: "AGENTS.md",
        reason: "Generated from CLAUDE.md. Edit CLAUDE.md, then run `node scripts/agent-team/gen-agents-md.mjs`.",
    },
    {
        glob: ".kbd-orchestrator/position-reminder.txt",
        reason: "Rewritten by the KBD runtime on every transition. Use `prometheus kbd` commands.",
    },
];
function segmentMatches(pattern, segment) {
    const regex = new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
    return regex.test(segment);
}
function matchSegments(pattern, path) {
    if (pattern.length === 0)
        return path.length === 0;
    const [head, ...rest] = pattern;
    if (head === "**") {
        for (let i = 0; i <= path.length; i++) {
            if (matchSegments(rest, path.slice(i)))
                return true;
        }
        return false;
    }
    if (path.length === 0 || head === undefined)
        return false;
    return segmentMatches(head, path[0]) && matchSegments(rest, path.slice(1));
}
/**
 * Glob match of a project-relative POSIX path. Case-insensitive, because macOS
 * and Windows filesystems are, and `Internal/BaseDef/X.GZ` is the same file.
 */
export function globMatch(glob, relPath) {
    return matchSegments(glob.toLowerCase().split("/"), relPath.toLowerCase().split("/").filter((s) => s !== ""));
}
/** The protection rule covering `relPath`, if any. */
export function protectionFor(relPath) {
    return PROTECTED_PATHS.find((p) => globMatch(p.glob, relPath));
}
/** The file a file-editing tool call targets, if it names one. */
export function targetPath(toolInput) {
    if (toolInput === null || typeof toolInput !== "object")
        return undefined;
    const record = toolInput;
    const value = record["file_path"] ?? record["notebook_path"] ?? record["path"];
    return typeof value === "string" && value !== "" ? value : undefined;
}
