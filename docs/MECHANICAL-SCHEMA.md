# Mechanical Schema Specification

> **文档 ID**：MW-SPEC-001  
> **版本**：0.1.0 (Draft)  
> **状态**：规范设计稿，尚未实现  
> **适用对象**：Mechanical Worlds 的作者工具、资源导入器、Headless Mechanical Core、Three.js 渲染适配器、自动化校验器  
> **相关文档**：[Disassembly Engine](./DISASSEMBLY-ENGINE.md) · [Automotive Asset Specification](./AUTOMOTIVE-ASSET-SPEC.md)

## 1. 目标和非目标

本规范定义一种**可序列化、可版本化、可验证**的机械资产合同，使同一机械资产在编辑器、Web 查看器、服务端校验和测试环境中拥有一致的物理零件身份、装配层次、连接约束、拆装规则和运动语义。

**必须满足（MUST）**：

1. 明确区分**物理零件定义**（definition）与**物理零件实例**（instance）。同型号五颗螺母可以复用定义，但每一颗必须有独立实例 ID 和状态。
2. 多个渲染 Mesh **可以**映射到同一个物理零件；一个需要独立拆卸的物理零件 **不得**与其他物理零件合并为一个不可分离的 Mesh。
3. 区分**设计装配姿态**、**运行时装配状态**与**视图姿态**。爆炸视图不能擅自改变连接状态。
4. 拆卸/装配的安全前置条件、动作结果、失败处理必须显式表达，不能依赖动画完成回调推断机械状态。
5. 所有引用必须可解析；所有 ID 全局唯一；所有可执行操作必须有明确的语义版本与效果。

**不在 v0.1.0 范围内**：自动从任意三角网格推断真实装配关系；完整有限元分析；可形变轮胎的真实拆卸；实际维修认证；通用动力学仿真求解器。

关键词：**MUST/SHOULD/MAY** 分别表示强制、建议、可选。本文中物理精度的承诺仅针对经过工程审核的数据。

## 2. 资产包布局与版本

推荐目录：

```text
assets/mechanical/<category>/<asset-id>/
├── manifest.json
├── geometry/
│   ├── assembly.glb
│   └── collisions.glb                # 可选，简化碰撞代理
├── structure/
│   ├── part-definitions.json
│   ├── nodes.json
│   ├── connectors.json
│   ├── mates.json
│   ├── joints.json
│   └── fasteners.json
├── operations/
│   ├── disassembly.json
│   ├── assembly.json
│   └── paths.json
├── views/
│   └── exploded-layouts.json
├── metadata/
│   ├── bom.json
│   └── provenance.json
└── preview/
    └── overview.webp
```

实际目录可以重新映射，但 `manifest.json` **MUST** 包含每个引用文件的相对 URI。路径不得越过资产根目录；不允许通过任意远程 URI 绕过资源白名单。资源应记录内容哈希，用于缓存和版本完整性检查。

```json
{
  "schemaVersion": "0.1.0",
  "assetId": "mw.car.fwd-i4.001",
  "assetVersion": "0.1.0",
  "title": "FWD I4 Passenger Car — Reference Assembly",
  "status": "reference-draft",
  "coordinateSystem": {
    "units": "m",
    "handedness": "right",
    "up": "+Y",
    "forward": "-Z"
  },
  "rootNodeId": "vehicle",
  "geometry": [
    {"id": "primary", "uri": "geometry/assembly.glb", "sha256": "<sha256-hex>"}
  ],
  "documents": {
    "partDefinitions": "structure/part-definitions.json",
    "nodes": "structure/nodes.json",
    "connectors": "structure/connectors.json",
    "mates": "structure/mates.json",
    "joints": "structure/joints.json",
    "fasteners": "structure/fasteners.json",
    "disassembly": "operations/disassembly.json",
    "assembly": "operations/assembly.json",
    "paths": "operations/paths.json",
    "explodedLayouts": "views/exploded-layouts.json",
    "bom": "metadata/bom.json",
    "provenance": "metadata/provenance.json"
  }
}
```

上面的 `<sha256-hex>` 是需要由实际构建工具替换的占位值，不是可直接发布的校验值。**发布态**必须填充合法的 64 位十六进制 SHA-256。

版本策略：

