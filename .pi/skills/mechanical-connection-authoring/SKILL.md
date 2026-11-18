---
name: mechanical-connection-authoring
description: Define connector anchors, fixed or revolute Mate graphs, fasteners, hinge axes, joint limits and local/world frame alignment for real multipart machines. Use when adding wheel hubs, eyeglass hinges, transmissions, bearings or robotic joints.
---

# mechanical-connection-authoring

## Goal

Author mechanically meaningful connection semantics independent of visual hierarchy.

## Required workflow

1. Obtain local coordinate frames from source CAD/procedural geometry; never infer precision from screenshots.
2. Define Connector owner Part IDs, mating roles, axes and offset M.
3. Connect Mate endpoints and Fastener instances; specify Joint DOF and finite limits.
4. Validate world transforms, connector compatibility and measured alignment against relevant source tolerances.
5. Write release/lock operation guards so visual movement cannot bypass Mate state.
6. Add positive, negative, misaligned and aborted assembly tests.

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
