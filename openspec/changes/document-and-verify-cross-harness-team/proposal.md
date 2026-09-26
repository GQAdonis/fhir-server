## Why

The phase is done only when the cross-harness team is documented, CI enforces it on every OS, and each new role demonstrably works in each harness on synthetic data.

## What Changes

- Rewrite `docs/agent-team.md`: 14 roles, harness matrix, model per harness per tier, PHI lanes, hook capability matrix, prerequisites.
- Update `CLAUDE.md`, and through it the generated `AGENTS.md`.
- Update the `agent-tooling.yml` CI with the manifest checks, the drift check and the guard tests.
- Update `project.json` harness preferences.
- Run the phase goal check and per-harness smoke tests.

## Capabilities

### New Capabilities

### Modified Capabilities
- `agent-team/team-verification`: adds a cross-harness acceptance requirement.

## Impact

Documentation, CI workflow and KBD project config; no Go code.
