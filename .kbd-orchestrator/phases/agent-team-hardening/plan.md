PLAN: agent-team-hardening
Project: WSO2 FHIR Server
Date: 2026-09-25
OpenSpec available: YES (`openspec/`, schema `spec-driven`)
Changes to implement: 7

## Inputs carried from assessment
- Decisions ATH-D-001 to ATH-D-004:
  - D-001: the only BAA-covered model provider is Tribe Health Solutions' local models.
  - D-002: merge to about 14 roles.
  - D-003: MiniMax agents live in the project `.minimax/`, used via `MINIMAX_DATA_DIR`.
  - D-004: wire hooks per harness where supported.
- Open questions 2 and 4, resolved here as recommended (ATH-D-005 and ATH-D-006):
  - **ATH-D-005.** One portable manifest (`.agent-team/team.json`) is the single source of truth. Every harness file, including `.claude/agents/`, is *generated* from it, and a drift check fails if a generated file is hand-edited.
  - **ATH-D-006.** `anthropics/healthcare` has no license file, so it is installed as a **Claude plugin**, never vendored. `ajhcs/healthcare-agents` and `PhenoML/ClaudeFHIRSkill` are Apache-2.0, so selected skills are vendored with NOTICE attribution.
- Probe facts (2026-09-25; recorded as evidence in change 1):
  - **Codex 0.154:** has native hooks (`session_start`, `post_tool_use`, `permission_request` via plugin `hooks.json`) and a custom endpoint (`openai_base_url`; already `http://127.0.0.1:11434/...`).
  - **Kimi 0.42:** custom `providers.*.base_url`.
  - **OpenCode:** plugins and custom providers.
  - **MiniMax Code 0.5.4:** no hook or provider surface found in its config or help. Verify it.

## Scope cuts and trade-offs
- **No real PHI is used anywhere in this phase.** Every smoke test uses synthetic data or public EHR sandboxes. This phase delivers the *capability* for PHI lanes (configuration templates, lane markers, guards), not a live PHI lane: the Tribe endpoint and model names are not yet known (ATH-D-001).
- **Business roles produce documents and runbooks, not server code.** Integration, sync and billing features in Go are a later phase. These agents plan and govern them.
- **Parity is definitional, not behavioural.** Kimi ignores per-role models, and `mcode exec` cannot select an agent. The team is *defined* identically everywhere, with each harness's degradation documented; identical routing is not claimed.
- **Deferred to a later phase:** the prior reflection's hardening items:
  - a minimum-delta threshold for flush;
  - internal-agent labels in the ledger;
  - `--allowedTools` documentation for headless personas;
  - SHA-pinning `release.yml`.

  The operator did not add them to this phase's goals.
- **`agent-team-creator` is a worktree build.** Its exact path and commit are pinned in each export receipt, and any adapter defect found is reported upstream, not patched locally.

## Target roster (14 roles, ATH-D-002)

| Role (id) | From | Tier | Real-PHI lane? |
|---|---|---|---|
| `fhir-tech-lead` | existing, absorbs knowledge curation | hard | no (orchestrates only) |
| `fhir-architect` | existing, absorbs ideation strategy | hard | no |
| `fhir-go-developer` | existing | medium | no (synthetic fixtures) |
| `fhir-storage-search-engineer` | existing | hard | no |
| `fhir-test-engineer` | existing | medium | no |
| `fhir-code-reviewer` | existing | medium | no |
| `fhir-security-compliance-reviewer` | existing, narrowed to code/infra security (HIPAA policy moves to the new role) | hard | no |
| `fhir-conformance-validator` | existing | medium | no |
| `fhir-infra-release-engineer` | existing | medium | no |
| `hipaa-privacy-officer` **(new)** | HIPAA Privacy, Security and Breach Notification rules; minimum necessary; BAAs; access/audit policy; PHI-lane governance | hard | policy only, **no PHI content** |
| `fhir-integration-specialist` **(new)** | FHIR R4 REST/Bulk `$export`, SMART on FHIR / backend services, US Core, patient matching, Epic/Oracle Health/MEDITECH connectivity | hard | **yes, only via a Tribe-endpoint lane**; otherwise sandboxes |
| `ehr-integration-manager` **(new)** | business owner of EHR partner onboarding: contracts/BAAs checklist, go-live, SLAs | medium | no |
| `data-sync-coordinator` **(new)** | sync schedules, reconciliation, drift/incident handling across external EHRs | medium | **yes, only via a Tribe-endpoint lane** |
| `billing-prior-auth-specialist` **(new)** | prior authorization (CMS-0057-F), payer rules (LCD/NCD via CMS Coverage MCP), CPT/HCPCS/ICD-10 coding, denials/appeals (CARC/RARC), payer-specific documentation requirements | hard | **yes, only via a Tribe-endpoint lane** |

