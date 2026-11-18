# Engineering reference — cad-source-ingestion

## Standards and sources

- glTF 2.0 specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html . glTF is right-handed, +Y up, +Z asset front, distances in meters and angles in radians.
- STEP AP242 context: https://www.prostep.org/en/medialibrary/fact-sheets/iso-10303-242-step-ap242 . Supports product structure, CAD geometry/topology, manufacturing information and kinematics.
- Open CASCADE STEPCAFControl_Reader source: https://github.com/Open-Cascade-SAS/OCCT/blob/master/src/DataExchange/TKDESTEP/STEPCAFControl/STEPCAFControl_Reader.hxx . Its interface can preserve assembly shapes, colors and names.

**Explicit frame bridge:** Current Mechanical Worlds concept automotive geometry encodes **vehicle forward = -Z** and **vehicle right = +X**. This is a project-specific frame, not glTF's +Z front semantic. For a canonical +Z-front CAD/glTF input, document the 180-degree yaw transform (or an equivalent rotation) and preserve original source frame data; avoid silently flipping handedness.

The current repository does not yet implement a production STEP B-Rep importer or GD&T parser. This skill defines an evidence contract for that work. Do not label generated mesh approximations CAD-reviewed merely because the export has a .glb extension.

## Shared repository specification

- `AGENTS.md` project-wide truth ladder
- `docs/FOUR-CORNER-CONSTRAINTS.md` current anchored demo
- `docs/COMPLEX-MACHINE-ARCHITECTURE.md` future modular assembly
