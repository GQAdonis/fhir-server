# Resolution — retire-merged-agents

## Round 1 (judge BLOCK: 2 CRITICAL)

| Finding | Resolution |
|---|---|
| `project.json` still names `fhir-knowledge-curator` | Reworded to "knowledge curation merged into fhir-tech-lead". |
| docs carry several retired-agent references beyond the one redirect note | The roster merge bullets and the stage-matrix labels now describe the roles without the retired ids. The architect and tech-lead role sources (and so all generated copies) say "absorbed the former ideation-strategist / knowledge-curator role; see Retired agents". A sweep outside the task's exclusions finds the ids **only** in the `docs/agent-team.md` "Retired agents" note. After the rebuild, reinstall and lint are clean. |

## Round 2 (judge BLOCK: 1 CRITICAL, 1 WARNING)

| Finding | Resolution |
|---|---|
| The architect role still mentions the retired role (prose "former ideation-strategist role") | The parentheticals were removed from both the architect and tech-lead role sources, then rebuilt and reinstalled. A case-insensitive sweep outside the exclusions finds retired-agent mentions only in the `docs/agent-team.md` "Retired agents" note plus the two roster bullets under it that describe the merge, and in `README.md`'s build-order row describing this change (the operator's saved plan text). By exact id, only the redirect note remains. |
| `project.json` contains an absolute local path | Pre-existing: `git diff origin/main -- .kbd-orchestrator/project.json` adds no `/Users/` lines. The path was written by `/kbd-init` (`focus_project_path`) and is KBD runtime identity, not part of this change. Left as is and noted for the operator. |

The port-diff evidence baseline was corrected to `origin/main`. The local `main` predates PR #1, so it has no agent files and every role showed as rewritten. The corrected diff shows only the planned edits (architect 21 and tech lead 44 lines for the merges; 2–3 lines each for the build-command and ownership alignment).

## Persona reviews (shared with export-team-to-harnesses)

- fhir-code-reviewer: no functional references remain; the ids appear only in the redirect note, its roster bullets, README's plan row, the change's own artifacts and the pre-archive base specs.
- fhir-security-compliance-reviewer: the retired curator's duties moved intact (scan gate, D-003/D-006 privacy rules). Its warning, that the tech lead's new Edit/Write is enforced by prompt only, is an operator question recorded in execution.md.
