# parametric-cad-authoring — reference

Use RH +Y up, -Z front, +X vehicle right. Runtime lengths in m; source CAD can be mm only with explicit conversion. For complex functional solids use CadQuery/FreeCAD/STEP when available; current generator uses triangulated geometry and should not be labeled exact B-Rep. Record holes, bearing races, mating planes and approximate design dimensions. Do not invent OEM values.

## Shared authoritative specifications

- `docs/MECHANICAL-SCHEMA.md` — identity, coordinates, connectors, operations.
- `docs/DISASSEMBLY-ENGINE.md` — engine guards, path, DAG and state.
- `docs/P1-ASSEMBLY-IMPLEMENTATION.md` — current validated implementation boundaries.
- `docs/SKILLS-ARCHITECTURE.md` — skill operations and mirrors.

## Acceptance record

Record the source artifact path, exact generated target IDs, automated verification result, unverified constraints and provenance level. Avoid unsupported precision claims.
