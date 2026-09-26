verdict: PASS

# HIPAA privacy review: `configure-phi-lanes` (task 3.1)

> **Re-check, 2026-09-26.** The verdict changed from BLOCK to PASS.
> - C1 is resolved.
> - Q3, W6 and the counts rule are fixed.
> - W1–W5 are deferred to a follow-up change by operator decision, gated before any real-PHI session.
> - Details are in section 8. The original review below is kept as written; only the status tags were added.

- Reviewer: `hipaa-privacy-officer` (decision support only). The designated privacy official (the operator, 45 CFR 164.530(a)) decides.
- Date: 2026-09-26.
- Branch: `feat/agent-team-hardening`, uncommitted working tree.
- No PHI was seen or processed. The review used policy text, code, configuration and templates only.
- Method: I read the files directly. I had no shell, so I did not run `git diff`, `npm test` or the scans. The implementer's test and scan claims are not re-verified here.
- Write-scope note: my manifest scope is `docs/compliance/**`. The orchestrator directed me to write this file under `.kbd-orchestrator/.../evidence/`, so I did. No other file was changed.
- Why BLOCK: exactly one CRITICAL finding (C1), a policy statement that contradicts the operator's 2026-09-26 decision. The fix is one line. Everything else is WARNING or SUGGESTION and acceptable for a synthetic-only phase, provided the conditions in section 5 are met before the first real Tribe-lane session.

## 1. Scope reviewed

- **OpenSpec change:** `openspec/changes/configure-phi-lanes/{proposal.md, design.md, tasks.md, specs/agent-tooling/phi-lanes/spec.md}` and `.kbd-orchestrator/phases/agent-team-hardening/execution.md`.
- **Guard:**
  - `.claude/hooks/src/phi-lane-guard.mts`
  - `.claude/hooks/src/lib/phi-lane.mts`
  - `.claude/hooks/test/phi-lane.test.mjs`
  - `.claude/hooks/phi-sandboxes.json`
  - `.claude/hooks/src/lib/harness-payload.mts` (`phiLaneInput`)
- **Guard registration:** `.claude/settings.json`, `.claude/settings.tribe.json`, `.codex/hooks.json`, `.opencode/plugins/fhir-guards.js`, and `scripts/agent-team/plugins/fhir-guards/{kimi.plugin.json, hooks/hooks.json}`.
- **Tribe profile and templates:** `.claude/settings.tribe.json`, `.codex/config.phi.template.toml`, `.kimi-code/config.phi.template.toml`, `.opencode/opencode.phi.template.json`.
- **Agent scope:** `.claude/hooks/src/agent-scope-guard.mts`, `src/lib/agent-scope.mts` (read at the interface level).
- **Ledger:** `src/lib/ledger.mts` (`LEDGER_FIELDS`, `ledgerKeyFindings`, rotation split) and `src/scan-prometheus.mts`.
- **Policy text:**
  - `.claude/skills/phi-lane-policy/SKILL.md` (the `.agents/` copy is assumed identical because the mirror check enforces it)
  - `scripts/agent-team/build-manifest.mjs` `phiLaneBlock`
  - `.agent-team/roles/hipaa-privacy-officer.md` and its generated exports
  - `docs/compliance/README.md`, `docs/agent-team.md` (lanes, hook coverage, PHI lanes), `README.md`, `PRODUCT.md`
- **External reference:** the Claude Code settings-precedence and CLI references at code.claude.com. These establish how `--settings` merges with other settings; see W2.

## 2. Findings

### CRITICAL

**C1. The privacy officer's own workflow still permits de-identified real-patient data on non-Tribe endpoints.** *Status: RESOLVED (re-check, section 8).*

- **Files:**
  - `.agent-team/roles/hipaa-privacy-officer.md`, Workflow step 2;
  - its generated copies: `.claude/agents/hipaa-privacy-officer.md:66`, `.codex/agents/hipaa-privacy-officer.toml`, `.opencode/agents/hipaa-privacy-officer.md`, `.kimi-code/agents/hipaa-privacy-officer.md`, `.minimax/agents/hipaa-privacy-officer/agent.md`, `.agent-team/team.json`.
