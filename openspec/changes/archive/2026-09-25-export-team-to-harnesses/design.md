## Context

The staging exporter never overwrites and never installs (native contract, installed skill `references/native-harnesses.md`). Codex, OpenCode and Kimi read project directories. MiniMax reads `MINIMAX_DATA_DIR` or `~/.minimax`; ATH-D-003 makes it the repo's `.minimax`.

## Decisions

- **Install script** `scripts/agent-team/install-exports.mjs`: copies only role files from staging to their harness location, and refuses to touch non-team files. Existing `.claude/agents/fhir-*.md` are replaced only after a recorded diff review.
- **The drift check reuses the exporter:** export to a temp dir, then byte-compare with the installed files. It is implemented in `lint-agents`, so CI covers it without a new job.
- **`AGENTS.md` generation:** `.claude/hooks/src/gen-agents-md.mts` copies `CLAUDE.md` and swaps the first guidance line to a harness-neutral one. It is byte-checked by the drift check.
- **Model values** come from `evidence/model-map.md` (previous change) through `roles[].native.<target>` overrides.

## Risks / Trade-offs

- [Exporter defect for a harness] → the per-harness smoke test is the arbiter; defects are reported upstream to `agent-team-creator` and patched in the install script, recorded as a deviation.
- [`.claude/agents` regeneration changes behaviour] → the fresh-session role checks from the previous phase are repeated for all 14 roles.
