# I4 Engine Kinematics and Disassembly — Executable Reference

> Implementation status: **code + tests + Two-GLB viewer wired and CI passing**. 
> Engineering status: **generated-conceptual**, not measured CAD. 
> Scope: source Batch 02 (30 named GLB Part instances), 1 analytic four-cylinder mechanism, 2 independent operation plans.

## 1. What is actually implemented

- `packages/mechanical-schema/src/index.ts`: `SliderCrankConstraint` data contract; mandatory rigid-body IDs, radius/rod length, crankshaft joint, unit axes, phase angles, evidence tier, source ID and required Mates. The validator rejects invalid L/r ratios, duplicate/missing parts, incorrect axes and ungrounded CAD-review claims.
- `packages/mechanical-core/src/engine-i4.ts`: pure deterministic I4 kinematics, manifest-bound engine fixture, conceptual local Connector frames and independent teardown/assembly DAGs.
- `packages/mechanical-core/src/index.ts`: transaction-safe, guarded revolute joint positioning with revision events, optional undo snapshots and disassembly interference prevention.
- `src/automotive.ts`: GLB engine view with 0–720° scrubber, continuous motion, cam rotation, cutaway, live piston telemetry, teardown/rebuild buttons and operation status.
- `tools/asset-pipeline/audit-engine-i4.mjs`: source parameter, kinematic closure, 720° phase and teardown→reassembly audit; exports a machine-readable contract.
- `tests/engine-i4.test.mjs`, `tests/engine-audit.test.mjs`: end-to-end mathematical and mechanical negative/round-trip cases.

The previously implemented automotive four-corner and glasses demonstrations remain independent reference fixtures. A geometry fixture is **not** an OEM manufacturing qualification.

## 2. Geometry source and coordinate frame

Inputs come from `assets/generated/automotive/manifest-02.json`, which binds 30 distinct physical engine/differential Part IDs to real nodes in `fwd-i4-batch-02.glb`.

Current authoring coordinates:

| Parameter | Value | Source confidence |
|---|---:|---|
| Unit / handedness | meters, RH | project convention |
| Vehicle front / engine cylinder axis | -Z / +Y | project authoring convention |
| Crankshaft axis | +X | generated layout |
| Crankshaft center | [0, 0.52, -1.44] m | generated GLB manifest |
| Crank throw radius `r` | 0.085 m | conceptual generator |
| Rod center-to-center `L` | 0.245 m | conceptual geometry |
| Piston pin→piston center | 0.035 m | conceptual |
| Rod center from crank journal | 0.115 m | conceptual mesh |
| Piston ring group above center | 0.045 m | conceptual mesh |
| Cylinder phase | [0, π, π, 0] | authored inline-four kinematics |
| Camshaft drive ratio | 1:2 relative to crank | four-stroke illustrative relationship |

These are **internal values for a test machine**, not specifications of any automaker. The source evidence and uncertainties are captured in `assets/mechanical/engine-i4-source-brief.json`.

## 3. Analytic slider-crank closure

For cylinder `i` define `φ_i ∈ [0, π, π, 0]` and `α_i = θ + φ_i` where `θ` is the crankshaft rotation.

Crankpin (world YZ, X fixed to the cylinder plane):

```
P_crank_i = [x_i, y_crank + r cos(α_i), z_crank + r sin(α_i)]
```

Slider (piston pin) follows +Y, with constant world Z:

```
h_i       = sqrt(L² - r² sin²(α_i))
P_pin_i   = [x_i, y_crank + r cos(α_i) + h_i, z_crank]
pitch_i   = atan2(-r sin(α_i), h_i)  // rod tilt around X
```

Consequences:

1. Each connecting rod retains fixed center-to-center length `L`.
2. The piston pin stays on its single translation axis for the full rotation.
3. At 0°, pistons 1 and 4 are at the same top-dead-center side, while 2 and 3 are at bottom-dead-center side.
4. Each cylinder has `2r = 0.170 m` ideal stroke.
5. The camshafts use `θ_cam = θ_crank / 2` so 720° crank yields 360° cam.

The analytic solver returns every `engine.piston.*`, `engine.rod.*`, `engine.piston.pin.*`, `engine.piston.rings.*` position/rotation from **one** crank input, with per-cylinder closure error. It does not merely apply four arbitrary sine-wave offsets.

## 4. Mechanical-authority rules

`MechanicalEngine.setRevoluteAngle("joint.engine.i4.crankshaft", θ)` rejects:

- NaN/∞ or angles outside the authored 0–720° demonstration limit;
- attempted motion while a transaction is running;
- missing/detached core piston, pin, ring, rod or crankshaft Part;
- released bearing or conrod/crank journal Mates required by the mechanism.

It atomically updates the driven joint with a revision event, and can record an undo snapshot. The Three.js viewer owns interpolation and cutaway presentation; it must not directly forge mechanical install states.

The engine service plans require crank angle = **0**. After rotation, home the crank before attempting a teardown. The generated engine operates independently from the wheel/brake Mechanical Core instance, preventing unrelated vehicle operations from overwriting each other's Part states.

## 5. Independently authored disassembly and reassembly

`plan.engine.i4.disassemble`: 26 conceptual operations.

