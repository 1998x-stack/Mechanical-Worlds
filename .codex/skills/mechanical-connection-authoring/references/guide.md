# mechanical-connection-authoring — reference

Coordinate relation: T_world_source × C_source = T_world_target × C_target × M. Revolute constraints allow orientation about the designated axis but require pivot position alignment. The demo's global 15 mm check is not a manufacturing tolerance. For real assemblies store joint-specific fits, fastener size, source and uncertainty.

## Shared authoritative specifications

- `docs/MECHANICAL-SCHEMA.md` — identity, coordinates, connectors, operations.
- `docs/DISASSEMBLY-ENGINE.md` — engine guards, path, DAG and state.
- `docs/P1-ASSEMBLY-IMPLEMENTATION.md` — current validated implementation boundaries.
- `docs/SKILLS-ARCHITECTURE.md` — skill operations and mirrors.

## Acceptance record

Record the source artifact path, exact generated target IDs, automated verification result, unverified constraints and provenance level. Avoid unsupported precision claims.