- **Text:** "is any non-Tribe endpoint (harness, hosted MCP connector, web tool, log sink) exposed to real PHI? If so, reject it **or require de-identification**."
- **Why it is critical:** the second branch tells the reviewing role that de-identification makes a cloud or other non-Tribe destination acceptable. That directly contradicts the operator decision of 2026-09-26, made under 45 CFR 164.530(a): data derived from real patients, including data de-identified under 164.514(b), stays on the Tribe lane. It is the one policy statement that would lead this role to recommend APPROVE for exactly the flow the operator prohibited.
- **Why task 5.1 missed it:** the task 5.1 grep looked for "de-identified". This line says "de-identification".
- **Fix:**
  1. In `.agent-team/roles/hipaa-privacy-officer.md`, replace step 2 with: "Check the lane: is any non-Tribe endpoint (harness, hosted MCP connector, web tool, log sink) exposed to real PHI or to data derived from it, including de-identified data? If so, recommend REJECT. De-identification does not make a non-Tribe endpoint permissible (operator decision 2026-09-26, 45 CFR 164.530(a))."
  2. Run `node scripts/agent-team/build-manifest.mjs` and `node scripts/agent-team/install-exports.mjs`, then `npm --prefix .claude/hooks run lint:agents`.
  3. Extend the task 5.1 verify grep to `de-identif` (every form of the word) and review each hit by hand.

### WARNING

**W1. The lane proof is self-declared, not proven. The trust boundary is weaker than the design claims.** *Status: DEFERRED to a follow-up change (operator decision; gate item 4.1 in `docs/compliance/README.md`).*

- **Files:** `.claude/hooks/src/lib/phi-lane.mts` (`tribeLaneActive`); the lane-note blocks in all three `*.phi.template.*` files; `docs/agent-team.md` § PHI lanes.
- **Design claim:** "the harness's configured model base URL ... must equal `TRIBE_MODEL_BASE_URL`, so a cloud session cannot simply declare itself a PHI lane."
- **What the code does:** it compares two operator-exported variables. The templates tell the operator to set `export AGENT_MODEL_BASE_URL="$TRIBE_MODEL_BASE_URL"`, which makes the check a tautology.
- **How it fails:** nothing ties `AGENT_MODEL_BASE_URL` to the endpoint the harness actually calls.
  - Claude Code calls `ANTHROPIC_BASE_URL`, or Bedrock or Vertex when `CLAUDE_CODE_USE_BEDROCK` or `CLAUDE_CODE_USE_VERTEX` is set.
  - Codex, OpenCode and Kimi call whatever provider their loaded config selects.
  - Suppose the three variables are left in a shell profile or `.envrc` and someone launches the harness on its default cloud model. The guard then treats the session as a proven Tribe lane and allows production FHIR pulls to a non-BAA model.
  - The Claude profile (`settings.tribe.json`) does not set or check `ANTHROPIC_BASE_URL` at all.
- **The name:** `AGENT_MODEL_BASE_URL` is acceptable as a name. The problem is where its value comes from.
- **The boundary itself is sound in one respect:** only launch-time environment can prove the lane, and a tool call cannot change the environment of the running hook process.
- **Open question (not verified):** can an agent write an `env` block into `.claude/settings.local.json` and have it take effect on a later or reloaded session?
- **Fix before any real session:**
  - **Claude Code:** in `tribeLaneActive`, derive the active endpoint from the variable the harness really uses. Require `ANTHROPIC_BASE_URL === TRIBE_MODEL_BASE_URL`, with `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX` and any other provider-switch variables unset.
  - **Other harnesses:** provide a single launcher, for example `scripts/agent-team/tribe-launch.mjs`. It renders the harness config and exports `AGENT_MODEL_BASE_URL` from the same value, so the two cannot diverge. Document that launching any other way is the synthetic lane.
  - **Settings files:** add `.claude/settings*.json` `env` keys to the protected-path guard, or have the guard ignore lane variables that come from settings files.
  - **Tests:** add a test where all three variables are set but `ANTHROPIC_BASE_URL` differs, and assert deny.
- **Owners:** `fhir-infra-release-engineer` implements; `fhir-security-compliance-reviewer` reviews.

**W2. The Claude Tribe profile does not remove the off-lane sinks it claims to remove.** *Status: DEFERRED (operator decision; gate item 4.2).*