## CHANGE LIST (ordered)

1. **install-domain-skills**: install and vendor the skills the new roles need, and author the missing project skills.
   - Scope: `.claude/settings.json` (plugin marketplace plus enabled plugin), `.agents/skills/` (universal) mirrored to `.claude/skills/`, `.opencode/skills/`, `.kimi-code/skills/` and `.minimax/skills/`, `THIRD_PARTY_NOTICES.md`, `docs/agent-team.md` prerequisites
   - Depends on: NONE
   - Recommended agent: Claude Code (main session)
   - Est. complexity: M
   - Complexity score: Medium (7 tasks, no code, new content)
   - Model class: medium
   - Customer value: HIGH (G7; prerequisite for G2–G5)
   - Details:
     - **Plugin:** add the `anthropics/healthcare` marketplace plus `healthcare@healthcare` as a project-enabled plugin (Claude only). It includes the CMS Coverage, ICD-10 and NPI MCP connectors.
     - **Vendored, pinned to commit, with NOTICE attribution:**
       - from `ajhcs/healthcare-agents` (Apache-2.0): revenue-cycle, medical-coding, prior-authorization, clinical-documentation-improvement, interoperability-engineer and compliance-officer skills;
       - from `PhenoML/ClaudeFHIRSkill` (Apache-2.0): the FHIR skill.
     - **Project-authored skills:** `ehr-integration-onboarding`, `fhir-data-sync-runbook`, `payer-documentation-rules` (cite-sources discipline: LCD/NCD through the CMS Coverage MCP; never rely on memorized payer rules) and `phi-lane-policy` (which lanes may touch PHI; the synthetic-data default).
     - Each installed skill's provenance (URL, commit, license) goes into a manifest file, `.agents/skills/SOURCES.json`.
     - **Firecrawl skill research per new role, recorded as a deliverable.** `evidence/skill-research.md` holds the queries, result URLs, provenance, license, and the select/reject rationale, and maps each selected skill to its role. It covers the assessment searches plus targeted searches per role:
       - HIPAA: Security Rule audit, risk analysis;
       - FHIR integration: SMART backend services, Bulk `$export`, patient matching;
       - EHR integration manager: onboarding and BAA checklists;
       - data sync: reconciliation, CDC and sync monitoring;
       - billing: payer policy, CARC/RARC appeals, X12 278/837.
   - Acceptance:
     - `evidence/skill-research.md` has at least one Firecrawl query and a select/reject decision per new role;
     - every vendored skill has a pinned commit and license entry;
     - `claude plugin list` (project) shows `healthcare`;
     - `lint:agents` still passes;
     - no unlicensed text is vendored: `grep` for the anthropics/healthcare skill names under `.agents/skills` returns nothing.