- `schemaVersion`：格式兼容性的语义版本；主版本升级可能改变字段意义。
- `assetVersion`：一项具体资产的数据、几何或装配逻辑变更版本。
- 引擎读取器 MUST 显式检查所支持的 schema 范围；不认识的主版本应拒绝执行。
- 所有迁移 MUST 保留稳定实例 ID 的映射表，避免损坏用户保存的步骤及状态。

## 3. 坐标、单位、精度与变换

### 3.1 标准约定

| 内容 | 规范 |
|---|---|
| 渲染与运行时长度 | **米 (m)** |
| 角度 | **弧度 (rad)** |
| 时间 | **秒 (s)** |
| 质量 | **千克 (kg)** |
| 力/扭矩（扩展） | N / N·m |
| 坐标系 | 右手坐标系；+Y 向上，-Z 指向车辆前进方向，+X 指向车辆右侧 |
| 姿态旋转 | 归一化 quaternion `[x,y,z,w]` |
| 变换矩阵 | 列向量语义；世界矩阵 = 父世界矩阵 × 子局部矩阵 |
| 默认缩放 | `[1,1,1]`；连接求解须拒绝不符合要求的非均匀缩放 |

STEP/CAD 输入的 mm 必须在导入时显式转换为 m；源单位保留在 `provenance`，不能出现一份资源中“mm 和 m 混用而未标记”的情况。

标准 `Transform`：

```ts
type Vec3 = [number, number, number];
type Quat = [number, number, number, number]; // x y z w; norm ≈ 1
type Transform = {
  position: Vec3; // meters, relative to parent coordinate frame
  rotation: Quat;
  scale?: Vec3;   // optional; defaults [1,1,1]
};
```

所有 `Transform` 必须为有限数值（不得为 NaN/Infinity）；零件本地旋转轴应明确定义，不能依赖欧拉角顺序。

### 3.2 设计/物理/视觉分层

- `designLocal`：装配图规定的零件基准位置；在当前资产版本内不可被动画修改。
- `actualLocal`：当前模拟操作后零件物理位置与连接状态；由运行时状态存储管理。
- `visualLocal`：Three.js 绘制时使用的姿态；可受爆炸视图、预览、高亮、动画插值影响。
- `explosionDelta`：仅影响 `visualLocal`，**不触发**机械连接状态变更。

推荐渲染流程：`visualLocal = renderProjection(actualLocal, viewState, animationFrame)`；物理事实来源仍是 `actualLocal + mateState + operationLog`。

## 4. 机械标识与装配结构

### 4.1 ID 与对象种类

**所有 ID 大小写敏感，稳定且全局唯一**。推荐 `a.b.c` 的结构化命名法，例如：

- `vehicle`：整车根装配体。
- `powertrain.engine`：发动机总成。
- `wheel.fl`：左前车轮子装配体。
- `wheel.fl.rim`：左前轮轮辋实例。
- `wheel.fl.lug.01`：左前轮第 1 个紧固件实例。
- `c.wheel.fl.rim.mount`：轮辋安装连接锚点。
- `mate.wheel.fl.hub`：轮与轮毂连接。
- `op.wheel.fl.remove`：拆下左前车轮的操作。

`Node` 使用邻接树结构，**一个物理实例只能有一个装配父节点**。装配结构树与横跨子装配体的连接图是不同对象；不能借用父子关系表达所有机械连接。

```ts
type AssemblyNode = {
  id: string;
  kind: "assembly";
  parentId: string | null;
  designLocal: Transform;
  label: string;
};

type PartNode = {
  id: string;
  kind: "part";
  parentId: string;            // parent assembly id
  definitionId: string;
  designLocal: Transform;
  geometryBindings: Array<{
    assetId: string;            // manifest geometry[].id
    gltfNodeName: string;       // unique, stable glTF node name
  }>;
  collisionProxyId?: string;
  label?: string;
};

type Node = AssemblyNode | PartNode;
```

**树的要求**：一个且仅一个根 `AssemblyNode`；其 `parentId=null`；其余节点有且仅有一个存在的父级 Assembly；不得有环；所有节点均从根可达。`geometryBindings` 不应指向另一个独立 Part 占有的同一渲染节点。

