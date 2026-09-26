## Why

The team must be the same in five harnesses. Hand-maintaining 14 roles × 5 formats would drift immediately. `agent-team-creator` defines a portable manifest that exports to each harness. Its guide cannot express healthcare roles, so the manifest is authored directly (expert path), and it becomes the single source of truth (ATH-D-005).

## What Changes

- Author `.agent-team/team.json`: 14 roles, i.e. 9 kept engineering roles plus 5 new domain roles (ATH-D-002).
- Each role gets explicit disjoint `owns` paths, inputs, outputs, `dependsOn`, `modelPolicy` tier, bound skills, a PHI-lane rule block, and a Harness card (skills, tools and model per harness).
- Fold ideation into the architect and knowledge curation into the tech lead.
- Create owned documentation paths for business roles: `docs/integrations/`, `docs/sync/`, `docs/billing/`, `docs/compliance/`.
- Initialize local team state, and record per-harness model discovery.

## Capabilities

### New Capabilities
- `agent-team/team-manifest`: the portable team definition as the single source of truth, and its structural rules.
- `agent-team/domain-personas`: the HIPAA, FHIR integration, EHR integration manager, data-sync and billing/prior-auth roles and their rules.

### Modified Capabilities

## Impact

New `.agent-team/` and `docs/{integrations,sync,billing,compliance}/`. No harness files change until `export-team-to-harnesses`.
