// Hook (PreToolUse on Edit|Write|MultiEdit|NotebookEdit): refuse edits to
// generated or runtime-owned files, naming how each one is really produced.
import { allow, deny, runHook } from "./lib/hook-io.mjs";
import { projectDir, rel } from "./lib/paths.mjs";
import { protectionFor, targetPath } from "./lib/protected-paths.mjs";
await runHook("guard-generated", (input) => {
    const target = targetPath(input.tool_input);
    if (target === undefined)
        return allow();
    const relative = rel(projectDir(), target);
    if (relative === null)
        return allow();
    const rule = protectionFor(relative);
    return rule === undefined ? allow() : deny(`${relative} is protected. ${rule.reason}`);
});
