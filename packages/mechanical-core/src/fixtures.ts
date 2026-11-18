/** Two self-contained reference fixtures. Dimensions are illustrative, not repair specifications. */
import {
  transform, type Vec3, type MechanicalAsset, type MechanicalNode,
  type PartDefinition, type Connector, type Mate, type Operation,
  type OperationPlan, type Predicate, type Effect
} from "../../mechanical-schema/src/index.js";

type Intent = "disassemble" | "assemble";
const installed = (id: string): Predicate => ({ kind: "part", id, equals: "installed" });
const detached = (id: string): Predicate => ({ kind: "part", id, equals: "detached" });
const released = (id: string): Predicate => ({ kind: "mate", id, equals: "released" });
const part = (id: string, state: "installed" | "detached"): Effect => ({ kind: "part", id, state });
const mate = (id: string, state: "locked" | "released"): Effect => ({ kind: "mate", id, state });
const shift = (id: string, value: Vec3): Effect => ({ kind: "offset", id, value });
const origin: Vec3 = [0, 0, 0];

class Builder {
  definitions: PartDefinition[] = [];
  nodes: MechanicalNode[] = [];
  connectors: Connector[] = [];
  mates: Mate[] = [];
  operations: Operation[] = [];
  plans: OperationPlan[] = [];
  private definitionsByKey = new Set<string>();
  constructor(public id: string, public label: string, public description: string, public rootId: string) {
    this.assembly(rootId, label, null);
  }
  assembly(id: string, name: string, parentId: string | null): void {
    this.nodes.push({ kind: "assembly", id, name, parentId, designLocal: transform(origin) });
  }
  part(id: string, name: string, parentId: string, geometryKey: string, position: Vec3): void {
    const definitionId = "def." + geometryKey;
    if (!this.definitionsByKey.has(definitionId)) {
      this.definitions.push({ id: definitionId, name, category: geometryKey });
      this.definitionsByKey.add(definitionId);
    }
    this.nodes.push({ kind: "part", id, name, parentId, definitionId, geometryKey, designLocal: transform(position) });
  }
  connector(id: string, ownerPartId: string, kind: Connector["kind"] = "mount"): string {
    this.connectors.push({ id, ownerPartId, kind, local: transform(origin) });
    return id;
  }
  connect(id: string, a: string, b: string, fastenerPartIds?: string[]): string {
    this.mates.push({
      id,
      connectorAId: this.connector("c." + id + ".a", a),
      connectorBId: this.connector("c." + id + ".b", b),
      initialState: "locked",
      ...(fastenerPartIds ? { fastenerPartIds } : {})
    });
    return id;
  }
  operation(id: string, label: string, intent: Intent, targetId: string,
    dependsOn: string[], requires: Predicate[], effects: Effect[], durationMs = 320): void {
    this.operations.push({ id, label, intent, targetId, dependsOn, requires, effects, durationMs });
  }
  plan(id: string, label: string, intent: Intent, operationIds: string[]): void {
    this.plans.push({ id, label, intent, operationIds });
  }
  asset(flags: Record<string, boolean> = {}): MechanicalAsset {
    return {
      schemaVersion: "0.1.0", id: this.id, label: this.label, description: this.description,
      rootId: this.rootId, definitions: this.definitions, nodes: this.nodes,
      connectors: this.connectors, mates: this.mates,
      operations: this.operations, plans: this.plans, flags
    };
  }
}

