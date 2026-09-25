// Normalize hook payloads from other harnesses (Codex, OpenCode, Kimi Code,
// MiniMax Code) into the Claude Code shape the project hooks already accept.
// Pure functions; the process boundary lives in harness-hook.mts.
import path from "node:path";
export const HARNESSES = ["codex", "opencode", "kimi", "minimax"];
/** Keys other harnesses use for a single edited file. */
const PATH_KEYS = ["file_path", "filePath", "filepath", "path", "notebook_path", "target_file"];
/** `*** Update File: x`, `*** Add File: x`, `*** Delete File: x`, `*** Move to: x` (Codex apply_patch, OpenCode patch). */
const PATCH_HEADER = /^\s*\*\*\* (?:Update File|Add File|Delete File|Move to): (.+?)\s*$/gm;
/** Every string value in a (nested) tool input, for patch-text scanning. */
function strings(value, out = [], depth = 0) {
    if (depth > 6)
        return out;
    if (typeof value === "string")
        out.push(value);
    else if (Array.isArray(value))
        for (const v of value)
            strings(v, out, depth + 1);
    else if (value !== null && typeof value === "object")
        for (const v of Object.values(value))
            strings(v, out, depth + 1);
    return out;
}
/**
 * Files a tool call would write, from direct path fields and from patch text.
 * Order-preserving and de-duplicated.
 */
export function editedPaths(toolInput) {
    const found = [];
    if (toolInput !== null && typeof toolInput === "object" && !Array.isArray(toolInput)) {
        const record = toolInput;
        for (const key of PATH_KEYS) {
            const v = record[key];
            if (typeof v === "string" && v !== "")
                found.push(v);
        }
        // MultiEdit-style arrays of edits with their own paths.
        for (const v of Object.values(record)) {
            if (Array.isArray(v))
                for (const item of v)
                    if (item !== null && typeof item === "object")
                        found.push(...editedPaths(item));
        }
    }
    for (const s of strings(toolInput))
        for (const m of s.matchAll(PATCH_HEADER))
            found.push(m[1]);
    return [...new Set(found)];
}
/** Native tool names that write files, per harness (lower-cased for comparison). */
const WRITE_TOOLS = {
    // Codex 0.154 writes files only through apply_patch; edit/write are a defensive allowance for future tool names.
    codex: ["apply_patch", "edit", "write"],
    opencode: ["edit", "write", "patch", "multiedit"],
    kimi: ["writefile", "strreplacefile", "edit", "write"],
    minimax: ["write", "edit", "multiedit", "apply_patch", "write_file", "edit_file"],
};
export function isWriteTool(harness, tool) {
    return WRITE_TOOLS[harness].includes(tool.toLowerCase());
}
/** Drop undefined fields (the hook-io types use exact optional properties). */
function compact(o) {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
export function projectRootOf(p) {
    const v = p.cwd ?? p.directory;
    return typeof v === "string" && v !== "" ? v : undefined;
}
/**
 * Claude-shaped PreToolUse inputs for the guard: one per edited file, or none
 * when the tool does not write files. A file path is passed as `file_path`,
 * which the guard resolves against the project root.
 */
export function guardInputs(harness, p) {
    const tool = p.tool_name ?? p.tool ?? "";
    if (!isWriteTool(harness, tool))
        return [];
    const toolInput = p.tool_input ?? p.args;
    const cwd = projectRootOf(p);
    // Paths are relative to the session directory (which may be a subdirectory),
    // so make them absolute before the guard relativizes them to the repo root.
    const absolute = (file) => (cwd !== undefined && !path.isAbsolute(file) && !/^[A-Za-z]:[\\/]/.test(file) ? path.resolve(cwd, file) : file);
    return editedPaths(toolInput).map((file) => compact({
        hook_event_name: "PreToolUse",
        session_id: p.session_id ?? p.sessionID,
        cwd: projectRootOf(p),
        tool_name: "Edit",
        tool_input: { file_path: absolute(file) },
    }));
}
/**
 * Map native lifecycle events onto the events the ledger records. A harness
 * session start/end is recorded as SubagentStart/SubagentStop with the harness
 * as agent_type. Per-turn Stop events are deliberately not recorded.
 */
const LEDGER_EVENTS = {
    SessionStart: "SubagentStart",
    "session.created": "SubagentStart",
    SessionEnd: "SubagentStop",
    "session.deleted": "SubagentStop",
    PostToolUseFailure: "PostToolUseFailure",
    "session.error": "PostToolUseFailure",
    UserPromptSubmit: "UserPromptSubmit",
    SubagentStart: "SubagentStart",
    SubagentStop: "SubagentStop",
};
/** Claude-shaped ledger input, or undefined for events the ledger does not record. */
export function ledgerInput(harness, p) {
    const event = p.hook_event_name !== undefined ? LEDGER_EVENTS[p.hook_event_name] : undefined;
    if (event === undefined)
        return undefined;
    return compact({
        hook_event_name: event,
        session_id: p.session_id ?? p.sessionID ?? `${harness}-unknown`,
        cwd: projectRootOf(p),
        agent_type: p.agent_type ?? harness,
        agent_id: p.agent_id,
        tool_name: p.tool_name ?? p.tool,
    });
}
