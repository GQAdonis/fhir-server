---
name: phi-lane-policy
description: Patient-data lane rules for the WSO2 FHIR Server agent team. Use before any task that could touch patient data — pulling from an external EHR, writing test fixtures, reading logs or database rows, drafting prior-auth or appeal text, or configuring a model provider — to decide whether real PHI is allowed and which model endpoint may process it.
license: Apache-2.0
---

# PHI lane policy

The rules come from operator decision ATH-D-001: Tribe Health Solutions is the only model provider covered by a Business Associate Agreement (BAA), and it serves HIPAA-compliant local models. Every other model endpoint is outside the BAA.

## Lanes

| Lane | Model endpoint | Data allowed |
|---|---|---|
| `synthetic` (default) | Any harness: Claude, Codex, OpenCode, Kimi, MiniMax, including hosted MCP connectors | Synthetic data only (Synthea, hand-written fixtures), public EHR sandboxes (Epic, Oracle Health, SMART Health IT, HAPI public) and de-identified data (Safe Harbor 18 identifiers removed, or Expert Determination on file) |
| `tribe` | Only the endpoint in `TRIBE_MODEL_BASE_URL`, with `PHI_LANE=tribe` set | Real PHI, limited to the minimum necessary for the task |

A session counts as the `tribe` lane only when **both** conditions hold:
- `PHI_LANE=tribe` is set;
- the harness's active model base URL equals `TRIBE_MODEL_BASE_URL`.

Declaring the lane without the matching endpoint is still the synthetic lane.

## Rules

1. Assume the synthetic lane unless both lane conditions are verifiably true. If unsure, stop and ask the operator.
2. On the synthetic lane, never request, paste, fetch or summarize real patient records, even a single identifier. If real PHI appears in input, stop, do not repeat it, and tell the operator it must move to a Tribe lane.
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
   Use a harness profile with them disabled. Return only de-identified summaries or counts to other roles, and never write PHI-bearing drafts to files.
8. This policy overrides any vendored skill or agent prompt (for example `healthcare-agents`) that allows PHI in "an approved environment" or with "user authorization". The Tribe lane is the only approved environment, and a user statement alone does not make a session one.
9. Enforcement status: a guard hook (`phi-lane-guard`, change `configure-phi-lanes`) is planned. It will deny non-sandbox FHIR pulls outside a Tribe lane. **Until it lands, no hook enforces these rules**: they rely on the agent following this policy and on review.

## Checklist before patient-data work

- [ ] Which lane am I on, and can I prove it?
- [ ] Is the target endpoint a sandbox or `localhost`? If not, am I on a Tribe lane?
- [ ] Is the data requested the minimum necessary?
- [ ] Will any output (file, log, message) leave the lane? If so, is it de-identified?
