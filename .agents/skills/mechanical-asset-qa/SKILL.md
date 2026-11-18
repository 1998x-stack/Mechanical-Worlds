---
name: mechanical-asset-qa
description: Audit catalogs, GLB meshes, assembly schema, connector and operation constraints, reproducibility, source licenses and release claims. Use for QA, PR review, failed validation and any asset promotion or publication.
---

# mechanical-asset-qa

## Goal

Reject ungrounded promotions and maintain automated pass/fail evidence.

## Required workflow

1. Run npm run skills:check to reject skill mirror drift.
2. Run npm run assets:validate to inspect binary GLB, meshes, node identities, bounds and catalog statuses.
3. Run npm run test and npm run build; review dependency regressions in wheel/eyeglass demos.
4. Ensure geometry source and rights are declared, and generated is not confused with CAD-reviewed.
5. For new mechanical behavior test guarded operations, negative collisions, snap alignment and reassembly.
6. Publish machine-readable QA report and list all unresolved warnings.

## Bundled resources

- Read `references/guide.md` when implementing the domain-specific workflow.
- Copy and complete `assets/brief.template.json` with source evidence.
- Run `node scripts/check.mjs` in this skill directory (`--help` for supported commands).
- For automotive geometry, run `npm run assets:build` and `npm run assets:validate` from repository root.

## Non-negotiables

- Maintain physical instance IDs and meter-based RH coordinate convention.
- Do not promote planned-only entries to generated unless actual named meshes exist in a validated GLB.
- A renderable conceptual model is not CAD-reviewed, manufacturing-certified or a real repair procedure.
- Update tests and QA evidence when editing mechanical constraints or new asset families.