`PartDefinition` 包含共享性质（不包含实例姿态）：

```ts
type PartDefinition = {
  id: string;                    // e.g. "def.lug-nut.m12"
  name: { zh: string; en?: string };
  category: string;              // taxonomy key
  material?: string;
  massKg?: number;
  nominalDimensionsM?: Vec3;
  partNumber?: string;
  supplier?: string;
  tags?: string[];
  sourceRef?: string;            // CAD/BOM provenance reference
};
```

可复用定义不意味着把所有相同螺栓当作一个可移动实体。每一颗需单独实例（或用明确的实例展开规则在发布前生成稳定 ID）。

### 4.2 组件层级

装配体节点可拥有任意数量的子装配体或零件。引擎 SHOULD 允许折叠/展开，递归拆解某装配体时根据引用到该子树的操作图计划，而不是简单遍历 Mesh 顺序。

**装配体可被整体拆下**；这时对子树整体应用一个临时刚体变换，同时保留子树内部连接。若子组件再次拆解，则依据更细粒度的操作展开。

## 5. Connector：连接锚点

每个锚点属于一个 `PartNode`，其坐标以所属零件本地坐标系表示。

```ts
type Connector = {
  id: string;
  ownerPartId: string;
  role: "male" | "female" | "neutral";
  kind:
    | "plane" | "shaft" | "bore" | "thread" | "bolt-hole"
    | "pin" | "slot" | "snap" | "hinge" | "electrical";
  frame: Transform;              // local to owner physical part
  profile?: {
    diameterM?: number;
    depthM?: number;
    pitchM?: number;
    threadDesignation?: string;
    fitClass?: string;
    clearanceM?: number;
  };
  tags?: string[];
};
```

`kind` 表示几何/连接特征，不是运动自由度。必须通过 `Mate` 和 `Joint` 才能形成真实连接与约束。

锚点兼容性最低规则：类型匹配、方向匹配、角色匹配、同轴/同面、尺寸与公差满足要求；旋转对称连接可在其剩余自由度内选择最接近当前位置的解。对于螺纹/压配/电气插接必须附加专用检查。

**基本位姿解**：设源零件世界姿态 `T_ws`，源锚点局部变换 `C_s`；目标零件世界姿态 `T_wt`，目标锚点局部变换 `C_t`；配合偏移 `M`，希望 `T_ws × C_s = T_wt × C_t × M`，则：

```text
T_ws = T_wt × C_t × M × inverse(C_s)
```

`M` 必须在配合定义中给出（缺省单位变换）；对于面向相反的平面法线，作者工具应明确提供 180° 定向规则，不能偷偷依赖 `lookAt`。

## 6. Mate、Joint、Fastener

### 6.1 Mate（连接关系）

```ts
type Mate = {
  id: string;
  connectorAId: string;
  connectorBId: string;
  matingOffset?: Transform;      // M in §5
  jointId: string;               // one primary joint
  fastenerInstanceIds?: string[];
  requiredForInstalledState: boolean;
  initialState: "locked" | "released";
  provenance?: "cad" | "manual" | "inferred";
  verified?: boolean;
};
```

锚点连接是一条**显式图边**，允许不同装配子树交叉相连。`fastenerInstanceIds` 指向真实 `PartNode`；一个紧固件可以紧固多个 Mate，但同一紧固件状态必须在所有受影响 Mate 中一致。

### 6.2 Joint（运动约束）

```ts
type Joint =
  | { id: string; type: "fixed"; mateId: string }
  | { id: string; type: "revolute"; mateId: string; axisA: Vec3;
      limitsRad?: [number, number]; initialPositionRad?: number }
  | { id: string; type: "prismatic"; mateId: string; axisA: Vec3;
      limitsM?: [number, number]; initialPositionM?: number }
  | { id: string; type: "cylindrical"; mateId: string; axisA: Vec3;
      limitsM?: [number, number]; limitsRad?: [number, number] }
  | { id: string; type: "screw"; mateId: string; axisA: Vec3;
      pitchMPerTurn: number }
  | { id: string; type: "spherical"; mateId: string; limitsRad?: Vec3 };
```

`axisA` 是在 `connectorA` 局部坐标系中表示的单位向量。若之后引入齿轮副，应作为**关节耦合约束**（joint coupling）连接两个 revolute joints，而不是将单个齿轮对等同于普通 Mate。

