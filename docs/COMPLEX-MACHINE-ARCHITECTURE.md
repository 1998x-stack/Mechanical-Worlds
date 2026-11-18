# Large Mechanical Systems — Scalable Production & Agent Skill Architecture

> Design note for `Mechanical Worlds` beyond its first automotive GLB geometry batch.  
> Status: `architecture proposal`, not a statement that every component is already implemented.

## 1. Production principles

Mechanical Worlds is an **assembly graph product**, not a model-file count product. Future products may range from a 20-part eyeglass hinge to a 100,000-part industrial turbine. To scale reliably, distinguish and independently version:

1. **Source engineering geometry** (CAD STEP/B-Rep/native authored scripts and material provenance).
2. **Renderable physical Part instances** (GLB meshes, mesh template reuse, transform hierarchy).
3. **Assembly hierarchy** (BOM, subassembly ownership, instance identity).
4. **Mechanical connections** (Connector/Mate/Joint/Fastener graph; independent of glTF tree).
5. **Operation knowledge** (DAG, preconditions, safety state, motion path and independent assembly plan).
6. **Presentation state** (visibility, LOD, exploded visual layout, pick maps; not mechanical truth).
7. **Validation and release evidence** (static + dynamic QA, source license, CAD confidence, manufacturing qualification).

**Never use the presence of a GLB mesh as evidence for L3 mechanical ability.**

## 2. Skill ownership

| Step | Responsible skill | Artifact contract |
|---|---|---|
| New machine intake | `complex-machine-onboarding` | requirements, source, hazards and version plan |
| Assembly/BOM | `mechanical-system-planner` | stable IDs and catalog subsystem hierarchy |
| Geometry construction | `parametric-cad-authoring` | independently editable source and dimensions |
| Batch production | `automotive-asset-factory` or domain successor | generated binary GLB, manifest, catalog promotion |
| glTF export | `gltf-asset-pipeline` | valid nodes, units, materials, bounds and indices |
| Mechanical geometry | `mechanical-connection-authoring` | connector frames, joint limits and Mate graph |
| Interactions | `disassembly-operation-authoring` | prerequisites, trajectories, collision and rollback |
| Release QA | `mechanical-asset-qa` | pass/fail evidence, unresolved constraints |
| Publish | `mechanical-release-operator` | source/provenance, CI logs, Pages/browser release status |

Skills are **process contracts**, not ad hoc prompts. Every action should have an inspectable input/expected output and deterministic script where possible.

## 3. Ten-year-scale assembly identifiers

Use structured IDs that do not depend on mesh name order or screen location:

- `mw.car.fwd-i4.catalog.001` — source asset family.
- `chassis.corner.fl`, `wheel.fl.rim`, `wheel.fl.lug.1` — physical assembly and Part instances.
- `def.lug-nut.generic` — reusable PartDefinition; never collapse all nuts into one physical instance.
- `c.wheel.fl.rim.hub-mount` — Connector owned by a physical Part.
- `mate.wheel.fl.hub` — connection edge.
- `joint.g.temple.left` — kinematic constraint.
- `op.wheel.fl.detach` — independently identified operation.
- `path.wheel.fl.out` — motion path.

For version migration maintain `oldId → newId` mapping, BOM quantities and instance reference preservation. Never repurpose an existing ID for a different physical object.

## 4. Modular assets and streaming

The first automotive GLB contains 76 Part nodes in one file, which is appropriate for a prototype. Large machines require subsystem packaging:

```text
assets/mechanical/<family>/<asset-id>/
  manifest.json
  catalog.json
  geometry/
    body/assembly-lod0.glb
    chassis/front-suspension-lod0.glb
    chassis/rear-suspension-lod0.glb
    powertrain/engine-lod0.glb
    powertrain/transmission-lod0.glb
    interior/seats-lod0.glb
    electrical/harness-lod0.glb
  mechanical/
    connectors.json
    mates.json
    joints.json
    fasteners.json
    operations.json
    motion-paths.json
  metadata/
    provenance.json
    bom.json
    quality-report.json
```

