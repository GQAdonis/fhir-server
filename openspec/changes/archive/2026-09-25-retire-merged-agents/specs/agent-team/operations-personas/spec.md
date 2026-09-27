## MODIFIED Requirements

### Requirement: Knowledge curator maintains the Karpathy loop
There SHALL be no separate knowledge-curator agent. `fhir-tech-lead` SHALL carry the Karpathy loop duties, using the curation skill:
- summarize ledger activity into knowledge-base notes;
- run the project knowledge lint;
- draft the Karpathy lessons section of the phase `reflection.md`;
- rotate `agent-ledger.jsonl` into `.prometheus/ledger/<yyyy-mm>.jsonl` at month boundaries (resetting `.prometheus/.flush-cursor`).

It MUST run the `.prometheus/` PHI/secret scan before proposing any commit of that directory.

#### Scenario: Scan finds a match
- **WHEN** the scan reports a match in `.prometheus/`
- **THEN** the tech lead stops, reports file and line, and does not stage the directory
