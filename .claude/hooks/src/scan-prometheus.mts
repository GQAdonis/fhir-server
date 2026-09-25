// CLI: scan the committable text files under .prometheus/ (or the directory
// given as the first argument) for PHI and secrets. Exits 1 when anything
// matches, printing file:line:column and the rule id — never the matched text.
//
// By default only files git would commit are scanned (tracked, plus untracked
// files not excluded by .gitignore), because gitignored local state such as
// session reply records never reaches the repository. `--all` scans every file.
// Outside a git work tree, every file is scanned.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAllowlist, scanText, validateAllowlist } from "./lib/scan.mjs";

const MAX_BYTES = 5 * 1024 * 1024;

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function looksBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0);
}

// npm runs scripts from .claude/hooks/, so default to the repository that
// contains this script (dist/ -> hooks/ -> .claude/ -> repo) unless Claude
// Code supplied CLAUDE_PROJECT_DIR or a directory was passed explicitly.
const repoRoot = process.env["CLAUDE_PROJECT_DIR"] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = process.argv.slice(2);
const scanAll = args.includes("--all");
const root = args.find((a) => !a.startsWith("--")) ?? path.join(repoRoot, ".prometheus");
if (!existsSync(root)) {
  console.log(`scan-prometheus: ${root} does not exist; nothing to scan`);
  process.exit(0);
}

const allowlistFile = path.join(root, "scan-allowlist.json");
const { accepted: allowlist, rejected: rejectedEntries } = validateAllowlist(
  parseAllowlist(existsSync(allowlistFile) ? readFileSync(allowlistFile, "utf8") : undefined),
);

// Report how many entries are allowlisted, never their values: scan output can
// land in CI logs, and an allowlisted value is exactly what would leak there.
// Reviewers read the entries in the committed scan-allowlist.json instead.
const allowCount = (allowlist.literals ?? []).length;
if (allowCount > 0) {
  console.log(`scan-prometheus: ${allowCount} allowlisted literal(s) in ${path.basename(allowlistFile)} — review them in the file, not in this output`);
}

/** Committable files under `dir` per git, or undefined when `dir` is not in a work tree. */
function committableFiles(dir: string): string[] | undefined {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."], {
    cwd: dir,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.error !== undefined || r.status !== 0) return undefined;
  return r.stdout.split("\0").filter((f) => f !== "").map((f) => path.join(dir, f)).filter((f) => existsSync(f));
}

let files: string[] = [];
const fromGit = scanAll ? undefined : committableFiles(root);
if (fromGit === undefined) walk(root, files);
else files = fromGit;
console.log(`scan-prometheus: scope = ${fromGit === undefined ? "all files" : "committable files (git)"}`);
let hits = 0;
if (rejectedEntries > 0) {
  // The allowlist itself is committed: entries that look like real data are findings.
  console.error(`scan-prometheus: ${path.basename(allowlistFile)}: ${rejectedEntries} entr${rejectedEntries === 1 ? "y is" : "ies are"} not synthetic (only example.*/.invalid/.test/.localhost emails and noreply@anthropic.com may be allowlisted) — remove them`);
  hits += rejectedEntries;
}
let scanned = 0;
for (const file of files.sort()) {
  if (path.resolve(file) === path.resolve(allowlistFile)) continue;
  if (statSync(file).size > MAX_BYTES) {
    console.error(`scan-prometheus: ${path.relative(root, file)}: skipped (over 5 MB) — review manually`);
    hits += 1;
    continue;
  }
  const buf = readFileSync(file);
  if (looksBinary(buf)) {
    // Fail closed: a NUL byte could hide UTF-16 or appended text from the scan.
    console.error(`scan-prometheus: ${path.relative(root, file).split(path.sep).join("/")}: binary content not scanned — review manually or remove`);
    hits += 1;
    continue;
  }
  scanned += 1;
  for (const m of scanText(buf.toString("utf8"), allowlist)) {
    hits += 1;
    console.error(`scan-prometheus: ${path.relative(root, file).split(path.sep).join("/")}:${m.line}:${m.column}: ${m.rule}`);
  }
}

if (hits > 0) {
  console.error(`scan-prometheus: ${hits} finding(s) in ${scanned} file(s); remove the content or add a reviewed literal to scan-allowlist.json`);
  process.exitCode = 1;
} else {
  console.log(`scan-prometheus: clean (${scanned} file(s) scanned)`);
}
