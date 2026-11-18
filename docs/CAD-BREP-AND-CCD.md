# I4 CAD B-Rep and Continuous Mesh-Contact Review (2026-11-18)

## Status summary

This release closes the user-visible `automotive.html` loading crash and introduces a **real parametric Open CASCADE/CadQuery B-Rep** and a **conservative continuous BVH mesh surface-contact checker**.

**Status tiers must remain separate:**

- `renderable GLB`: 106 Parts across the existing catalog batches, source mesh instances individually named.
- `authored-parametric-brep`: 18 key engine Part instances now also have an independently exported *STEP CAD assembly* and a GLB tessellated from their B-Rep surfaces.
- `cad-reviewed`: **0 Parts**. We have no third-party reference dimensions, licensed OEM STEP, GD&T, fits, material test evidence or independent expert certification.
- `engine-collision-certified`: **false**. The audit explicitly contains actual surface contacts and intervals that its current numerical budget cannot resolve.

## 1. Root cause and fix: undefined `Object3D.name`

The old loader used `gltf.scene.children[i]` and then `imported.add(node)` in a forward loop. Three.js `Object3D.add` removes the child from its old parent, shortening `gltf.scene.children`. This skipped alternate nodes and eventually produced `undefined`, causing the runtime error `Cannot set properties of undefined (setting 'name')`.

It also implicitly assumed Three.js would keep catalog punctuation unchanged in `Object3D.name`; `GLTFLoader` may sanitize glTF node names.

**Delivered:** `src/glb-part-binding.mjs` takes an immutable snapshot, resolves each ID using Three.js's exact upstream name normalization, rejects duplicates and missing IDs before reparenting, preserves catalog IDs as `userData.partId`, and reassigns stable names. `tests/glb-part-binding.test.mjs` loads BOTH committed GLB binaries with actual Three.js, then verifies all **76 + 30** nodes are reparented with matching physical Part identity and valid geometry.

## 2. Source authored CAD (not OEM CAD)

File: `tools/cad/generate_engine_reference.py`.

Python CadQuery 2.8 / OCP generates **18 independent physical Part instances**:

- One cast-block reference: four genuine through-cylinder bore cuts, plus a rough crankcase void.
- One crankshaft: coherent 1&4 up / 2&3 down throw grouping, shaft main journals, offset crank pins and simplified webs.
- Four pistons: real hollow skirt B-Rep cuts and through pin bore in the X direction.
- Four connecting rods: linked bearing bosses with two X-axis bearing holes; nominal pin and big-end clearance is explicitly generated.
- Four separate X-axis piston pins.
- Four 3-ring packs (a ring pack is a physical Part instance grouping three rings).

The exact same authored source emits:
- `engine-i4-concept-reference.step`: native B-Rep STEP assembly in millimeters;
- `engine-i4-cad-reference.glb`: GLB triangulated from the B-Rep surfaces in meters;
- `engine-i4-cad-manifest.json`: 18 Part IDs, design placements, file hash and risk flags.

The product's original 30-Part powertrain GLB is preserved as a fallback. The CAD GLB **replaces only 18 corresponding render nodes**, without changing the authoritatively tracked `mechanical-core` Part IDs or states. The other **12** GLB Parts remain procedural reference meshes. Local development without CadQuery-generated assets continues to operate with the original GLBs. Pages CI builds the supplementary CAD export into its published `models/` directory.

### Numerical reference dimensions (not manufacturing dimensions)

| Parameter | Value |
|---|---:|
| Cylinder center pitch | 205 mm |
| Bore diameter | 152 mm |
| Piston external diameter | 144 mm |
| Nominal radius difference | 4 mm |
| Crank throw | 85 mm |
| Connecting rod bearing-center distance | 245 mm |
| Crank phases | [0, π, π, 0] |
| CAD STEP unit / browser GLB unit | mm / m |
| Crank axis / piston travel | +X / +Y |

These large simplified demonstration dimensions are **not a real vehicle specification**. B-Rep solids can be mathematically valid and STEP-exportable without proving their assembled clearance, motor functionality, manufacturing suitability or service safety.

### Source commands

