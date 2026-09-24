# agent-tooling/hook-runtime Specification

## Purpose
Defines how this repository's Claude Code hook scripts are authored, compiled, invoked and how they report results, so that every hook behaves identically on macOS, Linux and Windows.

## Requirements

### Requirement: Hooks are Node ES modules compiled from TypeScript 7
Hook logic SHALL be authored as `.mts` sources under `.claude/hooks/src/` and compiled with TypeScript 7 into `.mjs` files under `.claude/hooks/dist/`. Hooks SHALL use only Node built-in modules at runtime.

#### Scenario: Build produces runnable modules
- **WHEN** a contributor runs `npm --prefix .claude/hooks run build`
- **THEN** every `src/**/*.mts` entry point has a corresponding `dist/**/*.mjs` that Node 24 can execute without installed dependencies

### Requirement: Compiled output stays in sync with sources
The committed `dist/` directory MUST match a fresh compilation of `src/`.

#### Scenario: Stale dist is detected
- **WHEN** a source file changes without a rebuild and `npm --prefix .claude/hooks run check:dist` runs
- **THEN** the command exits non-zero and names each out-of-date file

#### Scenario: Fresh dist passes
- **WHEN** `dist/` was produced from the current `src/`
- **THEN** `check:dist` exits 0

### Requirement: Hooks are registered in exec form
Every project hook registration in `.claude/settings.json` SHALL use exec form, with `command` set to `node` and `args` containing `${CLAUDE_PROJECT_DIR}/.claude/hooks/dist/<name>.mjs`, so no shell is involved on any platform.

#### Scenario: Registration contains no shell syntax
- **WHEN** `.claude/settings.json` is inspected
- **THEN** every hook entry has `command: "node"` and an `args` array, and no entry uses pipes, `&&`, or shell variable expansion

### Requirement: Uniform hook input and output handling
Hooks SHALL read one JSON object from stdin. They SHALL exit 0 when the action should proceed, and exit 2 with a reason on stderr only when the action must be blocked. Hooks SHALL NOT block on malformed input; they MUST log a warning and exit 0.

#### Scenario: Malformed stdin does not block work
- **WHEN** a hook receives non-JSON input
- **THEN** it exits 0 and writes a single warning line to stderr

#### Scenario: Project directory resolution
- **WHEN** `CLAUDE_PROJECT_DIR` is set
- **THEN** the hook resolves project paths from it; otherwise it uses the process working directory, with Windows path separators normalized
