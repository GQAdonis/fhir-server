# HIPAA compliance

**Owner:** `hipaa-privacy-officer`.

Minimum-necessary assessments for new data categories and partner feeds, BAA prerequisite records (status only, not agreement text), PHI data-flow maps, access and audit control reviews, and breach-assessment procedure notes. Code and infrastructure security findings belong to `fhir-security-compliance-reviewer`.

**Patient-data rule:** policy and process documentation only. **Never** add patient data, incident details that identify a person, credentials, or real endpoint hosts. The patient-data lanes are defined in the `phi-lane-policy` skill (ATH-D-001: only Tribe Health Solutions' BAA-covered local models may process real PHI).

**Cloud-harness data policy (operator decision 2026-09-26):** the operator, acting as designated privacy official (45 CFR 164.530(a)), limited cloud-model harnesses (Claude, Codex, OpenCode, Kimi, MiniMax on cloud models) and hosted connectors to synthetic data only. Data derived from real patients, including data de-identified by Safe Harbor or Expert Determination (45 CFR 164.514(b)), stays on the Tribe local-model lane. This replaces the earlier "synthetic or de-identified" rule.

## Decision record (45 CFR 164.530(j))

Operator decisions of 2026-09-26, made as designated privacy official (45 CFR 164.530(a)), following the `hipaa-privacy-officer` review of change `configure-phi-lanes` (`.kbd-orchestrator/phases/agent-team-hardening/evidence/hipaa-review-configure-phi-lanes.md`):

1. **Cloud harnesses are synthetic only.** This includes published de-identified research datasets derived from real patients, and it applies to patient data in partner documents and tool output, not only to user input.
2. **Counts rule.** Only pass/fail, fixed error codes and run-level resource or operation counts leave a Tribe lane. Free-text diagnostics, resource IDs or MRNs, per-patient timestamps and sliced counts do not. Patient counts from 1 to 10 are suppressed (CMS cell-size policy).
3. **Tribe-lane harnesses.** Claude Code may become a Tribe lane first, after a verified dry run. Codex and OpenCode follow once their denies are seen to work. Kimi Code and MiniMax Code are not approved Tribe lanes.
4. **Gate before the first real-PHI session.** The review's warnings W1-W5 are deferred to a follow-up change. No Tribe-lane session with real PHI may start until all of these hold:
   1. The lane proof reads the endpoint the harness actually calls, with a test for the mismatch case (W1).
   2. A synthetic dry run of the Tribe profile writes no knowledge-base or Karpathy notes, runs no plugin hooks and loads no project or user settings (W2).
   3. Shell egress is restricted on the Claude Tribe profile (W3).
   4. A network capture during a synthetic dry run shows traffic only to the Tribe endpoint and the approved partner host, and every denied channel is seen to deny (W4).
   5. Only harnesses that pass step 4 are used, per decision 3.
   6. BAA status records exist for Tribe and the partner (164.502(e), 164.504(e), 164.308(b)), with a minimum-necessary assessment for the first flow.
   7. A risk-analysis entry exists for the Tribe workstation (164.308(a)(1)(ii)(A)), covering local transcript retention, full-disk encryption (164.312(a)(2)(iv)), unique user IDs, audit controls and TLS.
   8. The FHIR-detection gaps in the guard are closed or accepted in writing by the operator (W5).