export function createWheelAsset(): MechanicalAsset {
  const b = new Builder("demo.wheel.fl", "汽车左前轮", "五颗固定螺母 → 解除轮毂配合 → 整体取轮 → 原位装配。制动盘和卡钳留在底盘侧。", "vehicle");
  b.assembly("chassis", "底盘 / 转向节", "vehicle");
  b.assembly("wheel.fl", "左前车轮总成", "vehicle");
  b.part("chassis.hub.fl", "轮毂 / 轴头", "chassis", "hub", [0, 0.3, 0]);
  b.part("chassis.brake.disc.fl", "制动盘（不随车轮拆卸）", "chassis", "brake-disc", [-0.13, 0.3, 0]);
  b.part("chassis.brake.caliper.fl", "制动卡钳（不随车轮拆卸）", "chassis", "caliper", [-0.12, 0.73, 0.22]);
  b.part("wheel.fl.rim", "轮辋", "wheel.fl", "rim", [-0.38, 0.3, 0]);
  b.part("wheel.fl.tire", "轮胎", "wheel.fl", "tire", [-0.38, 0.3, 0]);
  b.part("wheel.fl.valve", "气门嘴", "wheel.fl", "valve", [-0.51, 0.86, 0.07]);
  const lugIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const a = (2 * Math.PI * (i - 1)) / 5;
    const id = "wheel.fl.lug." + String(i).padStart(2, "0");
    lugIds.push(id);
    b.part(id, "轮毂螺母 " + i, "wheel.fl", "lug-nut",
      [-0.55, 0.3 + Math.cos(a) * 0.22, Math.sin(a) * 0.22]);
    b.connect("mate.wheel.lug." + i, id, "wheel.fl.rim");
  }
  const mount = b.connect("mate.wheel.fl.hub", "wheel.fl.rim", "chassis.hub.fl", lugIds);
  const removeIds: string[] = [];
  const installIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const id = lugIds[i - 1], m = "mate.wheel.lug." + i;
    const remove = "op.wheel.lug." + i + ".remove";
    const install = "op.wheel.lug." + i + ".install";
    removeIds.push(remove); installIds.push(install);
    b.operation(remove, "拆下螺母 " + i, "disassemble", id, [],
      [installed(id), { kind: "flag", id: "virtualSupport", equals: true }],
      [mate(m, "released"), part(id, "detached"), shift(id, [-0.64 - 0.07 * (i % 2), 0.23 + i * 0.045, 0.33 + i * 0.09])]);
    b.operation(install, "装回螺母 " + i, "assemble", id, ["op.wheel.attach"],
      [detached(id), installed("wheel.fl.rim")],
      [part(id, "installed"), shift(id, origin), mate(m, "locked")]);
  }
  b.operation("op.wheel.release-mount", "解除轮辋-轮毂配合", "disassemble",
    "wheel.fl", removeIds, lugIds.map(detached), [mate(mount, "released")], 220);
  b.operation("op.wheel.detach", "沿轮轴方向取下车轮总成", "disassemble",
    "wheel.fl", ["op.wheel.release-mount"], [released(mount)],
    ["wheel.fl.rim", "wheel.fl.tire", "wheel.fl.valve"].flatMap(id =>
      [part(id, "detached"), shift(id, [-1.28, 0.28, 0.16])]), 680);
  b.operation("op.wheel.attach", "对齐并安装车轮总成", "assemble",
    "wheel.fl", [], [detached("wheel.fl.rim"), released(mount)],
    ["wheel.fl.rim", "wheel.fl.tire", "wheel.fl.valve"].flatMap(id =>
      [part(id, "installed"), shift(id, origin)]), 680);
  b.operation("op.wheel.lock-mount", "确认五颗螺母固定并锁定配合", "assemble",
    "wheel.fl", installIds, lugIds.map(installed), [mate(mount, "locked")], 220);
  b.plan("plan.wheel.remove", "完整拆下左前轮", "disassemble",
    [...removeIds, "op.wheel.release-mount", "op.wheel.detach"]);
  b.plan("plan.wheel.install", "完整装回左前轮", "assemble",
    ["op.wheel.attach", ...installIds, "op.wheel.lock-mount"]);
  return b.asset({ virtualSupport: true });
}

