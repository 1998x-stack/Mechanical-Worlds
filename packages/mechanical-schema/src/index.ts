/** Mechanical Worlds schema v0.1 — immutable asset authoring contract. */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Transform = { position: Vec3; rotation: Quat };
export type PartStatus = "installed" | "detached" | "placed";
export type MateStatus = "locked" | "released";

export interface PartDefinition {
  id: string;
  name: string;
  category: string;
  material?: string;
}
export interface AssemblyNode {
  kind: "assembly"; id: string; name: string; parentId: string | null;
  designLocal: Transform;
}
export interface PartNode {
  kind: "part"; id: string; name: string; parentId: string;
  definitionId: string;
  geometryKey: string;
  designLocal: Transform;
}
export type MechanicalNode = AssemblyNode | PartNode;
export interface Connector {
  id: string; ownerPartId: string;
  kind: "mount" | "thread" | "hinge" | "press-fit" | "clip" | "slide";
  local: Transform;
}
export interface Mate {
  id: string; connectorAId: string; connectorBId: string;
  initialState: MateStatus; fastenerPartIds?: string[];
}
export type Predicate =
  | { kind: "part"; id: string; equals: PartStatus }
  | { kind: "mate"; id: string; equals: MateStatus }
  | { kind: "flag"; id: string; equals: boolean };
export type Effect =
  | { kind: "part"; id: string; state: PartStatus }
  | { kind: "mate"; id: string; state: MateStatus }
  | { kind: "offset"; id: string; value: Vec3 };
export interface Operation {
  id: string; label: string;
  intent: "disassemble" | "assemble";
  targetId: string;
  dependsOn: string[];
  requires: Predicate[];
  effects: Effect[];
  durationMs: number;
}
export interface OperationPlan {
  id: string; label: string;
  intent: "disassemble" | "assemble";
  operationIds: string[];
}
export interface MechanicalAsset {
  schemaVersion: "0.1.0";
  id: string; label: string; description: string; rootId: string;
  definitions: PartDefinition[];
  nodes: MechanicalNode[];
  connectors: Connector[];
  mates: Mate[];
  operations: Operation[];
  plans: OperationPlan[];
  flags?: Record<string, boolean>;
}
export type ValidationIssue = {
  severity: "error" | "warning";
  code: string; path: string; message: string;
};
export const IDENTITY: Transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
export const zero = (): Vec3 => [0, 0, 0];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const transform = (position: Vec3): Transform => ({ position, rotation: [0, 0, 0, 1] });

export function validateAsset(asset: MechanicalAsset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fail = (code: string, path: string, message: string) =>
    issues.push({ severity: "error", code, path, message });
  if (asset.schemaVersion !== "0.1.0") fail("SCHEMA_VERSION", "schemaVersion", "Unsupported schema");
  const entries = [...asset.definitions, ...asset.nodes, ...asset.connectors, ...asset.mates,
    ...asset.operations, ...asset.plans];
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) fail("DUPLICATE_ID", entry.id, "ID missing or duplicated");
    ids.add(entry.id);
  }
  const nodes = new Map(asset.nodes.map(n => [n.id, n]));
  const parts = new Set(asset.nodes.filter(n => n.kind === "part").map(n => n.id));
  const definitions = new Set(asset.definitions.map(d => d.id));
  const connectors = new Map(asset.connectors.map(c => [c.id, c]));
  const mates = new Set(asset.mates.map(m => m.id));
  const ops = new Map(asset.operations.map(op => [op.id, op]));
  const root = nodes.get(asset.rootId);
  if (!root || root.kind !== "assembly" || root.parentId !== null)
    fail("ROOT", asset.rootId, "Root must be an assembly with no parent");
  for (const n of asset.nodes) {
    if (n.id !== asset.rootId && (!nodes.has(n.parentId!) || nodes.get(n.parentId!)?.kind !== "assembly"))
      fail("ORPHAN", n.id, "Missing assembly parent");
    if (n.id !== asset.rootId) {
      const visited = new Set<string>();
      let cursor: MechanicalNode | undefined = n;
      while (cursor && cursor.id !== asset.rootId) {
        if (visited.has(cursor.id)) { fail("TREE_CYCLE", n.id, "Parent cycle"); break; }
        visited.add(cursor.id);
        cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
      }
      if (!cursor) fail("UNREACHABLE", n.id, "Not connected to root");
    }
    if (n.kind === "part" && !definitions.has(n.definitionId))
      fail("DEFINITION", n.id, "Unknown part definition");
    if (!n.designLocal.position.every(Number.isFinite) ||
        !n.designLocal.rotation.every(Number.isFinite) ||
        Math.abs(Math.hypot(...n.designLocal.rotation) - 1) > 1e-5)
      fail("TRANSFORM", n.id, "Invalid transform or nonunit quaternion");
  }
  for (const c of asset.connectors) {
    if (!parts.has(c.ownerPartId)) fail("CONNECTOR_OWNER", c.id, "Connector must belong to a part");
  }
  for (const m of asset.mates) {
    if (!connectors.has(m.connectorAId) || !connectors.has(m.connectorBId))
      fail("MATE_ENDPOINT", m.id, "Unknown connector");
    if (m.connectorAId === m.connectorBId) fail("MATE_ENDPOINT", m.id, "Self connection");
    for (const p of m.fastenerPartIds ?? [])
      if (!parts.has(p)) fail("FASTENER", m.id, "Fastener part missing: " + p);
  }
  for (const op of asset.operations) {
    if (!nodes.has(op.targetId)) fail("OP_TARGET", op.id, "Target node missing");
    for (const dep of op.dependsOn)
      if (!ops.has(dep)) fail("OP_DEPENDENCY", op.id, "Unknown dependency " + dep);
    for (const p of op.requires) {
      if (p.kind === "part" && !parts.has(p.id)) fail("PREDICATE", op.id, p.id);
      if (p.kind === "mate" && !mates.has(p.id)) fail("PREDICATE", op.id, p.id);
    }
    for (const effect of op.effects) {
      if ((effect.kind === "part" || effect.kind === "offset") && !parts.has(effect.id))
        fail("EFFECT", op.id, "Missing part " + effect.id);
      if (effect.kind === "mate" && !mates.has(effect.id))
        fail("EFFECT", op.id, "Missing mate " + effect.id);
      if (effect.kind === "offset" && !effect.value.every(Number.isFinite))
        fail("EFFECT", op.id, "Nonfinite offset");
    }
    if (!Number.isFinite(op.durationMs) || op.durationMs < 0)
      fail("DURATION", op.id, "Negative or nonfinite duration");
  }
  for (const plan of asset.plans) {
    const allowed = new Set(plan.operationIds);
    for (const id of allowed) {
      const op = ops.get(id);
      if (!op) { fail("PLAN_OPERATION", plan.id, "Unknown operation " + id); continue; }
      if (op.intent !== plan.intent) fail("PLAN_INTENT", plan.id, "Mismatched operation intent");
      for (const dep of op.dependsOn)
        if (!allowed.has(dep)) fail("PLAN_DEPENDENCY", plan.id, "Dependency outside plan " + dep);
    }
    const visiting = new Set<string>(), done = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) { fail("OPERATION_CYCLE", plan.id, "Cycle at " + id); return; }
      if (done.has(id)) return;
      visiting.add(id);
      for (const dep of ops.get(id)?.dependsOn ?? []) if (allowed.has(dep)) visit(dep);
      visiting.delete(id);
      done.add(id);
    };
    for (const id of allowed) visit(id);
  }
  return issues;
}
