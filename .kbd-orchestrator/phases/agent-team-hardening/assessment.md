ASSESSMENT: agent-team-hardening
Project: WSO2 FHIR Server
Date: 2026-09-25
Codebase baseline: the Go/PostgreSQL FHIR R4 server is unchanged since the prior phase. The agent team is 11 Claude-only `fhir-*` engineering personas plus Claude-only hooks. The server is intended to become an intermediate EHR that pulls patient data from external EHRs over FHIR for AI use.
Cross-tool progress: none. This is a new phase with 0 changes, and no other harness has executed work here.

---

## Scope clarification

Assess is fact-finding. It determines the roster, the conversion approach, the skill candidates and the per-harness constraints. Files are created in `/kbd-plan` → `/kbd-apply`. The `agent-team-creator` skill was run in assessment mode only (its `guide` command); no manifest, state or export was written.

## Evidence base

- **`agent-team-creator`** (installed from `prometheus-skill-pack/.worktrees/agent-team-creator/dist/...`, a worktree build rather than a tagged release):
  - `guide` accepts only the generic areas `code`, `design`, `mobile`, `security`, `docs`, `marketing` and `product` (`runtime/src/guidance.mts:8,15-21`). A `research` or `infra` area errors with "Unknown work area".
  - For this outcome it proposed `implementer`, `designer`, `security-reviewer`, `documentation-specialist`, `product-manager` and `reviewer`, with **no healthcare, integration, billing or HIPAA roles**. Its documented alternative is: "Experts may supply a manifest directly."
