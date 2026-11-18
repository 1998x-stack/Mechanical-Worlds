---
name: parametric-cad-authoring
description: Author reproducible parametric 3D mechanical solids, wheel rims, brake rotors, hub shafts, calipers, frame brackets and robot mechanisms. Use when creating or refining real mesh geometry from procedural CAD or STEP sources.
---

# parametric-cad-authoring

## Goal

Build dimensioned physically independent geometries, not placeholder images or a monolithic OBJ.

## Required workflow

1. Choose a dimensioned part brief in assets/brief.template.json; record whether dimensions are measured or conceptual.
2. Model functional features: bores, outer shells, bosses, ribs, bolt circles, teeth, spokes, cylinders and wall thickness.
3. Keep a reproducible CAD/procedural source and an immutable stable part ID.
4. Use named independent meshes in glTF/GLB; distinguish geometry-generated from CAD-reviewed quality.
5. Inspect manifoldness, normals, bounds, obvious interpenetration and uncertainty.
6. Run npm run assets:build and npm run assets:validate before changing catalog statuses.

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
