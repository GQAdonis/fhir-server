# Resolution — configure-phi-lanes

## hipaa-privacy-officer (task 3.1): BLOCK, then PASS on re-check

C1 (the officer's own role allowed "require de-identification") fixed, with the Q3 and W6 wording. W1-W5 deferred by operator decision to a follow-up change gating the first real-PHI session; R1 and R2 fixed. See `evidence/hipaa-review-configure-phi-lanes.md` and the decision record in `docs/compliance/README.md`.

## fhir-security-compliance-reviewer: PASS (4 WARNING, 6 SUGGESTION)

All four warnings fixed in `41e0113`, each with a test:
- loopback is a sandbox only on the dev port 9090 or with `PHI_LOCAL_SANDBOX=1`, and the `[::1]` bracket bug is fixed;
- uploads are denied without a proven Tribe lane;
- ledger writes refuse symlinks and go through temp file + rename;
- agent-scope state lives in a per-user 0700 dir, and Bash writes are documented as unscoped.

Suggestions taken: the deny reason names the host only; month keys are bounded; the dead regex branch is removed. Not taken:
- the `..`-before-symlink path suggestion (no write tool passes such paths unnormalized);
- the fetch-token-only URL extraction (fails closed today).

## fhir-code-reviewer: PASS (2 SUGGESTION)

- The dead `FHIR_PATH` branch is removed.
- Orphaned scope files after a crash: low severity, not addressed.

## Judge (Codex CLI, cross-model, fresh context)

**Round 1: BLOCK, 5 CRITICAL** (`findings.json`).
- Resolved in `41e0113`:
  - the Codex template's model selection;
  - the tech-lead scope allowing writes outside the repository.
- Remaining after that commit:
  - `cmd` field: first judged not reproduced, then resolved in `1917893`;
  - ledger race: partial;
  - overlapping agents: partial.

**Verdict round 2 (`findings-verdict.json`):** BLOCK on those three items. Fixed in `1917893`:
- `cmd` is read;
- rotation refuses to run without the lock, and only stale locks are cleared;
- the tool call's own `agent_type` decides scope, failing closed without it.

**Verdict round 3 (`findings-verdict2.json`):** `cmd` resolved; two items partial, plus one WARNING regression. The review budget was exhausted, so the operator decided on 2026-09-26: **accepted trade-offs.**
1. **Ledger appends:** a hook append proceeds unlocked if rotation holds the lock for more than 3 s. A tool call must never hang, and rotation takes milliseconds.
2. **Agent scope without an identity:** with no `agent_type` in the payload and `fhir-tech-lead` among the active agents, the tech lead's scope applies (fail closed). A sibling's edit may be denied. Current Claude Code sends `agent_type` for subagent calls.

Neither is a PHI exposure.
