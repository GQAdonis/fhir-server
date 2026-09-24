## Why

The team needs personas that own the front of the KBD lifecycle: ideation, specification and planning, and orchestration of everyone else. They also define the prompt contract (hand-offs, missing-skill behaviour, Karpathy rules) that every later persona reuses.

## What Changes

- Add `.claude/agents/fhir-tech-lead.md` (opus). It orchestrates KBD stages and dispatches the other `fhir-*` personas; it is usable as a main-session agent via `claude --agent fhir-tech-lead`.
- Add `.claude/agents/fhir-ideation-strategist.md` (opus). It covers feature discovery, FHIR / Implementation Guide research, and idea validation feeding KBD goals.
- Add `.claude/agents/fhir-architect.md` (opus). It covers specs, design and plans, and stewards `DESIGN.md`; its writes are limited to `openspec/`, `docs/` and `DESIGN.md`.
- Add the shared prompt sections: hand-off contract, "missing skill: name it and continue", and Karpathy practices.
- Vendor `karpathy-guidelines` into `.claude/skills/` so the Karpathy rules exist on a fresh clone.

## Capabilities

### New Capabilities
- `agent-team/architecture-personas`: the orchestration, ideation and architecture agents, their responsibilities, models and hand-offs.

### Modified Capabilities

## Impact

- New files in `.claude/agents/` and `.claude/skills/karpathy-guidelines/`.
- Five of the eleven agents run on opus; these three are part of that choice (decision D-002).
