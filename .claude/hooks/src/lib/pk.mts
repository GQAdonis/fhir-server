// Delivery of session notes to the project knowledge base via the `pk` CLI.
//
// `pk ingest` compiles notes with an LLM and routinely takes 10+ seconds, far
// longer than a Stop hook should block. Notes are therefore queued in
// .prometheus/outbox/ and drained by a detached background process; an entry is
// deleted only after `pk` accepts it, so a failure is retried on the next flush.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PK_DRAIN_TIMEOUT_MS = 120_000;

/** Resolve how to run `pk`: PK_BIN (a binary, or a .mjs/.cjs/.js script run with node) or `pk` on PATH. */
export function pkCommand(env: NodeJS.ProcessEnv): { command: string; prefix: string[] } {
  const bin = env["PK_BIN"];
  if (bin !== undefined && bin !== "") {
    return /\.(mjs|cjs|js)$/.test(bin) ? { command: process.execPath, prefix: [bin] } : { command: bin, prefix: [] };
  }
  return { command: "pk", prefix: [] };
}

export type IngestResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export function ingest(root: string, note: string, env: NodeJS.ProcessEnv, timeoutMs: number = PK_DRAIN_TIMEOUT_MS): IngestResult {
  const { command, prefix } = pkCommand(env);
  const r = spawnSync(command, [...prefix, "ingest", "--scope", "project", "--source", "claude-hooks", note], {
    cwd: root,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    env,
  });
  if (r.error !== undefined) {
    const code = (r.error as NodeJS.ErrnoException).code;
    return { ok: false, reason: code === "ETIMEDOUT" ? "pk timed out" : code === "ENOENT" ? "pk not found" : `pk failed: ${code ?? "error"}` };
  }
  return r.status === 0 ? { ok: true } : { ok: false, reason: `pk exited ${r.status ?? "by signal"}` };
}

export function outboxDir(root: string): string {
  return path.join(root, ".prometheus", "outbox");
}

export interface DrainReport {
  readonly delivered: number;
  readonly remaining: number;
  readonly lastError?: string;
}

/** Ingest every queued note, oldest first; delete each one `pk` accepts. */
export function drainOutbox(root: string, env: NodeJS.ProcessEnv): DrainReport {
  const dir = outboxDir(root);
  if (!existsSync(dir)) return { delivered: 0, remaining: 0 };
  const notes = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  let delivered = 0;
  let lastError: string | undefined;
  for (const name of notes) {
    const file = path.join(dir, name);
    const result = ingest(root, file, env);
    if (result.ok) {
      rmSync(file, { force: true });
      delivered += 1;
    } else {
      lastError = result.reason;
      if (result.reason === "pk not found") break; // no point retrying the rest now
    }
  }
  const report: DrainReport = { delivered, remaining: notes.length - delivered };
  return lastError === undefined ? report : { ...report, lastError };
}

/** Start the background drainer and return immediately. */
export function startDetachedDrain(root: string, env: NodeJS.ProcessEnv): void {
  const drainer = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "pk-drain.mjs");
  const child = spawn(process.execPath, [drainer, root], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env,
  });
  child.unref();
}
