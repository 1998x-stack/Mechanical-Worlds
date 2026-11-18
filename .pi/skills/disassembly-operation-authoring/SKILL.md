---
name: disassembly-operation-authoring
description: Author dependency DAGs, safety guards, transactional mechanical state, motion paths, fastening steps and independent reassembly plans. Use when adding click-to-disassemble/click-to-assemble workflows for any complex mechanical system.
---

# disassembly-operation-authoring

## Goal

Create guarded, repeatable mechanical operations rather than decorative explode animations.

## Required workflow

1. Read docs/DISASSEMBLY-ENGINE.md and record required release operations for fasteners, locks and connectors.
2. Model dependsOn DAG, preconditions, resource locks, inverse intent and effects.
3. Author separately validated disassembly and assembly paths with explicit reference frame and collision policy.
4. Check path collisions and explain any allowed contact pairs; never silently downgrade required checks.
5. Exercise pause/cancel/undo/redo/round-trip state invariants in headless tests.
6. Expose only verified operation capabilities to the viewer; keep explosion presentation-only.

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
