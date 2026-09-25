# Resolution — define-portable-team-manifest

## Round 1 (judge BLOCK: 1 CRITICAL, 1 WARNING)

| Finding | Resolution |
|---|---|
| The manifest has no `native.*.version` recording the agent-team-creator path and commit (design risk mitigation) | `team.config.json` gains `native.<harness>.{version,source}` for all 5 harnesses: the installed harness version, `agent-team-creator 5f2d7a712f28 (worktree path)`, and the native contract URL. `build-manifest.mjs` emits them as team-level native wrappers and fails if any harness lacks either field (new unit test; 11/11 pass). Rebuilt; `cli.mjs validate` still `{"valid":true}`. |
| `docs/interop/**` owned but not created | Added `docs/interop/README.md` (owner, contents, patient-data rule); scan clean. |

## Round 2 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The Harness card doesn't list tools for Codex, OpenCode, Kimi or MiniMax | The card now has a Tools column for every harness. Each role's Claude tools are mapped to capabilities (read, shell, edit, web, firecrawl, delegate), and each capability is rendered with that harness's tool names (Codex `apply_patch`/`web_search`, OpenCode `read`/`bash`/`edit`/`webfetch`/`task`, Kimi `ReadFile`/`Shell`/`WriteFile`/`SearchWeb`/`Task`, MiniMax descriptive). A separate Permissions column follows. New unit test; 12/12 pass. Rebuilt, and `--check` passes. |

## Round 3 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The architect prompt still grants `docs/**` | The architect's Writable paths now list exactly its header `owns` (`docs/*.md`, `docs/images/**`, the stage artifacts, evidence, and the manifest sources), and name the domain doc trees as belonging to other roles. The same audit found the infra body narrower than its header: the body now lists the agent-tooling paths, and the header's `.github/**` is narrowed to the paths the body states (`.gitignore` added). A new `ownsStatementProblems` check fails when a prompt's "Writable paths, and only these:" bullet and the header `owns` disagree in either direction (unit test added; 13/13 pass). It runs in `--check`, so this cannot regress. The port diff evidence was refreshed. |

## Round 4 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The flow-list parser splits commas inside items | Confirmed a real defect: billing `inputs` had become `["…(LCD/NCD", "payer policies)", …]`. The parser now tracks parenthesis depth as well as quotes, and throws on an unterminated quote or parenthesis. The billing item is also quoted in its header. A regression test covers parenthesised, quoted and malformed items (14/14 pass). After the rebuild, billing `inputs` holds 3 intact items, and an audit over all 14 roles found every `inputs`/`outputs`/`owns`/`skills`/`dependsOn` item verbatim in its header (0 mismatches). |

## Round 5 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The validator runs `go build ./... && go vet ./...` instead of the blocking `make build && make vet` | This text was inherited unchanged from the archived previous phase. It avoided `make build` because the read-only validator must not write the untracked `./fhir-server` binary; `git check-ignore` confirms that binary is not ignored. The Makefile builds to the overridable `$(BINARY)`, so both the validator and the code reviewer (which had the same substitution) now run the exact constraint command `make build BINARY="$(mktemp -d)/fhir-server" && make vet`. Verified locally with exit 0, the binary written to the temp dir, and no `./fhir-server` created. The port diff was refreshed. |

## Round 6 (judge BLOCK: 1 CRITICAL, 1 WARNING)

| Finding | Resolution |
|---|---|
| The ownership check doesn't enforce findings-only ownership for review roles | `ownershipProblems` now requires every read-only role (no Edit/Write tools) to own exactly `.agent-team/findings/<id>/**`. Unit test added (15/15 pass). On the real tree, seeding `docs/review/**` into `fhir-code-reviewer` makes `--check` exit 1 with the message "review role must own only …"; the restored tree passes. |
| Stale test evidence | `evidence/manifest-build.md` now records 15/15 tests, lists the added checks, drops the fixed hash (which changes with any role edit), and adds the new seeded-fault row. |

## Round 7 (judge BLOCK: 1 CRITICAL; round 7's first dispatch returned unusable output and was retried)

