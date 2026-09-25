// Hook: record agent lifecycle metadata to .prometheus/agent-ledger.jsonl.
// Registered for SubagentStart, SubagentStop, PostToolUseFailure,
// TaskCompleted and UserPromptSubmit. Never blocks; never records content.
import { allow, runHook } from "./lib/hook-io.mjs";
import { appendEntry, entryFromHook, readKbdPosition } from "./lib/ledger.mjs";
import { projectDir } from "./lib/paths.mjs";

await runHook("agent-ledger", (input) => {
  const root = projectDir();
  const entry = entryFromHook(input, new Date(), readKbdPosition(root));
  if (entry !== null) appendEntry(root, entry);
  return allow();
});
