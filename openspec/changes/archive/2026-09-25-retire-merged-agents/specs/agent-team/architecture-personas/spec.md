## MODIFIED Requirements

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
