---
type: Reference
id: claude-hooks-activity-for-wire-hooks-per-harness-validator-ingestion
title: Claude hooks activity for wire-hooks-per-harness validator ingestion
tags:
- claude-hooks
- agent-activity
- kb-ingestion
- kbd
- agent-team-hardening
- wire-hooks-per-harness
- fhir-conformance-validator
links:
- claude-hooks-activity-for-wire-hooks-per-harness-reviewer-ingestion
sources:
- id: hooks
  resource: claude-hooks
generated:
  by: pk/1.9.0
  at: 2026-09-25T21:02:58.706273+00:00
created_at: 2026-09-25T21:02:58.706273+00:00
updated_at: 2026-09-25T21:02:58.706273+00:00
revision: 0
content_hash: b23aae8cfe5a88be566284d84f9ee40b244a5590aaea14669c4415e51083a24e
---

## Activity window

- **Time range:** `2026-09-25T16:43:29.676Z` → `2026-09-25T21:02:23.627Z`.[^hooks]
- **Session:** `2bd5bbd2-7c7a-495f-9b41-d460cd2d1bae`.[^hooks]
- **KBD phase:** `agent-team-hardening`.[^hooks]
- **Change:** `wire-hooks-per-harness`.[^hooks]
- **Ledger lines summarized:** 10.[^hooks]

This capture continues the same `agent-team-hardening` / `wire-hooks-per-harness` sequence after [Claude hooks activity for wire-hooks-per-harness reviewer ingestion](/claude-hooks-activity-for-wire-hooks-per-harness-reviewer-ingestion.md). It records the start of `fhir-conformance-validator`, a main-session stop, one boundary recording, and one KB ingestion event in the same session.[^hooks]

## Event counts

| Event | Count |
|---|---:|
| `UserPromptSubmit` | 6 |
| `SubagentStart` | 1 |
| `SubagentStop` | 1 |
| `boundary_recorded` | 1 |
| `kb_ingested` | 1 |

## Agent activity

| Agent | Started | Stopped | Tool failures | Tasks completed |
|---|---:|---:|---:|---:|
| `(main session)` | 0 | 1 | 0 | 0 |
| `fhir-conformance-validator` | 1 | 0 | 0 | 0 |

## Notes

- `fhir-conformance-validator` was started but not stopped within the summarized window.[^hooks]
- The main session recorded one stop and no starts.[^hooks]
- No tool failures were recorded for either listed agent row.[^hooks]
- No tasks were completed by the listed agents during this capture.[^hooks]
- The ledger included one `kb_ingested` event and one `boundary_recorded` event.[^hooks]

[^hooks]: Claude hooks agent activity capture `claude-hooks`.