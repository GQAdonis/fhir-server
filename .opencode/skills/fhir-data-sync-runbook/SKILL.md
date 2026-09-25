---
name: fhir-data-sync-runbook
description: Operate recurring data synchronization from partner EHRs into this FHIR server — Bulk Data $export scheduling with _since, NDJSON ingest, reconciliation of counts and versions, retries, and sync incident handling. Use when setting or changing a sync schedule, investigating missing or stale data, reconciling counts, or writing a sync incident report.
license: Apache-2.0
---

# FHIR data sync runbook

Owner: `data-sync-coordinator`, which writes to `docs/sync/`. Implementation changes go to `fhir-integration-specialist` and the engineering roles. Real partner data flows only on a Tribe lane (`phi-lane-policy`).

## Sync model

- **Initial load:** `Group/[id]/$export` (preferred) or `Patient/$export`, with `_type` limited to the agreed resource types.
- **Incremental:** the same export with `_since=<transactionTime of the last successful export>`. Store `transactionTime` from the completion manifest, not wall-clock time.
- **Kick-off → poll → download:**
  - poll the `Content-Location` status URL, honouring `Retry-After`;
  - download NDJSON with the access token if `requiresAccessToken` is true;
  - process the `error` array (OperationOutcome NDJSON).
- **Ingest:**
  - write resources through this server's normal write path (a transaction bundle per batch), so indexing (`sp_*` tables), versioning, referential-integrity checks and tenant scoping all apply;
  - set `meta.source` to the partner identifier;
  - on a Tribe lane, add `Provenance` pointing to the partner.
- **Ordering:** load referenced resources (Patient, Practitioner, Organization, Encounter) before referencing ones. Otherwise the integrity check returns 422.
- **Deletes:** Bulk `$export` does not report deletions. Reconcile them with periodic full exports or partner-specific delete feeds, and soft-delete here.

## Schedule record (`docs/sync/<partner>.md`)

| Field | Example |
|---|---|
| Resource types | Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance |
| Cadence | incremental daily 02:00 partner time; full weekly |
| Freshness SLA | ≤ 24 h |
| Partner limits | max concurrent exports, rate limit, maintenance window |
| Last good `transactionTime` | stored in operational config, not this doc |

## Reconciliation (after each run)

1. For each resource type, compare the partner count (from the manifest `output[].count`) with the ingested count.
2. List failed rows (validation 400/422, integrity 422) by error code. Record counts, never resource content.
3. Spot-check version drift: `meta.lastUpdated` on the partner side is at most our ingest time.
4. When drift exceeds the threshold (default 0.5% or any missing Patient), open an incident.

## Incident procedure

1. Pause the schedule for the partner if data corruption is suspected.
2. Record in `docs/sync/incidents/<yyyy-mm-dd>-<partner>.md`: timeline, counts, error codes, root cause and fix. **No patient identifiers or clinical content.**
3. If PHI may have gone to a wrong tenant or destination, escalate immediately to `hipaa-privacy-officer` (possible breach; the Breach Notification Rule clock starts at discovery).
4. Re-run from the last good `transactionTime` after the fix; confirm reconciliation passes.

## Sandboxes for synthetic testing

SMART Health IT bulk-data server (https://bulk-data.smarthealthit.org), the HAPI public server, and the Epic/Oracle Health developer sandboxes.
