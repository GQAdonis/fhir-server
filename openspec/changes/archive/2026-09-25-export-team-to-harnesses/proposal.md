## Why

The team manifest only matters once every harness can load the same roles. Exports must be generated, reviewed and installed without clobbering existing native configuration. Any drift between the manifest and the installed files must fail CI.

## What Changes

- Export the manifest with `agent-team-creator export` to Claude, Codex, OpenCode, Kimi and MiniMax staging directories, and review the diagnostics.
- Install the definitions:
  - `.claude/agents/`, regenerated and replacing the hand-written files;
  - `.codex/agents/*.toml`;
  - `.opencode/agents/*.md`;
  - `.kimi-code/agents/*.md`;
  - `.minimax/agents/<name>/agent.md` (ATH-D-003).
- Generate `AGENTS.md` from `CLAUDE.md` for the non-Claude harnesses.
- Extend `lint:agents` with a drift check across all harnesses, and a card check.

## Capabilities

### New Capabilities
- `agent-team/cross-harness-export`: how agent definitions are generated and installed for each harness, and the per-harness limitations.

### Modified Capabilities
- `agent-team/team-verification`: the lint now covers generated files in every harness plus drift against the manifest.

## Impact

New `.codex/agents/`, `.opencode/agents/`, `.kimi-code/agents/`, `.minimax/agents/` and `AGENTS.md`. `.claude/agents/` becomes generated.
