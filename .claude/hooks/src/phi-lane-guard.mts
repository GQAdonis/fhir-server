// Hook (PreToolUse on WebFetch/Bash/MCP-shaped tool calls): deny FHIR pulls
// against non-sandbox endpoints unless the session has a proven Tribe lane
// (`PHI_LANE=tribe` and a matching model endpoint). Policy is `phi-lane-policy`;
// this hook is a backstop and fails open on any error, like every project hook.
import { readFileSync } from "node:fs";
import path from "node:path";

import { allow, deny, runHook } from "./lib/hook-io.mjs";
import { projectDir } from "./lib/paths.mjs";
import { deniedUrl, parseSandboxes } from "./lib/phi-lane.mjs";

function loadSandboxes(root: string) {
  try {
    return parseSandboxes(readFileSync(path.join(root, ".claude", "hooks", "phi-sandboxes.json"), "utf8"));
  } catch {
    return parseSandboxes(undefined);
  }
}

await runHook("phi-lane-guard", (input) => {
  const toolName = typeof input.tool_name === "string" ? input.tool_name : "";
  const allowlist = loadSandboxes(projectDir());
  const url = deniedUrl(toolName, input.tool_input, allowlist, process.env);
  if (url === undefined) return allow();
  return deny(
    `${url} is a non-sandbox FHIR endpoint. Real PHI may be processed only on a proven Tribe lane (ATH-D-001, phi-lane-policy): set PHI_LANE=tribe with the Tribe model endpoint active, or use a public FHIR sandbox / synthetic data instead.`,
  );
});
