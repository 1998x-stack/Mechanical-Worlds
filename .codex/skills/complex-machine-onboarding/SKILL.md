---
name: complex-machine-onboarding
description: Introduce and scale new machine families such as turbines, industrial robots, engines, gearboxes, clocks and multi-stage power transmissions. Use whenever a new complex mechanical asset family is requested.
---

# complex-machine-onboarding

## Goal

Scale model production without forking mechanical-core or sacrificing verifiable subsystem contracts.

## Required workflow

1. Gather constraints, asset source rights, module boundaries, power/energy hazards and bill of materials.
2. Define a versioned catalog and stable ID namespace compatible with current Mechanical Schema.
3. Select a single reference assembly with end-to-end assembly/disassembly goals.
4. Model a geometry batch and tie exact mesh nodes back to catalog instances.
5. Author Mate/Joint interfaces, operation DAG, rollback and collision confidence per subsystem.
6. Roll out independent subsystem GLBs, LODs, change migration and gated releases.

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
