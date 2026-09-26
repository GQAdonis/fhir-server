# Goals

- Use the agent-team-creator skill to research and determine the agent team this project needs as an intermediate EHR for AI, and convert the existing 11 fhir-* agents to that team-member format where conversion is needed
- Add a HIPAA expert role (Privacy, Security and Breach Notification rules, minimum necessary, BAAs, audit and access controls) for PHI flowing in from other EHR systems
- Add a FHIR protocol and integration specialist role (FHIR R4 REST/Bulk Data, SMART on FHIR/backend services auth, US Core, patient matching, pulling patient data from external EHRs into this server)
- Add business-level roles for managing EHR integrations and for coordinating data synchronization and interactions with external EHR systems (onboarding, sync schedules, reconciliation, incident handling)
- Add a billing specialist role covering prior-authorization workflows, payer rules, claim denial and dispute/appeal resolution, and payer-specific documentation requirements that determine what must be recorded to bill each procedure
- Generate equivalent agent definitions for Codex, Claude Code, OpenCode, Kimi Code and MiniMax CLI from a single source so the same team works in every harness
- Use Firecrawl web search to find suitable skills for each role, install them locally in this project, and record in every agent card its skills, tools, and the best model per harness
