## Purpose

Defines how the project's guardrail and Karpathy logging hooks run in harnesses other than Claude Code, and how unsupported harnesses are documented.

## ADDED Requirements

### Requirement: Guard and ledger hooks run where a harness supports hooks
For each harness with a native hook or plugin mechanism, the protected-path guard SHALL deny edits to generated or runtime-owned files, and the agent ledger SHALL record session and tool-failure events, using the same Node hook scripts as Claude Code.

#### Scenario: Protected edit in Codex
- **WHEN** a Codex session attempts to edit `internal/basedef/profiles-types.min.json.gz`
- **THEN** the edit is denied with the same reason Claude Code gives

### Requirement: Capability matrix is published
`docs/agent-team.md` SHALL list, for each of the five harnesses, whether guard, ledger, license, gofmt and flush hooks are supported, partial or unsupported, with evidence for each claim.

#### Scenario: Unsupported harness
- **WHEN** a harness has no hook mechanism
- **THEN** the matrix marks it unsupported and states the reduced protection
