# Slider-crank closure and engineering review

## Closed-chain formula

Let `r` be throw radius, `L` the rod bearing-center distance, and `φ` each cylinder's crank phase.

```
α = θ+φ
Pcrank = [x, y0 + r*cos(α), z0 + r*sin(α)]
PpistonPin = [x, y0 + r*cos(α) + sqrt(L²-r²*sin²(α)), z0]
rodAngleX = atan2(-r*sin(α),sqrt(L²-r²*sin²(α)))
```

Require `L>r>0`; guard any NaN. For a conventional inline-four use [0, π, π, 0] geometry phases and a two-turn four-stroke operation cycle with camshaft half-speed. This is kinematics, not a combustion or valve-timing simulation.

## Authoritative files

- `packages/mechanical-schema/src/index.ts` — slider-crank schema and validators.
- `packages/mechanical-core/src/engine-i4.ts` — solver, GLB-bound part tree, explicit DAG.
- `assets/mechanical/engine-i4-source-brief.json` — generated-only dimensions and accuracy risks.
- `tools/asset-pipeline/audit-engine-i4.mjs` — 721-position analytic closure and state round-trip.
- `docs/ENGINE-I4-KINEMATICS.md` — detailed equation, geometry mismatch and open issues.

## Engineering gaps (not already implemented)

The generated block is not hollow source CAD. The source crankshaft GLB throw pattern does not fully represent 1&4/2&3 phase. Linkage center-to-center mathematical poses can be correct while the geometric mesh surfaces intersect. Before real OEM fidelity claim, require correct STEP source rights, actual bore/piston/pin fits, dimensions and continuous mesh collision evidence.

For reusable non-engine mechanisms, extract a typed coupler plugin registry rather than hardcoding the I4 formula into Three.js.