关节只限制**已连接状态**下的自由度；拆卸前必须先解除对应 Mate 或满足允许的特殊释放模式。

### 6.3 Fastener（紧固件）

```ts
type Fastener = {
  instanceId: string;            // points to a PartNode
  type: "bolt" | "nut" | "screw" | "pin" | "clip" | "washer" | "other";
  securesMateIds: string[];
  removalOperationId?: string;
  installOperationId?: string;
  toolHint?: string;             // descriptive only
  expendable?: boolean;          // one-time-use / damaged on removal
};
```

`expendable=true` 时，不允许无条件将其再次安装；规划器需要 replacement part 的条件，或将该步骤标注为演示级模拟动作。所有真实维护扭矩等要求必须有外部工程来源，不能依据零件外形猜测。

## 7. 拆卸/装配操作与依赖图

### 7.1 Operation

一个 `Operation` 是带前置条件和可提交效果的**原子业务动作**；可以由多个运动片段组成。拆装 DAG 仅描述依赖关系，不等同于动画时间线。

```ts
type Predicate =
  | { type: "mate-state"; mateId: string; equals: "locked" | "released" }
  | { type: "part-state"; nodeId: string; equals: "installed" | "detached" | "placed" }
  | { type: "flag"; key: string; equals: boolean }
  | { type: "operation-committed"; operationId: string };

type OperationEffect =
  | { type: "set-mate-state"; mateId: string; value: "locked" | "released" }
  | { type: "set-part-state"; nodeId: string; value: "installed" | "detached" | "placed" }
  | { type: "set-flag"; key: string; value: boolean };

type Operation = {
  id: string;
  intent: "disassemble" | "assemble";
  kind:
    | "release-fastener" | "install-fastener"
    | "release-connector" | "lock-connector"
    | "detach-part" | "place-part"
    | "detach-subassembly" | "install-subassembly"
    | "verify";
  targetNodeId: string;
  dependsOn: string[];           // references operation IDs in the same plan
  preconditions: Predicate[];
  pathId?: string;               // required for geometry-changing actions
  effects: OperationEffect[];
  inverseOperationId?: string;   // validated inverse, not automatic time-reversal
  resourceLocks?: string[];      // parts/mates controlled exclusively
  validationLevel: "visual" | "kinematic" | "engineering-reviewed";
  notes?: string;
};
```

**同一套资产可以有不同的可选方案**（例如“整车爆炸展示”和“左前轮拆卸”）；应在操作文件里使用 `planId`、`operationIds` 和 `goalPredicates` 明确限定。条件依赖通过 `preconditions` 表达；`dependsOn` 只包含需要强制先提交的操作，不得形成环。多个独立紧固件可以并发运行，但相互冲突的锁不能并行。

### 7.2 Execution plan

```ts
type OperationPlan = {
  id: string;
  intent: "disassemble" | "assemble";
  label: string;
  operationIds: string[];
  goalPredicates: Predicate[];
  verifiedForAssetVersion: string;
};
```

规划器可以从可执行操作中建立**拓扑层**；若要求“拆除 X”但依赖不满足，则需要自动纳入其先决操作或向用户说明障碍。任何自动展开都必须遵循用户选择的计划、权限和安全上下文。

## 8. 运动路径 MotionPath

路径规范描述**几何姿态轨迹**，不是物理连接状态。运动轨迹均在固定参考坐标系中定义，并在执行时绑定到一次有效的起始姿态。

```ts
type Keyframe = {
  t: number;                     // seconds since action start, t >= 0
  transform: Transform;          // absolute pose in declared referenceFrame
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
};

type MotionPath = {
  id: string;
  targetNodeId: string;
  referenceFrame: { kind: "parent" | "assembly" | "world"; nodeId?: string };
  interpolation: "linear" | "slerp" | "keyframes" | "screw";
  keyframes: Keyframe[];         // strictly increasing t
  collisionPolicy: "required" | "advisory" | "none";
  expectedClearanceM?: number;
  authoredFrom: "cad" | "manual" | "suggested";
  reviewed: boolean;
};
```

