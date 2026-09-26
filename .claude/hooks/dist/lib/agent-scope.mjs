// Session-scoped tracking of the active subagent, so a PreToolUse hook can
// enforce a role's documented write scope even though PreToolUse payloads
// carry no agent identity (change `configure-phi-lanes`, task 4.3).
//
// Claude Code fires SubagentStart/SubagentStop with `agent_type` around a
// Task-tool subagent's lifetime; this module remembers that mapping in a
// small per-session state file (outside the repo, never committed) so a later
// PreToolUse call in the same session can look it up.
//
// Documented limitation: a persona run as the *main* session (for example
// `claude --agent fhir-tech-lead`) never fires SubagentStart, so its tool
// calls are not scoped here — there is no hook event that identifies a main
// session's own persona. No other harness (Codex, OpenCode, Kimi, MiniMax)
// fires a subagent-lifecycle hook event at all today (docs/agent-team.md,
// "Hook coverage per harness"), so this module is registered for Claude Code
// only; harness-hook.mts never calls it. Concurrent subagents in one session
// are not disambiguated: the most recent SubagentStart wins until the next
// SubagentStop clears it (residual limitation, documented here rather than
// silently assumed away).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { globMatch } from "./protected-paths.mjs";
function stateDir() {
    return path.join(os.tmpdir(), "fhir-server-agent-scope");
}
function stateFile(sessionId) {
    const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
    return path.join(stateDir(), `${safe}.json`);
}
/** Record that `agentType` is now the active subagent for `sessionId`. */
export function recordAgentStart(sessionId, agentType) {
    if (sessionId === "" || agentType === "")
        return;
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(stateFile(sessionId), JSON.stringify({ agent_type: agentType }));
}
/** Clear the recorded active subagent for `sessionId`, if any. */
export function clearAgentScope(sessionId) {
    if (sessionId === "")
        return;
    try {
        rmSync(stateFile(sessionId), { force: true });
    }
    catch {
        // Best-effort: a missing or unreadable state file is not an error here.
    }
}
/** The subagent recorded as active for `sessionId`, or undefined when none is recorded. */
export function activeAgentType(sessionId) {
    if (sessionId === "")
        return undefined;
    try {
        const value = JSON.parse(readFileSync(stateFile(sessionId), "utf8"));
        return typeof value.agent_type === "string" ? value.agent_type : undefined;
    }
    catch {
        return undefined;
    }
}
/** Every role's id and documented `owns` globs, from `.agent-team/team.json` (the manifest built from each role's prompt). */
export function rolesWithScope(repoRoot) {
    try {
        const manifest = JSON.parse(readFileSync(path.join(repoRoot, ".agent-team", "team.json"), "utf8"));
        return (manifest.roles ?? [])
            .filter((r) => typeof r.id === "string" && Array.isArray(r.owns))
            .map((r) => ({ id: r.id, owns: r.owns.filter((o) => typeof o === "string") }));
    }
    catch {
        return [];
    }
}
/**
 * Whether `relPath` falls within `agentId`'s documented write scope, derived
 * from `.agent-team/team.json` (which is generated from
 * `.agent-team/roles/<id>.md` "Owns"). Returns undefined when the role has no
 * recorded scope at all, so a role manifest that predates this check is never
 * silently blocked.
 */
export function isWithinOwnedScope(repoRoot, agentId, relPath) {
    const role = rolesWithScope(repoRoot).find((r) => r.id === agentId);
    if (role === undefined || role.owns.length === 0)
        return undefined;
    return role.owns.some((glob) => globMatch(glob, relPath));
}
