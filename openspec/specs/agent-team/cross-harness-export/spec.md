# agent-team/cross-harness-export Specification

## Purpose
Defines how the team manifest is turned into native agent definitions for Claude Code, Codex, OpenCode, Kimi Code and MiniMax Code, where they are installed, and which per-harness limitations are documented rather than hidden.

## Requirements

### Requirement: Each harness has generated definitions for every role
For every role in the manifest, the repository SHALL contain a generated definition in the following locations:
- `.claude/agents/<id>.md`;
- `.codex/agents/<id>.toml`;
- `.opencode/agents/<id>.md`;
- `.kimi-code/agents/<id>.md`;
- `.minimax/agents/<id>/agent.md`.

#### Scenario: Role coverage
- **WHEN** the manifest has 14 roles
- **THEN** each of the five locations contains exactly those 14 role definitions

### Requirement: Generated files are not hand-edited
A drift check SHALL regenerate every harness definition and `AGENTS.md` from their sources and fail on any byte difference.

#### Scenario: Hand edit
- **WHEN** a generated `.codex/agents/<id>.toml` is edited by hand
- **THEN** the drift check fails naming the file

### Requirement: Per-harness limitations are explicit
Where a harness ignores a field (Kimi's per-role model) or lacks a capability (MiniMax Code has no agent selector for `exec`; its agents load from `MINIMAX_DATA_DIR`), the generated definition SHALL still carry the information as Harness-card text, and `docs/agent-team.md` SHALL list the limitation.

#### Scenario: Kimi model
- **WHEN** a Kimi definition is generated
- **THEN** its body states the intended model even though Kimi ignores the frontmatter field

### Requirement: Non-Claude harnesses get project instructions
`AGENTS.md` SHALL be generated from `CLAUDE.md`, changing only the title (`# AGENTS.md`) and the harness-specific lead line.

#### Scenario: Instruction parity
- **WHEN** `CLAUDE.md` changes and `AGENTS.md` is not regenerated
- **THEN** the drift check fails
