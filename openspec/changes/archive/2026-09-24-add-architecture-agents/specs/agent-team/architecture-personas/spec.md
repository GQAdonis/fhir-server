## Purpose

Defines the agent personas that own ideation, architecture and orchestration of the KBD lifecycle for this repository, including their models, permitted scope and the hand-off contract other personas follow.

## ADDED Requirements

### Requirement: Architecture personas exist as project agents
The repository SHALL provide `fhir-tech-lead`, `fhir-ideation-strategist` and `fhir-architect` as project subagents under `.claude/agents/`. Each has `name`, a `description` stating when to delegate to it, `model: opus`, an explicit `tools` list, and a `skills` list.

#### Scenario: Agents are discoverable
- **WHEN** Claude Code is started in this repository
- **THEN** the three agents are listed as project agents and none shares a name with a user-level agent

### Requirement: Personas own specific KBD stages
`fhir-ideation-strategist` SHALL own goal discovery (`kbd-new-phase`, `kbd-goal`). `fhir-architect` SHALL own `kbd-assess`, `kbd-analyze`, `kbd-plan` and OpenSpec artifact authoring. `fhir-tech-lead` SHALL own `kbd-execute`, `kbd-status`, `kbd-goal-check` and `kbd-next-phase`, and SHALL dispatch implementation, review and validation to the other `fhir-*` personas.

#### Scenario: Plan requested
- **WHEN** the tech lead needs a phase plan
- **THEN** it delegates to `fhir-architect` rather than writing the plan itself

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
