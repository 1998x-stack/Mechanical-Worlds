---
name: gltf-asset-pipeline
description: Export and validate binary glTF 2.0 GLB assets with stable scene nodes, normals, triangle topology, dimensions and manifest linkage. Use whenever generating browser 3D meshes or preparing a mechanical GLB release.
---

# gltf-asset-pipeline

## Goal

Make every advertised GLB parseable, complete, reproducible and traceable.

## Required workflow

1. Generate meshes with finite vertices, valid normals, positive triangle indices, explicit materials and RH meter units.
2. Emit binary GLB v2 with JSON chunk, BIN chunk and legal 4-byte alignment.
3. Preserve unique glTF node names equal to source catalog part IDs.
4. Check bufferViews/accessors byte ranges, every node mesh, triangle counts, and world bounds.
5. Compare manifest to catalog IDs, hashes and geometry file existence, rejecting false-ready statuses.
6. Run node tools/asset-pipeline/validate-glb.mjs; keep outputs versioned and reproducible.

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