2. **define-portable-team-manifest**: convert the team to the `agent-team-creator` portable manifest as the single source of truth.
   - Scope: `.agent-team/team.json`, `.agent-team/state.json` (local state, gitignored if it holds prompts or evidence, per the skill's guidance), and the ownership paths `docs/integrations/`, `docs/billing/`, `docs/compliance/`, `docs/sync/` (README stubs)
   - Depends on: install-domain-skills (roles bind installed skill ids)
   - Recommended agent: Claude Code
   - Est. complexity: L
   - Complexity score: High (9 tasks; new schema usage; ownership design)
   - Model class: frontier
   - Customer value: HIGH (G1, and the foundation for G6)
   - Details:
     - Map the 9 kept engineering agents into `roles[]` (prompt body, skills, `owns` as disjoint write paths taken from their current Owns sections, inputs/outputs, `dependsOn`, and `modelPolicy` tier). Fold ideation into architect and curation into tech-lead (ATH-D-002).
     - Add the 5 new domain roles with full prompts: domain rules and hand-offs.
     - Every role's prompt carries its **PHI-lane rule block** (lane allowed or not; synthetic default; how to request a Tribe lane), **authored here, before export**. Change 5 only adds runtime configuration and the guard; if it has to touch a prompt, it edits the manifest and re-exports.
     - Every role's prompt ends with a generated **"Harness card" section**: its skills (preloaded vs invoke), its tools, and its model per harness (Claude, Codex, OpenCode, Kimi, MiniMax). The per-harness models are also set as native values through `roles[].native.<target>` where the harness honours them.
     - Business roles own the new `docs/*` paths. Reviewers get a findings path each.
     - Run `validate`, then `init` (state).
     - Record the model discovery: `agent-team-models` `models-discover` per harness, then `models-select` per role tier.
   - Acceptance:
     - `cli.mjs validate` returns ok;
     - `cli.mjs guide` with the ownership map returns `ready: true`;
     - no two roles share a write path (a script check);
     - every role's `skills[]` resolve to installed ids;
     - every role has a PHI-lane block and a Harness card listing skills, tools and a model entry for all 5 harnesses (a script check).

3. **export-team-to-harnesses**: generate native agent definitions for all five harnesses from the manifest, and install them.
   - Scope: `.claude/agents/*.md` (regenerated; replaces the hand-written files), `.codex/agents/*.toml`, `.opencode/agents/*.md` (+ `opencode.json` only if needed), `.kimi-code/agents/*.md`, `.minimax/agents/<name>/agent.md`, `.agent-team/exports/<target>/` receipts, `AGENTS.md` (project instructions for Codex, OpenCode, Kimi and MiniMax, mirrored from `CLAUDE.md`)
   - Depends on: define-portable-team-manifest
   - Recommended agent: Claude Code
   - Est. complexity: L
   - Complexity score: High (10 tasks; 5 native formats; model mapping)
   - Model class: frontier
   - Customer value: HIGH (G6)
   - Details:
     - `cli.mjs export` per target into new staging directories, then review diagnostics.
     - Per-harness model mapping through `roles[].native.<target>` overrides, with a hard/medium/low tier map:
       - **Claude:** opus-5-5 / sonnet-5 / haiku-4-5.
       - **Codex:** tiers from `models-discover`; the current default is `gpt-6-astra`.
       - **OpenCode:** a provider/model per tier.
       - **Kimi:** role model ignored, documented; invocation-level model.
       - **MiniMax:** `MiniMax-M3`.
     - Install by deliberate merge: never overwrite non-team native config.
     - Extend `lint:agents` with a **drift check**: regenerate from the manifest and byte-compare against the installed files for every harness.
   - Acceptance:
     - every harness lists the 14 agents:
       - `claude` (fresh session);
       - `codex` (agent listing, or `-c` smoke prompt);
       - `opencode agent list`;
       - `kimi --agent <name>` smoke;
       - `MINIMAX_DATA_DIR=.minimax mcode` interactive listing, or file-presence evidence, because `exec` has no selector;
     - the drift check passes and fails after a hand edit;
     - every generated agent file in every harness contains the role's skills, tools and selected model, either natively (Claude, Codex, OpenCode, MiniMax) or as the Harness-card text where the harness ignores the field (Kimi model). This is a script check over all 70 files (14 roles × 5 harnesses);
     - `AGENTS.md` is **generated** from `CLAUDE.md` by a script (`.claude/hooks/src/gen-agents-md.mts`), which swaps only the Claude-specific lead line and keeps every section. The drift check regenerates it and byte-compares, so a hand edit to either file fails CI.

4. **wire-hooks-per-harness**: give non-Claude harnesses the same guardrail and Karpathy hooks where their native mechanism allows (ATH-D-004).
   - Scope: Codex project hook config (plugin `hooks.json` or `.codex/config.toml` hooks), `.opencode/plugin/fhir-guards.{js,ts}` (calls `node .claude/hooks/dist/*.mjs`), and a Kimi hook config if supported (else documented). MiniMax is documented as unsupported unless verification finds a mechanism.
   - Depends on: export-team-to-harnesses
   - Recommended agent: Claude Code
   - Est. complexity: M
   - Complexity score: Medium (6 tasks; adapters around existing hooks)
   - Model class: medium
   - Customer value: MEDIUM (safety parity)
   - Details:
     - A payload adapter per harness maps its hook JSON onto the existing `hook-io` contract (tool name, file path, event).
     - Minimum coverage: `guard-generated` (pre-edit deny) and `agent-ledger` (session and tool events).
   - Acceptance, per harness:
     - a live or fixture test shows a protected-path edit denied;
     - one ledger line appended;
     - a capability matrix (supported / partial / none) in `docs/agent-team.md`.

5. **configure-phi-lanes**: prepare, but do not activate, the Tribe-endpoint PHI lanes, and enforce the synthetic default (ATH-D-001).
   - Scope:
     - provider templates using env-var placeholders only (`TRIBE_MODEL_BASE_URL`, `TRIBE_MODEL_API_KEY`, `TRIBE_MODEL_*`): `.opencode/opencode.phi.template.json`, `.codex/config.phi.template.toml`, `.kimi-code/config.phi.template.toml`;
     - `phi-lane-policy` in each PHI-capable role (FHIR integration, data sync, billing);
     - a new guard hook, `phi-lane-guard`.
   - Depends on: define-portable-team-manifest (PHI-lane prompt blocks already there), export-team-to-harnesses, wire-hooks-per-harness. Any prompt edit here goes through the manifest, then re-export, then the drift check.
   - Recommended agent: Claude Code, with review by `hipaa-privacy-officer` and `fhir-security-compliance-reviewer`
   - Est. complexity: M
   - Complexity score: High (new abstraction; security-sensitive)
   - Model class: frontier
   - Customer value: HIGH (HIPAA-safe path to the product use case)
   - Details:
     - `phi-lane-guard` (PreToolUse on network and FHIR tools, plus Bash `curl`/`fhir` patterns) denies FHIR pulls against non-sandbox endpoints unless the session declares `PHI_LANE=tribe` **and** the active model endpoint equals `TRIBE_MODEL_BASE_URL`.
     - An allowlist of public sandboxes: Epic sandbox, Oracle Health sandbox, SMART Health IT, HAPI public, `localhost`.
     - Templates never contain real hosts or keys.
     - **Register `phi-lane-guard` everywhere change 4 wired hooks:** Claude `settings.json`, the Codex hook config, the OpenCode plugin, and Kimi if supported, through the same payload adapters. Record MiniMax's gap in the capability matrix.
   - Acceptance:
     - if the manifest changed, all 5 exports are re-run and the drift check passes;
     - fixture tests: a production-looking FHIR base URL is denied without the lane and allowed with a matching lane; sandboxes are allowed;
     - the scan finds no secrets in the templates;
     - every harness marked "supported" or "partial" in change 4's capability matrix invokes `phi-lane-guard` (config inspection plus one fixture run per harness);
     - `hipaa-privacy-officer` review PASS.

6. **document-and-verify-cross-harness-team**: documentation, CI and acceptance across harnesses.
   - Scope: `docs/agent-team.md` (rewrite: 14 roles, harness matrix, model per harness per tier, PHI lanes, hook capability matrix, prerequisites), `CLAUDE.md` / `AGENTS.md` sections, `.github/workflows/agent-tooling.yml` (add the manifest validate, the drift check and the `phi-lane-guard` tests), `.kbd-orchestrator/project.json` `preferred_*` and `agents_config` for all 5 harnesses
   - Depends on: changes 1–5 **and 7** (retirement must finish before the goal check, so no stale agents remain)
   - Recommended agent: Claude Code (dogfood: `fhir-tech-lead` → `fhir-conformance-validator`)
   - Est. complexity: M
   - Complexity score: Medium (6 tasks)
   - Model class: medium
   - Customer value: HIGH (G6 and G7 verification)
   - Acceptance:
     - CI is green on 3 OSes;
     - the goal check marks G1–G7 MET, or records gaps;
     - a smoke prompt per harness per new domain role, using synthetic data only.

7. **retire-merged-agents**: retire `fhir-ideation-strategist` and `fhir-knowledge-curator` cleanly after the merge.
   - Scope: remove their generated files in every harness; keep a redirect note in `docs/agent-team.md`; update any references (tech-lead hand-off map, KBD docs)
   - Depends on: export-team-to-harnesses
   - Recommended agent: Claude Code
   - Est. complexity: S
   - Complexity score: Low (3 tasks)
   - Model class: small
   - Customer value: LOW (hygiene)
   - Acceptance:
     - `grep -r 'fhir-ideation-strategist\|fhir-knowledge-curator'` returns only the redirect note and the archive/evidence history;
     - `lint:agents` passes.

## EXECUTION ROUND ORDER
- Round 1: install-domain-skills
- Round 2: define-portable-team-manifest
- Round 3: export-team-to-harnesses
- Round 4 (parallel): wire-hooks-per-harness, retire-merged-agents
- Round 5: configure-phi-lanes (after round 4, since it registers into change 4's adapters)
- Round 6: document-and-verify-cross-harness-team (after changes 1–5 and 7)

## Goal traceability

| Goal | Changes |
|---|---|
| G1 agent-team-creator research and conversion | assess (research), 2 (conversion), 7 (merges) |
| G2 HIPAA expert | 1 (skills), 2 (role), 5 (lane governance) |
| G3 FHIR integration specialist | 1, 2, 5 |
| G4 business integration and sync roles | 1 (project skills), 2 (roles and doc ownership) |
| G5 billing and prior-auth specialist | 1 (plugin and vendored skills), 2 |
| G6 same team in 5 harnesses | 3 (exports and install), 4 (hooks), 6 (verification) |
| G7 skills installed; cards list skills, tools and model per harness | 1, 2, 3, 6 |

## Risks
- **PHI leakage through a cloud-model lane.** Mitigations: the synthetic default, `phi-lane-guard`, sandbox allowlists, a PHI-lane marker on every card, and `hipaa-privacy-officer` review. Residual risk: a Bash-level network call pattern the guard does not match. The guard is defense in depth; policy and training remain primary.
- **Adapter version drift.** MiniMax was inspected at 0.4.12, 0.5.4 is installed, and `agent-team-creator` is a worktree build. Every export records its version; per-harness smoke tests are the arbiter.
- **Regenerating `.claude/agents` loses hand-tuned wording.** Change 2 ports each prompt body verbatim before any edit, and change 3's drift diff is reviewed.
- **Plugin trust.** The `anthropics/healthcare` MCP connectors call hosted services (`hcls.mcp.claude.com`). Enable them only for synthetic and public-data work; they are not PHI lanes under ATH-D-001.

## COMMANDS TO RUN
```
/opsx:new install-domain-skills
/opsx:new define-portable-team-manifest
/opsx:new export-team-to-harnesses
/opsx:new wire-hooks-per-harness
/opsx:new configure-phi-lanes
/opsx:new document-and-verify-cross-harness-team
/opsx:new retire-merged-agents
```

## Review record

Adversarial review, artifact mode. Judge: gpt-5.5.

**Round 1: BLOCK**, 1 CRITICAL and 2 WARNING. All three are fixed:
- PHI-lane prompt blocks moved into change 2, before export; change 5 edits go through the manifest, then re-export, then drift check.
- Added an explicit "Harness card" (skills, tools, model per harness) to every role, with a script check over all generated files.
- Firecrawl skill research is now a recorded deliverable (`evidence/skill-research.md`) with per-role acceptance.

**Round 2: BLOCK**, 2 CRITICAL and 1 WARNING. The two-round cap was reached, so these were fixed **without re-review**:
- Change 6 now depends on change 7.
- Change 5 registers `phi-lane-guard` in every harness adapter from change 4, with per-harness acceptance.
- `AGENTS.md` is generated from `CLAUDE.md` and drift-checked (a deterministic test).

`fhir-conformance-validator` should re-check these three during execution.

PLAN COMPLETE
