# Skill research — agent-team-hardening

Date: 2026-09-25. Tool: Firecrawl `firecrawl_search` (web source), then `gh api repos/<r>` for provenance and pinned HEAD commits. Selection criteria: an explicit OSI license (required to vendor), active maintenance (pushed in 2026), relevance to a role, no instructions that conflict with ATH-D-001 (PHI via Tribe lane only), and provenance traceable to an upstream repository (marketplace mirrors of unknown origin are rejected).

## Queries

| # | Query | Roles |
|---|---|---|
| Q1 | `HIPAA Security Rule risk analysis agent skill SKILL.md github` | hipaa-privacy-officer |
| Q2 | `SMART on FHIR backend services Bulk Data $export Claude skill SKILL.md` | fhir-integration-specialist, data-sync-coordinator |
| Q3 | `prior authorization X12 278 CARC RARC denial appeal agent skill SKILL.md` | billing-prior-auth-specialist |
| Q4 | `EHR integration onboarding data sync reconciliation runbook agent skill healthcare interoperability SKILL.md` | ehr-integration-manager, data-sync-coordinator |
| Q0 | Assess-stage searches (FHIR developer skills, healthcare agent packs), recorded in `assess-evidence.txt` | all |

## Firecrawl result URLs (per query)

- **Q1 (HIPAA):**
  - https://github.com/affaan-m/everything-claude-code/blob/main/skills/hipaa-compliance/SKILL.md
  - https://www.themomentum.ai/blog/hipaa-agent-open-source
  - https://github.com/majiayu000/claude-skill-registry/blob/main/skills/development/hipaa-compliance/SKILL.md
  - https://mcpmarket.com/tools/skills/hipaa-compliance-for-healthcare
  - https://github.com/a2aproject/A2A/issues/1626
  - https://github.com/1Mangesh1/hipaa-guardian
  - https://github.com/CarbeneAI/Forge/blob/main/.claude/skills/HIPAACompliance/SKILL.md
  - https://github.com/eddiebelaval/squire/blob/main/skills/healthcare-compliance/SKILL.md
- **Q2 (SMART / Bulk):**
  - http://build.fhir.org/ig/HL7/bulk-data/en/authorization.html
  - https://github.com/smart-on-fhir/bulk-data-server/blob/master/README.md
  - https://hl7.org/fhir/uv/bulkdata/STU3/en/authorization.html
  - https://skills.rest/skill/fhir-bulk-data
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC7678833/
  - https://mcpmarket.com/tools/skills/hl7-fhir-interoperability
  - https://relevant.software/blog/fhir-bulk-data/
  - https://myclaw.ai/skills/fhir-bulk-data
- **Q3 (prior auth / denials):**
  - https://x12.org/codes/claim-adjustment-reason-codes
  - https://www.silnahealth.com/prior-authorization/denial-codes/
  - https://www.cms.gov/files/document/esmd-x12n-278-companion-guide.pdf
  - https://www.wcb.ny.gov/CMS-1500/WCB-CARC-RARC-codes.pdf
  - https://medheave.com/denial-management-services/common-denial-codes/
  - https://textexpander.com/blog/denial-codes-medical-billing-guide
  - https://behavehealth.com/glossary/denial-codes
  - https://getsolum.com/glossary/ansi-x12-278-prior-authorization
- **Q4 (integration / sync):**
  - https://digitalscientists.com/healthcare/domains/ehr-integrations/
  - https://www.linkedin.com/posts/silna-health_for-teams-running-dozens-or-hundreds-of-authorizations-activity-7470822245419036672-czN2
  - https://www.youtube.com/watch?v=2jTqj8CVR_U
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC9523524/
  - https://nirmitee.io/blog/how-ai-agents-integrate-with-ehr-systems/
  - https://www.medixteam.com/blog/healthcare-it-modernization-skills/
  - https://www.mindbowser.com/integration-with-ehr-systems-guide/
  - https://www.thinkitive.com/blog/ehr-interoperability-guide/

  Q4 returned no skill repositories, only vendor blogs, so it yielded a "no skill found" decision.
- **Q0 (assess stage):** GitHub repositories `anthropics/healthcare`, `ajhcs/healthcare-agents`, `PhenoML/ClaudeFHIRSkill`, `jmandel/health-skillz` (see `assess-evidence.txt`).

## Candidates and provenance