export function createGlassesAsset(): MechanicalAsset {
  const b = new Builder("demo.glasses", "机械眼镜", "镜片、鼻托、两侧铰链、镜腿和铰链螺钉均可按依赖关系拆解、回装。", "glasses");
  b.assembly("glasses.front", "镜框与镜片", "glasses");
  b.assembly("glasses.left", "左镜腿铰链组件", "glasses");
  b.assembly("glasses.right", "右镜腿铰链组件", "glasses");
  b.part("g.frame", "镜框 / 鼻梁", "glasses.front", "glasses-frame", [0, 0.64, 0]);
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? -1 : 1;
    const cn = side === "left" ? "左" : "右";
    const parent = "glasses." + side;
    b.part("g.lens." + side, cn + "镜片", "glasses.front", "lens", [sign * 0.79, 0.64, 0]);
    b.part("g.pad." + side, cn + "鼻托", "glasses.front", "nose-pad", [sign * 0.22, 0.32, 0.10]);
    b.part("g.hinge." + side, cn + "金属铰链座", parent, "hinge", [sign * 1.37, 0.65, 0.12]);
    b.part("g.temple." + side, cn + "镜腿", parent, "temple", [sign * 1.42, 0.63, 1.00]);
    b.part("g.screw." + side, cn + "铰链螺钉", parent, "hinge-screw", [sign * 1.37, 0.75, 0.12]);
    b.connect("mate.g.lens." + side, "g.lens." + side, "g.frame");
    b.connect("mate.g.pad." + side, "g.pad." + side, "g.frame");
    b.connect("mate.g.hinge.frame." + side, "g.hinge." + side, "g.frame");
    b.connect("mate.g.temple.hinge." + side, "g.temple." + side, "g.hinge." + side,
      ["g.screw." + side]);
  }
  const removeIds: string[] = [], attachIds: string[] = [];
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? -1 : 1;
    const cn = side === "left" ? "左" : "右";
    for (const kind of ["lens", "pad"] as const) {
      const id = "g." + kind + "." + side, m = "mate.g." + kind + "." + side;
      const name = kind === "lens" ? "镜片" : "鼻托";
      const away: Vec3 = kind === "lens" ? [sign * 0.45, 0.42, 0.58] : [sign * 0.44, -0.43, 0.43];
      const remove = "op.g." + kind + "." + side + ".remove";
      const attach = "op.g." + kind + "." + side + ".attach";
      removeIds.push(remove); attachIds.push(attach);
      b.operation(remove, "取下" + cn + name, "disassemble", id, [], [installed(id)],
        [mate(m, "released"), part(id, "detached"), shift(id, away)], 440);
      b.operation(attach, "安装" + cn + name, "assemble", id, [], [detached(id)],
        [part(id, "installed"), shift(id, origin), mate(m, "locked")], 440);
    }
    const screw = "g.screw." + side, temple = "g.temple." + side,
      hinge = "g.hinge." + side;
    const templeMate = "mate.g.temple.hinge." + side;
    const hingeMate = "mate.g.hinge.frame." + side;
    const screwRemove = "op.g.screw." + side + ".remove";
    const templeRemove = "op.g.temple." + side + ".remove";
    const hingeRemove = "op.g.hinge." + side + ".remove";
    const hingeAttach = "op.g.hinge." + side + ".attach";
    const templeAttach = "op.g.temple." + side + ".attach";
    const screwInstall = "op.g.screw." + side + ".install";
    removeIds.push(screwRemove, templeRemove, hingeRemove);
    attachIds.push(hingeAttach, templeAttach, screwInstall);
    b.operation(screwRemove, "旋出" + cn + "侧铰链螺钉", "disassemble", screw, [],
      [installed(screw)], [mate(templeMate, "released"), part(screw, "detached"),
        shift(screw, [sign * 0.48, 0.60, 0.20])], 430);
    b.operation(templeRemove, "拆下" + cn + "侧镜腿", "disassemble", temple,
      [screwRemove], [released(templeMate)],
      [part(temple, "detached"), shift(temple, [sign * 0.9, 0, -0.56])], 530);
    b.operation(hingeRemove, "拆下" + cn + "侧铰链座", "disassemble", hinge,
      [templeRemove], [detached(temple)],
      [mate(hingeMate, "released"), part(hinge, "detached"),
        shift(hinge, [sign * 0.72, -0.25, 0.15])], 410);
    b.operation(hingeAttach, "安装" + cn + "侧铰链座", "assemble", hinge,
      [], [detached(hinge)], [part(hinge, "installed"), shift(hinge, origin),
        mate(hingeMate, "locked")], 410);
    b.operation(templeAttach, "装回" + cn + "侧镜腿", "assemble", temple,
      [hingeAttach], [installed(hinge), detached(temple)],
      [part(temple, "installed"), shift(temple, origin)], 530);
    b.operation(screwInstall, "锁回" + cn + "侧铰链螺钉", "assemble", screw,
      [templeAttach], [installed(temple), detached(screw)],
      [part(screw, "installed"), shift(screw, origin), mate(templeMate, "locked")], 430);
  }
  b.plan("plan.glasses.remove", "眼镜全部拆解", "disassemble", removeIds);
  b.plan("plan.glasses.install", "眼镜全部合成", "assemble", attachIds);
  return b.asset();
}