- **Files:** `.claude/settings.tribe.json` (its `$comment`) and `docs/agent-team.md:87`.
- **How settings merge:** Claude Code merges `--settings` with the user, project and local settings files. A key omitted from `--settings` keeps its lower-level value, and lists are combined (code.claude.com/docs/en/settings, "Settings files and precedence" and "Lists merge instead of overriding").
- **Result:** `claude --settings .claude/settings.tribe.json` still loads `.claude/settings.json`. In a Tribe session:
  - the `karpathy-flush` hooks on `Stop`, `SessionEnd` and `PreCompact` still run. They write session-note text to `.prometheus/raw` and `outbox/`, which `pk-drain` then delivers to the knowledge base;
  - `"extraKnownMarketplaces": {}` does not clear the project's `healthcare` marketplace;
  - hooks from plugins enabled in `~/.claude/settings.json` still run. `mcp__*` denies MCP tool calls, but it does not stop plugin hooks.
- **Why it matters:** phi-lane-policy rule 7 requires these sinks to be off, and the docs say they are.
- **Fix:**
  - Launch with `--setting-sources` restricted so that project and user settings are not loaded, then `--settings .claude/settings.tribe.json`. Verify the accepted source names on the installed version: the CLI reference lists `user`, `workspace`, `machine`, `remote`.
  - Belt and braces: make `karpathy-flush`, and any hook that stores reply or prompt text, a no-op whenever `PHI_LANE` is set to any value. Checking only for a proven lane is not enough, so fail safe.
  - Add `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` to the profile env.
  - Correct the `docs/agent-team.md` wording.
  - Verify with a synthetic dry run on the Tribe profile that no Stop-hook note is written.
- **Owners:** `fhir-infra-release-engineer` implements; `fhir-security-compliance-reviewer` reviews.

**W3. Shell egress is open on the Claude Tribe profile.** *Status: DEFERRED (operator decision; gate item 4.3).*

- **File:** `.claude/settings.tribe.json`.
- **The gap:** on a proven Tribe lane the guard allows everything, and the profile denies only WebFetch, WebSearch and MCP. Bash can still `curl`/`wget` any host, push with `gh` or `git`, and so on. The Codex template blocks this with `network_access = false`; Claude's profile has no equivalent. That leaves a disclosure path for real PHI (164.502(a), 164.530(c)), even though it does not lead to a model.
- **Fix:** enable Claude Code's sandbox with a network allowlist of only the Tribe endpoint and the specific partner FHIR hosts for the session, or deny `Bash(curl:*)`, `Bash(wget:*)`, `Bash(gh:*)`, `Bash(git push:*)` and similar. Verify with a packet or proxy capture during a synthetic dry run.
- **Owners:** `fhir-infra-release-engineer`; review by `fhir-security-compliance-reviewer`.

**W4. The other harness templates lack equivalent denies, and Kimi and MiniMax have none.** *Status: DEFERRED (operator decision; gate items 4.4–4.5). Kimi and MiniMax are not approved Tribe lanes (decision 3).*

- **Kimi** (`.kimi-code/config.phi.template.toml`): no deny for SearchWeb, FetchURL or MCP. Hooks are fail-open.
- **MiniMax:** no template at all.
- **OpenCode** (`.opencode/opencode.phi.template.json`): denies only `webfetch`. It does not address:
  - web search;
  - MCP servers merged from the global config;
  - session sharing (`share`), an upload sink;
  - `small_model` or title-generation routing;
  - limiting providers to `tribe`.
- **Codex** (`.codex/config.phi.template.toml`): does not disable the web-search tool, MCP servers, or history persistence.
- **Risk if a deny silently doesn't apply:** these fields are unverified against live CLIs. A misspelled or unsupported key is usually ignored, not rejected, so the harness runs with the channel open while the operator believes it is closed.
- **Fix:**
  - State in `docs/agent-team.md` and the Kimi template that Kimi Code and MiniMax Code are **not approved Tribe-lane harnesses** until they have enforceable denies.
  - Add the missing OpenCode and Codex keys.
  - For each approved harness, add a verification step: a synthetic dry run in which every denied channel is attempted and the denial is observed.
- **Owners:** `fhir-infra-release-engineer`; review by `fhir-security-compliance-reviewer`.

**W5. Detection gaps in the guard (synthetic lane).** *Status: DEFERRED (operator decision; gate item 4.8).*

