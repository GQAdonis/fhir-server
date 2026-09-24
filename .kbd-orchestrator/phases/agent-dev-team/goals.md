# Goals

- Analyze the fhir-server codebase, CI, and existing agent/skill inventory to identify the roles an agent team must cover
- Define project-scoped Claude Code agents and subagents (.claude/agents/*.md) with an assigned model, tools, and responsibilities for ideation, architecture (specs, planning, guidance), development, testing, validation, and infrastructure rollout (GitHub Actions, CI/CD, Helm, releases)
- Map each agent persona to the KBD orchestrator skills (kbd-assess/plan/apply/reflect, opsx-*) and supporting skills it uses, with hand-off points between personas
- Encode fhir-server domain rules (FHIR R4 semantics, fail-closed search, RLS tenancy, write-time indexing, license header, race-clean integration tests) into the relevant agent definitions
- Document the team (roster, model assignment rationale, persona-to-skill matrix) and verify the agents load and can be invoked
