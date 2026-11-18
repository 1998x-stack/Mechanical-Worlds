# Engineering reference — swept-collision-auditor

## Current implementation scope

`packages/mechanical-core/src/p1.ts` currently performs conservative discrete world-AABB checks at a finite number of time samples. It skips pairs already overlapping at the initial pose and selected intentional contact groups. That is adequate for demonstrating the software architecture; it **does not prove an interference-free path**.

## Required future stages

1. Rigid-body collision proxies with traceable CAD relationship; validate manifoldness and per-asset axis frames.
2. Broadphase: spatial index and swept AABB bounds.
3. Narrowphase: oriented box / convex shape / mesh BVH checks; track allowed contacts from active Mates.
4. Continuous collision detection: swept volume or conservative advancement for translations and rotations, with numerical error bounds.
5. Runtime telemetry: first-contact pair, swept distance, time-of-impact, clearances, path waypoint and process stage.
6. Acceptance: negative tests detecting intersections between discrete samples, bolt shanks and reassembly interference.

Do not claim existing solver supports those stages. When a path is known to intersect the CAD geometry or collision confidence is insufficient, mark the operation blocked or advisory according to audited policy, rather than auto-certifying.

## Shared repository specification

- `AGENTS.md` project-wide truth ladder
- `docs/FOUR-CORNER-CONSTRAINTS.md` current anchored demo
- `docs/COMPLEX-MACHINE-ARCHITECTURE.md` future modular assembly
