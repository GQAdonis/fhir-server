# Resolution — install-domain-skills

Round 1: judge gpt-5.5 PASS (0 findings). The fhir-code-reviewer and fhir-security-compliance-reviewer personas both returned PASS, with 9 WARNINGs and 4 SUGGESTIONs between them.

| Finding | Source | Resolution |
|---|---|---|
| Hosted-connector plugin enabled for all sessions, not lane-gated | security W1 | ATH-D-007: plugin no longer enabled at project scope; marketplace registered only. `phi-lane-policy` rule 7 requires hosted connectors, plugins and web tools to be off on a Tribe lane. Hook enforcement belongs to `configure-phi-lanes`. |
| Marketplace not pinned | security W2 | A marketplace `ref` accepts only a branch or tag (docs: settings-reference, marketplace-reference), and the only tag, v1.0.0, is 58 commits behind the reviewed commit. Resolved by not enabling at project scope (ATH-D-007), with the risk documented in README and SOURCES (`pinned:false`). |
| `phi-lane-policy` claims a hook that doesn't exist | security W3 | Rule 9 now states that enforcement is pending and that no hook enforces the rules until `configure-phi-lanes`. |
| Vendored router's weaker PHI gate | security W4 | Rule 8 in `phi-lane-policy` gives it precedence. `healthcare-agents/VENDOR-NOTES.md` added; upstream text unchanged. Personas will cite the rule (change 2). |
| `fhir_package_manager.py` unsafe | security W5 | `fhir-software/VENDOR-NOTES.md`: do not run; use `internal/ig`. |
| Nonexistent package names (slopsquat) | security W6 | Verified: npm `@fhir/package-loader`, PyPI `fhir-package-loader` and `httpx-test` all return 404. Recorded in VENDOR-NOTES, with a do-not-install instruction. |
| Insecure template server | security S1 | Noted in VENDOR-NOTES. |
| "62 personas" | security S2 | That count appeared only in the review brief; no committed file uses it. |
| Dangling wiki links to gitignored session pages | security S3 | Deferred (pk index tooling, outside this change). |
| No stale-mirror removal | code W1 | `mirror-skills.mjs` writes a `.team-skills.json` marker per target, removes skills dropped from SOURCES, and `--check` flags them. Tested in a scratch tree. Marker comparison is CRLF-tolerant. |
| Mirror check not in CI | code W2 | `agent-tooling.yml` paths cover `.agents/**`, the three non-Claude mirrors and `scripts/agent-team/**`, and a `--check` step was added. |
| Medicare appeal timeline applied to MA | code W3 | Split into Original Medicare, Medicare Advantage (shorter; cite CMS) and Medicaid/commercial. |
| CMS-0057-F dates merged | code S1 | Split into Jan 1, 2026 (timeframes, reasons) and Jan 1, 2027 (Prior Authorization API). |

## Round 2 (judge BLOCK: 2 CRITICAL, 1 WARNING)

| Finding | Resolution |
|---|---|
| Research record lacks the Firecrawl result URLs | Added a "Firecrawl result URLs (per query)" section listing every URL returned for Q1–Q4, plus the Q0 repositories. |
| Mirror ignores `generated` skills | Verified that the `openspec-*` skills differ per harness (the generator writes harness variants: `.claude`, `.opencode` and `.kimi-code` all differ from `.agents`), so mirroring them would overwrite correct content. The spec requirement is scoped to the team's domain skills (`project` and `thirdParty`), with scenarios for generated exclusion. The script now fails on any `.agents/skills/*/SKILL.md` directory not classified in SOURCES.json (tested with a seeded unclassified skill → exit 1). |
| Research record says the plugin is enabled | Corrected to "marketplace registered; plugin per-user opt-in (ATH-D-007)". |

## Round 3 (judge BLOCK: 1 CRITICAL, 1 WARNING)

| Finding | Resolution |
|---|---|
| "Exactly one category" not enforced | `classificationProblems()` now fails on a skill listed in more than one category and on an unclassified source skill. Tested: a duplicate `phi-lane-policy` in `generated` makes `--check` exit 1 with the message "listed in project and generated". |
| README build-order row says "enabled for Claude" | Reworded to "marketplace registered for Claude, with the plugin per-user opt-in (ATH-D-007)". A repo sweep found no other enabled-plugin claims. |
