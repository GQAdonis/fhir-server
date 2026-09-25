// Hook adapter for harnesses other than Claude Code.
//   node .claude/hooks/dist/harness-hook.mjs --harness <codex|opencode|kimi|minimax> --hook <guard|ledger>
// Reads the harness's native hook payload on stdin, normalizes it to the
// Claude Code shape, runs the project's compiled hook (guard-generated or
// agent-ledger) and answers in the native contract:
//   codex, kimi, minimax: Claude-compatible JSON (hookSpecificOutput.permissionDecision) on stdout
//   opencode:             {"decision":"deny","reason":"…"} on stdout; the plugin throws on deny
// Never blocks on its own failure (exit 0 with a warning), like every project hook.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseInput } from "./lib/hook-io.mjs";
import { guardInputs, HARNESSES, ledgerInput, projectRootOf, type Harness, type NativePayload } from "./lib/harness-payload.mjs";

const dist = path.dirname(fileURLToPath(import.meta.url));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The repository root for a session directory: the nearest ancestor holding
 * `.git`. A session started in a subdirectory is still guarded against the
 * root-relative protected globs.
 */
function repoRoot(start: string | undefined): string | undefined {
  if (start === undefined) return undefined;
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

/** Run one compiled project hook with a Claude-shaped payload. */
function runProjectHook(script: string, input: unknown, root: string | undefined): { stdout: string; status: number | null } {
  const env = { ...process.env, ...(root !== undefined ? { CLAUDE_PROJECT_DIR: root } : {}) };
  const r = spawnSync(process.execPath, [path.join(dist, script)], { input: JSON.stringify(input), encoding: "utf8", env, windowsHide: true, timeout: 10_000 });
  return { stdout: r.stdout ?? "", status: r.status };
}

/** The deny reason from a guard-generated run, or undefined when it allowed. */
function denyReason(stdout: string): string | undefined {
  if (stdout.trim() === "") return undefined;
  try {
    const out = JSON.parse(stdout) as { hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string } };
    return out.hookSpecificOutput?.permissionDecision === "deny" ? out.hookSpecificOutput.permissionDecisionReason ?? "protected path" : undefined;
  } catch {
    return undefined;
  }
}

function answerDeny(harness: Harness, reason: string): void {
  if (harness === "opencode") {
    process.stdout.write(JSON.stringify({ decision: "deny", reason }));
    return;
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
}

try {
  const harness = arg("harness") as Harness | undefined;
  const hook = arg("hook");
  if (harness === undefined || !HARNESSES.includes(harness) || (hook !== "guard" && hook !== "ledger")) {
    throw new Error("usage: harness-hook --harness <codex|opencode|kimi|minimax> --hook <guard|ledger>");
  }
  const payload = parseInput(await readStdin()) as NativePayload | null;
  if (payload === null) throw new Error("ignoring malformed hook input");
  const root = repoRoot(projectRootOf(payload));
  if (hook === "guard") {
    for (const input of guardInputs(harness, payload)) {
      const reason = denyReason(runProjectHook("guard-generated.mjs", input, root).stdout);
      if (reason !== undefined) {
        answerDeny(harness, reason);
        break;
      }
    }
  } else {
    const input = ledgerInput(harness, payload);
    if (input !== undefined) runProjectHook("agent-ledger.mjs", input, root);
  }
} catch (err) {
  process.stderr.write(`[harness-hook] warning: ${err instanceof Error ? err.message : String(err)}\n`);
}
process.exitCode = 0;
