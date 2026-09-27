## Context

ATH-D-001: the only BAA-covered provider is Tribe's local models, whose endpoint is unknown. The guard is defense in depth; policy (the `phi-lane-policy` skill, the role PHI-lane blocks) is primary.

## Decisions

- **Detection surface:**
  - `WebFetch` URLs;
  - MCP FHIR tool inputs that carry a `base_url` or `server` field;
  - Bash commands matching `curl|wget|httpie|fhir` with an `http(s)://…/(fhir|FHIR|R4|api/FHIR)` path.

  Accept that obfuscated shell commands can evade it (documented residual risk).
- **Lane proof:** `PHI_LANE=tribe` alone is not enough. The harness's configured model base URL, read from the environment the adapter passes through, must equal `TRIBE_MODEL_BASE_URL`, so a cloud session cannot simply declare itself a PHI lane.
- **Allowlist file** `.claude/hooks/phi-sandboxes.json`, reviewed by `hipaa-privacy-officer`.
- **Deny reasons** cite ATH-D-001 and the `phi-lane-policy` skill.

## Risks / Trade-offs

- [False positives on non-FHIR URLs containing `/api/`] → match requires a FHIR-shaped path segment; fixture tests cover common non-FHIR URLs.
- [Evasion via encoded commands] → residual; covered by policy, review, and the security reviewer's checks.
