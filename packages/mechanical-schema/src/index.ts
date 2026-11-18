/** Mechanical Worlds schema v0.1 — immutable asset authoring contract. */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Transform = { position: Vec3; rotation: Quat };
export type PartStatus = "installed" | "detached" | "placed";
export type MateStatus = "locked" | "released";
export type OperationIntent = "disassemble" | "assemble" | "operate";

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
  /** Source file and unique glTF node binding; not a CAD verification claim. */
  geometryRef?: { uri: string; nodeName: string; tier: "generated-conceptual" | "cad-reviewed" };
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
  /** When true, atomic locking requires geometry-aligned anchors. */
  verified?: boolean;
  /** Runtime alignment acceptance, separate from manufacturing fit certification. */
  tolerance?: {
    positionM: number; angleRad: number;
    evidence: "conceptual" | "cad-reviewed";
    sourceId?: string;
  };
}
export interface RevoluteJoint {
  id: string; type: "revolute"; mateId: string; drivenPartId: string;
  pivotWorld: Vec3; axisWorld: Vec3; minRad: number; maxRad: number; initialRad: number;
}
export type MechanicalJoint = RevoluteJoint;
export interface CollisionProxy {
  partId: string;
  /** Conservative AABB in the part-local frame; independent of visible mesh. */
  center: Vec3; halfExtents: Vec3;
}
export interface MotionPath {
  id: string;
  kind: "linear" | "screw" | "hinge";
  /** All parts whose offsets are driven by the operation, or one driven joint. */
  targetPartIds: string[];
  jointId?: string;
  /** Normalized world-axis for screw rotation. */
  axisWorld?: Vec3;
  turns?: number;
  /** Demo screw extraction depth (meters) along axisWorld, before tray translation. */
  axialTravelM?: number;
  /** [0,1] fraction of animation spent in the threaded extraction/installation phase. */
  screwPhaseFraction?: number;
  /** required blocks new AABB contacts; advisory reports but permits demo. */
  collisionPolicy: "required" | "advisory" | "none";
  ignorePartIds?: string[];
  samples?: number;
}
export type Predicate =
  | { kind: "part"; id: string; equals: PartStatus }
  | { kind: "mate"; id: string; equals: MateStatus }
  | { kind: "flag"; id: string; equals: boolean }
  | { kind: "joint"; id: string; equalsRad: number };
export type Effect =
  | { kind: "part"; id: string; state: PartStatus }
  | { kind: "mate"; id: string; state: MateStatus }
  | { kind: "offset"; id: string; value: Vec3 }
  | { kind: "joint"; id: string; angleRad: number };