`transform` 是所在参考系中的**绝对姿态**，不能与“位移增量”混用。若目标零件处于一个整体移动的子装配体内，执行器必须先用参考节点世界姿态转换后再渲染；路径起点应在容差内匹配当前实际姿态，否则拒绝执行或经明确的重规划流程处理。

推荐路径类别为 `linear / angular / screw / arc / multi-segment / custom`，但序列化统一使用上面的关键帧与插值策略。Screw 需要沿轴旋转+位移的耦合语义；离散关键帧近似可用于演示，但不保证螺纹几何真实通过。

## 9. 运行时状态与视图状态

**资产包是只读设计数据**；以下为独立的会话数据，不应该回写到静态源文件：

```ts
type PartStatus = "installed" | "releasing" | "detaching"
                | "detached" | "placed" | "aligning"
                | "installing" | "error";

type RuntimeState = {
  assetId: string;
  assetVersion: string;
  revision: number;             // monotonic after committed transaction
  partStatus: Record<string, PartStatus>;
  actualLocal: Record<string, Transform>;
  mateState: Record<string, "locked" | "released">;
  flags: Record<string, boolean>;
  committedOperationIds: string[];
};

type ViewState = {
  selectedNodeId?: string;
  hiddenNodeIds: string[];
  transparentNodeIds: string[];
  explodedLayoutId?: string;
  explodedProgress: number;     // [0,1] only for presentation
  animationPreviewTime?: number;
};
```

执行时状态 `releasing/detaching/aligning/installing` 代表**运行时临时阶段**，不得当作已提交物理事实。`error` 应携带可定位的失败原因；恢复时以最近已提交快照为准。

## 10. BOM、出处与可信度

BOM 必须通过 PartDefinition + PartNode 展开为实例级数量，特别是重复紧固件。建议字段：`definitionId`、`quantity`、`instanceIds`、`material`、`massKg`、`sourceRef`；若没有供应商/尺寸/质量的真实数据，保持未知，不得虚构。

`provenance.json` SHOULD 包含：

- CAD 来源、版本、许可、作者与导入时间（允许空项）。
- 模型是否为 `conceptual / measured / manufacturer-verified`。
- 每个关键连接/轨迹来源 `cad / manual / inferred` 和复核状态。
- 物理真实性免责声明以及受限制的拆装操作。
- `reviewedBy`、`reviewDate` 和签核记录（若已经审查）。

**能力等级**：

- `L1 Exploded`：只实现视图拆散。
- `L2 Component`：可交互独立组件、可回装。
- `L3 Mechanical`：连接、状态、依赖、拆解路径被验证。
- `L4 Interactive`：人工拖动、锚点吸附与机械约束检查。
  
等级是按资产能力评估的，不应仅由是否包含某个字段自动断言为 L4。

## 11. 全链路最小示例（节选）

下面是**示意片段**，展示跨文件关联，并非完整发布级资产：

```json
{
  "nodes": [
    {"id": "vehicle", "kind": "assembly", "parentId": null, "label": "Vehicle", "designLocal": {"position": [0,0,0], "rotation": [0,0,0,1]}},
    {"id": "wheel.fl", "kind": "assembly", "parentId": "vehicle", "label": "Front-left wheel", "designLocal": {"position": [-0.8,0.35,-1.2], "rotation": [0,0,0,1]}},
    {"id": "wheel.fl.rim", "kind": "part", "parentId": "wheel.fl", "definitionId": "def.rim.16", "designLocal": {"position": [0,0,0], "rotation": [0,0,0,1]}, "geometryBindings": [{"assetId":"primary","gltfNodeName":"FL_Rim"}]}
  ],
  "connectors": [
    {"id":"c.wheel.fl.rim.mount", "ownerPartId":"wheel.fl.rim", "role":"female", "kind":"bore", "frame":{"position":[0,0,0],"rotation":[0,0,0,1]}, "profile":{"diameterM":0.06}}
  ]
}
```

`c.wheel.fl.rim.mount` 还必须与外部 hub/knuckle 装配中的锚点组成 `Mate`；上例只展示其中一端。不可把“未建立 Mate”误判为已验证的可拆卸资产。

一个操作片段：

