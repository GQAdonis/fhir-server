# Resolution — wire-hooks-per-harness

## Judge

The first dispatch returned HTTP 401: the local liter-llm gateway (localhost:4000) rejected its credential, and a retry got the same result. This needs the operator (`/liter-llm-bridge configure`), so the judge round is pending.

## fhir-security-compliance-reviewer: BLOCK (1 CRITICAL, 2 WARNING, 3 SUGGESTION)

| Finding | Resolution |
|---|---|
| CRITICAL: the Kimi/MiniMax launcher gives any repo zero-click code execution (it runs `<cwd>/.claude/hooks/dist/harness-hook.mjs` at SessionStart) | `run.mjs` now runs a project's adapter **only for allowlisted repositories**. It resolves the git top level from the payload `cwd` by real path, requires that root to be listed in a user-level allowlist (`$FHIR_GUARDS_CONFIG`, else `%APPDATA%`/`$XDG_CONFIG_HOME`/`~/.config` + `fhir-guards/roots.json`, never in a repo), and requires the adapter's real path to stay inside that root, so a symlink cannot escape. `run.mjs --allow <repo>` / `--list` manage the list, and the README and doc tell operators to allow only trusted repos. Test: before allowing, the adapter does not run; after `--allow` (given a subdirectory, the top level is recorded) it denies `AGENTS.md`; a non-allowlisted fake repo whose adapter prints PWNED produces no output. |
| WARNING: subdirectory sessions are unguarded | The adapter resolves the repo root (nearest `.git`) from the payload cwd. OpenCode uses `worktree` (the repo root) rather than `directory`. Codex commands locate the adapter via `git rev-parse --show-toplevel` (with a `commandWindows` `for /f` equivalent). Tests: an `apply_patch` from `internal/store` with a root-relative path is denied; a manual probe through the real `.codex/hooks.json` command from `internal/store` denies. |
| WARNING: the adapter's own fail-open behaviour is undocumented | `docs/agent-team.md` now states that the guard fails open in every harness on adapter error, timeout, missing adapter or unparseable output, that CI (`check:dist`, `lint:agents`) is the backstop, and which files lack a CI backstop. |
| SUGGESTION: the bypass flag is not marked test-only | The evidence row now says "test-only, never use operationally". |
| SUGGESTION: indented patch headers are missed | The regex allows leading whitespace; covered by the subdirectory test's indented header. |
| SUGGESTION: Codex `PostToolUse` → ledger always dropped | Registration removed. |

Hooks 110/110, `check:dist` up to date, `lint:agents` OK.

## fhir-code-reviewer: PASS (3 WARNING, 2 SUGGESTION)

| Finding | Resolution |
|---|---|
| The new protected globs have no direct deny tests | `guard-generated.test.mjs` `PROTECTED` now includes one path per new glob (the five harness agent dirs, `.agent-team/team.json`, `AGENTS.md`), each tested in relative, absolute POSIX and Windows forms. |
| The doc claims Codex records tool failures | The doc now says Codex has no tool-failure event, so it records only session starts and prompts. |
| The OpenCode plugin blocks its event loop with `spawnSync` | The plugin uses async `spawn` with a 10 s kill timer and awaits the result in both handlers. The plugin-module test still passes. |
| SUGGESTION: Codex `edit`/`write` are speculative | Kept as a commented defensive allowance (Codex 0.154 writes only through `apply_patch`). |
| SUGGESTION: the MiniMax `.*` matcher spawns on every tool | Narrowed to write tools. |

Hooks 117/117, `check:dist` up to date.

## fhir-security-compliance-reviewer re-review: PASS (CRITICAL closed; 4 WARNING, 7 SUGGESTION)

| Finding | Resolution |
|---|---|
| W: relative edit paths resolve against the repo root, not the session cwd (`../../AGENTS.md` from a subdirectory was allowed; `AGENTS.md` there was falsely denied) | `guardInputs` resolves relative paths against the payload `cwd` before the guard relativizes them to the repo root. Tests from `internal/store`: `../../AGENTS.md` is denied (Codex and Kimi), `testdata/golden.json` is denied as `internal/store/testdata/…`, and a local `AGENTS.md` is allowed. |
| W: the doc's subdirectory claim was inaccurate | Corrected; it now describes the session-directory resolution. |
| W: `realpathSync` keeps the input's case, so an allowlist silently misses on case variants | `realpathSync.native` (canonical case) is used for every comparison. The launcher prints a stderr notice when a repo with project hooks is not allowlisted, so the no-op is visible. The README wording is corrected. |
| W: fragile main-module detection (symlinked launcher fails open; a suffix match ran the hook; `--allow` ran on import) | `isMain()` compares `realpath(fileURLToPath(import.meta.url))` with `realpath(argv[1])` and gates all three branches. Test: importing the module with `-- --allow /tmp --yes` does not modify the allowlist. |
| S: an allowlist location controlled via env could be repo-controlled | An allowlist file whose real path is inside the judged repo is ignored (test). |
| S: `--allow` without confirmation | Requires an interactive TTY or an explicit `--yes` (test: non-interactive without `--yes` exits 1). The doc states that the allowlist trusts a path, not content. |
| S: only the entry file is realpath-contained | The whole `dist` directory is realpath-contained within the root, and the entry within `dist`. |
| S: OpenCode `worktree` may be `/` outside git | The plugin falls back to `directory` when `worktree` is a filesystem root. |
| S: OpenCode stderr piped but unread | `stdio: ["pipe","pipe","ignore"]`. |
| S: Codex without git, dubious ownership, `commandWindows` shell | Documented in the fail-open bullet. Which shell Codex uses for `commandWindows` is unverified and marked so. |
| S: `paths.mts` `rel()` prefix check is case-sensitive and doesn't resolve symlinks | Pre-existing (from `origin/main`) and outside this change's scope. Carried as a follow-up for `configure-phi-lanes` (guard work) and noted in `execution.md`. |

Hooks 117/117, harness-hook 13/13, `check:dist` up to date.
