---
name: engine-kinematics-authoring
description: Author mathematically coupled engine crankshaft, piston, connecting rod and timing constraints with source-traceable geometry and independent disassembly plans. Use when adding inline engines, reciprocating compressors, crank-slider machinery or kinematic benchmarks to Mechanical Worlds.
---

# Engine and slider-crank mechanism authoring

## Objective

Create engine mechanisms whose rods, sliders, pins and driven shafts obey **one authored constraint**, rather than disconnected per-mesh animations. Require CAD provenance before labeling any fixture engineering verified.

## Workflow

1. Verify existing generated GLB Part IDs and source hash. Open `assets/mechanical/engine-i4-source-brief.json` and the exact `manifest-02.json` bindings.
2. Declare units, orthogonal shaft/slider axes, source coordinate basis, crank throw radius `r`, rod length `L > r`, piston pin offset and four physical cylinder phases.
3. Add one `SliderCrankConstraint` with exact Part IDs, required Mates and `authoringTier`. Reject dangling or duplicate references.
4. Build a pure kinematic closure solver; derive every piston, pin and rod from the same crank angle. Check a 720° four-stroke cycle and 1:2 cam ratio.
5. Author bearing, pin, rod, head and cover Connector/Mate frames independently of geometry parenting. Record tolerance evidence and never assume GLB normal alignment is a CAD datum.
6. Implement independent teardown and assembly DAGs with guards for angle, part status, joint limits and required Mates. Verify cancellation/undo and a complete round trip.
7. Bind state-driven poses into the viewer; visually distinguish authored analytic constraint markers from low-confidence CAD surface mesh.
8. Run `npm run engine:audit`, `npm run test`, `npm run build`. Review source interferences and publish unverified geometry and collision limitations.

## Bundled resources

- `references/guide.md` explains the analytic closure and current collision gaps.
- `assets/brief.template.json` is an evidence-first mechanism intake.
- `scripts/check.mjs` runs the shared Skill preflight.
- `docs/ENGINE-I4-KINEMATICS.md` is the executable reference and QA contract.

## Hard boundaries

- Solver closure is **not** swept collision proof or ISO/STEP CAD review.
- Individual mesh animation without a constraint is not acceptable for a kinematic promotion.
- Do not infer real engine servicing, torques or safety procedures from this conceptual prototype.
