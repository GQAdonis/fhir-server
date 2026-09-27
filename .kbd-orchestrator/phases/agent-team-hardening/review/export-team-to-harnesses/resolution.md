# Resolution — export-team-to-harnesses

## Round 1 (judge BLOCK: 5 CRITICAL)

| Finding | Resolution |
|---|---|
| `.claude/agents` holds extra files beyond the 14 roles | The planned change `retire-merged-agents` (4b) was pulled forward and completed. `fhir-ideation-strategist.md` and `fhir-knowledge-curator.md` are removed, and `.claude/agents` holds exactly the 14 roster roles. |
| Lint doesn't enforce exact Claude roster membership | `lintHarnesses` now reports any `.claude/agents/*.md` that is not a roster role, as it already did for the other four harnesses. It flagged the two retiring files before their removal; `lint:agents` now reports `OK (14 agents; 14 roles x 5 harnesses)`. |
| The install drift check normalizes CRLF (not byte-for-byte) | Comparison is now byte-exact (`Buffer.compare`) for role files, markers and `.codex/config.toml`. `.gitattributes` forces LF on `.codex/**`, `.opencode/agents/**`, `.kimi-code/agents/**` and `.minimax/agents/**`; `.claude/agents/*.md` was already LF-forced. The unit test now asserts a CRLF copy **is** drift. |
| The AGENTS.md drift check normalizes CRLF | Byte-exact comparison; `AGENTS.md text eol=lf`. |
| AGENTS.md changes the title as well as the lead line | An `AGENTS.md` titled "CLAUDE.md" would be wrong, so the spec requirement is clarified to "changing only the title (`# AGENTS.md`) and the harness-specific lead line". The rest is byte-identical (`gen-agents-md --check`). `openspec validate --strict` passes. |

## Round 2 (judge BLOCK: 3 CRITICAL)

| Finding | Resolution |
|---|---|
| AGENTS.md not added | It exists as a new untracked file (the change is uncommitted; commit happens on operator request). The packet previously inlined only its head, so it now carries the full `git diff --no-index /dev/null AGENTS.md`, and `git status` shows it as `??`. `gen-agents-md --check` passes. |
| Compiled `dist/` not in the diff | `.claude/hooks/dist/` is committed, and `check:dist` compiles `src/` into a temp dir and byte-compares it: "dist/ is up to date (21 files)". The packet now includes the `dist/` diff (`lib/agent-lint.mjs`, the new `lib/harness-lint.mjs`, `lint-agents.mjs`). |
| docs/agent-team.md lacks the Kimi and MiniMax limitations | Added a "Per-harness limitations" section: Kimi ignores the per-agent model (choose with `-m`) and has no per-agent permissions; MiniMax `exec` has no agent selector and no listing, and `MINIMAX_DATA_DIR` relocates auth (separate login, gitignored runtime); plus the Codex registration and project-trust requirement, the OpenCode permission mapping, and the Claude reload note. |

## Persona reviews: fhir-code-reviewer BLOCK (1 CRITICAL, 2 WARNING, 1 SUGGESTION); fhir-security-compliance-reviewer PASS (5 WARNING, 3 SUGGESTION)