| Finding | Resolution |
|---|---|
| `docs/agent-team.md` does not carry the 14-role roster the manifest must match | Added a "Portable team roster" section to `docs/agent-team.md`: 14 rows with role, tier, PHI lane and owns, plus the merge and lane notes. The existing 11-agent table stays, because those are still the installed agents until `export-team-to-harnesses`. A new `rosterDocProblems` check in `--check` requires that section to list exactly the manifest roster, in order. Unit test added (16/16 pass). On the real tree, removing one doc row makes `--check` exit 1. `lint:agents` still passes. |

## Round 8 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| Role native metadata omits Kimi | Every role now carries `native.kimi.model` (from `team.config.json` `models.kimi`). The exporter documents that Kimi ignores per-role model frontmatter, so the value records intent, and the Harness card states the invocation-time model. The unit test asserts all 5 native keys (16/16 pass). All 14 roles carry 5 native entries; `cli.mjs validate` returns `{"valid":true}`. |

## Round 9 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The tech lead prompt authorizes `.prometheus/.flush-cursor`, which is not in `owns` | Added to `owns`. The tech lead's write-permission bullet is rewritten in the checked "Writable paths, and only these:" form and lists exactly its `owns` (goals, execution, execute-dispatch, reflection lessons, and the curation paths including the flush cursor). `ownsStatementProblems` now covers the tech lead as well. On the real tree, removing `.flush-cursor` from `owns` makes `--check` fail ("prompt states writable \".prometheus/.flush-cursor\" that is not in owns"); the restored tree passes. The port diff was refreshed. |

## Round 10 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| `docs/agent-team.md` still presents an 11-agent roster | Until `export-team-to-harnesses`, `.claude/agents/` really does hold the 11 original agents, and `lint:agents` requires every installed agent to be documented, so that table must stay. It is now headed "Installed Claude agents (until export)" and marked as superseded. The intro now describes the team as 14 roles defined in `.agent-team/team.json`. The spec requirement is clarified: the manifest must equal, in order, the roles in the "Portable team roster" section, with a new scenario "Roster documented" enforced by `build-manifest --check`. `openspec validate --strict` passes. The intro's "every agent is prefixed `fhir-`" claim was corrected, and the domain role names were checked for collisions with user-level agents in all five harnesses (none). |

## Round 11 (judge BLOCK: 2 CRITICAL)

| Finding | Resolution |
|---|---|
| `--check` does not enforce `agent-team-creator validate` | `--check` now runs the creator's `validate` on the built manifest whenever the skill is found (`$AGENT_TEAM_CREATOR`, or `~/.claude/skills/agent-team-creator`), and fails on any invalid result. Seeded test on the real tree: a `dependsOn` pointing at an unknown role fails with "agent-team-creator validate failed: Unknown dependency no-such-role"; restored, it passes. Without the skill it prints a visible skip, or fails when given `--require-validate`, which local QA uses. CI runners have no machine-local skill, so they get the skip, and the unit and structural checks still run there. |
| `fhir-test-engineer` prompt claims `*_test.go` across the repo | Its Owns section now states "Writable paths, and only these:" exactly matching its `owns` (`internal/testutil/**`, `internal/conformance/**`, `internal/store/testdata/**`), and so is covered by `ownsStatementProblems`. `*_test.go` files and benchmarks in other packages belong to the package owner, and the test engineer edits them only in an assigned task, never in parallel with that owner. |

## Round 12 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| `--check` can pass without `validate` in CI and on fresh clones | agent-team-creator is public (`Prometheus-AGS/prometheus-skill-system`, MIT), and its compiled CLI is committed with no dependencies. The CI job now checks that repository out at the pinned commit `5f2d7a712f289b6bb2df3f45138bb3d68ed836a2` (sparse, only the skill directory, `persist-credentials: false`, under the gitignored `.ci/`), sets `AGENT_TEAM_CREATOR`, and runs `build-manifest --check --require-validate`. CI now fails if validate cannot run or reports the manifest invalid. Simulated locally from a fresh sparse clone at that commit: `build-manifest: OK (14 roles)`. On a developer's fresh clone without the skill, the check prints a visible skip, and CI remains the enforcing gate. |

