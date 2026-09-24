## Purpose

Defines the repository rules that Claude Code enforces mechanically while agents edit files, and the KBD position context supplied to every session, so all agent personas follow the same guardrails on every platform.

## ADDED Requirements

### Requirement: Generated and runtime-owned files are protected
An Edit or Write targeting any of the following project-root-relative paths SHALL be denied, with a reason that names how the file is correctly produced:
- `internal/basedef/*.gz`
- `internal/store/testdata/**`
- `.claude/hooks/dist/**`
- `.kbd-orchestrator/phases/*/progress.json`
- `.kbd-orchestrator/current-waypoint.json`
- `.kbd-orchestrator/current-waypoint.md`
- `.kbd-orchestrator/position-reminder.txt`

Matching MUST be applied after normalizing absolute paths and Windows separators.

#### Scenario: Embedded definition bundle
- **WHEN** an agent attempts to write `internal/basedef/profiles-types.min.json.gz`
- **THEN** the write is denied and the reason names `make refresh-definitions`

#### Scenario: Absolute Windows-style path
- **WHEN** the target is given as `C:\repo\.kbd-orchestrator\current-waypoint.json` inside a project rooted at `C:\repo`
- **THEN** the write is denied

#### Scenario: Ordinary source file
- **WHEN** an agent writes `internal/store/search.go`
- **THEN** the write proceeds

### Requirement: Go files carry the license header
After an Edit or Write of a `.go` file, the system SHALL check for the Apache 2.0 header and, when absent, return feedback to the agent naming the file. The check MUST NOT block the write.

#### Scenario: Header missing
- **WHEN** an agent creates a `.go` file without the header
- **THEN** the agent receives feedback identifying the file and the required header

### Requirement: Go files are gofmt-clean
After an Edit or Write of a `.go` file, the system SHALL run gofmt's list check on that file, bounded to 10 seconds. It returns feedback when the file is not formatted, and does nothing when gofmt is unavailable.

#### Scenario: Unformatted file
- **WHEN** an edited `.go` file is not gofmt-clean
- **THEN** the agent receives feedback naming the file

#### Scenario: gofmt not installed
- **WHEN** gofmt is not on PATH
- **THEN** the hook exits 0 without feedback

### Requirement: Sessions start with KBD position context
At session start, the system SHALL add to the agent context the active KBD phase, the next derived change, and the first lines of `.kbd-orchestrator/position-reminder.txt`, bounded to 2 KB. When KBD state is absent, nothing SHALL be added.

#### Scenario: Active phase present
- **WHEN** a session starts in a checkout with an active KBD phase
- **THEN** the context names the phase and the next change

#### Scenario: No KBD state
- **WHEN** `.kbd-orchestrator/` does not exist
- **THEN** the hook exits 0 without output
