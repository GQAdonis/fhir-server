# Data synchronization

**Owner:** `data-sync-coordinator` (implementation changes: `fhir-integration-specialist` and the engineering roles).

- `docs/sync/<partner>.md`: sync schedule, resource types, freshness SLA and partner limits.
- `docs/sync/incidents/<yyyy-mm-dd>-<partner>.md`: incident reports (timeline, counts, error codes, root cause, fix).

The process is the `fhir-data-sync-runbook` skill.

**Patient-data rule:** record counts and error codes only. **Never** record patient identifiers, resource content, or anything that could identify a person. Suspected cross-tenant or misdirected PHI goes to `hipaa-privacy-officer` immediately (see `phi-lane-policy`).
