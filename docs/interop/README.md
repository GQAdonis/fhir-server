# FHIR interoperability designs

**Owner:** `fhir-integration-specialist`.

One file per partner: `docs/interop/<partner>.md`. Each holds capability findings (CapabilityStatement, SMART configuration, `$export` support), the pull design (REST or Bulk, resource types, `_type`/`_elements`), the auth method and scopes, US Core mapping gaps, the patient-matching strategy, and Provenance conventions.

**Patient-data rule:** designs and sandbox results only (counts and validation error codes). **Never** add patient data, production endpoint URLs, client IDs, keys or JWKS private material. See the `phi-lane-policy` skill (ATH-D-001).
