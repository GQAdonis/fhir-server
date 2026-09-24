// Hook (PostToolUse on Edit|Write|MultiEdit): feed back when an edited .go file
// is not gofmt-clean. Silent when gofmt is not installed. Never blocks.
import { allow, feedback, runHook } from "./lib/hook-io.mjs";
import { goTarget, runGofmt } from "./lib/go-checks.mjs";
import { projectDir, rel } from "./lib/paths.mjs";

await runHook("gofmt-check", (input) => {
  const root = projectDir();
  const file = goTarget(input.tool_input, root);
  if (file === undefined) return allow();
  const shown = rel(root, file) ?? file;
  const outcome = runGofmt(file);
  switch (outcome.kind) {
    case "unformatted":
      return feedback(`${shown} is not gofmt-clean (CI enforces gofmt). Run \`gofmt -w ${shown}\` and re-check.`);
    case "error":
      return feedback(`gofmt could not check ${shown}: ${outcome.detail}. The file may not compile; fix it before continuing.`);
    default:
      return allow();
  }
});
