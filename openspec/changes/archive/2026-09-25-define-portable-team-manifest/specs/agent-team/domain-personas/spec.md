## Purpose

Defines the healthcare domain roles that let the team run this server as an intermediate EHR for AI: HIPAA compliance, FHIR integration, EHR integration management, data synchronization, and billing and prior authorization.

## ADDED Requirements

### Requirement: HIPAA privacy officer governs PHI handling
`hipaa-privacy-officer` SHALL:
- review policy and compliance for PHI flows (Privacy, Security and Breach Notification rules; minimum necessary; BAAs; access and audit controls);
- own `docs/compliance/`;
- approve any change that affects PHI lanes.

It MUST NOT process PHI content itself.

#### Scenario: New external EHR feed
- **WHEN** an integration proposes pulling a new data category from a partner EHR
- **THEN** the privacy officer records a minimum-necessary assessment and the BAA prerequisite before the change proceeds

### Requirement: FHIR integration specialist owns interoperability design
`fhir-integration-specialist` SHALL design and review the following:
- FHIR R4 REST and Bulk Data `$export` pulls;
- SMART on FHIR and backend-services authorization;
- US Core conformance;
- patient matching.

It SHALL default to public EHR sandboxes, and MUST use real endpoints only through a Tribe-endpoint PHI lane.

#### Scenario: Endpoint choice
- **WHEN** asked to test a patient pull
- **THEN** it uses a sandbox (Epic, Oracle Health, SMART Health IT or HAPI) unless the session is on a Tribe lane

### Requirement: Business roles own integration and sync operations
`ehr-integration-manager` SHALL own partner onboarding, go-live checklists and SLAs in `docs/integrations/`. `data-sync-coordinator` SHALL own sync schedules, reconciliation and incident runbooks in `docs/sync/`. Neither SHALL modify Go source.

#### Scenario: Reconciliation drift
- **WHEN** counts diverge between a partner EHR and this server
- **THEN** the sync coordinator follows the `fhir-data-sync-runbook` and records the incident in `docs/sync/`

### Requirement: Billing and prior-auth specialist cites payer sources
`billing-prior-auth-specialist` SHALL cover:
- prior-authorization workflows (CMS-0057-F);
- CPT/HCPCS/ICD-10 coding;
- denials and appeals (CARC/RARC);
- payer-specific documentation requirements.

It SHALL own `docs/billing/`. It MUST cite a source for every payer rule.

#### Scenario: Documentation requirement
- **WHEN** asked what must be recorded to bill a procedure for a payer
- **THEN** the answer cites the LCD/NCD or payer policy used
