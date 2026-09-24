## Why

The operator requires that the Karpathy skills log everything, so the team improves from session to session. Today the only Karpathy integration is the global KBD boundary recorder. It runs through POSIX shell plus `python3`, so it does not work on Windows, and it records nothing about which agent persona did what. The operator also chose to **commit** `.prometheus/`, so anything logged becomes shared repository history. The logs must therefore carry no patient data or secrets by construction.

## What Changes

- Add an `agent-ledger` hook that appends one metadata-only JSON line per agent lifecycle event to `.prometheus/agent-ledger.jsonl`.
- Add a `karpathy-flush` hook that condenses new ledger lines into a session note under `.prometheus/raw/` and ingests it into the project knowledge base with `pk`. When `pk` is unavailable it falls back to an outbox.
- Add a `karpathy-boundary` Node wrapper around the machine-level `record-progress.py`. It is registered as KBD `augment` hooks for task, change and phase boundaries, so boundary recording works wherever Node runs and degrades gracefully without Python.
- Add a `scan-prometheus` PHI/secret scanner, used in-process by the flush hook and as a CLI over `.prometheus/**`.
- Register the hooks in `.claude/settings.json` and `.kbd-orchestrator/hooks-config.json`.

## Capabilities

### New Capabilities
- `agent-tooling/karpathy-logging`: what is logged about agent activity, where it goes, the privacy guarantees on that content, and how it reaches the knowledge base.

### Modified Capabilities

## Impact

- New hook sources and dist files under `.claude/hooks/`.
- New committed files under `.prometheus/`.
- New `.kbd-orchestrator/hooks-config.json`.
- Soft dependency on `pk` and on `python3`/`python`/`py` with the machine-level recorder. Both degrade to warnings.
