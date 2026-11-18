---
name: cad-source-ingestion
description: Import engineering CAD/STEP/AP242 source assemblies into Mechanical Worlds with traceable licenses, units, assembly metadata and glTF coordinate conversion. Use when replacing conceptual geometry with licensed CAD and assigning geometry review evidence.
---

# cad-source-ingestion

## Objective

Promote part geometry only when the source geometry, assembly transforms, dimensions and rights can actually be verified.

## Procedure

1. Inventory source files, hashes, legal redistribution rights, format/version and toolchain details before importing.
2. Prefer STEP AP242 assembly/PMI evidence or native CAD history when available, preserving bodies, instance IDs and hierarchy.
3. Read units and source coordinate frame; document project-specific -Z vehicle-forward versus glTF +Z front and implement explicit basis conversion.
4. Map each physical assembly occurrence to one stable catalog Part ID; never infer unique Parts from mesh count alone.
5. Extract nominal dimensions, datum axes, mating faces and fit requirements; mark assumptions/inferred coordinates as unverified.
6. Triangulate with traceable tolerance, preserve native CAD provenance and export GLB with exact node names and source evidence.
7. Run glTF/catalog QA, independent connector alignment and engineer review before changing CAD-review status.

## Resources

- Read `references/guide.md` for detailed standards, uncertainty and current implementation gaps.
- Start with `assets/brief.template.json`; never omit provenance or evidence status.
- Run `node scripts/check.mjs` to perform repository preflight.
- Validate any new geometric export with `npm run assets:validate`, then `npm run test` and `npm run build`.

## Explicit limits

- These are engineering authoring workflows, not automated manufacturing certification.
- Do not set `cad-reviewed` or `manufacturing-validated` without physical dimensional/fit/source evidence.
- GLB visual geometry and Mates do not by themselves prove real service safety.