- Opening the valve cover and timing enclosure; releasing the timing belt and tensioner;
- Removing both cams, cylinder head, oil pan and crank pulley;
- For each of four cylinders: separating the ring group, pin, piston and connecting rod in explicit dependent steps;
- Finally releasing the crankshaft, only after all four rods and necessary covers have cleared the graph.

`plan.engine.i4.assemble`: a separately authored 26-operation DAG, not automatically generated by reversing animation frames.

- Return crankshaft to bearing interface;
- Install each rod, piston, pin and ring group, restoring corresponding Mates;
- Return oil pan, cylinder head, camshafts, pulley and timing components;
- Finish with cover and final Mate lock checks.

The 3 differential GLB parts remain static conceptual references. The cylinder block also remains installed. Together with the 26 removed Parts, these account for the Batch 02 total of 30 physical instances.

Crucially, this DAG is a **logical assembly-state demonstration**, not real engine removal instructions. Bearings, rod caps, pin retainers, timing locks, fastener sizes, spring forces and other actual service steps have not been modeled and are not inferred.

## 6. Collision and mesh-accuracy boundary

A very important distinction: `maxClosureErrorM` measures ideal mathematical rod-length closure **not clearance between surface meshes**. A 1e-12 m solver residual does not imply one-picometer manufacturing quality or zero collision.

Known fidelity issues in current source GLB:

- The existing rendered crank throws are not an exact representation of the 1&4 / 2&3 physical phase grouping enforced by the analytic solver.
- The procedural cylinder block has visual, mostly solid cylinder features rather than truly hollow CAD-verified bores and clearance fits.
- Gear teeth, timing belt, valve profiles, rod bearing journals and pin housing radii are illustrative.
- Engine paths currently use `collisionPolicy = advisory` without mesh-level continuous collision. Wheel/brake AABB checks do **not** become automatically valid for engine moving rods.

The source evidence contract exposes all of these limitations and leaves `engineeringVerified: false`, `collisionCertified: false`. No real CAD/STEP supplier source has been imported.

## 7. Reproducible acceptance and next engineering gate

```bash
npm install
npm run assets:validate    # both published car GLB binaries
npm run test               # original demos, I4 closure, negative operation cases
npm run engine:audit       # 721 sampled angles, joint closure, 26-operation round trip
npm run build              # emit Pages GLBs and engine contract JSON
npm run check              # complete combined gates
```

Outputs:
- `dist-reports/engine-i4-qa.json` — machine-readable pass/limits/known risks.
- `public/models/engine-i4-kinematics-contract.json` — source, connector graph, kinematics, operations and QA result.
- Pages endpoint: `/Mechanical-Worlds/models/engine-i4-kinematics-contract.json`.

**Next work should revise the actual GLB geometry itself** from trustworthy dimensional CAD, make the crank-pin/rod/piston artwork coincide with these mathematical pivots, add real interior bores and pin-bearing fits, and qualify narrowphase + swept collision. Only then can this package be promoted from generated-conceptual geometry toward evidence-backed CAD review.

## 8. Verified restricted continuous GLB geometry separation

The additional `engine-clearance` module uses **actual binary GLB POSITION accessor minimum/maximum X values** for the 16 moving piston, connecting rod, pin and ring Part nodes (four per cylinder). Each node's authored X translation is fixed and, during assembled engine operation, its only rotation is about world X; therefore its world-X interval is invariant for **all** crankshaft angles. Disjoint intervals prove those two meshes cannot touch in 3D, without angle sampling.

The algorithm compares 96 cross-cylinder pairs (`6 cylinder pairs × 4 × 4 Parts`) and fails if any axial interval overlaps. It reports the minimum positive projection separation in meters and produces `engine-i4-axial-clearance.json` as a Pages/CI artifact. The proof is valid only for the specified actual GLB and normal assembled kinematic pose.

**Excluded entirely:** same-cylinder rod and piston contacts, crankshaft and bearing clearances, cylinder block wall interference, timing drive, gear engagement, motion during teardown/reassembly, material deformation and CAD tolerances. This is an exact **axis-projection exclusion** for a narrow set of cases, not a general-purpose CCD solver. In particular, the known generated block geometry must be replaced before claiming piston-to-bore physical clearance.

Run:

```bash
npm run engine:clearance
npm run engine:audit
npm run check
```

## New source B-Rep CAD and swept mesh review

An independent **18-Part parametric B-Rep** now reconstructs through-bored cylinder geometry, alternating crank offset phase, hollow piston skirts, pin-axis holes, connecting rod eyes and ring packs using CadQuery/OCP. It exports an actual STEP assembly and CAD-tessellated 18-node GLB, replacing corresponding display nodes in Pages while keeping Core Part IDs unchanged. It is original, non-OEM conceptual CAD and is **not dimension-reviewed or manufacturing-certified**.

The `src/mesh-ccd.mjs` module and `tools/cad/audit_cad_mesh.mjs` run a conservative full-720° BVH contact assessment across all 18 CAD-derived meshes. Actual results contain surface contacts and unresolved time intervals; therefore the overall mechanism remains `NOT_VERIFIED` for collision. See `docs/CAD-BREP-AND-CCD.md` for methods, counts, exclusions and external STEP evidence requirements.
