---
name: ehr-integration-onboarding
description: Onboard a partner EHR (Epic, Oracle Health/Cerner, athenahealth, eClinicalWorks, or any FHIR R4 server) as a data source for this intermediate EHR. Use when planning a new EHR connection, registering a SMART backend-services client, writing a go-live checklist, defining integration SLAs, or triaging an HL7/FHIR connection incident.
license: Apache-2.0
---

# EHR integration onboarding

Owner: `ehr-integration-manager`, which writes to `docs/integrations/<partner>/`. Technical design: `fhir-integration-specialist`. Policy gate: `hipaa-privacy-officer`. Follow `phi-lane-policy` throughout.

## Stages

1. **Intake**: record the following in `docs/integrations/<partner>/intake.md`:
   - partner and EHR vendor/version;
   - FHIR base URL for the **sandbox** only (production URLs go into deployment config, never the repo);
   - FHIR version and the US Core version claimed;
   - data categories requested and the use case;
   - partner contacts as roles or titles only, referencing the external contact system (no personal names, emails or phone numbers in the repo).
2. **Legal and privacy gate**: BAA or data-use agreement status, and a minimum-necessary assessment from `hipaa-privacy-officer`. Nothing proceeds without it.
3. **Capability discovery** (sandbox), recording what is supported vs needed:
   - `GET [base]/metadata` (CapabilityStatement);
   - `GET [base]/.well-known/smart-configuration`;
   - supported resources, search params, `$export` levels (system, group, patient) and auth methods.
4. **Auth registration**: SMART Backend Services (`client_credentials` + `private_key_jwt`):
   - generate the keypair outside the repo and publish a JWKS URL or register the public key;
   - request the narrowest `system/*.rs` scopes (SMART v2) or `system/*.read`;
   - store the client ID and key reference in the secret manager.
5. **Patient matching design**: which identifier systems to match on (the partner's record-number system URI; never SSN), `$match` availability, how `Patient.link` / `Provenance` record the source, and how duplicates are resolved.
6. **Test pull** (sandbox, synthetic lane):
   - a single patient `$everything` or `Patient/$export`;
   - validate against US Core profiles, record validation errors, and map gaps.
7. **Go-live checklist** (`docs/integrations/<partner>/go-live.md`):
   - production endpoint configured through deployment secrets;
   - Tribe-lane operator assigned;
   - sync schedule from `fhir-data-sync-runbook`;
   - monitoring and alert thresholds;
   - rollback / disable switch;
   - partner contacts and escalation path.
8. **SLA**: freshness target (e.g. data ≤ 24 h old), error budget, incident response times, and the partner's rate limits and maintenance windows.

## Incident triage (HL7/FHIR connection)

| Symptom | First checks |
|---|---|
| 401/403 | Clock skew on the JWT `exp`, key rotation (JWKS `kid`), scope changes on the partner side |
| 429 / throttling | Partner rate limit; back off exponentially and move the schedule |
| `$export` stuck in 202 | Job expiry; poll interval honours `Retry-After`; cancel with DELETE on the status URL and restart |
| Validation spike | Partner upgrade (US Core version); compare the CapabilityStatement with the recorded one |

Record incidents in `docs/sync/incidents/` (see `fhir-data-sync-runbook`) without patient identifiers.

## References

- SMART App Launch / Backend Services: https://hl7.org/fhir/smart-app-launch/backend-services.html
- Bulk Data Access IG: https://hl7.org/fhir/uv/bulkdata/
- US Core: https://hl7.org/fhir/us/core/
