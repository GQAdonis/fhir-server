## Context

Built on `agent-tooling/hook-runtime`. PreToolUse deny uses `hookSpecificOutput.permissionDecision: "deny"` plus `permissionDecisionReason`. PostToolUse feedback uses `hookSpecificOutput.additionalContext`. SessionStart uses `additionalContext`.

## Goals / Non-Goals

**Goals:** mechanical enforcement of the four rules; no false blocks on ordinary edits; bounded latency.

**Non-Goals:** blocking Bash-based writes (for example `sed -i`), which hooks on Edit/Write cannot see. That is covered by the code-reviewer persona and CI. Also out of scope: running golangci-lint per edit, which is too slow.

## Decisions

- **Deny list lives in one module** (`src/lib/protected-paths.mts`) with a reason per glob, so the list and its explanations can't drift apart. `.claude/hooks/dist/**` is added because change 1 commits compiled output.
- **Glob matching without dependencies:** a small segment matcher that supports `*` and `**` over POSIX-normalized, project-relative paths. Paths outside the project are never denied.
- **Feedback, not block, for header and gofmt.** Blocking PostToolUse can't undo the write anyway; feedback makes the agent fix it in the next step.
- **`gofmt` is resolved on PATH once per invocation with a 10s `spawnSync` timeout.** It is skipped silently if absent, so Windows contributors without Go still get the other guards.

## Risks / Trade-offs

- [An agent bypasses the guard with Bash redirection] → the reviewer persona and the CI `check:dist`/golden tests catch it after the fact.
- [Legitimate golden regeneration is blocked] → golden files are regenerated with `UPDATE_GOLDEN=1 go test …` through Bash, which the guard doesn't intercept; the deny reason says exactly that.