- **File:** `.claude/hooks/src/lib/phi-lane.mts`.
- **Paths `FHIR_PATH` misses:**
  - Azure Health Data Services (`https://<ws>-<svc>.fhir.azurehealthcareapis.com/Patient`): the FHIR marker is in the host, not the path;
  - `/baseR4`, `/fhir-r4`, `/R4B`, `/r5`, `/stu3`, `/dstu2`;
  - resource paths at the server root.
- **Other misses:**
  - scheme-less `curl host/fhir/...`;
  - tools that carry a `url` field but have no "fetch" in their name, such as `firecrawl_scrape` or browser `navigate` MCP tools. Both are present on this workstation;
  - a Codex shell `command` passed as an array rather than a string.
- **Fix:**
  - Treat a URL as FHIR-shaped if the host contains `fhir`, or any path segment is a FHIR R4 resource type, `metadata`, `$everything` or `_history`.
  - Read a `url` field from any tool input.
  - Join array commands before matching.
  - Match scheme-less host/path tokens after `curl`/`wget`.
  - Add a test for each case.
- **Why WARNING, not CRITICAL:** the guard is documented as defense in depth, and policy remains primary.

**W6. The `policy-only` lane block does not carry the de-identified rule.** *Status: RESOLVED (re-check, section 8).*

- **Where:** `scripts/agent-team/build-manifest.mjs:81`, which feeds this role's "Patient-data lane" section.
- **The gap:** it says "If real PHI appears in your input, stop", but omits de-identified patient data. It also says "Assess flows from descriptions, schemas and counts" without restricting what counts may be.
- **Fix:**
  1. Change the text to "If real PHI or de-identified data derived from real patients appears in your input, stop, do not repeat it, and tell the operator it must move to a Tribe lane. Assess flows from descriptions, schemas, synthetic examples and aggregate operational counts (see the counts rule)."
  2. Re-export and run `lint:agents`.

### SUGGESTION

- **S1. Narrow the sandbox allowlist** (`.claude/hooks/phi-sandboxes.json`, `isSandbox`).
  - Subdomain matching on vendor domains (`fhir.epic.com`, `*.cerner.com` entries) is broader than the sandbox programs.
  - Use exact-host matching for vendor entries, and add an optional `pathPrefix` (for example Epic's sandbox path, or Oracle Health's public sandbox tenant ID) so a vendor-hosted production tenant can never match.
  - Keep production hosts such as `fhir-ehr.cerner.com` off the list. It is correctly absent today.
- **S2. Unknown provenance should be treated as real-derived** (phi-lane-policy rule 2). Add: "If a dataset's provenance is unknown, treat it as derived from real patients." An agent cannot tell de-identified real data from synthetic data by looking at it.
- **S3. Keep `settings.tribe.json` in sync automatically.** Add a `lint:agents` check that its hook entries equal `.claude/settings.json` minus the Karpathy sinks. That replaces hand-sync with a verifiable condition.
- **S4. Flag malformed ledger lines** (`ledgerKeyFindings`). It skips non-JSON lines, so free text in a ledger file is caught only by the regex scan. Report malformed lines as findings.
- **S5. Agent-scope guard** (not a privacy control).
  - Prefer the `agent_type` in the PreToolUse payload, where Claude Code supplies it, over the per-session state file. This removes the concurrent-subagent ambiguity.
  - Consider denying tech-lead writes outside the repo (`relative === null` is currently allowed).
  - Main-session and non-Claude coverage staying prompt-only is acceptable. `fhir-tech-lead` is lane `none` and never on a Tribe lane.
- **S6. Vendored fixtures:** see question 5.

## 3. Answers to questions 1–5

### Q1. What may leave a Tribe lane? Are aggregate record counts acceptable?

**Recommendation:** allow operational counts under a fixed rule. Do not allow patient-level or attribute-sliced counts.

- **Allowed:**
  - pass/fail;
  - a fixed-vocabulary error code (HTTP status, FHIR `OperationOutcome.issue.code`, an internal error enum);
  - counts of resources or operations for the whole run (for example "412 Observation written, 3 rejected with `invalid`").
- **Not allowed:**
  - `OperationOutcome.diagnostics` or any free-text error message, which often echoes the offending field value;
  - resource logical IDs, MRNs, or partner identifiers. These are "any other unique identifying number" under 164.514(b)(2)(i)(R);
  - per-patient timestamps;
  - any count broken down by a demographic, clinical, geographic or date attribute.
