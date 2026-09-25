## Purpose

Defines the patient-data lanes: only sessions routed to the BAA-covered Tribe Health Solutions models may process real PHI, and all other sessions are restricted to synthetic data and public EHR sandboxes by policy and by a guard hook.

## ADDED Requirements

### Requirement: Non-sandbox FHIR pulls require a Tribe lane
A FHIR request to a non-allowlisted base URL SHALL be denied unless the session has `PHI_LANE=tribe` and its model endpoint equals `TRIBE_MODEL_BASE_URL`. The allowlist covers public sandboxes (Epic, Oracle Health, SMART Health IT, HAPI public) and `localhost`.

#### Scenario: Production endpoint without a lane
- **WHEN** an agent issues a FHIR pull to a production-looking base URL and `PHI_LANE` is unset
- **THEN** the call is denied with a reason naming ATH-D-001

#### Scenario: Sandbox
- **WHEN** the base URL is the SMART Health IT sandbox
- **THEN** the call proceeds

### Requirement: Templates contain no endpoint or credential values
Tribe provider templates SHALL reference endpoint, model and credential only through environment variables (`TRIBE_MODEL_BASE_URL`, `TRIBE_MODEL_API_KEY`, `TRIBE_MODEL_*`).

#### Scenario: Template scan
- **WHEN** the templates are scanned
- **THEN** no URL other than placeholders and no secret-shaped value is found

### Requirement: The guard runs in every hook-capable harness
`phi-lane-guard` SHALL be registered in Claude Code and in every harness marked supported or partial in the hook capability matrix.

#### Scenario: Registration check
- **WHEN** harness configurations are inspected
- **THEN** each supported harness invokes `phi-lane-guard`
