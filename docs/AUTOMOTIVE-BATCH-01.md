# Automotive Batch 01 — Generated Real GLB Mesh Assets

**Asset family:** `mw.car.fwd-i4.catalog.001`  
**Batch:** `mw.car.fwd-i4.batch-01`  
**Status:** `generated` (independent triangulated mesh nodes; conceptual geometry)  
**CAD / manufacturing validation:** **NOT PERFORMED**  
**Coordinate:** right-handed, +Y up, -Z vehicle forward, +X vehicle right, **meters**.

## Delivered geometry

A genuine binary glTF 2.0 `.glb` contains individually identifiable mesh nodes for **76 catalog Part instances** out of the **317 planned parts**. These meshes are generated from a checked-in procedural source, and can be selected independently in the Three.js viewer.

- Four wheel assemblies: wheel rim, tire, valve, and five individually instanced wheel nuts each = 32 Part nodes.
- Four corner brake/suspension packages: hub, bearing, brake disc, caliper, two pads, damper and coil spring each = 32 Part nodes.
- Front wheel steering components: steering knuckle, lower control arm and tie rod on each front corner = 6 Part nodes.
- Shared vehicle structure: front subframe, anti-roll bar, rear torsion beam, steering rack, body-in-white reference skeleton and floor pan = 6 Part nodes.

**Total: 76 actual GLB parts**, 21 shared geometric mesh templates, 33,120 triangle faces across distinct templates, and 2,821,688 bytes in the committed GLB. Runtime instancing reuses templates for repeated parts; the total scene triangle count with all instances is larger than template triangle count.

**Remaining:** 241 physical catalog Part instances are still `planned`. The catalog's 42 assembly nodes are structural metadata and not included in physical Part counts.

## Visual/engineering quality

This is not an empty geometry placeholder: the GLB contains annular tire and rim surfaces, wheel-spoke structures, fastener bodies, rotor surfaces, caliper housings, damper tubes, coil springs, suspension arms, control rods, subframe members and body-frame rails. Each Part has a glTF node named by its exact catalog ID.

However, all dimensions are **conceptual design parameters**, not measured from a production vehicle. The geometry has not been confirmed watertight/manifold, measured against OEM CAD/STEP, checked for stress/printability, mechanically mated at manufacturing tolerance, or collision-validated under real disassembly trajectories. Some details represent visual abstractions.

The new automotive gallery supports **GLB loading, selection, part filtering, isolation and visual explosion**. It does **not** claim full disassembly of the 76 generated Parts. The existing wheel/eyeglasses mechanical demos remain independently implemented and tested.

## Files

- `assets/generated/automotive/fwd-i4-batch-01.glb`: actual triangulated binary glTF asset.
- `assets/generated/automotive/manifest.json`: exact part IDs, geometric templates, counts and Git blob digest.
- `assets/generated/automotive/SOURCE.md`: source provenance and disclaimers.
- `tools/asset-pipeline/generate-automotive.mjs`: procedural mesh source (no external CAD download).
- `tools/asset-pipeline/validate-glb.mjs`: structural, catalog, hash, reproducibility validator.
- `tools/asset-pipeline/stage-assets.mjs`: copy GLB into Vite public assets.
- `assets/catalog/automotive-fwd-i4-001.json`: exact 76 records promoted to `generated`, 241 still `planned`.
- `automotive.html`, `src/automotive.ts`, `src/automotive.css`: GLB viewer.

## Commands

```bash
npm install
npm run skills:check
npm run assets:build     # generate the GLB from source
npm run assets:validate  # independently checks the committed GLB and catalog
npm run test
npm run build
npm run dev
```

Local viewers:

- `/` — executable wheel/eyeglasses P1 mechanical demonstration.
- `/automotive.html` — real generated automobile GLB 3D gallery.

Pages deployment uses `/Mechanical-Worlds/automotive.html`, with static binary under `/Mechanical-Worlds/models/automotive-fwd-i4-batch-01.glb`.

## QA contract

1. GLB is a real version 2 binary with valid JSON/BIN chunks and 4-byte buffer alignment.
2. All accessors and indices are in-bounds, and vertex floats are finite.
3. All 76 manifest IDs exist as uniquely named glTF nodes with actual geometry.
4. A `generated` catalog row must reference the exact GLB URI and glTF node name.
5. The Git blob content hash must match the binary; regeneration must preserve mesh topology and coordinates within float epsilon (V8 trig implementations may not be bit-identical).
6. No part is falsely tagged engineeringVerified.
7. Existing mechanical wheel/glasses tests and viewer build still pass.

## Batch 02+ strategy

First extend *actual geometry* for chassis mounting structure, control arms, steering linkages and wheel connection hardware with CAD/STEP provenance when available. Then produce verified-part batches for engine cylinder block, crankshaft, pistons and connecting rods, followed by seats and doors. Build each subsystem with independent GLB releases and a geometry-first QA gate. Only after connector frames, fasteners, Joint definitions and collision-reviewed paths are authored should the newly generated scene components be exposed as L3 true mechanical disassembly.

As assemblies become larger, refactor the single-file batch prototype into a family plug-in registry:

```text
tools/asset-pipeline/
  registry/
  families/
    automotive/
      geometry/
        wheels.mjs
        brakes.mjs
        suspension.mjs
        body.mjs
        powertrain.mjs
      catalog-map.mjs
  gltf/
    export.mjs
    validate.mjs
  releases/
    manifest.mjs
```

The above is the next-stage architecture, **not** a claim that these modules already exist.