- **Small cells:** if a count of *patients* by any attribute is ever needed off-lane, suppress cells of 1–10, following CMS's cell-size suppression policy.
- **Why:** a count of 1 combined with a code and a date can single out an individual. Under the 2026-09-26 decision, anything derived from real patients stays on the lane unless it is plainly operational.
- **Policy text:** make phi-lane-policy rule 7 and the `tribe-only` block say "fixed error codes" rather than "error codes".
- **Decision owner:** the operator.

### Q2. Rule 2 now makes the synthetic lane stop-and-redirect on de-identified patient data, same as real PHI.

**Recommendation:** confirmed as intended, and consistent with the synthetic-only decision.

- Two consequences need explicit operator confirmation (section 6):
  - public or credentialed de-identified research datasets derived from real patients, such as MIMIC-style datasets, are also excluded from cloud harnesses;
  - "stop and redirect" applies even when the data arrives inside a partner document or tool output, not only when a user supplies it.
- The wording in the skill, the `none` and `tribe-only` blocks, the docs, README and PRODUCT is consistent. The exceptions are C1 and W6.

### Q3. Does the De-identification rule read coherently with the 164.514(b) method list?

**Recommendation:** not quite. Rewrite it.

- **The problem:**
  - The sentence "cloud-harness agent work uses synthetic data:" ends in a colon, so the Safe Harbor and Expert Determination bullets read as if they were kinds of synthetic data.
  - The citations are not specific enough.
- **Suggested text:**
  - "De-identification (164.514(a)–(b)) has two methods:
    - Safe Harbor (164.514(b)(2)): remove the 18 identifiers in (b)(2)(i)(A)–(R) of the individual and of relatives, employers and household members, with no actual knowledge that the remainder could identify the individual ((b)(2)(ii));
    - Expert Determination (164.514(b)(1)): a qualified expert determines the risk is very small and documents the methods and results, and the determination is kept on file.
  - Any re-identification code must meet 164.514(c).
  - Under either method, data derived from real patients stays on the Tribe lane (operator decision 2026-09-26). Cloud-harness work uses synthetic data only."

### Q4. Residual risks: acceptable for this phase? What must be true before the first real Tribe-lane session?

**For this phase:** acceptable. Nothing in this phase processes real PHI, no Tribe endpoint is configured, and each risk depends on a real lane or real partner endpoint that does not exist yet.

| Risk | Assessment |
|---|---|
| Obfuscated-command evasion | Accept, as documented. Reduce it with W5. |
| Agent-scope guard is prompt-only for the main session and non-Claude harnesses | Accept. It is an integrity control on a lane-`none` role, not a PHI control. |
| `settings.tribe.json` is hand-synced | Accept only with S3. More importantly, W2 shows the profile's isolation claim is wrong regardless of sync. |
| Unverified deny fields | Not acceptable for real PHI. They must be verified by an observed denial on the installed version. |

**Before the first real session:** see section 5.

### Q5. Vendored fixtures under `skills/fhir-software/` and `skills/healthcare-agents/` trip the scan.

**Recommendation:** not a HIPAA finding against this change, and not a blocker.

- **Assumption:** these are upstream public fixtures using fictional values. Reserved `example.*` domains and 555-01xx numbers are designed not to identify anyone. I did not open the fixture values.
- **Actions:**
  - Record upstream source and commit provenance for those paths in the vendor notes.
  - Exempt the vendored paths by path scope in the scan configuration. Do not add literal allowlist entries; `validateAllowlist` correctly rejects non-reserved values.
  - Have `fhir-security-compliance-reviewer` spot-check that no hit uses a non-reserved domain or a non-fictional phone range.
  - If one does, treat it as potential real data: stop, and escalate to the operator.
- Do not edit vendored content.

## 4. Minimum-necessary and BAA notes

- This change adds no PHI data category, partner feed or PHI destination. It adds controls and templates only, so no minimum-necessary assessment is required for this change (164.502(b), 164.514(d)).
- The first real flow will need its own assessment and BAA record in `docs/compliance/<topic>.md`.
- **BAA status required before any real session:**
  - a BAA with Tribe Health Solutions as the model provider (164.502(e), 164.504(e), 164.308(b)); record the status only;
  - a BAA, or the covered-entity/BA relationship documented, with each partner whose FHIR endpoint is pulled;
  - subcontractor BAAs for any hosting in between.
