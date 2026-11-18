---
name: automotive-asset-factory
description: Batch-produce real automotive GLB mesh geometry from the 317-part catalog, starting with frame, four wheel assemblies, suspension, steering and brakes. Use when turning planned automotive parts into validated generated assets.
---

# automotive-asset-factory

## Goal

Promote catalog parts only after a committed binary GLB contains their named meshes.

## Required workflow

1. Choose coherent subsystem batch from assets/catalog/automotive-fwd-i4-001.json; do not claim the full catalog is modeled.
2. Use tools/asset-pipeline/generate-automotive.mjs to generate actual binary glTF 2.0 geometries.
3. Every generated GLB node must be named exactly as its catalog Part ID and have nonzero triangles.
4. Create batch manifest with source script, parameters, output URI, node names, triangle counts and quality tier.
5. Update geometryStatus to generated only for exact validated nodes; leave 317-total planning scope explicit.
6. Run npm run assets:validate, npm run test, npm run build and inspect the browser viewer.

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