- **Native export contracts** (the installed skill's `references/native-harnesses.md` at `~/Projects/prometheus/prometheus-skill-pack/.worktrees/agent-team-creator/dist/plugins/claude/prometheus-skill-pack/skills/agent-team-creator/`, excerpt in `evidence/assess-evidence.txt`, "source-verified staging adapters, not installed CLI certification"):

  | Target | Destination | Limit relevant to "same team everywhere" |
  |---|---|---|
  | Claude Code | `.claude/agents/<name>.md` (+ optional plugin) | full frontmatter incl. `model`, `skills`, `tools` |
  | Codex | `.codex/agents/<name>.toml` | `name`, `description`, `developer_instructions`; native `model` retained |
  | OpenCode | `.opencode/agents/<name>.md` (+ `opencode.json`) | `agent` / `permission` / `prompt` schema; name collisions fail |
  | Kimi Code | `.kimi-code/agents/<name>.md` | **role model frontmatter is ignored**; model is chosen at invocation or as a global secondary |
  | MiniMax Code (`mcode`) | `agents/<name>/agent.md` under `MINIMAX_DATA_DIR` or `~/.minimax` | **user-level, not project**; `mcode exec` has **no custom-agent selector** |

  The staging export never overwrites and never installs.
- **Installed harnesses and default models:**

  | Harness | Version | Default model |
  |---|---|---|
  | Claude Code | installed | project roster: opus-5-5 / sonnet-5 / haiku-4-5 |
  | Codex CLI | 0.154.0 | `gpt-6-astra` (`~/.codex/config.toml`) |
  | OpenCode | 1.18.25-fork | `kimi-for-coding/k3` |
  | Kimi Code | 0.42.0 | `kimi-code/k3` |
  | MiniMax Code (`mcode`) | 0.5.4 | `minimax/MiniMax-M3` (`~/.minimax/config.yaml:74`) |

  The adapter was inspected against `@minimax-ai/code` 0.4.12; 0.5.4 is installed, which is **version drift to verify**.
- **"MiniMax CLI" naming.** The operator installed `mmx-cli` 1.0.26 (`mmx`), MiniMax's **API/media CLI** (text, image, video, speech, search, quota). It has no agent-definition surface. The coding harness that holds agent definitions is **MiniMax Code (`mcode`)**. Plan should target `mcode` for agent definitions and treat `mmx` as an optional tool.

## Skill research (Firecrawl + GitHub provenance, 2026-09-25)

| Candidate | Provenance | License | Fits roles | Notes |
|---|---|---|---|---|
| `anthropics/healthcare` plugin v2.1.0: skills `fhir`, `fhir-developer`, `prior-auth`, `procedure-coding`, `icd10-cm`, `clinical-note-extract`, `doc-extract`, `contracts`, `fraud-detection`, `clinical-trial-protocol`; agents `note-extract-worker`, `documents-reader-*` | Anthropic, ★413, pushed 2026-08-27 | **no license file** | FHIR specialist, billing/prior-auth, CDI/coding, integration | Bundles **hosted MCP servers**: CMS Coverage (LCD/NCD payer rules), ICD-10, NPI Registry, Clinical Trials, PubMed (`hcls.mcp.claude.com`), plus local FHIR and Contracts servers. Install as a **plugin** (`/plugin marketplace add anthropics/healthcare`); vendoring the text into the repo needs license clarification |
| `ajhcs/healthcare-agents`: 51 agent/skill definitions, incl. `revenue-cycle-specialist`, `revenue-medical-coding-specialist`, `clinical-prior-authorization-specialist`, `clinical-documentation-improvement-specialist`, `healthit-interoperability-engineer`, `healthit-epic-applications-analyst`, `payer-relations-specialist`, `quality-compliance-officer` | ★51, pushed 2026-07-19 | **Apache-2.0** | billing, prior-auth, CDI, integration, compliance | Generates `SKILL.md` for Claude, OpenCode and `.agents/skills`. Vendorable with attribution |
| `PhenoML/ClaudeFHIRSkill` | ★51, pushed 2026-06-02 | **Apache-2.0** | FHIR specialist | R4/R4B/R5 development guidance |
| `jmandel/health-skillz` (SMART on FHIR patient-record access) | Josh Mandel (HL7/SMART author), ★82 | **no license** | FHIR specialist (SMART patterns) | reference only unless licensed |
| *Unverified lead:* Firely `/fhir-validation` skill (Firely Terminal + Java validator) | mentioned in a Firely blog post only | **no source located** | FHIR validation | excluded from the candidate set until a source repository is found |
| `Upstream-Intelligence/upstream-mcp` (payer intelligence, denial risk) | ★1, pushed 2026-08-09 | MIT | billing | low adoption; commercial data dependency; evaluate, not default |
| `Cloverhound/epic-fhir-cli` (Epic FHIR CLI + skill) | ★1 | no license | integration (Epic) | not recommended |
| Locally installed (ECC): `hipaa-compliance`, `healthcare-phi-compliance`, `security-review`; agent `healthcare-reviewer` | `~/.TOOLS/skills/claude/*` (ECC collection) | ECC | HIPAA expert, security | already machine-local prerequisites |

No candidate was found for **integration-program management or data-sync coordination as a business process**. Those roles will need project-authored skills, e.g. EHR onboarding checklist, sync runbook, reconciliation.

---

## IMPLEMENTATION STATUS

- **Existing roster (`.claude/agents/fhir-*.md`, 11): DONE for engineering, MISSING for domain and business roles.** None of the requested roles exist: HIPAA expert, FHIR protocol and integration specialist, EHR integration manager, data-sync coordinator, billing and prior-auth specialist.
- **Conversion to `agent-team-creator` format: MISSING.** There is no portable team manifest or `.agent-team/` state. Every existing agent already has the fields the manifest needs (description, prompt body, tools, skills, model), so conversion is a mapping into `roles[]`, not a rewrite. Ownership (`owns`) is implicit in prose today and must become explicit, disjoint path lists.
- **Multi-harness definitions: MISSING** for Codex (`.codex/agents/` absent), OpenCode (`.opencode/agents/` absent), Kimi Code (`.kimi-code/agents/` absent) and MiniMax Code (no `fhir-*` in `~/.minimax/agents/`). The OpenSpec skills are already mirrored into `.agents/skills`, `.opencode/skills` and `.kimi-code/skills` (12 each) and `~/.minimax/skills`.
- **Per-harness safety parity: MISSING.** The guardrail, license, gofmt, ledger and flush hooks are registered only in `.claude/settings.json`. Codex, OpenCode, Kimi and MiniMax sessions would run with **no generated-file guard and no Karpathy logging**, unless each harness's own hook or plugin mechanism is wired to the same `node .claude/hooks/dist/*.mjs` entry points.
- **Skill installation for new roles: MISSING.** Candidates are identified above; none is installed in the project.
- **Business-domain workspace: MISSING.** There is no `docs/integrations/`, `docs/billing/`, `docs/compliance/` or equivalent path for business agents to own. They cannot be given disjoint write ownership until those paths are planned.

## CROSS-TOOL PROGRESS
- NONE.

## SPEC GAP SUMMARY
- **HIPAA vs. multi-harness (highest risk).** The target use sends real PHI from external EHRs to AI. Model providers behind non-Claude harnesses (OpenAI for Codex; Moonshot for Kimi; MiniMax; whatever OpenCode routes to) each need a **Business Associate Agreement** before PHI may be processed. No BAA status is known. Without it, those harness lanes must be restricted to synthetic or de-identified data and engineering work. This is an operator decision for the HIPAA role, not an assumption.
- **The Anthropic `fhir` skill pulls live patient data into model context.** Using it against production EHRs is a PHI disclosure to the model provider, so it needs the same BAA gate and a synthetic or sandbox EHR default (e.g. Epic and Cerner sandboxes, SMART Health IT sandbox).
- **Kimi ignores per-role models, and MiniMax agents are user-level with no `exec` agent selector.** "Same team in every harness" can be delivered as identical *definitions*, but **not identical model routing or headless invocation** in Kimi and MiniMax. The plan must state the per-harness degradation rather than claim parity.
- **Billing knowledge is payer-specific and time-sensitive.** Examples: CMS-0057-F prior-auth rules effective 2026-01-01, LCD/NCD coverage, commercial payer policies. Static skill text goes stale, so the billing role should rely on the CMS Coverage MCP and cite sources, not memorized rules.
- **The `agent-team-creator` build is from a worktree**, not a tagged release. Pin the exact version used in the export receipt.

## BUILD HEALTH
- Go build, vet and tests: not re-run this stage. There are no code changes since `8660a8e`, where CI was green on 3 OSes.
- Hook suite: 89/89 pass at `8660a8e` (prior phase evidence).
- known violations: NONE.

## CONSTRAINT CHECK
- AGENTS.md violations: N/A.
- constraints.md violations: NONE currently. New risk: vendoring unlicensed skills (anthropics/healthcare, health-skillz) into the repo would create a license-compliance problem. Install them as plugins or references instead.

## GOAL PROGRESS
- **G1**, `agent-team-creator` research and conversion: **PARTIAL**. Research is done here. The guide's taxonomy cannot express the domain roles, so conversion must use an expert-authored manifest.
- **G2**, HIPAA expert: **NOT MET**. The `hipaa-compliance` and `healthcare-phi-compliance` skills and the `healthcare-reviewer` agent exist machine-locally; no project role exists.
- **G3**, FHIR protocol and integration specialist: **NOT MET**. Skills are available (Anthropic `fhir` / `fhir-developer`, PhenoML).
- **G4**, business integration and data-sync roles: **NOT MET**. No external skill fits; project-authored skills are needed.
- **G5**, billing / prior-auth specialist: **NOT MET**. Strong candidates: Anthropic `prior-auth`, `procedure-coding`, `icd10-cm` + CMS Coverage MCP; ajhcs revenue and prior-auth agents.
- **G6**, the same team in 5 harnesses: **NOT MET**. Export contracts exist, with Kimi and MiniMax limits noted.
- **G7**, skills installed and cards list skills, tools and model per harness: **NOT MET**.

## Risks and open questions for plan
1. **BAA status per model provider** decides which harnesses may touch PHI. This needs operator input.
2. **Canonical source of truth.** One portable manifest (`.agent-team/`) exported to all five harnesses, including Claude, where it replaces the hand-written `.claude/agents` files, or the Claude files kept as the source and exported from. Recommended: the manifest is the source and every harness file is generated, with `lint:agents` extended to check drift.
3. **MiniMax user-level install.** Agents land in `~/.minimax/agents`, outside the repo. Options: `MINIMAX_DATA_DIR` pointing at a project path, or a documented install step.
4. **License posture for Anthropic healthcare skills:** plugin install vs. vendoring.
5. **Team size.** 11 existing + 5 requested = 16 roles, above the guide's "smallest useful team" default. Some existing roles may merge, e.g. ideation-strategist into architect, or the curator into tech-lead duties. Needs an explicit keep/merge decision.
6. **Hook parity per harness:** wire Codex, OpenCode, Kimi and MiniMax to the same Node hooks, or accept Claude-only guards and log that limit.

## Operator decisions (recorded after assessment, 2026-09-25)

These answer the assessment's open questions 1, 3, 5 and 6. They are recorded as KBD decisions ATH-D-001 to ATH-D-004.

| # | Decision | Plan consequence |
|---|---|---|
| ATH-D-001 | **The BAA-covered model provider is Tribe Health Solutions' HIPAA-compliant local models.** None of Anthropic, OpenAI, Moonshot or MiniMax is BAA-covered. | Real PHI only through sessions routed to Tribe local models. Claude Code, Codex, Kimi Code and MiniMax Code on their current cloud models are **synthetic or de-identified only**. Plan must identify which harnesses can target a custom (e.g. OpenAI-compatible) endpoint so they can run as PHI lanes once pointed at Tribe's endpoint (OpenCode supports custom providers; Codex, Kimi and MiniMax need verification), and must add a PHI-lane marker to every agent card. The endpoint URL and model names are **not yet known**, so they must be operator-supplied configuration with no hardcoded values. |
| ATH-D-002 | Merge to about 14 roles: `fhir-ideation-strategist` → `fhir-architect`; `fhir-knowledge-curator` → tech-lead duties (curation remains a skill). | The 9 remaining engineering roles plus 5 new domain roles. |
| ATH-D-003 | MiniMax agents are generated into the project `.minimax/agents`, used via `MINIMAX_DATA_DIR=<repo>/.minimax`. | They are versioned with the team; the doc and session setup set the env var. |
| ATH-D-004 | Wire the same Node hook scripts into each harness's native hook or plugin mechanism where supported; document the rest. | Plan needs a per-harness hook capability check (Codex hooks/notify, OpenCode plugins, Kimi hooks, MiniMax). |

Remaining open questions for plan: #2 (manifest as the source of truth; recommended) and #4 (Anthropic healthcare as a plugin, not vendored; recommended).

## Review record

Adversarial review, artifact mode. Judge: gpt-5.5; producer: claude-opus-5-5.
- **Round 1: BLOCK**, 1 CRITICAL and 2 WARNING, all evidence gaps. Fixed by appending the harness contract table, the existing agent roster and the per-harness skill counts to `evidence/assess-evidence.txt`.
- **Round 2: PASS**, 2 WARNING. Both applied: the contract citation now names the installed skill path, and Firely is marked as an unverified lead.

ASSESSMENT COMPLETE
