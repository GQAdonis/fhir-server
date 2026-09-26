# EHR integrations

**Owner:** `ehr-integration-manager` (technical design: `fhir-integration-specialist`; policy gate: `hipaa-privacy-officer`).

One folder per partner EHR: `docs/integrations/<partner>/`, containing `intake.md`, `go-live.md` and an SLA record. The process is the `ehr-integration-onboarding` skill.

**Patient-data rule:** these documents hold configuration and process only. **Never** add patient data, production endpoint URLs, client secrets or keys. Sandbox base URLs are fine. Production values belong in deployment secrets. See the `phi-lane-policy` skill (ATH-D-001).
