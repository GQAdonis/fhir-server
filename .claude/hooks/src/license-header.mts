// Hook (PostToolUse on Edit|Write|MultiEdit): feed back a missing Apache
// license header on an edited .go file. Never blocks.
import { allow, feedback, runHook } from "./lib/hook-io.mjs";
import { goTarget, licenseFeedback } from "./lib/go-checks.mjs";
import { projectDir, rel } from "./lib/paths.mjs";

await runHook("license-header", (input) => {
  const root = projectDir();
  const file = goTarget(input.tool_input, root);
  if (file === undefined) return allow();
  const message = licenseFeedback(file, rel(root, file) ?? file);
  return message === undefined ? allow() : feedback(message);
});