| Finding | Resolution |
|---|---|
| code C: `.claude/agents/.team-agents.json` is not LF-pinned (permanent Windows drift) | `.gitattributes` now pins `.claude/agents/** text eol=lf`, so `git check-attr` reports `eol: lf` for the marker. Test added: a CRLF Claude marker is drift. |
| code W: the `team.json` drift check normalizes CRLF | Byte-exact `Buffer.compare`; test added. |
| code W: `.codex/config.toml` whole-file ownership undocumented | Documented in the Per-harness limitations row for Codex (wholly generated; put other settings in the user config). |
| code S: `.claude/settings.json` marketplace entry out of scope | It belongs to the archived `install-domain-skills` (ATH-D-007); the branch diff is cumulative. |
| sec W1: `.minimax` negations expose nested files; mcode wrote `.builtin` vendor agents into the committable tree | `.gitignore` now allows only `.minimax/agents/.team-agents.json`, `.minimax/agents/<id>/agent.md` and `.minimax/skills/`, and ignores `.minimax/agents/.builtin/` and any other nested file (probed: nested `auth.json` and `secret.json` are ignored). New `minimaxCommittableProblems` in `lint:agents` fails if git would commit anything else under `.minimax` (it runs in CI). |
| sec W2: steer the MiniMax data dir out of the repo; Docker context | `.dockerignore` added (excludes `.minimax/`, the harness dirs, `.agent-team/`, `.prometheus/`, `.ci/`, `.git`, …). README and the doc now warn that the data dir holds login and session data, and recommend copying agents to `~/.minimax/agents` until the operator decides ATH-D-003 (operator question recorded). |
| sec W3: third-party creator runs before later gates | `scan:prometheus` now runs before the creator checkout (hook tests already ran before it). The lint/drift step, which needs the creator, and the mirror, team-test and exec-form steps follow. |
| sec W4: OpenCode reviewers can still write through the shell | Read-only roles get an OpenCode `permission.bash` policy: `"*": "ask"`, with a read-only verification allowlist (git read commands, grep/rg, go vet/test, make test/lint, openspec validate/status, the hook npm scripts). The card and doc state the residual risk (an approved command could still write). |
| sec W5: tech-lead Edit/Write enforced by prompt only | Operator question (accept, or add a PreToolUse path allowlist for the tech lead), recorded in the resume notes. Enforcement belongs with the guard work in `configure-phi-lanes` / `wire-hooks-per-harness`. |
| sec S: Codex keys could be widened via the manifest | `lint:agents` allowlists Codex agent keys, restricts `sandbox_mode` to read-only or workspace-write, and requires read-only for the three gate roles (test added). |
| sec S: the installer follows symlinks from the export | `planTarget` rejects non-regular export files (`lstat`); test added (skipped where symlinks aren't permitted). |

All green after the fixes: team scripts 31/31, hooks 96/96, `check:dist` up to date, `lint:agents` OK (14 agents; 14 roles x 5 harnesses) including drift, CI step order verified.

## Round 4 (judge BLOCK: 3 CRITICAL)

| Finding | Resolution |
|---|---|
| `copyRepo` copies `.agent-team/team.json` without creating `.agent-team/` | The tests already passed (96/96), because `cpSync` creates missing parents. `copyRepo` now also calls `mkdirSync(dirname, { recursive: true })` explicitly, so it no longer relies on that behaviour. 5/5 pass. |
| No committed `dist/` for harness-lint | A packet omission this round: `.claude/hooks/dist/lib/harness-lint.mjs` is present and `check:dist` byte-compares it. The packet again carries the full `dist/` diff. |
| AGENTS.md not in the diff | A packet omission this round: the full file is inlined again (untracked `??`, uncommitted change). |

## Round 5 (judge BLOCK: 2 CRITICAL)

| Finding | Resolution |
|---|---|
| `openspec/specs/agent-team/cross-harness-export/spec.md` not added; `team-verification` not updated | OpenSpec workflow: the change carries **delta** specs under `openspec/changes/export-team-to-harnesses/specs/…` (ADDED `cross-harness-export`, MODIFIED `team-verification`), and `kbd-apply archive` (which runs `openspec archive`) merges them into `openspec/specs/`. That is how the two archived changes of this phase produced `openspec/specs/agent-team/{domain-skills,team-manifest,domain-personas}/`. The delta files are now in the packet diff, and `openspec validate export-team-to-harnesses --strict` passes. The base specs are updated at archive, which runs after this review passes. |

## Round 6 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The installer can write outside the harness directories through a symlinked installed path | New `assertInsideRoot`, applied to every role file, marker and `.codex/config.toml` before planning. It refuses when the installed path exists (or is a dangling link) and is not a regular file, and when the nearest existing directory's `realpath` is outside the repository root. Tests: a symlinked `.claude/agents/a.md` and a symlinked `.codex` directory both throw, and nothing is created at the outside target (10/10 pass). The real tree's `install-exports --check` and `lint:agents` still pass. |

## Round 7 (judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| The cross-harness lint doesn't require the standard prompt sections for Codex, OpenCode, Kimi or MiniMax | `generatedSections` now also requires the eight `REQUIRED_SECTIONS` (Role, Owns, Domain rules, Workflow, Hand-offs, Skills, Karpathy, Output contract) in every harness: Codex `developer_instructions`, and the Markdown bodies elsewhere. Test added: renaming "## Hand-offs" in one role for each of the four harnesses reports "missing section" in each. Hooks 97/97 pass, and the real tree lints clean. |

## Round 8 (judge BLOCK: 1 CRITICAL — disputed with evidence)

| Finding | Resolution |
|---|---|
| The CI path filters omit `.claude/agents/**` | No change needed. The `push` and `pull_request` filters both start with `".claude/**"` (`agent-tooling.yml` lines 11 and 29), which matches `.claude/agents/**`. Those lines predate this change, so they did not appear in the diff hunks. The full workflow file is now in the packet evidence. |

## Round 9 (judge BLOCK: 1 CRITICAL, 1 WARNING)

| Finding | Resolution |
|---|---|
| The installer overwrites `.codex/config.toml`, clobbering native project config | `install-exports` now manages only a delimited block (`# >>> agent-team roles … >>>` … `# <<< agent-team roles <<<`). `mergeCodexConfig` keeps every line outside the markers, appends the block to a file without markers, and throws on damaged markers. The drift check compares the merged result, so native lines are not drift but an edit inside the block is. Tests cover preservation, idempotence, role replacement and damaged markers (11/11). Real tree: prepending `model = "gpt-6-astra"` leaves `--check` in sync. The doc is updated. |
| The MiniMax committable check succeeds silently when `git ls-files` fails | It now fails closed and reports that it cannot prove the tree is clean. |

Hooks 97/97 (one earlier run had a timing flake in the Karpathy-boundary recorder test, which shells out to `pk`; it passed alone in 0.7 s and in the full rerun). `check:dist` is up to date and `lint:agents` is OK.

## Round 10 (the first dispatch hit a judge gateway 502 and was retried; judge BLOCK: 1 CRITICAL)

| Finding | Resolution |
|---|---|
| `--skip-drift` lets drift pass | The offline flag is kept, but it can no longer pass. With `--skip-drift`, structural checks still run, but the command exits **3** ("structure OK … but drift NOT verified") instead of 0; only a full run with drift exits 0. CI runs `lint:agents` without the flag. The CLI test asserts exit 3 and the message. Hooks 97/97 pass, and full `lint:agents` is OK. |

A pre-existing, unrelated flake in `karpathy-boundary.test.mjs` ("recorder present") showed up under load: its 2 s interpreter-probe timeout expires, although the hook records correctly in 1–2 s standalone and the file is unchanged from `origin/main`. It is registered as task 4.1 of `wire-hooks-per-harness`, which owns the hooks.
