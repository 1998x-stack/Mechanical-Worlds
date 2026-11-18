# Mechanical Worlds Multi-Agent Skills Architecture

## Purpose

As Mechanical Worlds expands from cars to engines, watches, robot arms and industrial plant, every agent must apply consistent engineering constraints. Domain skills encode procedures, references, deterministic scripts and starter assets; AGENTS.md governs the repo; TypeScript code remains the truth for runtime behavior.

## Actual discovery paths

| Agent | Native location | Repository implementation |
|---|---|---|
| Codex | `.agents/skills/<name>/SKILL.md` | Canonical source, automatically discovered |
| Claude Code | `.claude/skills/<name>/SKILL.md` | Byte-identical generated mirror |
| Pi | `.pi/skills/<name>/SKILL.md` (also `.agents/skills`) | Byte-identical mirror; possible duplicate-name warning |
| Codex developer tools | `.codex/` | Mirror for navigation only, **not** claimed as Codex native discovery |

See official specifications: https://learn.chatgpt.com/docs/build-skills , https://code.claude.com/docs/en/skills and https://docs.pi.dev/latest/skills .

## Nine composable production skills

| Skill | Input | Output |
|---|---|---|
| `mechanical-system-planner` | machine family + engineering requirements | stable subsystem and Part/BOM architecture |
| `parametric-cad-authoring` | part brief + dimensions + provenance | reproducible geometry source |
| `automotive-asset-factory` | catalog IDs + batch | GLB, manifest, updated catalog entries |
| `gltf-asset-pipeline` | CAD or procedurally generated meshes | glTF 2.0 GLB and structural QA |
| `mechanical-connection-authoring` | source assembly + connector anchors | Mate, Joint, Fastener graph |
| `disassembly-operation-authoring` | attachment interfaces and safety guards | disassembly/assembly DAG and trajectories |
| `mechanical-asset-qa` | manifest + GLB + assembly model | hard gate reports and negative tests |
| `complex-machine-onboarding` | new machine type and sources | schema-compatible phased rollout |
| `mechanical-release-operator` | release candidates + CI | versioned published artifacts and audit trail |

### Progressive disclosure

1. Name and 1–2 sentence trigger description in `SKILL.md` frontmatter.
2. `SKILL.md` with concrete ordered workflow, no sprawling prose.
3. `references/guide.md`, `scripts/check.mjs` and `assets/brief.template.json` loaded on demand.
4. Shared `tools/asset-pipeline` for complex geometry algorithms to avoid code duplication.

## Change control

Edit a canonical skill only inside `.agents/skills/`. Mirror via `node tools/skills/sync.mjs sync`. CI should run the equivalent `check` command to fail on any drift. Never hand-edit four copies. Run frontmatter and JSON template validation with each check.

## Repeated asset production loop

    import catalog and authorized sources
      ↓
    mechanical-system-planner defines boundaries and ID rules
      ↓
    parametric-cad-authoring creates independent geometries
      ↓
    gltf-asset-pipeline builds GLB with named real meshes
      ↓
    mechanical-asset-qa inspects geometry and catalog coverage
      ↓
    mechanical-connection-authoring defines constraints
      ↓
    disassembly-operation-authoring defines guarded plans
      ↓
    mechanical-asset-qa runs round-trip/collision tests
      ↓
    mechanical-release-operator confirms CI, docs and Pages

A planned catalog is not an asset release. A generated GLB qualifies as a **renderable mesh**, not an OEM replica or a qualified part for manufacturing.

## Scaling to extremely complex machines

Partition by mechanically meaningful subassemblies with stable interfaces; do not merge cross-module joints into an unstructured mesh or recursively ship entire assemblies on every view. Store each subsystem as a separately versioned GLB and metadata shard as volume grows, with content addressing, multiple LODs, a BOM index and dependency graph. For flexible hoses, cables, belts, hydraulic/pneumatic circuits and loaded joints, add specialized validators and eventually simulation adapters rather than pretending rigidbody displacement covers them.

Each new machine family starts with one *vertical* acceptance slice (part selection → release → path → reinsertion → mate lock), a truthful unmodeled backlog, and a reproducible asset batch. Engineering level promotion is controlled by evidence, not by automatic render success.

## Model-first catalog schema

Individual catalog rows should contain `id`, `parentId`, `nameZh`, `kind`, `geometryStatus`, `engineeringVerified`; a generated row additionally needs `geometryUri`, `geometryNodeName`, `geometrySource` and reference to build manifest. Never infer a Part has geometry from a sibling node.

## Quality risks and explicit non-goals

- `GLB valid` does not imply `watertight`, `printable`, `CAD accurate`, `collision-free` or `manufacturable`.
- Arbitrary automatic import from online repositories is prohibited without provenance/license review.
- First automotive geometry batch is a conceptual physically separate surface-mesh series; manufacturer dimensions, joints and production manufacturing requirements remain unverified.
- Browser preview provides visual and selection validation; click-to-disassemble requires a separate certified operation DAG. Do not imply every generated catalog row is immediately mechanically detachable.
