# Modifications

Vendored from https://github.com/ajhcs/healthcare-agents at commit `81b239763c06a71f6290d01f2535431c5ae4d89c` (Apache-2.0).

Changes made by the WSO2 FHIR Server / TribeHealth project (Apache-2.0 §4(b)):

- The router skill `skills/healthcare-agents/`, the `agents/` directory and the `workflows/` directory are combined into one self-contained skill directory.
- Path references `../../agents/` and `../../workflows/` in the router files are rewritten to `agents/` and `workflows/`, so that the skill works from any harness skills directory.

No prompt content was otherwise changed.
