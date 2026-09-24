# Review resolution: add-engineering-agents

**Round 1 (BLOCK, 3 CRITICAL).** "Required skills not in frontmatter." This conflicted with the phase rule adopted in the `add-architecture-agents` review: preload only repo-resident skills. Resolved by aligning the task criteria for changes 5, 6 and 7 with that rule. Evidence: `evidence/change5-skill-resolution.txt` (every preloaded skill is repo-resident, and every prompt-named skill resolves on disk).

**Round 2 (BLOCK, 3 CRITICAL).** The agents referenced `docs/agent-team.md` before it existed. Resolved by creating `docs/agent-team.md` now with its Prerequisites section: a machine-local skill list with sources resolved from real paths, plus the runtime tools. Change `document-and-verify-agent-team` completes the rest of the doc.

**Round 3: PASS, no findings.** Post-review correction: one repo-resident entry (`openspec-update-change`) was removed from the prerequisites list. It lives in `.claude/skills/`, so listing it as machine-local was wrong. No behavioural change.