```bash
python -m pip install cadquery==2.8.0
npm install
npm run build:core
python tools/cad/generate_engine_reference.py --output dist-cad/engine-i4
node --test tests-cad/reference.test.mjs
node tools/cad/audit_cad_mesh.mjs --step-deg=180
node --test tests-cad/collision.test.mjs
```

The independent workflow `.github/workflows/cad-reference.yml` executes the above and uploads STEP, GLB, manifest and collision report as GitHub Actions artifacts. `.github/workflows/pages.yml` also builds a Pages-accessible STEP and CAD-derived GLB:

- `/Mechanical-Worlds/models/engine-i4-concept-reference.step`
- `/Mechanical-Worlds/models/engine-i4-cad-reference.glb`
- `/Mechanical-Worlds/models/engine-i4-cad-manifest.json`

## 3. Mesh-BVH continuous motion checker

`src/mesh-ccd.mjs` implements a **conservative swept triangle-surface separation test**, not the previous finite-sample AABB detection.

It first computes triangle BVH distances at the midpoint of a time interval. A bound on any mesh vertex's maximum displacement is:

```
D = |P1-P0| + r * angle(q0,q1)
```

where `r` bounds the radius of local vertices about the object's origin. If the BVH-reported minimum separation `d` exceeds the sum of the two possible half-interval displacements plus a safety margin, **no triangle of those two meshes can touch anywhere in that full time interval**.

Otherwise, the algorithm subdivides the time interval. It returns three explicit statuses:

1. `surface-clear` — the movement bound mathematically separates all triangle surfaces throughout the interval.
2. `surface-contact` — BVH detects an intersecting or threshold-distance triangle pair.
3. `unresolved` — the certified separation cannot be established within the given resolution/budget.

It **never** converts an unresolved interval into a clearance claim. This is useful for any rigid body with linear positional interpolation and quaternion `slerp` rotation.

Important limits: BVH measures *surface distances*, not solid containment; nested solids without intersecting shells may be undetected. Invalid/open/nonmanifold mesh topology, true flexible materials, and arbitrary multibody motions outside the interpolation contract are also not certified.

References: `three-mesh-bvh` closest-point and intersection APIs, https://github.com/gkjohnson/three-mesh-bvh/blob/master/API.md .

## 4. Full-reference engine contact report — NOT VERIFIED

`tools/cad/audit_cad_mesh.mjs` examines all 18 CAD-derived meshes during crankshaft operation from 0 to 720° across 4 conservative 180° intervals. The 153 pairs per interval yield 612 interval-pair decisions.

An initial successful GitHub CAD audit returned:

| Classification | Count |
|---|---:|
| Swept world bounding-box exclusion | 72 |
| Triangle BVH conservative continuous surface exclusion | 408 |
| Triangle-surface contact detected | 32 |
| Unresolved contact / insufficient subdivision budget | 100 |

**Overall verdict: `NOT_VERIFIED`.**

Some of the 32 contacts are likely intentional bearing/pin interfaces, but the code does not automatically exempt them. The audit records authored Mate IDs alongside candidates to facilitate human review, retaining `reviewRequired: true`. Additional collisions may be geometry errors. All 100 unresolved cases also require additional computational budget, local refinement or CAD design work. The exact counts will change if geometry or audit granularity changes.

The reference does NOT include every 30 GLB Part as a B-Rep shape, engine combustion loads, manufacturer part tolerances, gear tooth profiles, timing belt kinematics, rotating seals, oil-film behavior or deformation.

## 5. Acceptance and next specific actions

**Actually completed:** loading fix (all 106 source nodes), source STEP generation (18 B-Rep Part instances), reproducible CAD GLB and native STEP artifact publication, fail-closed swept mesh surface diagnostics, headless GLB and kinematic regression.

**Still needed for a manufacturing quality engine:** a reliable externally sourced licensed STEP/OEM assembly, toleranced bore and bearing models, review of contact and unresolved pairs, accurate modeled gear/valve/timing parts, full CCD over reviewed watertight meshes, and a physical or engineer-qualified clearance/strength acceptance plan.

Never promote this reference from `authored-parametric-brep` to `cad-reviewed` solely because STEP export and these software checks pass.
