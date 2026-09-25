# Review resolution: add-infra-and-knowledge-agents (11 rounds)

**Real defects found and fixed**, grouped:
- **Persona scopes vs spec:**
  - Infra: `Makefile` (CI targets) and build-output `.gitignore` lines were added to the spec. `version.txt` was removed from its writable paths (release workflow only).
  - Curator: rotation needs write access to `agent-ledger.jsonl` and the local `.flush-cursor`.
- **Scanner:**
  - Allowlist values are no longer printed (CI logs could leak them); only the count is shown.
  - The default scope is git-committable files, because gitignored local state is never committed; `--all` keeps the full sweep.
  - Allowlist entries must be synthetic emails (`example.*`, `.invalid`, `.test`, `.localhost`, `noreply@anthropic.com`). Anything else is a finding and is not applied.
- **Flush:** same-instant flushes overwrote each other's notes. Fixed with millisecond timestamps plus atomic exclusive create (temp file hard-linked to the final name, which fails with EEXIST instead of overwriting).
- **Evidence:** the curator smoke artifact now includes its five-line fixture input.

**Packet-scope artifacts (not defects):**
- A stale `.git/index.lock` silently blocked `git add -N`, so round 1 saw no agent files. The lock had no holder and was removed.
- Repeated "missing file" findings came from per-change `files.txt` scoping. They were resolved by reviewing the whole shipped hook package, the pattern already used in `add-guardrail-hooks`.
- `events.jsonl` "present": the packet's file tree is a filesystem listing. Git evidence (`evidence/change7-git-ignore-state.txt`) shows it untracked and ignored.

Lesson for reflection: diff-mode packets should be built from the cumulative candidate (all phase files), not from per-change file lists, whenever changes share a package.
