// Verifies that the committed dist/ is exactly what a fresh compile of src/
// produces. Compiles into a temporary outDir, then byte-compares every file in
// both trees. Exits 1 and lists each stale, missing, or extra file on drift.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(pkgDir, "dist");
const tscBin = path.join(pkgDir, "node_modules", "typescript", "bin", "tsc");

function listFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}

if (!existsSync(tscBin)) {
  console.error("check-dist: typescript is not installed; run `npm --prefix .claude/hooks ci` first");
  process.exit(1);
}

function check(freshDir) {
  const build = spawnSync(process.execPath, [tscBin, "-p", pkgDir, "--outDir", freshDir], {
    cwd: pkgDir,
    encoding: "utf8",
  });
  if (build.status !== 0) {
    process.stderr.write(build.stdout + build.stderr);
    console.error("check-dist: compilation failed");
    return false;
  }

  const fresh = listFiles(freshDir);
  const committed = new Set(listFiles(distDir));
  const problems = [];
  for (const file of fresh) {
    if (!committed.has(file)) {
      problems.push(`missing from dist: ${file}`);
      continue;
    }
    committed.delete(file);
    const a = readFileSync(path.join(freshDir, file));
    const b = readFileSync(path.join(distDir, file));
    if (!a.equals(b)) problems.push(`stale: ${file}`);
  }
  for (const extra of committed) problems.push(`not produced by src (remove it): ${extra}`);

  if (problems.length > 0) {
    for (const p of problems) console.error(`check-dist: ${p}`);
    console.error("check-dist: run `npm --prefix .claude/hooks run build` and commit dist/");
    return false;
  }
  console.log(`check-dist: dist/ is up to date (${fresh.length} files)`);
  return true;
}

// Cleanup must run on every path, so no process.exit() before the finally.
const freshDir = mkdtempSync(path.join(tmpdir(), "hooks-dist-"));
try {
  process.exitCode = check(freshDir) ? 0 : 1;
} finally {
  rmSync(freshDir, { recursive: true, force: true });
}
