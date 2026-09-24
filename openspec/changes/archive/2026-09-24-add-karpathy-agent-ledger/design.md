## Context

These pieces already exist: the hook runtime (see `agent-tooling/hook-runtime`), `pk ingest --scope project --source <s>`, and the machine-level recorder `~/.claude/skills/karpathy-progress-memory/scripts/record-progress.py`. That recorder is idempotent by canonical event identity and returns `recorded|queued|degraded|duplicate`.

KBD hooks are loaded by `shared/lib/hooks.sh`. Verified: a project `mode: override` only suppresses the built-in `report-progress` reporter. It cannot replace a built-in entry by id (decision D-005).

## Goals / Non-Goals

**Goals:** per-agent observability; a privacy-safe committed history; knowledge-base ingestion; Windows-capable boundary recording.

**Non-Goals:** rewriting the global KBD `hooks.json` or `record-progress.py`; recording tool payloads for debugging; real-time dashboards.

## Decisions

- **Allowlist, not denylist, for ledger fields.** The writer builds each line from a fixed field list, so a new hook payload field cannot leak by default.
- **Hash prompts.** `prompt_sha256` lets the curator correlate repeated prompts without storing them.
- **Scan in memory before the write.** `karpathy-flush` renders the note as a string, calls `scanText()`, then does temp-file + rename. A partial or unscanned note can never appear in `.prometheus/raw/`.
- **Flush cursor.** `.prometheus/.flush-cursor` stores the ledger byte offset of the last flush, so flushes are incremental and idempotent across `Stop`, `SessionEnd` and `PreCompact` in the same session.
- **KBD augment entries, not override.** Three entries in `.kbd-orchestrator/hooks-config.json` run `node .claude/hooks/dist/karpathy-boundary.mjs --boundary <kind>`.
  - On Unix, the global python entries also run, and the recorder returns `duplicate` for the second call.
  - On Windows, the global shell entries fail with `on_failure: warn` and the Node entry records.
- **Recorder resolution order:** `KARPATHY_RECORDER`, then `$KBD_ORCHESTRATOR_ROOT/../karpathy-progress-memory/scripts/record-progress.py`, then `os.homedir()/.claude/skills/karpathy-progress-memory/scripts/record-progress.py`. **Interpreter order:** `python3`, `python`, `py -3`, each probed with `--version` under a 2s timeout.
- **Asynchronous knowledge-base delivery.** This is a DECISION revised during apply, based on live evidence. `pk ingest` measured about 12s per note, because it compiles with an LLM. A 10s synchronous cap would have queued essentially every note, and nothing drained the queue.
  - The flush now writes the scanned note to `raw/` and `outbox/`, then starts a detached `pk-drain.mjs` (120s per note).
  - The drainer deletes an outbox entry only after `pk` accepts it, and logs `kb_ingested` or `kb_deferred`.
  - The hook returns immediately. `KARPATHY_FLUSH_SYNC=1` drains inline for tests and CI.
- **Serialized appends.** Ledger appends use `fs.appendFileSync` with a single `\n`-terminated line under 4 KB. POSIX `O_APPEND` keeps concurrent writers line-atomic on local disks. Windows appends of that size are effectively atomic, and a corrupt line is skipped by readers.

## Risks / Trade-offs

- [A human hand-edits a committed note and adds PHI] → CI runs `scan:prometheus` (change 8), and `fhir-security-compliance-reviewer` owns `.prometheus/` review.
- [Regex scanners have false positives, such as FHIR test IDs that look like phone numbers] → a match blocks only the note, never the session. Any allowlist of known synthetic patterns lives in `.prometheus/scan-allowlist.json` and requires review.
- [The ledger grows without bound in a committed repo] → the curator (change 7) rotates `agent-ledger.jsonl` monthly into `.prometheus/ledger/<yyyy-mm>.jsonl`.
- [`pk` latency on Stop] → delivery is detached, so the Stop hook never blocks. Queued notes are retried on every flush, and `node .claude/hooks/dist/pk-drain.mjs` drains them manually.
