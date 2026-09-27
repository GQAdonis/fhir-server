// Session-scoped tracking of the active subagent, so a PreToolUse hook can
// enforce a role's documented write scope even though PreToolUse payloads
// carry no agent identity (change `configure-phi-lanes`, task 4.3).
//
// Claude Code fires SubagentStart/SubagentStop with `agent_type` around a
// Task-tool subagent's lifetime; this module remembers that mapping in a
// small per-session state file (outside the repo, never committed) so a later
// PreToolUse call in the same session can look it up.
//
// Documented limitations:
// - A persona run as the *main* session (for example `claude --agent
//   fhir-tech-lead`) never fires SubagentStart, so its tool calls are not
//   scoped here — there is no hook event that identifies a main session's own
//   persona.
// - No other harness (Codex, OpenCode, Kimi, MiniMax) fires a
//   subagent-lifecycle hook event at all today (docs/agent-team.md, "Hook
//   coverage per harness"), so this module is registered for Claude Code
//   only; harness-hook.mts never calls it.
// - A Bash/shell tool call carries no `file_path`/`path`/`notebook_path`
//   field (`targetPath` finds none), so this guard never fires for it: a
//   scoped agent's shell command (e.g. `echo ... > internal/store/x.go`) is
//   not enforced, only its Edit/Write/MultiEdit/NotebookEdit tool calls are.
// - Nested subagents (an outer persona whose Task delegates to an inner one)
//   are tracked as a stack: the most recently started, not-yet-stopped agent
//   is "active", and stopping an inner agent restores the outer one rather
//   than clearing the scope outright. True *parallel* subagent execution
//   within one session is not a supported Claude Code model as far as this
//   guard assumes; if that assumption is ever wrong, this stack does not
//   disambiguate which parallel agent a given tool call belongs to.
import { chmodSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { refuseSymlink } from "./fsguard.mjs";
import { globMatch } from "./protected-paths.mjs";
/**
 * A private, per-OS-user state directory (not shared across accounts on a
 * multi-user host): created with mode 0700, and re-tightened on every call in
 * case something loosened it. If it already exists and is owned by a
 * different user, refuse to use it — writing through a directory another
 * account controls would let that account spoof or read agent-scope state.
 */
function stateDir() {
    const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
    const suffix = uid !== undefined ? String(uid) : (os.userInfo().username || "unknown").replace(/[^A-Za-z0-9._-]/g, "_");
    const dir = path.join(os.tmpdir(), `fhir-server-agent-scope-${suffix}`);
    refuseSymlink(dir);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (uid !== undefined) {
        let stat;
        try {
            stat = statSync(dir);
        }
        catch {
            stat = undefined;
        }
        if (stat !== undefined && stat.uid !== uid)
            throw new Error(`agent-scope: ${dir} is owned by another user; refusing to use it`);
    }
    try {
        chmodSync(dir, 0o700);
    }
    catch {
        // Best-effort: platforms without POSIX permission bits (e.g. Windows), or
        // a directory we don't own (caught above), leave this as a no-op.
    }
    return dir;
}
function stateFile(sessionId) {
    const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
    return path.join(stateDir(), `${safe}.json`);
}
function readStack(sessionId) {
    try {
        const value = JSON.parse(readFileSync(stateFile(sessionId), "utf8"));
        return Array.isArray(value.stack) ? value.stack.filter((s) => typeof s === "string") : [];
    }
    catch {
        return [];
    }
}
function writeStack(sessionId, stack) {
    const file = stateFile(sessionId);
    if (stack.length === 0) {
        try {
            rmSync(file, { force: true });
        }
        catch {
            // already gone: fine
        }
        return;
    }
    refuseSymlink(file);
    writeFileSync(file, JSON.stringify({ stack }));
}
/** Push `agentType` as the now-active subagent for `sessionId` (nested on top of any already-active agent). */
export function recordAgentStart(sessionId, agentType) {
    if (sessionId === "" || agentType === "")
        return;
    const stack = readStack(sessionId);
    stack.push(agentType);
    writeStack(sessionId, stack);
}
/**
 * Pop the most recent matching `agentType` entry for `sessionId`, restoring
 * whichever agent (if any) was active before it started — not a blind clear,
 * so an outer agent's scope survives an inner agent's stop.
 */
export function recordAgentStop(sessionId, agentType) {
    if (sessionId === "")
        return;
    const stack = readStack(sessionId);
    const idx = stack.lastIndexOf(agentType);
    if (idx !== -1)
        stack.splice(idx, 1);
    writeStack(sessionId, stack);
}
/** Clear every recorded active subagent for `sessionId`, if any (full reset, e.g. when the stopped agent's identity is unknown). */
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
/** The innermost (most recently started, not yet stopped) subagent for `sessionId`, or undefined when none is active. */
export function activeAgentType(sessionId) {
    if (sessionId === "")
        return undefined;
    const stack = readStack(sessionId);
    return stack.length > 0 ? stack[stack.length - 1] : undefined;
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
