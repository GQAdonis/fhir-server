## Why

The guardrail and Karpathy hooks run only in Claude Code today. A Codex, OpenCode, Kimi or MiniMax session can therefore hand-edit generated files and leaves no ledger trail. ATH-D-004 requires wiring the same Node hook scripts wherever a harness supports hooks.

## What Changes

- Add per-harness payload adapters that map each harness's hook input onto the existing `hook-io` contract.
- Register the adapters for Codex (native hooks), OpenCode (a plugin) and Kimi (if supported). Verify MiniMax.
- Publish a hook capability matrix.

## Capabilities

### New Capabilities
- `agent-tooling/harness-hooks`: which project hooks run in which harness, how they are adapted, and the documented gaps.

### Modified Capabilities

## Impact

New adapter sources in `.claude/hooks/src/adapters/`, plus Codex hook configuration, `.opencode/plugin/`, and possibly Kimi config.
