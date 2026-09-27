## MODIFIED Requirements

### Requirement: Agent definitions are linted
A lint command SHALL fail when any of the following holds:
- a generated agent definition in any harness location (`.claude/agents/`, `.codex/agents/`, `.opencode/agents/`, `.kimi-code/agents/`, `.minimax/agents/`) has invalid structure for its format;
- a Claude definition names a model other than `opus`, `sonnet`, `haiku`, `fable` or `inherit`;
- a skill neither resolves locally nor appears in the prerequisites table;
- a required prompt section, the PHI-lane block or the Harness card is missing;
- any installed definition differs from a fresh export of `.agent-team/team.json`.

#### Scenario: Unknown skill added
- **WHEN** an agent lists a skill that is neither installed nor documented as a prerequisite
- **THEN** the lint exits non-zero naming the agent and the skill

#### Scenario: Drift
- **WHEN** an installed definition differs from the manifest export
- **THEN** the lint exits non-zero naming the harness and file
