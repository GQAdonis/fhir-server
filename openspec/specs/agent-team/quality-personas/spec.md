# agent-team/quality-personas Specification

## Purpose
Defines the independent review and validation agent personas that gate changes before archive, their read-only posture, and the severity-ranked findings format they produce.

## Requirements

### Requirement: Quality personas are read-only
`fhir-code-reviewer`, `fhir-security-compliance-reviewer` and `fhir-conformance-validator` SHALL be project agents whose tools exclude Edit and Write. They MAY run read-only and verification commands through Bash.

#### Scenario: Reviewer asked to fix code
- **WHEN** a reviewer is asked to apply a fix
- **THEN** it reports the finding with a suggested fix and hands the change back to an engineering persona

### Requirement: Findings use the adversarial-review severity scale
Each quality persona SHALL report findings as CRITICAL, WARNING or SUGGESTION, each with file, line (when applicable), claim, evidence and suggested fix, and an overall verdict of BLOCK when any CRITICAL exists.

#### Scenario: Fail-closed violation
- **WHEN** a diff under review removes a search predicate for an unsupported parameter without returning an error
- **THEN** `fhir-code-reviewer` reports a CRITICAL finding and verdict BLOCK

### Requirement: Security review covers committed agent logs
`fhir-security-compliance-reviewer` SHALL review any change touching `.prometheus/`, test fixtures, error messages or logging for PHI and secrets. It SHALL review any change touching `internal/db` or `internal/store` for RLS bypass and tenant-scope omissions.

#### Scenario: Ledger change adds a field
- **WHEN** a change adds a field to the agent ledger schema
- **THEN** the security reviewer confirms the field cannot carry tool input, tool output or prompt text, or reports CRITICAL

### Requirement: Conformance validator gates archive
`fhir-conformance-validator` SHALL run `openspec validate <change> --strict`, the change's task verifications, `make build && make vet` and `make test`, plus the store/handler race-integration command when those packages changed. It SHALL report PASS only when all succeed.

#### Scenario: Verification command fails
- **WHEN** any required command exits non-zero
- **THEN** the validator reports BLOCK with the failing command output
