# Review resolution: add-karpathy-agent-ledger

**Round 1 (BLOCK, 4 CRITICAL).**
- `dist/` was missing from the packet. Fixed: the file list now includes `dist/`.
- `$PWD` in the KBD config. Fixed: the entries use a relative path, and the project root defaults to the dispatcher's working directory.
- 120s vs 10s timeout. Fixed: `tasks.md` 3.1 is aligned with the spec/design revision made during apply. Evidence: `pk ingest` takes about 12s, so async delivery is used.
- **Real privacy hole:** `sanitizeId` accepted `@`, `/` and `+`, so DSNs and emails could reach the ledger. Fixed: the charset is tightened, every identifier is also run through `scanText`, and regression assertions were added.

**Round 2 (BLOCK, 3 CRITICAL).**
- 2× change-1 files not in scope. Fixed: added as context.
- **Real bug:** the flush cursor advanced before the note was persisted. Fixed: the cursor advances only after the note is in both `raw/` and `outbox/`. A blocked delta is skipped deliberately (documented). A regression test was added.

**Round 3 (BLOCK, 1 CRITICAL).** "TypeScript 7.0.2 unpublished." This is false and reflects the judge's stale knowledge. Evidence: `evidence/typescript-7-published.txt` (npm `latest` = 7.0.2, published 2026-07-08, lockfile integrity matches, fresh `npm ci` installs 7.0.2).

**Round 4 (PASS, 1 WARNING).** Docs not updated. Deferred to change `document-and-verify-agent-team` (`docs/agent-team.md`: Karpathy data flow and PHI policy). No server config key is involved.

**Certification:** PENDING until `fhir-security-compliance-reviewer` (change `add-quality-agents`) reviews this change and the committed `.prometheus/` content. That is the approval gate in `execution.md`.

**Open item for security review:** the user-level `Stop` hook (`pk ingest`, outside this repo) writes `.prometheus/knowledge/wiki/karpathy-session-*.md` records containing assistant reply text. Under the commit-everything decision (D-003), those records would be committed. `scan:prometheus` covers them (currently clean), but they are conversation content, not metadata.

## Security-compliance review (persona `fhir-security-compliance-reviewer`)

**Round 1: BLOCK.** Reply text in `.prometheus/knowledge/` would be committed, and the scan had not been run. Policy questions went to the operator:
- D-006: gitignore reply text and path caches.
- D-007: drop `prompt_sha256`.

Scanner hardening followed the review:
- the allowlist requires an exact match of at least 8 characters;
- binary files fail closed;
- allowlisted literals are printed.

Evidence: `evidence/security-review-karpathy-ledger.txt`.

**Round 2.** All prior findings RESOLVED. The only open item was the scan run, which the persona could not execute non-interactively. It was run by the orchestrating session and exited 0 over 91 files (`evidence/scan-prometheus-gate.txt`), which per the persona's hand-off converts the verdict to PASS. Evidence: `evidence/security-review-karpathy-ledger-round2.txt`.

**Certification: PASSED** (security gate). Tracked follow-ups:
- the CI scan step (change `document-and-verify-agent-team`, task 3.1);
- recorder `touchedFiles` noise from `node_modules` paths (the global recorder, not this repo).
