## Why

Several of this repo's hardest rules are mechanical, and a prompt is a weak guarantee for them:
- generated files must be regenerated, never hand-edited;
- KBD projections must never be hand-edited;
- every `.go` file carries the Apache header;
- Go code is gofmt-clean.

Enforcing them with hooks gives every persona, in any tool session, the same guardrails. Separately, a session-start hook gives each agent the current KBD position without a manual read.

## What Changes

- `session-context` (SessionStart): injects the current KBD phase, next derived change, and the position reminder head as bounded additional context.
- `guard-generated` (PreToolUse on Edit/Write): denies writes to generated or runtime-owned paths, naming the correct regeneration command.
- `license-header` (PostToolUse on `.go` writes): feeds back a missing Apache header.
- `gofmt-check` (PostToolUse on `.go` writes): feeds back gofmt failures, within a 10s cap.
- Registration of all four in `.claude/settings.json`, in exec form.

## Capabilities

### New Capabilities
- `agent-tooling/guardrail-hooks`: the project rules enforced mechanically at edit time and the context provided at session start.

### Modified Capabilities

## Impact

- New hook sources and dist under `.claude/hooks/`, and new entries in `.claude/settings.json`.
- Edits to `internal/basedef/*.gz`, `internal/store/testdata/**`, `.claude/hooks/dist/**` and KBD projections are refused inside Claude Code sessions.
