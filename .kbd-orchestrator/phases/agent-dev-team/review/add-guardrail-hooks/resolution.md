# Review resolution: add-guardrail-hooks

**Round 1 (BLOCK, 2 CRITICAL + 1 WARNING).**
- dist helpers "missing": packet scope. They are change-1 files and were added as context.
- Matcher and timeout mismatch. Fixed: the timeout is now 10s. The PreToolUse `NotebookEdit` addition is kept and recorded in `tasks.md`, because notebooks carry `notebook_path`.
- **Real:** the license check accepted any line mentioning "Apache License". Fixed: it now requires a WSO2 copyright line, "Apache License" and "Version 2.0" in the `//` block before `package`. Verified against every tracked `.go` file with zero false rejects.

**Round 2 (BLOCK, 1 CRITICAL + 1 WARNING).**
- **Real bypass:** a relative target that climbs out and back in (`../repo/internal/basedef/x.gz`) was treated as outside the project and allowed. Fixed: `rel()` resolves relative targets against the project root first. Regression tests were added.

**Round 3 (BLOCK, 1 CRITICAL).** The packet was scoped file by file and showed some dist files without their sources. Resolved by reviewing the entire `.claude/hooks` package as it ships.

**Round 4 (PASS, 1 WARNING).** The header check accepts other leading comments before the header. Accepted: the hook is feedback-only and non-blocking, and it is stricter than the repo's `license-header` constraint check. Logged for reflection.

Also hardened during apply, before review: glob matching is case-insensitive, for macOS and Windows filesystems.
