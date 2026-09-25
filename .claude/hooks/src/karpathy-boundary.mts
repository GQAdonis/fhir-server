// KBD hook bridge: record a successful task/change/phase boundary with the
// machine-level Karpathy progress recorder, from Node, on any OS.
//
//   node .claude/hooks/dist/karpathy-boundary.mjs --boundary task|change|phase [--project-root <dir>]
//
// Invoked by .kbd-orchestrator/hooks-config.json (augment entries). The KBD
// dispatcher supplies KBD_HOOK_* in the environment; they pass straight through
// to the recorder. Every outcome — including a missing recorder or Python — is
// appended to the agent ledger, and the process always exits 0.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { appendEntry, makeEntry, readKbdPosition, sanitizeId } from "./lib/ledger.mjs";
import { projectDir } from "./lib/paths.mjs";

const BOUNDARIES = new Set(["task", "change", "phase"]);
// Generous: under parallel load an interpreter (or pyenv shim) can take seconds to answer.
const PROBE_TIMEOUT_MS = 10_000;
const RECORD_TIMEOUT_MS = 12_000;

export interface Interpreter {
  readonly command: string;
  readonly prefix: readonly string[];
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** First existing recorder path, in the documented resolution order. */
export function resolveRecorder(env: NodeJS.ProcessEnv, home: string = os.homedir()): string | undefined {
  const candidates: string[] = [];
  const explicit = env["KARPATHY_RECORDER"];
  if (explicit !== undefined && explicit !== "") candidates.push(explicit);
  const kbdRoot = env["KBD_ORCHESTRATOR_ROOT"];
  if (kbdRoot !== undefined && kbdRoot !== "") {
    candidates.push(path.join(kbdRoot, "..", "karpathy-progress-memory", "scripts", "record-progress.py"));
  }
  candidates.push(path.join(home, ".claude", "skills", "karpathy-progress-memory", "scripts", "record-progress.py"));
  return candidates.find((c) => existsSync(c));
}

/** First Python 3 interpreter that answers `--version`: python3, python, py -3. */
export function resolveInterpreter(env: NodeJS.ProcessEnv): Interpreter | undefined {
  const candidates: Interpreter[] = [
    { command: "python3", prefix: [] },
    { command: "python", prefix: [] },
    { command: "py", prefix: ["-3"] },
  ];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
      encoding: "utf8",
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
      env,
    });
    if (probe.status === 0 && /Python 3\./.test(`${probe.stdout}${probe.stderr}`)) return candidate;
  }
  return undefined;
}

/** Extract the recorder's `status` from its JSON stdout (last JSON object line). */
export function recorderStatus(stdout: string): string | undefined {
  const lines = stdout.trim().split("\n").reverse();
  for (const line of lines) {
    try {
      const value = JSON.parse(line) as { status?: unknown };
      if (typeof value.status === "string") return sanitizeId(value.status);
    } catch {
      // not JSON; keep looking
    }
  }
  return undefined;
}

export function main(argv: readonly string[], env: NodeJS.ProcessEnv): string {
  const boundary = argValue(argv, "--boundary") ?? "";
  const root = argValue(argv, "--project-root") ?? projectDir(env);
  const kbd = readKbdPosition(root);
  const log = (event: string, outcome: string): string => {
    appendEntry(
      root,
      makeEntry({ ts: new Date().toISOString(), event, outcome, kbd_phase: kbd.phase, kbd_change: kbd.change }),
    );
    return `${event}:${outcome}`;
  };

  if (!BOUNDARIES.has(boundary)) return log("boundary_degraded", "bad-boundary-arg");
  const recorder = resolveRecorder(env);
  if (recorder === undefined) return log("boundary_degraded", `${boundary}:no-recorder`);
  const python = resolveInterpreter(env);
  if (python === undefined) return log("boundary_degraded", `${boundary}:no-python`);

  const run = spawnSync(
    python.command,
    [...python.prefix, recorder, "--project-root", root, "--from-hook", "--boundary", boundary],
    { cwd: root, encoding: "utf8", timeout: RECORD_TIMEOUT_MS, windowsHide: true, env },
  );
  if (run.error !== undefined) {
    const code = (run.error as NodeJS.ErrnoException).code ?? "error";
    return log("boundary_degraded", `${boundary}:${code === "ETIMEDOUT" ? "timeout" : "spawn-failed"}`);
  }
  if (run.status !== 0) return log("boundary_degraded", `${boundary}:recorder-exit-${run.status ?? "signal"}`);
  return log("boundary_recorded", `${boundary}:${recorderStatus(run.stdout) ?? "unknown"}`);
}

// Run only when executed directly (tests import the helpers).
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stderr.write(`karpathy-boundary: ${main(process.argv.slice(2), process.env)}\n`);
  } catch (err) {
    process.stderr.write(`karpathy-boundary: warning: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  process.exitCode = 0;
}
