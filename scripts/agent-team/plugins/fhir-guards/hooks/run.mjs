#!/usr/bin/env node
// Launcher for the fhir-guards plugin (Kimi Code, MiniMax Code).
//
// Plugins are installed per user and fire in every project, so the launcher
// runs a project's compiled adapter ONLY for repositories the operator has
// explicitly allowed. Otherwise any cloned repo containing
// .claude/hooks/dist/harness-hook.mjs would get code execution at session start.
//
//   node run.mjs <kimi|minimax> <guard|ledger>   (hook entry point)
//   node run.mjs --allow <repo>                    (record a repo root)
//   node run.mjs --list                            (show allowed roots)
//
// The allowlist lives in the user's config dir (never in a repo):
//   $FHIR_GUARDS_CONFIG, else %APPDATA%/fhir-guards/roots.json on Windows,
//   else $XDG_CONFIG_HOME/fhir-guards/roots.json, else ~/.config/fhir-guards/roots.json.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// realpathSync.native returns the canonical on-disk case (macOS/Windows), so a
// root allowed as /Users/X/Repo matches a cwd reported as /users/x/repo.
const real = (p) => realpathSync.native(p);

export function allowlistFile(env = process.env) {
  if (env.FHIR_GUARDS_CONFIG) return env.FHIR_GUARDS_CONFIG;
  const base = process.platform === "win32" && env.APPDATA ? env.APPDATA : env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "fhir-guards", "roots.json");
}

function allowedRoots(env, repo) {
  try {
    const file = allowlistFile(env);
    // An allowlist stored inside the repository being judged is ignored: a repo
    // (or a tool loading its .env) must not be able to allow itself.
    if (repo !== undefined && existsSync(file) && (real(file) === repo || real(file).startsWith(repo + path.sep))) return [];
    const roots = JSON.parse(readFileSync(file, "utf8")).roots;
    return Array.isArray(roots) ? roots.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

/** Nearest ancestor (inclusive) that contains `.git` (a directory or a worktree file), as a real path. */
export function repoRootOf(start) {
  let dir;
  try {
    dir = real(start);
  } catch {
    return undefined;
  }
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const inside = (root, p) => p === root || p.startsWith(root + path.sep);

/** The adapter to run for this payload's cwd, or undefined when the repo is not allowed. */
export function adapterFor(cwd, env = process.env) {
  const root = repoRootOf(cwd);
  if (root === undefined) return undefined;
  const dist = path.join(root, ".claude", "hooks", "dist");
  const cli = path.join(dist, "harness-hook.mjs");
  if (!existsSync(cli)) return undefined;
  if (!allowedRoots(env, root).includes(root)) {
    process.stderr.write(`fhir-guards: ${root} has project hooks but is not allowlisted; skipping (run hooks/run.mjs --allow <repo> to enable)\n`);
    return undefined;
  }
  // Contain the whole dist directory (the adapter imports ./lib and spawns sibling hooks), not just the entry file.
  const realDist = real(dist);
  return inside(root, realDist) && inside(realDist, real(cli)) ? real(cli) : undefined;
}

function allow(repo, confirmed) {
  // Allowing a repo grants its hooks session-start execution: require an operator.
  if (!confirmed && !process.stdin.isTTY) {
    console.error("fhir-guards: --allow must be run interactively by the operator (or pass --yes)");
    process.exit(1);
  }
  const root = repoRootOf(repo);
  if (root === undefined) {
    console.error(`fhir-guards: ${repo} is not inside a git repository`);
    process.exit(1);
  }
  const file = allowlistFile();
  const roots = [...new Set([...allowedRoots(process.env, undefined), root])].sort();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ roots }, null, 2)}\n`);
  console.log(`fhir-guards: allowed ${root} (${file})`);
}

function hook(harness, name) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let cwd;
    try {
      cwd = JSON.parse(raw).cwd;
    } catch {
      cwd = undefined;
    }
    const cli = adapterFor(typeof cwd === "string" && cwd !== "" ? cwd : process.cwd());
    if (cli === undefined) process.exit(0); // not an allowed repo: do nothing
    const r = spawnSync(process.execPath, [cli, "--harness", harness, "--hook", name], { input: raw, encoding: "utf8", timeout: 10_000, windowsHide: true });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(0);
  });
}

/** True only when this file is the process entry point (also through a symlink). */
function isMain() {
  try {
    return process.argv[1] !== undefined && real(fileURLToPath(import.meta.url)) === real(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  const [a, b] = args;
  if (a === "--allow") allow(b !== undefined && b !== "--yes" ? b : process.cwd(), args.includes("--yes"));
  else if (a === "--list") console.log(allowedRoots(process.env, undefined).join("\n"));
  else hook(a, b);
}