export interface Operation {
  id: string; label: string;
  intent: OperationIntent;
  targetId: string;
  dependsOn: string[];
  requires: Predicate[];
  effects: Effect[];
  durationMs: number;
  pathId?: string;
}
export interface OperationPlan {
  id: string; label: string;
  intent: OperationIntent;
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
  joints?: MechanicalJoint[];
  motionPaths?: MotionPath[];
  collisionProxies?: CollisionProxy[];
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
    ...asset.operations, ...asset.plans, ...(asset.joints ?? []), ...(asset.motionPaths ?? [])];
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
  const joints = new Map((asset.joints ?? []).map(j => [j.id, j]));
  const paths = new Map((asset.motionPaths ?? []).map(p => [p.id, p]));
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
    if (n.kind === "part" && n.geometryRef && (
        n.geometryRef.nodeName !== n.id || !n.geometryRef.uri.endsWith(".glb") ||
        !["generated-conceptual", "cad-reviewed"].includes(n.geometryRef.tier)))
      fail("GEOMETRY_REF", n.id, "Geometry node must equal physical Part ID and reference a GLB");
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
    if (m.tolerance && (
      !Number.isFinite(m.tolerance.positionM) || m.tolerance.positionM < 0 ||
      !Number.isFinite(m.tolerance.angleRad) || m.tolerance.angleRad < 0 ||
      (m.tolerance.evidence === "cad-reviewed" && !m.tolerance.sourceId?.trim())))
      fail("MATE_TOLERANCE", m.id, "Invalid tolerance or missing CAD evidence source");
  }
  const nearlyUnit = (v: Vec3) => v.every(Number.isFinite) &&
    Math.abs(Math.hypot(...v) - 1) <= 1e-5;
  for (const joint of asset.joints ?? []) {
    if (!mates.has(joint.mateId) || !parts.has(joint.drivenPartId))
      fail("JOINT_REF", joint.id, "Unknown mate or driven part");
    if (!nearlyUnit(joint.axisWorld) || !joint.pivotWorld.every(Number.isFinite))
      fail("JOINT_AXIS", joint.id, "Non-unit joint axis / invalid pivot");
    if (![joint.minRad, joint.maxRad, joint.initialRad].every(Number.isFinite) ||
        joint.minRad > joint.initialRad || joint.initialRad > joint.maxRad)
      fail("JOINT_LIMIT", joint.id, "Joint initial position violates limits");
  }
  const seenProxies = new Set<string>();
  for (const proxy of asset.collisionProxies ?? []) {
    if (!parts.has(proxy.partId) || seenProxies.has(proxy.partId))
      fail("PROXY_REF", proxy.partId, "Missing part or duplicate proxy");
    seenProxies.add(proxy.partId);
    if (!proxy.center.every(Number.isFinite) ||
        !proxy.halfExtents.every(v => Number.isFinite(v) && v > 0))
      fail("PROXY_SHAPE", proxy.partId, "Invalid collision proxy dimensions");
  }
  for (const path of asset.motionPaths ?? []) {
    if (!path.targetPartIds.length || path.targetPartIds.some(id => !parts.has(id)))
      fail("PATH_TARGET", path.id, "Missing target part");
    if (path.kind === "hinge" && (!path.jointId || !joints.has(path.jointId)))
      fail("PATH_JOINT", path.id, "Missing revolute joint");
    if (path.kind === "screw" &&
        (!path.axisWorld || !nearlyUnit(path.axisWorld) || !Number.isFinite(path.turns) || path.turns === 0))
      fail("PATH_SCREW", path.id, "Screw path needs unit axis and nonzero turns");
    if (path.kind === "screw" &&
        (path.axialTravelM === undefined || !Number.isFinite(path.axialTravelM) || path.axialTravelM <= 0 ||
         path.screwPhaseFraction === undefined || !Number.isFinite(path.screwPhaseFraction) ||
         path.screwPhaseFraction <= 0 || path.screwPhaseFraction >= 1))
      fail("PATH_SCREW_PHASE", path.id, "Screw path needs positive axial travel and phase in (0,1)");
    if (path.samples !== undefined && (!Number.isInteger(path.samples) || path.samples < 2 || path.samples > 256))
      fail("PATH_SAMPLES", path.id, "Sample count must be 2–256");
    for (const ignored of path.ignorePartIds ?? [])
      if (!parts.has(ignored)) fail("PATH_IGNORE", path.id, "Unknown ignored part " + ignored);
  }
  for (const op of asset.operations) {
    if (!nodes.has(op.targetId)) fail("OP_TARGET", op.id, "Target node missing");
    if (op.pathId && !paths.has(op.pathId))
      fail("OP_PATH", op.id, "Unknown operation motion path");
    for (const dep of op.dependsOn)
      if (!ops.has(dep)) fail("OP_DEPENDENCY", op.id, "Unknown dependency " + dep);
    for (const p of op.requires) {
      if (p.kind === "part" && !parts.has(p.id)) fail("PREDICATE", op.id, p.id);
      if (p.kind === "mate" && !mates.has(p.id)) fail("PREDICATE", op.id, p.id);
      if (p.kind === "joint" && !joints.has(p.id)) fail("PREDICATE", op.id, p.id);
    }
    for (const effect of op.effects) {
      if ((effect.kind === "part" || effect.kind === "offset") && !parts.has(effect.id))
        fail("EFFECT", op.id, "Missing part " + effect.id);
      if (effect.kind === "mate" && !mates.has(effect.id))
        fail("EFFECT", op.id, "Missing mate " + effect.id);
      if (effect.kind === "offset" && !effect.value.every(Number.isFinite))
        fail("EFFECT", op.id, "Nonfinite offset");
      if (effect.kind === "joint") {
        const j = joints.get(effect.id);
        if (!j || !Number.isFinite(effect.angleRad) ||
            effect.angleRad < j.minRad - 1e-8 || effect.angleRad > j.maxRad + 1e-8)
          fail("EFFECT_JOINT", op.id, "Missing joint or target violates limits");
      }
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
