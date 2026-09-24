# agent-tooling/karpathy-logging Specification

## Purpose
Defines the continuous-improvement logging of agent activity (the Karpathy loop): which events are recorded, the metadata-only privacy guarantee for committed logs, and how records reach the project knowledge base and KBD boundary history on every operating system.

## Requirements

### Requirement: Agent lifecycle events are recorded
The system SHALL append exactly one JSON line to `.prometheus/agent-ledger.jsonl` for each `SubagentStart`, `SubagentStop`, `PostToolUseFailure`, `TaskCompleted` and `UserPromptSubmit` event.

#### Scenario: Subagent completion is logged
- **WHEN** a `fhir-*` subagent finishes
- **THEN** one ledger line is appended containing its `agent_type`, `agent_id`, `session_id`, event name, outcome and ISO timestamp

### Requirement: Ledger content is metadata-only
Ledger lines MUST contain only these fields: `ts`, `session_id`, `agent_type`, `agent_id`, `event`, `tool_name`, `outcome`, `kbd_phase`, `kbd_change`, `prompt_chars`. Tool inputs, tool outputs, prompt text and file contents MUST NOT be recorded.

#### Scenario: Extra input fields are dropped
- **WHEN** a hook payload includes `tool_input`, `tool_response` or `prompt`
- **THEN** the written ledger line contains none of those values

#### Scenario: Prompts are recorded by size only
- **WHEN** a `UserPromptSubmit` event is logged
- **THEN** the line carries `prompt_chars` and neither prompt text nor any hash of it (decision D-007: an unsalted hash of a short prompt can be brute-forced)

### Requirement: Session notes are scanned before they are persisted
Before a session note is written under `.prometheus/raw/`, its full content SHALL be scanned for PHI and secret patterns (SSN, MRN-like identifiers, email addresses, phone numbers, bearer tokens, `sk-` keys, database DSNs with credentials). A note with any match MUST NOT be written. Allowlisted values MUST match a reviewed entry of at least 8 characters exactly. Files that cannot be scanned as text (binary content, or over 5 MB) MUST be reported as findings.

#### Scenario: Seeded PHI blocks the write
- **WHEN** a candidate note contains `123-45-6789`
- **THEN** no file is created under `.prometheus/raw/`, a ledger line with `event: flush_blocked` and a match count (not the matched text) is appended, and the hook exits 0 with a user-visible warning

#### Scenario: Whole-tree scan
- **WHEN** `npm --prefix .claude/hooks run scan:prometheus` runs over a clean `.prometheus/`
- **THEN** it exits 0; with any match it exits non-zero and reports file and line without echoing the matched text

### Requirement: Conversation text is never committed
Files under `.prometheus/` that contain conversation text or absolute local paths (session records that capture assistant replies, prompt-snapshot caches, the knowledge-base event log) MUST be excluded from version control by `.prometheus/.gitignore` (decision D-006). All other `.prometheus/` content is committed and MUST pass the PHI/secret scan.

#### Scenario: Session reply records are ignored
- **WHEN** the knowledge base writes `knowledge/wiki/karpathy-session-<id>.md`
- **THEN** `git check-ignore` reports the file as ignored

### Requirement: Session knowledge reaches the project knowledge base
At `Stop`, `SessionEnd` and `PreCompact`, ledger lines added since the previous flush SHALL be summarized into one session note. The note SHALL be queued under `.prometheus/outbox/` and delivered to the project-scoped knowledge base by a background process, so the hook never waits on the knowledge CLI. An outbox entry MUST be removed only after the knowledge CLI accepts it; otherwise it MUST remain queued and be retried on a later flush. The hook MUST exit 0 in every case.

#### Scenario: Knowledge CLI available
- **WHEN** `pk` is on PATH and accepts the note
- **THEN** after the background delivery completes, `pk list` includes the note, the outbox entry is gone, and a `kb_ingested` ledger line is recorded

#### Scenario: Knowledge CLI unavailable
- **WHEN** `pk` is not on PATH
- **THEN** the note stays in `.prometheus/outbox/`, the hook exits 0, and the next flush retries delivery

### Requirement: KBD boundaries are recorded on every platform
Successful KBD task, change and phase boundaries SHALL invoke the Karpathy progress recorder through a Node entry point. If the recorder script or a Python interpreter cannot be found, the boundary MUST still be logged as a `boundary_degraded` ledger line and the hook MUST exit 0.

#### Scenario: Recorder available
- **WHEN** a task boundary fires and the recorder and a Python interpreter resolve
- **THEN** the recorder runs, and its result (`recorded`, `queued`, `degraded` or `duplicate`) is appended to the ledger

#### Scenario: Recorder unavailable
- **WHEN** no Python interpreter is on PATH
- **THEN** a `boundary_degraded` line is appended and the hook exits 0
