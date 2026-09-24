// Shared input/output contract for every project hook.
//
// A hook is a pure `handler(input) => HookResult`. `runHook` owns the process
// boundary: it reads one JSON object from stdin, calls the handler, writes the
// Claude Code hook output, and sets the exit code. Malformed input never blocks
// work — it produces a single warning and exit 0.

export type HookInput = Readonly<Record<string, unknown>> & {
  readonly hook_event_name?: string;
  readonly session_id?: string;
  readonly cwd?: string;
  readonly agent_id?: string;
  readonly agent_type?: string;
  readonly tool_name?: string;
  readonly tool_input?: unknown;
};

export type HookResult =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly reason: string }
  | { readonly kind: "feedback"; readonly text: string }
  | { readonly kind: "context"; readonly text: string }
  | { readonly kind: "warn"; readonly message: string };

export interface HookOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: 0 | 2;
}

export const allow = (): HookResult => ({ kind: "allow" });
export const deny = (reason: string): HookResult => ({ kind: "deny", reason });
export const feedback = (text: string): HookResult => ({ kind: "feedback", text });
export const context = (text: string): HookResult => ({ kind: "context", text });
export const warn = (message: string): HookResult => ({ kind: "warn", message });

/** Parse raw stdin. Returns null for empty, non-JSON, or non-object input. */
export function parseInput(raw: string): HookInput | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  try {
    const value: unknown = JSON.parse(trimmed);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    return value as HookInput;
  } catch {
    return null;
  }
}

/** Map a handler result onto the Claude Code hook output contract. */
export function renderResult(result: HookResult, eventName: string): HookOutput {
  switch (result.kind) {
    case "allow":
      return { stdout: "", stderr: "", exitCode: 0 };
    case "deny":
      if (eventName === "PreToolUse") {
        const body = {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: result.reason,
          },
        };
        return { stdout: JSON.stringify(body), stderr: "", exitCode: 0 };
      }
      // Events without a permission decision block via exit 2 + stderr reason.
      return { stdout: "", stderr: `${result.reason}\n`, exitCode: 2 };
    case "feedback":
    case "context": {
      const body = {
        hookSpecificOutput: { hookEventName: eventName, additionalContext: result.text },
      };
      return { stdout: JSON.stringify(body), stderr: "", exitCode: 0 };
    }
    case "warn":
      return {
        stdout: JSON.stringify({ systemMessage: result.message }),
        stderr: "",
        exitCode: 0,
      };
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Process entry point for a hook. Any thrown error is reported as a warning
 * and exits 0: a broken hook must never stop an agent from working.
 */
export async function runHook(
  name: string,
  handler: (input: HookInput) => HookResult | Promise<HookResult>,
): Promise<void> {
  let output: HookOutput;
  try {
    const input = parseInput(await readStdin());
    if (input === null) {
      output = { stdout: "", stderr: `[${name}] warning: ignoring malformed hook input\n`, exitCode: 0 };
    } else {
      const result = await handler(input);
      output = renderResult(result, input.hook_event_name ?? "");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    output = { stdout: "", stderr: `[${name}] warning: hook failed: ${message}\n`, exitCode: 0 };
  }
  if (output.stdout !== "") process.stdout.write(output.stdout);
  if (output.stderr !== "") process.stderr.write(output.stderr);
  process.exitCode = output.exitCode;
}
