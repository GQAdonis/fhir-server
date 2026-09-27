## ADDED Requirements

### Requirement: Cross-harness acceptance
Each of the five domain roles SHALL answer a role-confirmation prompt in every harness that can run it headlessly (Claude Code, Codex, OpenCode, Kimi Code), using synthetic data only. MiniMax Code SHALL be verified by agent file presence under `MINIMAX_DATA_DIR`, plus an interactive listing when available.

#### Scenario: Domain role smoke
- **WHEN** `billing-prior-auth-specialist` is invoked in OpenCode with a synthetic prior-auth question
- **THEN** it answers within its role and cites a coverage source, with no real PHI in the prompt or output
