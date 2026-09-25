# agent-team/architecture-personas Specification

## Purpose
Defines the agent personas that own ideation, architecture and orchestration of the KBD lifecycle for this repository, including their models, permitted scope and the hand-off contract other personas follow.

## Requirements

### Requirement: Architecture personas exist as project agents
The repository SHALL provide `fhir-tech-lead` and `fhir-architect` as project subagents in every harness location generated from the team manifest. Each has a `description` stating when to delegate to it, a hard-tier model, an explicit tools list, and a skills list. `fhir-ideation-strategist` SHALL NOT exist; its duties belong to `fhir-architect`.

#### Scenario: Agents are discoverable
- **WHEN** Claude Code is started in this repository
- **THEN** `fhir-tech-lead` and `fhir-architect` are listed as project agents, `fhir-ideation-strategist` is not, and none shares a name with a user-level agent

### Requirement: Personas own specific KBD stages
`fhir-architect` SHALL own the following:
- goal discovery and research (`kbd-new-phase`, `kbd-goal`);
- `kbd-assess`, `kbd-analyze` and `kbd-plan`;
- OpenSpec artifact authoring.

`fhir-tech-lead` SHALL own `kbd-execute`, `kbd-status`, `kbd-goal-check`, `kbd-next-phase` and `kbd-reflect` lesson curation, and SHALL dispatch implementation, review and validation to the other team roles.

#### Scenario: Plan requested
- **WHEN** the tech lead needs a phase plan
- **THEN** it delegates to `fhir-architect` rather than writing the plan itself

#### Scenario: New phase goals requested
- **WHEN** the operator asks what to build next
- **THEN** `fhir-architect` drafts the goals and `fhir-tech-lead` creates the phase

### Requirement: Architect writes are limited to design artifacts
`fhir-architect` MUST restrict file changes to `openspec/`, `docs/`, `DESIGN.md` and `.kbd-orchestrator/phases/*/` stage artifacts, and MUST cite `DESIGN.md` sections when describing behaviour.

#### Scenario: Architect asked to change Go code
- **WHEN** a request would require editing a `.go` file
- **THEN** the architect records the change in a spec or plan and hands it to an engineering persona

### Requirement: Personas degrade when a skill is missing
Every `fhir-*` agent prompt SHALL instruct the agent to state the name of any listed skill that is not available and to continue with the equivalent manual steps.

#### Scenario: Machine-local skill absent
- **WHEN** a contributor's machine lacks a listed skill
- **THEN** the agent reports `missing skill: <name>` once and completes the task without it

### Requirement: Karpathy practices are part of every persona
Every `fhir-*` agent prompt SHALL apply the `karpathy-guidelines` principles (state assumptions, simplest solution, surgical changes, verifiable success criteria). It SHALL also state that activity is recorded automatically by the project hooks and MUST NOT write prompt or tool content into `.prometheus/`.

#### Scenario: Vendored guidelines available on fresh clone
- **WHEN** the repository is freshly cloned on a machine without user-level skills
- **THEN** `.claude/skills/karpathy-guidelines/SKILL.md` is present
