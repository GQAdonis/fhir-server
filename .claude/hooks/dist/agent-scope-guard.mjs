// Hook (SubagentStart/SubagentStop; PreToolUse on Edit/Write/MultiEdit/
// NotebookEdit): enforces a role's documented write scope for personas whose
// prompt restricts them to specific paths (change `configure-phi-lanes`, task
// 4.3, operator decision 2026-09-26). Currently enforced: `fhir-tech-lead`.
//
// Claude Code only — see `lib/agent-scope.mts` for why, and for the
// documented limitations (main-session personas, concurrent subagents).
import { allow, deny, runHook } from "./lib/hook-io.mjs";
import { activeAgentType, clearAgentScope, isWithinOwnedScope, recordAgentStart } from "./lib/agent-scope.mjs";
import { projectDir, rel } from "./lib/paths.mjs";
import { targetPath } from "./lib/protected-paths.mjs";
const ENFORCED_AGENTS = new Set(["fhir-tech-lead"]);
await runHook("agent-scope-guard", (input) => {
    const sessionId = typeof input.session_id === "string" ? input.session_id : "";
    if (input.hook_event_name === "SubagentStart") {
        if (typeof input.agent_type === "string")
            recordAgentStart(sessionId, input.agent_type);
        return allow();
    }
    if (input.hook_event_name === "SubagentStop") {
        clearAgentScope(sessionId);
        return allow();
    }
    const agentType = activeAgentType(sessionId);
    if (agentType === undefined || !ENFORCED_AGENTS.has(agentType))
        return allow();
    const target = targetPath(input.tool_input);
    if (target === undefined)
        return allow();
    const root = projectDir();
    const relative = rel(root, target);
    if (relative === null)
        return allow();
    const within = isWithinOwnedScope(root, agentType, relative);
    if (within === undefined || within)
        return allow();
    return deny(`${relative} is outside ${agentType}'s documented write scope (.agent-team/roles/${agentType}.md "Owns"). Delegate this edit to the persona that owns it.`);
});
