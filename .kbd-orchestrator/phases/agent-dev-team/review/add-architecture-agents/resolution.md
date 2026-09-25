# Review resolution: add-architecture-agents

**Round 1 (BLOCK, 4 CRITICAL).** Fixed:
- Tech-lead Bash is kept, with rationale. `disallowedTools: Edit, Write` was added, and the task wording was corrected.
- Machine-local skills were moved out of `skills:` frontmatter. Only repo-resident skills are preloaded now; this rule is recorded in `design.md`.

**Round 2 (BLOCK, 3 CRITICAL + 1 WARNING).** The two-round cap was reached. Fixes were applied without re-review:
- **CRITICAL: architect writable paths exceed the spec.** Fixed: `website/docs/**` was removed. The `.kbd-orchestrator/phases/*/` stage artifacts stay, because the spec requirement "Architect writes are limited to design artifacts" explicitly permits them.
- **CRITICAL ×2: `openspec-explore` / `openspec-propose` "not vendored".** Not a defect; this is a packet-evidence gap. Both files exist at `.claude/skills/<name>/SKILL.md` (created by `openspec init`, not by this change). Evidence: `evidence/change2-preloaded-skills.txt`.
- **WARNING: design.md mentioned TodoWrite.** Fixed: the design now matches the frontmatter.

`fhir-conformance-validator` should re-check this change during phase goal-check.

**Round 3 (PASS, 1 WARNING).** The smoke evidence was not in the packet. It is at `evidence/smoke-architecture-agents.txt` (3/3 exit 0, correct role answers) and is now listed in `files.txt`.

**Deviation recorded.** Task 3.1 says "through the Agent tool". A running Claude Code session only loads project agents at startup, so agents created mid-session are not visible to its Agent tool (error: `Agent type 'fhir-tech-lead' not found`). The smoke test therefore ran as fresh headless sessions (`claude -p "<prompt>" --agent <name>`), which load `.claude/agents/` from disk. Change 8 will repeat the Agent-tool check in a new session.