- A data-use agreement does not substitute for any of these (164.514(e)).

## 5. Conditions before the first real Tribe-lane session

Each condition must be verifiable. Owners are in brackets.

1. C1 is fixed, re-exported, and `lint:agents` passes. [infra, architect]
2. W1: the lane proof reads the harness's real endpoint variable, or a single launcher produces both config and proof. A test shows the guard denies when the lane variables are set but the real endpoint differs. [infra; security reviews]
3. W2: in a synthetic dry run on the Tribe profile, no Karpathy or knowledge note is written, no plugin hook fires, and no user or project settings sources are loaded. The docs match. [infra; security reviews]
4. W3/W4, egress: a network capture during a synthetic dry run shows traffic only to the Tribe endpoint and the approved partner FHIR host. Every denied channel (web fetch, web search, MCP, sharing, shell egress) is attempted and observed to be denied on the installed harness version. [infra; security reviews]
5. Only harnesses that pass condition 4 are approved as Tribe lanes. Kimi and MiniMax are excluded until they do. [operator]
6. BAA records (status only) exist in `docs/compliance/` for Tribe and for the partner, and a minimum-necessary assessment exists for the first flow. [hipaa-privacy-officer; ehr-integration-manager]
7. A risk-analysis entry exists for the Tribe-lane workstation flow (164.308(a)(1)(ii)(A)). It covers:
   - local transcript and cache retention (`cleanupPeriodDays`, harness history);
   - full-disk encryption on the workstation (164.312(a)(2)(iv));
   - unique user identification (164.312(a)(2)(i));
   - audit controls (164.312(b));
   - TLS to the Tribe and partner endpoints (164.312(e)(1)).
   [hipaa-privacy-officer; infra]
8. The Q1 counts rule is written into phi-lane-policy rule 7 and the `tribe-only` block. [architect; hipaa-privacy-officer]
9. The guard gaps from W5 are closed, or accepted in writing by the operator. [infra]

## 6. Operator decisions required

1. **Approve the C1 fix.** It aligns the privacy officer's workflow with the 2026-09-26 decision.
2. **Counts rule (Q1).** Operational counts and fixed error codes may leave the lane. Diagnostics text, IDs and attribute-sliced counts may not. Patient counts by attribute are suppressed at 1–10.
3. **Scope of synthetic-only (Q2).** Confirm that public or credentialed de-identified research datasets derived from real patients are also excluded from cloud harnesses.
4. **Approved Tribe harnesses.** Recommendation: Claude Code first, after conditions 2–4; Codex and OpenCode after verification; Kimi and MiniMax not yet.
5. **Knowledge-base destination.** Confirm where `pk-drain` delivers notes and that this destination is never reachable from a Tribe session.
6. **Local retention.** Accept or reject local transcript retention on Tribe-lane workstations, given full-disk encryption.
7. **Record the decision.** Record the decision on this review, with a sign-off reference, in `docs/compliance/` (164.530(j) documentation).

**Recommendation to the designated privacy official:** REJECT the change as it stands (BLOCK), solely because of C1. Once C1 is fixed, APPROVE WITH CONDITIONS for synthetic-only operation in this phase. Conditions 1–9 in section 5 gate the first real Tribe-lane session.

## 7. Citations

- 45 CFR 164.530(a) (privacy official), 164.530(c) (safeguards), 164.530(j) (documentation)
- 45 CFR 164.502(a), 164.502(b), 164.514(d) (permitted uses; minimum necessary)
- 45 CFR 164.514(a)–(c) (de-identification: Safe Harbor (b)(2), Expert Determination (b)(1), re-identification (c)); 164.514(e) (limited data set / DUA)
- 45 CFR 164.502(e), 164.504(e), 164.308(b) (business associate and subcontractor agreements)
- 45 CFR 164.308(a)(1)(ii)(A) (risk analysis); 164.312(a)(1), (a)(2)(i), (a)(2)(iv), (b), (e)(1) (access control, unique user ID, encryption, audit controls, transmission security)
- 45 CFR 160.103 (definitions: PHI, individually identifiable health information)
- HHS de-identification guidance: https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html
- CMS cell-size suppression policy (ResDAC): https://resdac.org/articles/cms-cell-size-suppression-policy
- Claude Code settings precedence and list merging: https://code.claude.com/docs/en/settings
- Claude Code CLI reference (`--settings`, `--setting-sources`, `--no-session-persistence`): https://code.claude.com/docs/en/cli-reference

