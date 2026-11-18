# AGENTS.md — Mechanical Worlds

This is the canonical working agreement for Codex, Pi, Claude Code and other agents modifying Mechanical Worlds.

## Mission and architecture

Build a trustworthy, extensible mechanical assembly/disassembly platform rather than a gallery of disconnected exploded meshes.

- `packages/mechanical-schema`: stable assembly, physical Part, Connector, Mate, Joint, Operation and path contracts.
- `packages/mechanical-core`: headless mechanical authority: transaction, DAG, guards, state, collision validation. NEVER depend on Three.js.
- `packages/mechanical-three`: scene presentation, picking, LOD and visual previews. Never commit mechanical truth from an animation frame.
- `tools/asset-pipeline`: deterministic and reviewable mesh generator, GLB validation, manifests, QA reports.
- `assets/catalog/automotive-fwd-i4-001.json`: 317 **planned** automotive parts at baseline. Catalog count is not rendered mesh count.

**Coordinate system**: RH, +Y up, -Z forward, +X vehicle right; meters in runtime, radians for angles. Preserve source CAD units separately. Instance IDs are stable across export versions; glTF node names must equal physical Part IDs.

## Truthful quality ladder

| Status | Required evidence | Legitimate claim |
|---|---|---|
| `planned` | Catalog ID, parent and intended function | Design planned |
| `generated` | Real triangle mesh exists in committed validated GLB, named node, manifest and source | Renderable geometry |
| `cad-reviewed` | Source CAD and engineering review of dimensions, anchor frames, fits | CAD-reviewed model |
| `manufacturing-validated` | Documented tolerances/strength and physical manufacturing qualification | Validated for stated manufacturing scope |

Do not jump levels. Neither a successful Three.js render nor an AABB collision pass certifies mechanical clearances, real vehicle servicing, or 3D print strength. L1–L4 *interactivity capability* is orthogonal to geometry status.

## Mandatory workflow

1. Identify the matching repository skill (`.agents/skills/<name>/SKILL.md`); load its references only as needed.
2. Check actual catalog and assembly graph IDs, relevant data contracts and source provenance/licensing.
3. Plan a coherent batch of physically separate Parts; define stable IDs and assembly boundaries.
4. Generate **real binary GLB geometry** and preserve its generator/source parameters; do not promote a catalog item merely because a filename was created.
5. Validate every GLB chunk, mesh, named node, finite positions, triangle topology, bounds and catalog mapping.
6. If the scope includes disassembly, implement Mates, guards, motion paths, collision policy, independent assembly plan and round-trip tests.
7. Run `npm run skills:check`, `npm run assets:validate`, `npm run test`, `npm run build`; fix the root cause of failures.
8. Update README/docs with real delivered counts, known accuracy limitations and outstanding tasks.

## Skill discovery and single source

- **Codex** auto-discovers `.agents/skills/`, not `.codex/skills/` by default; `.codex/skills/` is an explicit mirrored navigation copy.
- **Claude Code** reads `.claude/skills/`.
- **Pi** reads `.pi/skills/` and `.agents/skills/`; duplicate-name warnings may appear. Canonical source is `.agents/skills/`.
- Maintain only `.agents/skills/` as authoritative. Run `npm run skills:sync` to generate mirrors; `npm run skills:check` enforces byte-for-byte consistency.
- `SKILL.md` is case-sensitive; YAML frontmatter must include valid kebab-case name and precise routing description. Each skill bundles `references/`, `scripts/`, and `assets/`.

## Mechanical correctness and security

- Never infer an actual disassembly process or fastener torque from an unverified GLB or photo.
- Maintain cross-subsystem Mates separately from the assembly hierarchy.
- A screw animation needs explicit pitch/turn parameters and two-stage exit when it becomes fully disengaged; a reversed preview is not an independently validated assembly operation.
- Collision broadphase is not continuous narrowphase; disclose sampling limitations and allowed contact pairs.
- Real safety-critical brakes, airbags, springs, steering and powered machinery require verified source data and specialist review. Never claim OEM certification.
- Import only geometry/materials with appropriate provenance and redistribution licenses. No auto-download or execution of untrusted CAD scripts.
- Maintain rollback and idempotence in `Mechanical Core`; avoid direct state mutation from UI.

## PR/commit review checklist

- [ ] Real geometry matches catalog `generated` rows; `planned` remains truthful elsewhere.
- [ ] Schema and Unit tests cover new Parts, connectors, operations and exceptional paths.
- [ ] Geometry has visible, individually selectable GLB nodes and reproducible source.
- [ ] No unexpected regressions in left-front-wheel and glasses demos.
- [ ] Repository skills mirrors pass consistency and frontmatter validation.
- [ ] CI and Pages deployment are inspected; deployment is not assumed from source changes.
- [ ] Summary explicitly distinguishes rendered conceptual geometry from measured CAD and manufacturing certification.

## Basic commands

    npm install
    npm run skills:sync
    npm run skills:check
    npm run assets:build
    npm run assets:validate
    npm run test
    npm run build
    npm run dev

Contributions should be focused and traceable; prefer one mechanically coherent verified batch rather than a huge unvalidated catalog promotion.
