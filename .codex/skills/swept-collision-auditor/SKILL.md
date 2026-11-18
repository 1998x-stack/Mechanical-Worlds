---
name: swept-collision-auditor
description: Audit mechanical disassembly trajectories for collision risks beyond the sampled AABB broadphase. Use when preparing new multi-link joints, vehicle brake service, engine disassembly or real-world clearance claims.
---

# swept-collision-auditor

## Objective

Separate broadphase candidate checks, detailed mesh narrowphase and true continuous swept contact proof.

## Procedure

1. Identify moving rigid-body group, stationary obstacles and all attachments that move together at each operation.
2. Read the source assembly and connector frames; never infer initial clearance from visual preview alone.
3. Run current AABB sampled preflight as a cheap regression check, with recorded sample count and excluded contact pairs.
4. Build non-surface simulation proxies from reviewed CAD or convex decomposition, not rough visual boxes.
5. Run OBB/convex/BVH mesh narrowphase and continuous time-of-impact sweeps in a verified external or future in-repo solver.
6. Review allowed-contact pairs as a function of Mate/Joint release state, instead of blanket ignoring initially touching obstacles.
7. Add adversarial tests for grazing contacts, long thin parts, contacts between samples, rotation around pivots and reverse insertion.
8. Publish a signed audit result with solver version, precision thresholds, source evidence and all unsupported cases.

## Resources

- Read `references/guide.md` for detailed standards, uncertainty and current implementation gaps.
- Start with `assets/brief.template.json`; never omit provenance or evidence status.
- Run `node scripts/check.mjs` to perform repository preflight.
- Validate any new geometric export with `npm run assets:validate`, then `npm run test` and `npm run build`.

## Explicit limits

- These are engineering authoring workflows, not automated manufacturing certification.
- Do not set `cad-reviewed` or `manufacturing-validated` without physical dimensional/fit/source evidence.
- GLB visual geometry and Mates do not by themselves prove real service safety.
