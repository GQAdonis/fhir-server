## Why

Tribe Health Solutions' local models are the only BAA-covered provider (ATH-D-001). The team needs a safe path to real PHI through those models and a hard default of synthetic data everywhere else. Nothing should depend on endpoint details that are not yet known.

## What Changes

- Add provider configuration templates for Tribe's endpoint (OpenCode, Codex, Kimi) that use environment variables only.
- Add a `phi-lane-guard` hook: FHIR pulls against non-sandbox endpoints are denied unless the session declares `PHI_LANE=tribe` and the active model endpoint matches `TRIBE_MODEL_BASE_URL`.
- Register the guard in every adapter from `wire-hooks-per-harness`.

## Capabilities

### New Capabilities
- `agent-tooling/phi-lanes`: which sessions may touch real PHI, and how the guard and templates enforce the synthetic default.

### Modified Capabilities

## Impact

New templates in `.opencode/`, `.codex/` and `.kimi-code/`, plus a new hook source and its registration in each harness. No live PHI lane is activated.
