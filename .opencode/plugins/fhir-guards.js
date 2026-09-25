// WSO2 FHIR Server project plugin for OpenCode: runs the repo's compiled hooks
// (.claude/hooks/dist) through the harness-hook adapter, so OpenCode sessions
// get the same protected-path guard and metadata-only ledger as Claude Code.
// Generated files and KBD projections are refused; see docs/agent-team.md.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Runs the adapter without blocking OpenCode's event loop; resolves with its stdout ("" on any failure).
function adapter(directory, hook, payload) {
  const cli = path.join(directory, ".claude", "hooks", "dist", "harness-hook.mjs");
  if (!existsSync(cli)) return Promise.resolve("");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, "--harness", "opencode", "--hook", hook], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    let out = "";
    const timer = setTimeout(() => child.kill(), 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (c) => (out += c));
    child.on("error", () => resolve(""));
    child.on("close", () => {
      clearTimeout(timer);
      resolve(out);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ ...payload, directory }));
  });
}

// `worktree` is the repository root; `directory` may be a subdirectory.
export const FhirGuards = async ({ directory, worktree }) => {
  // OpenCode reports worktree "/" outside a git repo; never resolve the adapter from a filesystem root.
  const root = worktree && path.dirname(worktree) !== worktree ? worktree : directory;
  return {
  "tool.execute.before": async (input, output) => {
    const out = await adapter(root, "guard", { tool: input.tool, sessionID: input.sessionID, args: output.args });
    if (out === "") return;
    let result;
    try {
      result = JSON.parse(out);
    } catch {
      return;
    }
    if (result.decision === "deny") throw new Error(result.reason);
  },
  event: async ({ event }) => {
    if (event.type === "session.created" || event.type === "session.deleted" || event.type === "session.error") {
      await adapter(root, "ledger", { hook_event_name: event.type, sessionID: event.properties?.info?.id ?? event.properties?.sessionID });
    }
  },
};
};
