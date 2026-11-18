# gltf-asset-pipeline — reference

A valid GLB begins with magic 0x46546C67, version 2, and total file length. JSON and BIN chunk lengths must match header. Accessors use correct numeric component types and bounds. A real geometric mesh with no provenance or connector accuracy remains generated/conceptual, not CAD-reviewed. Multiple graphical primitives may belong to one physical part.

## Shared authoritative specifications

- `docs/MECHANICAL-SCHEMA.md` — identity, coordinates, connectors, operations.
- `docs/DISASSEMBLY-ENGINE.md` — engine guards, path, DAG and state.
- `docs/P1-ASSEMBLY-IMPLEMENTATION.md` — current validated implementation boundaries.
- `docs/SKILLS-ARCHITECTURE.md` — skill operations and mirrors.

## Acceptance record

Record the source artifact path, exact generated target IDs, automated verification result, unverified constraints and provenance level. Avoid unsupported precision claims.
