// Hook (SessionStart): tell every session where KBD stands — active phase,
// next derived change, and the head of the runtime position reminder — so no
// persona starts work from stale assumptions. Silent without KBD state.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { allow, context, runHook } from "./lib/hook-io.mjs";
import { projectDir } from "./lib/paths.mjs";
import { buildSessionContext } from "./lib/session.mjs";
await runHook("session-context", () => {
    const kbd = path.join(projectDir(), ".kbd-orchestrator");
    if (!existsSync(kbd))
        return allow();
    const read = (name) => {
        try {
            return readFileSync(path.join(kbd, name), "utf8");
        }
        catch {
            return undefined;
        }
    };
    const text = buildSessionContext(read("current-waypoint.json"), read("position-reminder.txt"));
    return text === undefined ? allow() : context(text);
});
