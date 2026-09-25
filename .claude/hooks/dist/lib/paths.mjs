// Project-path helpers that behave the same on POSIX and Windows.
//
// All comparisons happen on POSIX-style strings so that a Windows path such as
// `C:\repo\internal\x.go` and its POSIX form resolve identically, regardless of
// which OS the hook is running on.
const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/;
/** Replace backslashes with forward slashes and collapse duplicate slashes. */
export function toPosix(p) {
    return p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}
function isAbsolute(p) {
    return p.startsWith("/") || WINDOWS_DRIVE.test(p);
}
/**
 * Normalize `.` and `..` segments of a POSIX-style path. Returns null when a
 * relative path climbs above its starting point (e.g. `../x`).
 */
function normalizeSegmentsOrNull(p) {
    const prefix = p.startsWith("/") ? "/" : "";
    const out = [];
    for (const segment of p.split("/")) {
        if (segment === "" || segment === ".")
            continue;
        if (segment === "..") {
            if (out.length === 0 && prefix === "")
                return null;
            out.pop();
            continue;
        }
        out.push(segment);
    }
    return prefix + out.join("/");
}
function normalizeSegments(p) {
    return normalizeSegmentsOrNull(p) ?? p;
}
/** Lower-case a leading drive letter so `C:/x` and `c:/x` compare equal. */
function foldDrive(p) {
    return WINDOWS_DRIVE.test(p) ? p[0].toLowerCase() + p.slice(1) : p;
}
/** Project root: CLAUDE_PROJECT_DIR when set, otherwise the working directory. */
export function projectDir(env = process.env, cwd = process.cwd()) {
    const fromEnv = env["CLAUDE_PROJECT_DIR"];
    return normalizeSegments(toPosix(fromEnv !== undefined && fromEnv !== "" ? fromEnv : cwd));
}
/**
 * Path of `target` relative to `root`, POSIX-style, without a leading `./`.
 * A relative `target` is resolved against `root` first, so `../repo/x` inside
 * `/repo` is recognised as `x` rather than slipping through as "outside".
 * Returns null when `target` lies outside `root`.
 */
export function rel(root, target) {
    const base = foldDrive(normalizeSegments(toPosix(root))).replace(/\/$/, "");
    const posixTarget = toPosix(target);
    const absolute = isAbsolute(posixTarget) ? posixTarget : `${base}/${posixTarget}`;
    const full = foldDrive(normalizeSegments(absolute));
    if (full === base)
        return "";
    return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : null;
}
