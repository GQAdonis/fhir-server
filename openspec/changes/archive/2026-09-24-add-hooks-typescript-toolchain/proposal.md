## Why

The agent team needs Claude Code hooks that run the same on macOS, Linux and Windows. Shell-form hooks don't meet that bar, and the repo has no toolchain for writing hooks in TypeScript. This change provides the foundation that every later hook change builds on.

## What Changes

- Add `.claude/hooks/`, a Node package with `typescript@7.0.2` and `@types/node@24` as devDependencies.
- Add a `tsconfig.json` that compiles `src/**/*.mts` to `dist/**/*.mjs`.
- Add a shared hook runtime library for stdin JSON parsing, structured output, exit semantics and project-path resolution.
- Commit the compiled `dist/`, with a `check:dist` freshness script, so contributors need no build step to use the hooks.
- Add a `node:test` unit suite for the library.
- Add a project `.claude/settings.json` skeleton. Hook entries are added by later changes.
- Add the missing Apache license header to `internal/config/example_parse_test.go`, which would otherwise block the `license-header` constraint for every change in this phase.

## Capabilities

### New Capabilities
- `agent-tooling/hook-runtime`: how project hook scripts are built, invoked and behave across operating systems.

### Modified Capabilities

## Impact

- New files under `.claude/hooks/` and `.claude/settings.json`.
- Contributors who edit hook sources need Node 24 and `npm`. Contributors who only use the hooks need just `node` on PATH.
- One Go test file gets a comment header; there is no behaviour change.
