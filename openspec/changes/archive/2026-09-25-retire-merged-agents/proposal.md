## Why

ATH-D-002 merges `fhir-ideation-strategist` into `fhir-architect`, and `fhir-knowledge-curator` into tech-lead duties. The retired agents and the spec requirements that name them must go, so that no harness offers a role that no longer exists.

## What Changes

- Remove the two agents' definitions from every harness. The export stops generating them; this change removes any leftovers and references.
- Update `agent-team/architecture-personas` and `agent-team/operations-personas` to the merged ownership.
- Keep a redirect note in `docs/agent-team.md`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `agent-team/architecture-personas`: the ideation strategist is removed; the architect owns goal discovery.
- `agent-team/operations-personas`: the knowledge curator is removed; the tech lead owns the Karpathy loop duties.

## Impact

Removes `fhir-ideation-strategist` and `fhir-knowledge-curator` definitions and references.