Each GLB shard contains named physical Part instances. A top-level manifest exposes a `partId → geometryURI / gltfNodeName / LOD` map. Scene loading can be lazy; the Mechanical Core must still know the authoritative graph even when a mesh shard is not loaded.

Use content-addressed storage and caching for immutable binaries; separate LODs and collision proxies from high-poly render meshes.

## 5. Batch promotion is a state transition

Catalog progression:

```text
planned
  ↓ real source + generated GLB mesh + quality pass
generated
  ↓ source CAD review and interface/fit verification
cad-reviewed
  ↓ mechanical, print/manufacture/test qualification
manufacturing-validated
```

A GLB may be visually excellent yet physically wrong. Rendering and geometry status are orthogonal to whether the asset supports L1 exploded display or L4 interactive assembly.

For every promotion write a manifest and explicit QA result. If a batch has 10 generated parts and 1 invalid geometry node, update only the 10 verified rows, not the whole assembly.

## 6. Reproducible geometry factory

Inputs:

- Catalog candidate IDs and source/license references.
- Versioned feature/dimension parameters (explicit units).
- Geometry factory source and seed (if stochastic).
- Export format and coordinate convention.

Outputs:

- Real GLB buffer containing every declared named Part node.
- Component manifest including transforms and primitive counts.
- Catalog update only for validated generated meshes.
- QA report and recovery instructions.

Quality gates:
1. structural glTF parse (magic/version/JSON/BIN/accessors);
2. valid topology and finite vertex ranges;
3. stable node IDs, no duplicate physical instance name;
4. bounds and material checks;
5. source/copyright and geometry tier;
6. mechanical graph tests when available;
7. benchmark/Pages preview.

For rigorous CAD output include B-Rep STEP, mesh conversion metadata and manifoldness checks; the current first batch only provides triangulated GLB and programmatic source.

## 7. Mechanical precision and collision roadmap

Current P1 provides connector positions, revolute hinge angles, a staged screw animation and discrete sampled AABB collisions in reference fixtures. A production-grade engine should add:

- full connector 6-DOF mating including normals/axes and contact offsets;
- joint chains, gear coupling and simultaneous multi-part kinematics;
- continuous swept collision, convex decomposition and mesh BVH;
- explicit allowed-contact pairs that update as Mate states change;
- automated path-planning candidates (guided along authored degrees of freedom) plus human review;
- material, deformation, friction, clearance and stress where the target application needs it;
- source-qualified service sequences for safety-critical machinery.

No automatic system should label such generated plans verified without engineering evidence.

## 8. Concrete next releases

- **Batch 01 — completed geometry**: 76 independent Part instances across body skeleton, wheels, chassis, suspension and braking. Their mechanical interconnections for the entire car are not yet authored.
- **Batch 02 — completed generated geometry**: 30 engine/differential parts in a second GLB, not CAD-reviewed; four-wheel/brake corner DAGs now operate on the generated Batch 01 GLB nodes. Begin with a single I4 crank slider acceptance slice.
- **Batch 03 — planned**: doors, hinges, regulators, driver's seat and steering column with real joint constraints.
- **Batch 04 — planned**: engine sub-components, gearbox, steering, electrical modules and harness representations. Flexible cables and irreversible fasteners require domain-specific rules.

Use `npm run assets:plan -- --system powertrain --limit 30` to produce a candidate list; do not promote candidates until `assets:validate` covers actual emitted geometry.

## 9. Engineering roles and model release contracts

Each quality release should specify:
- modeling source provenance/license and responsible author;
- nominal dimensions, coordinate and selected reference frames;
- geometry capability (`generated` vs `cad-reviewed`);
- operation capability (L1/L2/L3/L4 for the specific subsystem);
- automatic QA result and unit-test evidence;
- manual review signoff where essential;
- known limitations and target application.

This prevents large-scale Agent production from quietly turning a structured mechanical product into a collection of mislabeled or non-manufacturable models.
