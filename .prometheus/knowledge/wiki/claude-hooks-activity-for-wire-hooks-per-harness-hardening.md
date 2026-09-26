---
type: Reference
id: claude-hooks-activity-for-wire-hooks-per-harness-hardening
title: Claude hooks activity for wire-hooks-per-harness hardening
tags:
- claude-hooks
- agent-activity
- kb-ingestion
- kbd
- agent-team-hardening
- wire-hooks-per-harness
- fhir-security
links:
- claude-hooks-activity-for-export-team-to-harnesses-security-reviewer-stop
sources:
- id: hooks
  resource: claude-hooks
generated:
  by: pk/1.9.0
  at: 2026-09-25T16:39:05.957332+00:00
created_at: 2026-09-25T16:39:05.957332+00:00
updated_at: 2026-09-25T16:39:05.957332+00:00
revision: 0
content_hash: 963f5b1dbbea97c4dab6761992779e549b0b9aa11ced830ab795497098ab7d0e
---

## Activity window

- **Time range:** `2026-09-25T16:31:59.713Z` → `2026-09-25T16:38:35.357Z`.[^hooks]
- **Session:** `2bd5bbd2-7c7a-495f-9b41-d460cd2d1bae`.[^hooks]
- **KBD phase:** `agent-team-hardening`.[^hooks]
- **Change:** `wire-hooks-per-harness`.[^hooks]
- **Ledger lines summarized:** 26.[^hooks]

This capture continues the same `agent-team-hardening` session as the earlier `export-team-to-harnesses` security reviewer stop recorded in [Claude hooks activity for export-team-to-harnesses security reviewer stop](/claude-hooks-activity-for-export-team-to-harnesses-security-reviewer-stop.md), but the active change in this window is `wire-hooks-per-harness` and the ledger is dominated by subagent stop events.[^hooks]

## Event counts

| Event | Count |
|---|---:|
| `SubagentStop` | 24 |
| `UserPromptSubmit` | 1 |
| `kb_ingested` | 1 |

## Agent activity

| Agent | Started | Stopped | Tool failures | Tasks completed |
|---|---:|---:|---:|---:|
| `(main session)` | 0 | 23 | 0 | 0 |
| `fhir-security-compliance-reviewer` | 0 | 1 | 0 | 0 |

## Notes

- The summarized ledger contains 24 total `SubagentStop` events, one `UserPromptSubmit`, and one `kb_ingested` event.[^hooks]
- No agent start events were recorded in the summarized window.[^hooks]
- No tool failures were recorded for either the main session row or `fhir-security-compliance-reviewer`.[^hooks]
- No completed tasks were recorded for the listed agent rows.[^hooks]

[^hooks]: Claude hooks activity summary for source `claude-hooks`.