| Candidate | Found by | Stars | License | Pushed | Pinned commit | Decision |
|---|---|---|---|---|---|---|
| `anthropics/healthcare` plugin (`prior-auth`, `procedure-coding`, `icd10-cm`, `fhir-developer`, `fhir`, `contracts`, `doc-extract`, `clinical-note-extract`, `fraud-detection`, `clinical-trial-protocol`) | Q0 | 413 | none | 2026-08-27 | `c7ed150d376bdd13219eb0bfeb4203e12da85516` | **Select, plugin-only.** Publisher-maintained, but the repo has no license, so it is never vendored (ATH-D-006). The marketplace is registered via `extraKnownMarketplaces` in `.claude/settings.json`. The `healthcare@healthcare` plugin is per-user opt-in and not enabled at project scope (ATH-D-007). |
| `ajhcs/healthcare-agents` router skill `healthcare-agents` + `agents/` + `workflows/` | Q0, Q3 | 51 | Apache-2.0 | 2026-07-19 | `81b239763c06a71f6290d01f2535431c5ae4d89c` | **Select, vendor.** It covers prior-auth appeal, denial spike, HIPAA evidence checklist and HL7/FHIR incident workups, plus specialists (`clinical-prior-authorization-specialist`, `revenue-medical-coding-specialist`, `revenue-cycle-specialist`, `payer-relations-specialist`, `quality-compliance-officer`, `healthit-interoperability-engineer`). The router loads `../../agents` and `../../workflows`, so it is vendored as one self-contained bundle with those paths rewritten to skill-local ones; the modification is noted per Apache-2.0 §4(b). |
| `PhenoML/ClaudeFHIRSkill` (`fhir-software`; `TopologyHealth/ClaudeFHIRSkill` redirects here) | Q0, Q2 | 51 | Apache-2.0 | 2026-06-02 | `f472b762acd0511da892963ec940431f5d57c58a` | **Select, vendor.** Covers FHIR R4 dev, SMART on FHIR (`references/smart_on_fhir.md`), search params and validation. Used by fhir-integration-specialist and the engineering roles. |
| `affaan-m/everything-claude-code` `hipaa-compliance`, `healthcare-phi-compliance` | Q1 | 267k | MIT | 2026-09-24 | `e482e579415fde18357cafce70f177ae19fd7f03` | **Select, machine-local prerequisite** (already installed under the ECC skill set; README documents the install). Not vendored, to avoid a fork of a fast-moving pack; listed in the prerequisites block. |
| `1Mangesh1/hipaa-guardian` | Q1 | 7 | MIT | 2026-06-23 | `391c34c3…` | Reject: low adoption; Safe Harbor scanning overlaps the existing `scan:prometheus` PHI scan. |
| `CarbeneAI/Forge` `HIPAACompliance` | Q1 | 9 | MIT | 2026-07-24 | `add38e58…` | Reject: low adoption; generic guidance duplicated by ECC + ajhcs `quality-compliance-officer`. |
| `eddiebelaval/squire` `healthcare-compliance` | Q1 | 21 | MIT | 2026-08-16 | `b5eea390…` | Reject: generic, duplicated by selected sources. |
| `majiayu000/claude-skill-registry` `hipaa-compliance` | Q1 | 648 | MIT | 2026-09-25 | `ffd3fdbd…` | Reject: aggregator; per-skill upstream provenance not traceable. |
| mcpmarket.com / skills.rest / myclaw.ai `fhir-bulk-data`, `hl7-fhir-interoperability`, `hipaa-compliance-for-healthcare` | Q1, Q2 | n/a | unknown | n/a | n/a | Reject: marketplace listings with no traceable upstream repository or license. |
| `jmandel/health-skillz` | Q0 | 82 | none | 2026-06-08 | `c5378cb0…` | Reject: no license, so it cannot be vendored, and there is no plugin distribution. |
| `smart-on-fhir/bulk-data-server` | Q2 | 55 | NOASSERTION | 2026-09-15 | `f81f960a…` | Reject as a skill (it is a reference server). Kept as a sandbox reference in `fhir-data-sync-runbook`. |
| HL7 Bulk Data IG (`build.fhir.org/ig/HL7/bulk-data`), CMS esMD X12N 278 companion guide, X12 CARC list | Q2, Q3 | n/a | spec | n/a | n/a | Not skills. These are **cited sources** for the project skills `fhir-data-sync-runbook` and `payer-documentation-rules`. |

## Decision per new role

| Role | Selected skills | Gap filled by project skill |
|---|---|---|
| hipaa-privacy-officer | ECC `hipaa-compliance` + `healthcare-phi-compliance` (machine-local); ajhcs `healthcare-agents` (HIPAA evidence checklist workflow, `quality-compliance-officer`) | `phi-lane-policy` (ATH-D-001 lanes; no search result encodes a single-BAA-provider rule) |
| fhir-integration-specialist | PhenoML `fhir-software`; `healthcare@healthcare` `fhir-developer`/`fhir` (plugin, Claude only); ajhcs `healthit-interoperability-engineer` | `ehr-integration-onboarding` (SMART backend-services registration, sandbox-first) |
| ehr-integration-manager | ajhcs `healthcare-agents` (`healthit-interoperability-engineer`, HL7/FHIR incident workup) | `ehr-integration-onboarding`. Q4 returned only vendor blogs, with no skill. |
| data-sync-coordinator | PhenoML `fhir-software` | `fhir-data-sync-runbook` (Bulk `$export` cadence, reconciliation, incidents). Q2/Q4 found no licensed skill. |
| billing-prior-auth-specialist | `healthcare@healthcare` `prior-auth`, `procedure-coding`, `icd10-cm` (plugin); ajhcs `healthcare-agents` (prior-auth appeal and denial spike workflows; coding, revenue cycle and payer specialists) | `payer-documentation-rules` (cite LCD/NCD/payer policy; X12 278 / CMS-0057-F; CARC/RARC appeals) |

## PHI/secret scan of installed skills (task 4.1)

`node .claude/hooks/dist/scan-prometheus.mjs .agents/skills/<skill>`:

- **Project skills** (`phi-lane-policy`, `ehr-integration-onboarding`, `fhir-data-sync-runbook`, `payer-documentation-rules`): clean. One keyword hit (`mrn` in prose) was reworded, not allowlisted.
- **Vendored skills:** 10 keyword hits, each reviewed. All are synthetic or public values, and the upstream content is left unmodified:
  - `example.org` / `example.com` emails;
  - `+1-555-…` phone numbers;
  - the public HL7 list address;
  - a localhost test DSN (`postgres:postgres@localhost`);
  - an illustrative Direct address;
  - an example "MRN 12345" in an HL7 v2 teaching scenario;
  - the public CMS 1-800-MEDICARE hotline.