## 8. Re-check (2026-09-26)

**Method:** I read the files directly. I did not run `lint:agents` or the tests, so the coordinator's report that `lint:agents` passes is taken as stated.

**Verified resolved:**
- **C1.** `.agent-team/roles/hipaa-privacy-officer.md:67` now says: recommend REJECT if a non-Tribe endpoint is exposed to real PHI or data derived from it, including de-identified data. It adds that de-identification does not make a non-Tribe endpoint permissible.
  - A repo-wide grep (excluding `.kbd-orchestrator/`) for `require de-identification` and `synthetic or de-identified` finds only the historical "replaces the earlier rule" sentence in `docs/compliance/README.md:9`, which is correct.
  - The exported `.claude/agents/hipaa-privacy-officer.md` and `.codex/agents/hipaa-privacy-officer.toml` carry the new text.
- **Q3.** The De-identification rule (role lines 48–52) now reads coherently:
  - Safe Harbor 164.514(b)(2), with the (b)(2)(ii) actual-knowledge test;
  - Expert Determination 164.514(b)(1);
  - re-identification codes under 164.514(c);
  - then "either way … stays on the Tribe lane".
- **W6.** The `policy-only` block (`scripts/agent-team/build-manifest.mjs:81`) now covers de-identified patient data and limits counts to run-level counts under the counts rule.
- **Counts rule.** `.agents/skills/phi-lane-policy/SKILL.md` rule 7 and its checklist, and the `tribe-only` block (`build-manifest.mjs:86`), state the rule:
  - may leave: pass/fail, fixed error codes, run-level counts;
  - may not leave: diagnostics text, IDs or MRNs, per-patient timestamps, sliced counts;
  - patient counts of 1–10 are suppressed.
  - The mirrored skill copies (`.claude`, `.opencode`, `.kimi-code`, `.minimax`) contain the same text.
- **Q2 scope.** The skill preamble now covers published de-identified research datasets, and patient data in partner documents and tool output.
- **Rule 9 / `tribe-only` guard wording** no longer describes the guard as planned or absent.
- **Decision record.** `docs/compliance/README.md` "Decision record (45 CFR 164.530(j))" records operator decisions 1–4. It includes the pre-real-PHI gate, which carries this review's section 5 conditions (W1–W5, BAA status, minimum necessary, risk analysis).

**Contradiction check:** I found no policy statement contradicting the operator's decisions. I checked:
- the role;
- the lane blocks;
- the skill;
- `docs/compliance/README.md`;
- `docs/agent-team.md` (lanes);
- README;
- PRODUCT.

**Remaining issues (WARNING, non-blocking, belong to the deferred follow-up):**
- **R1.** `docs/agent-team.md:87-88` still describes W1 and W2 as done. Line 87 says `settings.tribe.json` "disables the Karpathy Stop/SessionEnd/PreCompact sinks" and "clears the plugin marketplace list". Line 88 calls `AGENT_MODEL_BASE_URL` "the harness's actual active model endpoint". Both are inaccurate (W1, W2).
  - This is not a contradiction of an operator decision, and the gate in `docs/compliance/README.md` controls real use. But a reader of `docs/agent-team.md` could rely on it.
  - **Fix:** add one sentence to that section: "Not yet sufficient for real PHI: see the pre-real-PHI gate in `docs/compliance/README.md` (W1–W5 deferred)." Correct the two claims in the follow-up change.
- **R2.** `.kimi-code/config.phi.template.toml` does not say that Kimi is not an approved Tribe lane (decision 3).
  - **Fix:** add a header line saying so, or remove the template until Kimi has enforceable denies.

**Updated recommendation to the designated privacy official:** APPROVE WITH CONDITIONS for this phase (synthetic-only operation).
- The conditions are the pre-real-PHI gate in `docs/compliance/README.md` decision 4, plus R1 and R2.
- R1 and R2 should land with the follow-up change, or sooner as doc-only edits.
- No real-PHI Tribe-lane session may start until every gate item holds.
- The operator's sign-off reference should be recorded against this review in the decision record.
