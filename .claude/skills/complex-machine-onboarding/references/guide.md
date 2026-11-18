# complex-machine-onboarding — reference

Use subsystem sharding and content-addressed GLBs at scale. Do not place every turbine/robot assembly in one massive GLB. Distinguish flexible hoses, belts, fluid power, high-voltage and loaded springs that require specialized simulators from rigid-body joints. New machines must share schema versioning and QA tooling.

## Shared authoritative specifications

- `docs/MECHANICAL-SCHEMA.md` — identity, coordinates, connectors, operations.
- `docs/DISASSEMBLY-ENGINE.md` — engine guards, path, DAG and state.
- `docs/P1-ASSEMBLY-IMPLEMENTATION.md` — current validated implementation boundaries.
- `docs/SKILLS-ARCHITECTURE.md` — skill operations and mirrors.

## Acceptance record

Record the source artifact path, exact generated target IDs, automated verification result, unverified constraints and provenance level. Avoid unsupported precision claims.