```json
{
  "id": "op.wheel.fl.detach",
  "intent": "disassemble",
  "kind": "detach-subassembly",
  "targetNodeId": "wheel.fl",
  "dependsOn": ["op.wheel.fl.release-mount"],
  "preconditions": [{"type":"mate-state","mateId":"mate.wheel.fl.hub","equals":"released"}],
  "pathId": "path.wheel.fl.out",
  "effects": [{"type":"set-part-state","nodeId":"wheel.fl.rim","value":"detached"}],
  "resourceLocks": ["wheel.fl","mate.wheel.fl.hub"],
  "validationLevel": "visual"
}
```

如果操作粒度为子装配体，执行器还须对所有子零件维护一致的安装状态；示例只列出单个效果，发布数据必须完整。

## 12. 校验规则与错误码

| 代码 | 类型 | 失败条件 |
|---|---|---|
| `MW_SCHEMA_VERSION_UNSUPPORTED` | fatal | 未支持的主版本 |
| `MW_INVALID_UNITS` | fatal | 坐标/单位声明缺失或冲突 |
| `MW_DUPLICATE_ID` | fatal | 任何实例/关系/操作 ID 重复 |
| `MW_TREE_CYCLE` | fatal | 装配层级循环 |
| `MW_ORPHAN_NODE` | fatal | 父级不存在/子树不可达 |
| `MW_GEOMETRY_UNBOUND` | fatal | 可独立拆卸零件缺少有效几何绑定 |
| `MW_CONNECTOR_BROKEN_REF` | fatal | Mate 指向无效 Connector |
| `MW_JOINT_INVALID` | fatal | 约束不匹配或轴线不合法 |
| `MW_OPERATION_CYCLE` | fatal | 操作依赖 DAG 有环 |
| `MW_OPERATION_EFFECT_CONFLICT` | fatal | 同一操作存在矛盾后置条件 |
| `MW_PATH_START_MISMATCH` | error | 起始姿态超出容差 |
| `MW_PATH_COLLISION` | error | 不允许的拆卸扫掠碰撞 |
| `MW_ASSEMBLY_ROUNDTRIP_FAILED` | error | 拆装往返后状态不一致 |
| `MW_UNREVIEWED_SOURCE` | warning | 推测数据未经工程核对 |

静态校验顺序：Manifest → 引用文件 → ID/树 → glTF 绑定 → Connector/Mate/Joint → Operation/Plan → Path → BOM → Provenance。动态校验再执行计划和回装测试。

推荐可配置默认阈值（**仅为开发测试起点，不是所有机械的制造公差**）：

- quaternion 归一化误差 `≤ 1e-5`；
- 视觉回装平移差 `≤ 1e-4 m`、姿态差 `≤ 1e-3 rad`；
- 同轴/孔径公差必须从**零件级 fitClass/clearance**读取，不能套用统一全局阈值；
- 切换爆炸视图前后：RuntimeState（除展示字段）严格保持一致。

## 13. 迁移与兼容性

新字段必须说明是否必填、默认值和与旧资产行为的关系。不得无迁移地更改 ID 意义、轴向定义、单位或连接偏移定义。若发生破坏性更改：

1. 提升 `schemaVersion` 主版本；
2. 给出 `migrate(src) -> dst` 与变更日志；
3. 包含旧实例 ID 映射；
4. 在迁移前后运行全部结构与拆装回归测试。

## 14. 实施接口和完成定义（Definition of Done）

建议首先实现框架无关接口：

```ts
interface MechanicalAssetLoader {
  load(manifestUri: string): Promise<ValidatedAsset>;
}
interface MechanicalValidator {
  validateStatic(asset: unknown): ValidationReport;
  validateDynamic(asset: ValidatedAsset, planId: string): Promise<ValidationReport>;
}
```

**Schema v0.1.0 验收条件**：

- 至少一个 fixture 通过全部静态校验；
- 对重复零件、孤立连接、装配树环、操作 DAG 环、错误单位和无效路径有负面测试；
- BOM 数量与实例展开数量一致；
- 同一资产可由 Headless Core 和 Three.js Adapter 读取，结果的业务状态一致；
- `Automotive Asset Specification` 中的参考模型与此规范兼容。

下一步参考：[Disassembly Engine](./DISASSEMBLY-ENGINE.md) 中定义的执行顺序、事务与回滚设计。
