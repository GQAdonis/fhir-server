// Project-path helpers that behave the same on POSIX and Windows.
//
// All comparisons happen on POSIX-style strings so that a Windows path such as
// `C:\repo\internal\x.go` and its POSIX form resolve identically, regardless of
// which OS the hook is running on.

import { realpathSync } from "node:fs";

const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/;

/** Replace backslashes with forward slashes and collapse duplicate slashes. */
export function toPosix(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function isAbsolute(p: string): boolean {
  return p.startsWith("/") || WINDOWS_DRIVE.test(p);
}

/**
 * Normalize `.` and `..` segments of a POSIX-style path. Returns null when a
 * relative path climbs above its starting point (e.g. `../x`).
 */
function normalizeSegmentsOrNull(p: string): string | null {
  const prefix = p.startsWith("/") ? "/" : "";
  const out: string[] = [];
  for (const segment of p.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0 && prefix === "") return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return prefix + out.join("/");
}

function normalizeSegments(p: string): string {
  return normalizeSegmentsOrNull(p) ?? p;
}

/** Lower-case a leading drive letter so `C:/x` and `c:/x` compare equal. */
function foldDrive(p: string): string {
  return WINDOWS_DRIVE.test(p) ? p[0]!.toLowerCase() + p.slice(1) : p;
}

/** Project root: CLAUDE_PROJECT_DIR when set, otherwise the working directory. */
export function projectDir(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  const fromEnv = env["CLAUDE_PROJECT_DIR"];
  return normalizeSegments(toPosix(fromEnv !== undefined && fromEnv !== "" ? fromEnv : cwd));
}

/** The POSIX-style parent of `p`, or `p` unchanged when it has no more segments (a terminal like `/` or `c:`). */
function parentOf(p: string): string {
  const idx = p.lastIndexOf("/");
  if (idx < 0) return p;
  if (idx === 0) return "/";
  return p.slice(0, idx);
}

/**
 * Best-effort canonical form of a POSIX-style path: resolves symlinks through
 * the real filesystem. A tool call can name a file that doesn't exist yet
 * (Write on a new path), so an unresolvable path walks up to its longest
 * *existing* ancestor, resolves that, and re-appends the remaining segments —
 * a symlinked ancestor directory is still recognised even for a brand-new
 * file inside it. Never throws and never blocks: a path this platform cannot
 * resolve at all (wrong OS form, missing, inaccessible) is returned
 * unchanged, matching every project hook's fail-open behavior.
 */
function resolveReal(p: string): string {
  let dir = p;
  const suffix: string[] = [];
  for (;;) {
    try {
      const real = toPosix(realpathSync.native(dir));
      return suffix.length > 0 ? `${real.replace(/\/$/, "")}/${suffix.join("/")}` : real;
    } catch {
      const parent = parentOf(dir);
      if (parent === dir) return p;
      suffix.unshift(dir.slice(parent.length).replace(/^\//, ""));
      dir = parent;
    }
  }
}

/**
 * Path of `target` relative to `root`, POSIX-style, without a leading `./`.
 * A relative `target` is resolved against `root` first, so `../repo/x` inside
 * `/repo` is recognised as `x` rather than slipping through as "outside".
 * Both sides are resolved through the real filesystem before comparing, so a
 * symlinked path to a file under `root` is still recognised as inside it, and
 * the containment check is case-insensitive (macOS and Windows filesystems
 * are, by default; folding case on a case-sensitive filesystem costs nothing
 * but a rare false match, never a bypass — the same trade-off `globMatch`
 * makes). Returns null when `target` lies outside `root`.
 */
export function rel(root: string, target: string): string | null {
  const rootNormalized = foldDrive(normalizeSegments(toPosix(root))).replace(/\/$/, "");
  const posixTarget = toPosix(target);
  const absolute = isAbsolute(posixTarget) ? posixTarget : `${rootNormalized}/${posixTarget}`;
  const full = resolveReal(foldDrive(normalizeSegments(absolute)));
  const base = resolveReal(rootNormalized);
  const fullLower = full.toLowerCase();
  const baseLower = base.toLowerCase();
  if (fullLower === baseLower) return "";
  return fullLower.startsWith(`${baseLower}/`) ? full.slice(base.length + 1) : null;
}
