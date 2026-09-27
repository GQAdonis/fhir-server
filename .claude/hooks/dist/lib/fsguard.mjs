// Small filesystem-safety helpers shared by anything that writes inside
// `.prometheus/` or a per-user state directory: never follow a symlink onto a
// write target, and provide a synchronous sleep for lock retry backoff
// (hooks run as short-lived synchronous CLIs, so there is no event loop to
// `await setTimeout` on between attempts).
import { lstatSync } from "node:fs";
/**
 * Refuse to proceed if `p` is a symlink. A hook that blindly `writeFileSync`s
 * or `mkdirSync`s a path an attacker (or another local user) has replaced with
 * a symlink would otherwise write through it to an arbitrary target. Missing
 * paths are fine (there is nothing to follow yet); anything else propagates.
 */
export function refuseSymlink(p) {
    let stat;
    try {
        stat = lstatSync(p);
    }
    catch (err) {
        if (err.code === "ENOENT")
            return;
        throw err;
    }
    if (stat.isSymbolicLink())
        throw new Error(`refusing to follow symlink at ${p}`);
}
/**
 * Block the current thread for `ms` milliseconds. Node.js explicitly permits
 * `Atomics.wait` on the main thread (unlike browsers), so this is a real
 * synchronous sleep, not a spin loop, for lock-retry backoff in a
 * synchronous CLI/hook. Falls back to a busy loop only if `Atomics.wait` is
 * unavailable in the running environment.
 */
export function sleepSync(ms) {
    try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    }
    catch {
        const until = Date.now() + ms;
        while (Date.now() < until) {
            // busy-wait fallback
        }
    }
}
