## 1. Protected paths

- [x] 1.1 Implement `src/lib/protected-paths.mts` (globs + per-glob reason, `*`/`**` matcher over project-relative POSIX paths) and `src/guard-generated.mts` PreToolUse hook; verify `node:test` cases deny each protected path including absolute and backslash variants, and allow `internal/store/search.go`

## 2. Go file feedback

- [x] 2.1 Implement `src/license-header.mts` PostToolUse hook for `*.go`; verify tests give feedback for a headerless fixture and none for `internal/store/store.go`
- [x] 2.2 Implement `src/gofmt-check.mts` PostToolUse hook (10s timeout, silent when gofmt absent); verify tests with an unformatted fixture produce feedback and a PATH without gofmt exits 0 silently

## 3. Session context

- [x] 3.1 Implement `src/session-context.mts` SessionStart hook (phase, `nextChange`, position-reminder head, 2 KB cap, silent without `.kbd-orchestrator/`); verify tests for both cases and that output JSON has `hookSpecificOutput.additionalContext`

## 4. Registration

- [x] 4.1 Register all four hooks in `.claude/settings.json` (exec form; PostToolUse matcher `Edit|Write|MultiEdit`; PreToolUse matcher `Edit|Write|MultiEdit|NotebookEdit`, since notebook edits carry `notebook_path` and the guard covers them too; 10s timeout) and rebuild dist; verify `check:dist` passes and a live attempt in this session to edit `internal/basedef/profiles-types.min.json.gz` is refused