## Round 13 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The doc presents `fhir-ideation-strategist` and `fhir-knowledge-curator` as active personas | Both agents are still installed until the planned change `retire-merged-agents` removes them, and `lint:agents` requires installed agents to be documented. In `docs/agent-team.md` they are now marked "(retiring: merged into …)" in the installed table and "→ now `fhir-architect` / `fhir-tech-lead`" in the stage matrix. The hand-off and Karpathy diagrams name the merge targets, and every prerequisite `used_by` list is reassigned to `fhir-architect` / `fhir-tech-lead`. File removal and the final doc rewrite stay in `retire-merged-agents` and `document-and-verify-cross-harness-team`, per plan order. `lint:agents` and `build-manifest --check --require-validate` both pass. |

## Round 14 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| `--check` can succeed without running validate | `--check` now **always** runs `agent-team-creator validate` and fails if the skill is missing or reports errors. Verified: exit 1 with the message "agent-team-creator not found …" when it is missing. The only bypass is an explicit `--skip-validate` offline opt-out, which prints a WARNING that CI still enforces validation. CI runs plain `--check` against the pinned checkout. |

## Round 15 (judge PASS, 1 WARNING)

| Finding | Resolution |
|---|---|
| The doc calls `fhir-tech-lead` read-only | Fixed in `docs/agent-team.md`: the read-only list now names the reviewers and validator only, and a new line states the tech lead's write scope (KBD phase records and curation paths, per its `owns`). The `make build` note mentions the `BINARY=` temp-dir form. |

## Persona reviews: fhir-code-reviewer PASS (1 WARNING, 2 SUGGESTION); fhir-security-compliance-reviewer PASS (7 WARNING, 4 SUGGESTION)

| Finding | Resolution |
|---|---|
| sec W1: the HIPAA officer is the approving authority | The role now recommends; the designated privacy official (a person, 164.530(a)) signs off in `docs/compliance/<topic>.md`. |
| sec W2–W4: breach, minimum-necessary, DUA and Safe Harbor inaccuracies | Rewritten with citations: unsecured-PHI presumption, discovery definition, the HHS <500/≥500 split, the per-State media trigger, business-associate notice (164.410), state-law flag, the 164.502(b)(2) exceptions, role-based access, DUA limited to limited data sets, and Safe Harbor covering relatives, employers and household. |
| sec W5: tribe-only lane block is weaker; web tools; unverifiable lane | Lane block adds: assume synthetic if you cannot check both conditions yourself; treat every session as synthetic until `phi-lane-guard` and a denying Tribe profile exist; stop if PHI appears; tribe-only cards state that no listed model is BAA-covered. Tool *denial* is carried to configure-phi-lanes 4.1. |
| sec W6: no safe PHI destination; automatic sinks | Lane block, billing role and `phi-lane-policy` rule 7: PHI drafts go only to the operator in the session, never to files or other roles; knowledge-base Stop hooks, transcripts and telemetry are listed as sinks to disable. Enforcement is carried to 4.1. |
| sec W7: the tech lead can hand-edit the ledger | Carried to configure-phi-lanes 4.2 (rotation script, ledger-key allowlist, then drop the Edit scope). |
| sec W8: the first checkout persists credentials | `persist-credentials: false` added. |
| sec S: de-identified data on cloud lanes | Operator question, recorded in execution.md. |
| sec S: sync runs without go-live check; contact PII | The sync coordinator confirms the go-live record before real runs; intake records contacts as roles or titles only (role and onboarding skill). |
| code W: `agent-team-creator` `used_by` mismatch; no reverse check | Now used by `fhir-architect` and `fhir-infra-release-engineer`, and added to both `invoke` lists. New `usedByProblems` check: every manifest role a prerequisite names must preload or invoke it (18/18 tests pass; the real tree passes). |
| code S: color collisions | Accepted: Claude Code offers 8 colors for 14 roles, so collisions are unavoidable; `color` is cosmetic. |
| code S: hand-off diagram omits domain roles | Added domain hand-off lines. |
