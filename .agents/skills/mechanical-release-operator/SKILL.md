---
name: mechanical-release-operator
description: Coordinate GitHub CI, Pages demos, release changelogs, skill mirroring and accurate provenance statements for mechanical asset batches. Use when publishing a new geometry batch or verifying repository release readiness.
---

# mechanical-release-operator

## Goal

Release only traceable models with green checks and explicit known limits.

## Required workflow

1. Inspect branch and generated diffs; confirm licenses and no untrusted remote CAD scripts.
2. Run npm run skills:sync after canonical edits; check mirror consistency.
3. Run npm run assets:validate, npm run test, npm run build and fix all fatal failures.
4. Confirm GitHub Actions status, Pages base URL and deployed GLB path, and perform browser smoke test if available.
5. Update README/catalog/changelog with actual produced meshes and unmodeled remainder.
6. Report commit SHA, QA evidence, remaining blocking items and next mechanically coherent batch.

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
