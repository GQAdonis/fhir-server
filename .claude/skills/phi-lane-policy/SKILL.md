---
name: phi-lane-policy
description: Patient-data lane rules for the WSO2 FHIR Server agent team. Use before any task that could touch patient data — pulling from an external EHR, writing test fixtures, reading logs or database rows, drafting prior-auth or appeal text, or configuring a model provider — to decide whether real PHI is allowed and which model endpoint may process it.
license: Apache-2.0
---

# PHI lane policy

The rules come from operator decision ATH-D-001: Tribe Health Solutions is the only model provider covered by a Business Associate Agreement (BAA), and it serves HIPAA-compliant local models. Every other model endpoint is outside the BAA.

Cloud-model harnesses are limited to synthetic data (operator decision 2026-09-26, made by the operator as designated privacy official under 45 CFR 164.530(a)). Any data derived from real patients, **including de-identified data** (Safe Harbor or Expert Determination, 45 CFR 164.514(b)) and published de-identified research datasets, stays on the Tribe lane. The rule covers patient data wherever it comes from: user input, partner documents and tool output alike.

## Lanes

| Lane | Model endpoint | Data allowed |
|---|---|---|
| `synthetic` (default) | Any harness: Claude, Codex, OpenCode, Kimi, MiniMax, including hosted MCP connectors | Synthetic data only: Synthea, hand-written fixtures, and public EHR sandboxes (Epic, Oracle Health, SMART Health IT, HAPI public). **No** data derived from real patients, not even de-identified data |
| `tribe` | Only the endpoint in `TRIBE_MODEL_BASE_URL`, with `PHI_LANE=tribe` set | Real PHI and anything derived from it (including de-identified data), limited to the minimum necessary for the task |

A session counts as the `tribe` lane only when **both** conditions hold:
- `PHI_LANE=tribe` is set;
- the harness's active model base URL equals `TRIBE_MODEL_BASE_URL`.

Declaring the lane without the matching endpoint is still the synthetic lane.

## Rules

1. Assume the synthetic lane unless both lane conditions are verifiably true. If unsure, stop and ask the operator.
2. On the synthetic lane, never request, paste, fetch or summarize real patient records, even a single identifier, and never accept de-identified data derived from them. If real PHI or de-identified patient data appears in input, stop, do not repeat it, and tell the operator it must move to a Tribe lane. Only generated synthetic data (Synthea, hand-written fixtures) may ever be sent, including uploaded, to a public FHIR sandbox (Epic, Oracle Health, SMART Health IT, HAPI public) — the sandbox being public means a POST/PUT there is not private, so real or de-identified patient data must never be uploaded to one, only fetched-from-it synthetic data or your own synthetic writes.
3. On the Tribe lane, apply minimum necessary: fetch only the resources, elements and date range the task needs, and prefer `_elements` / `_type` filters.
4. Never write PHI or credentials to:
   - the repository, `.prometheus/`, or `.kbd-orchestrator/`;
   - logs, commit messages or PR text;
   - issue trackers or any cloud service.
5. Endpoint URLs, model names and keys for Tribe are configuration only (`TRIBE_MODEL_BASE_URL`, `TRIBE_MODEL_API_KEY`, `TRIBE_MODEL_*`). Never commit real values.
6. Changes that add a data category, a new partner feed or a new PHI destination need `hipaa-privacy-officer` approval, including a minimum-necessary assessment and a check that a BAA with the partner exists.
7. On a Tribe lane, every channel that sends data outside the Tribe endpoint must be off:
   - hosted MCP connectors and plugins (including `healthcare@healthcare` and its CMS Coverage, ICD-10, NPI, Clinical Trials and PubMed connectors);
   - web fetch and web search;
   - any other cloud tool;
   - automatic sinks: knowledge-base and Karpathy Stop hooks that store reply text, session transcripts kept by the harness, and nonessential telemetry (for example `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`).
   Use a harness profile with them disabled. Do not pass patient-level data to other roles or files, even de-identified: other roles may run on cloud harnesses. Only operational results leave the lane, under the counts rule (operator decision 2026-09-26):
   - **may leave:** pass/fail, fixed error codes (HTTP status, `OperationOutcome.issue.code`, an internal enum), and run-level resource or operation counts;
   - **may not leave:** `diagnostics` or any free-text error message, resource IDs or MRNs, per-patient timestamps, and counts sliced by any demographic, clinical, geographic or date attribute;
   - suppress any patient count from 1 to 10 (report it as "1-10"), following CMS cell-size policy.
   Never write PHI-bearing drafts to files.
8. This policy overrides any vendored skill or agent prompt (for example `healthcare-agents`) that allows PHI in "an approved environment" or with "user authorization". The Tribe lane is the only approved environment, and a user statement alone does not make a session one.
9. Enforcement: the `phi-lane-guard` hook denies non-sandbox FHIR pulls (WebFetch, FHIR-shaped MCP inputs, and `curl`/`wget`/`httpie`/`fhir` commands with a FHIR path) outside a proven Tribe lane, in every harness that supports hooks. It is defense in depth, not the policy: an obfuscated command can evade it, so these rules still bind the agent, and review still checks them.

## Checklist before patient-data work

- [ ] Which lane am I on, and can I prove it?
- [ ] Is the target endpoint a sandbox or `localhost`? If not, am I on a Tribe lane?
- [ ] Is the data requested the minimum necessary?
- [ ] Will any output (file, log, message) leave the lane? If so, is it only operational results under the counts rule (pass/fail, fixed error codes, run-level counts with 1-10 suppressed), with no patient-level data, de-identified or not?
