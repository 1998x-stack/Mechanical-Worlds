---
name: mechanical-system-planner
description: Architect assembly trees, BOM, stable part identities and interface boundaries for cars, robots, engines and industrial equipment. Use when designing a new machine family or planning a large multipart mechanical system.
---

# mechanical-system-planner

## Goal

Create consistent machine structures before authoring any geometry.

## Required workflow

1. Read docs/MECHANICAL-SCHEMA.md; state source coordinate frame, units and version.
2. Define root, subsystems, physical part instances and reusable PartDefinitions.
3. List cross-subsystem connectors, safety-critical boundaries, and planned operations separately from assembly parenting.
4. Choose one acceptance slice with a known disassemble and independent assemble goal.
5. Add planned-only catalog rows with stable IDs and truthful provenance.
6. Run scripts/check.mjs and record unresolved engineering constraints.

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
