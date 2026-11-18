# Mechanical Worlds

> 3D 机械结构、拆卸依赖、装配状态与交互式教学演示系统。

**当前版本：P1 交互引擎 + 106 个汽车 GLB 零件 + 四轮制动拆装 + 720° 四缸发动机闭环运动与拆装流程。** 本仓库已包含 TypeScript 数据模型、确定性拆装引擎、Three.js 程序化几何演示，以及左前轮和机械眼镜两个自动化验收案例。示例几何和运动轨迹是**演示级**，并非工业 CAD 或真实维修规程。

**P1 新增**：局部锚点与世界坐标对齐、Mate 配合校验、眼镜左右镜腿 Revolute 铰链和限位、螺钉分段轴向旋出/旋入、采样式 AABB 碰撞代理预检，以及可搜索的整车结构目录。新增同时加载 76 件车身/底盘与 30 件动力系统零件的 GLB 资产页面，并提供四个车轮角总成、发动机曲轴驱动和独立的发动机拆装流程（均为概念级软件验收）。

## 快速运行

要求 Node.js 22+。

```bash
git clone https://github.com/1998x-stack/Mechanical-Worlds.git
cd Mechanical-Worlds
npm install
npm run dev
```

打开终端显示的本地 Vite 地址（通常为 http://localhost:5173）。

构建与测试：

```bash
npm run skills:check # 检查 12 项 Agent Skills 在各目录中完全一致
npm run assets:validate # 两批 GLB 二进制、节点与目录状态校验
npm run assets:contracts # 导出四轮 GLB 绑定的锚点、Mate、路径和 DAG JSON（概念级）
npm run assets:build  # 从参数化程序源重生成汽车 GLB
npm run engine:audit  # 720° 连杆闭环 + 26步拆装/回装 QA
npm run engine:clearance # 从实际GLB顶点证明16个跨缸零件的X轴分离下界
npm run test         # 编译 schema/core；执行 Node.js 自动测试
npm run build        # TypeScript Web 类型检查 + Vite 发布产物
npm run check        # 测试和构建
npm run preview      # 预览 production 构建
```

[机械拆装演示](https://1998x-stack.github.io/Mechanical-Worlds/) · [汽车 GLB + 四缸运动学演示](https://1998x-stack.github.io/Mechanical-Worlds/automotive.html)。首页验证轮组与眼镜；汽车页可检查真实 GLB，并执行四轮角及 I4 发动机的概念机械操作。

## 两个可运行的验收案例

### 汽车左前轮

1. 点击**全部拆解**：逐颗拆下 5 颗轮毂螺母；全部解除后再释放轮毂 Mate；车轮的轮辋、轮胎、气门嘴一起沿轴向移走。
2. 制动盘、制动卡钳及底盘侧轮毂保持原位。
3. 点击**全部合成**：车轮复位，五颗螺母逐一回装，最后锁定轮毂 Mate。
4. 锚点不匹配会阻止关键 Mate 锁定；简化的 required 碰撞检查也会阻止指定运动轨迹。
5. 螺母优先沿轴向旋出，再移至零件托盘；安装时先靠近安装位再旋入。
6. 不满足依赖时直接点击后续步骤会被拦截。
7. 任意时刻可暂停/继续、取消当前动作、撤销/重做已提交的步骤。

### 机械眼镜

1. 左右镜片和鼻托可独立拆卸。
2. 拆卸镜腿前，必须移除对应的铰链螺钉；铰链座在镜腿拆卸之后才能取下。
3. 合成时依次恢复铰链座、镜腿及螺钉；镜片与鼻托独立复位。
4. 镜腿能够通过“打开左右镜腿/闭合左右镜腿”控制按限位绕铰链旋转。未闭合时不能直接拆相应铰链螺钉。
5. 使用同一套 Schema / Core Operation Engine 运行，非眼镜专用动画脚本。

### 四缸发动机 · I4 滑块曲柄系统

1. 汽车资产页的“聚焦发动机”“剖视发动机”显示内部零件和数学约束轴心线；这些中心线不是额外的 CAD 实体。
2. 拖动 0–720° 曲轴角度或者点击连续旋转，四个活塞、连杆、销与环共享同一个解析解；凸轮轴以曲轴角速度的一半转动。
3. 运行“发动机拆卸”和“重新装配”分别执行 26 个依赖操作；曲轴未归零或轴系未连接时，Core 会阻止不允许的动作。
4. 数学闭环在 721 个角度样本上校验，连续跨缸 X 轴间隔证明使用 16 个源 GLB 零件的实际顶点范围。它只保证指定跨缸零件对在正常转动状态下不接触，不保证发动机整体没有干涉。

参见 [完整发动机实现与已知 CAD 偏差](docs/ENGINE-I4-KINEMATICS.md)。目前源 GLB 曲轴轮廓与目标相位存在差异、缸体也不是真实镗孔实体；需要可信 CAD/STEP 来实现工程级形状与配合校验。

### 交互功能

- Three.js 鼠标旋转、缩放、点击零件；左侧零件树选中同一部件。
- 点击任意步骤可以尝试单独执行，阻断时显示原因。
- 全部拆解、全部合成、逐步执行、取消/暂停、Undo/Redo、重置。
- **爆炸视图**只更改显示位置，不改变任何机械运行状态。
- 右侧“**双案例自动拆装验收**”可以在页面里执行结构校验与往返测试。
- 左侧“**整车零件目录**”提供六大系统的文本搜索和筛选，目录包含 317 个拟建模零件及 42 个装配节点。其中 **106 个已生成真实 GLB 几何**，其余 **211 个尚未建模**；所有 317 个条目均未经 OEM 制造精度验证。

## 技术架构

```text
packages/
├── mechanical-schema/src/index.ts    # 物理零件定义/实例、Connector、Mate、Operation 数据合同和静态验证
├── mechanical-core/src/index.ts      # Operation DAG、guards、effect、原子提交、预览、取消、undo/redo
├── mechanical-core/src/p1.ts         # Anchor/Mate、Revolute pose、swept sample、screw interpolation
├── mechanical-core/src/fixtures.ts   # 汽车左前轮及眼镜 P0 操作图
├── mechanical-core/src/p1-fixtures.ts # P1 连接、关节、运动与碰撞代理
└── mechanical-three/src/index.ts     # Three.js 程序化 3D 几何、部件拾取、视图变换
src/
├── main.ts                           # 浏览器交互与验收控制
└── style.css                         # 响应式界面
assets/catalog/automotive-fwd-i4-001.json  # 6 系统、317 Part；106 generated / 211 planned
assets/generated/automotive/fwd-i4-batch-01.glb  # 76-Part binary glTF 2.0
assets/generated/automotive/fwd-i4-batch-02.glb  # 30-Part 四缸发动机与差速器 GLB
assets/generated/automotive/manifest.json  # 几何节点、Git 内容哈希、材料与版本
src/automotive.ts                     # GLTFLoader + I4闭环运动/四角拆装 + 部件拾取
packages/mechanical-core/src/engine-i4.ts  # 4缸解析运动学 + 52操作拆装图
packages/mechanical-core/src/engine-clearance.ts # 跨缸X投影分离证明
tools/asset-pipeline/audit-engine-i4.mjs    # 运动学与拆装 QA
tools/asset-pipeline/audit-engine-clearance.mjs # 实际GLB顶点间隔审查
tools/asset-pipeline/                 # 可重生成的 GLB source / 验证 / Pages staging
.agents/skills/                       # 12 项 canonical Agent Skills；mirrored to .codex/.claude/.pi
tests/engine.test.mjs                 # 无浏览器 headless regression
tests/p1.test.mjs                     # P1 锚点、铰链、螺纹、碰撞
tests/catalog.test.mjs                # 317 个物理零件及两批状态审查
tests/generated-corners.test.mjs      # 4 角车轮/制动往返拆装测试
tests/contracts.test.mjs              # 可审核的机械连接数据导出
tests/engine-i4.test.mjs              # 720°运动闭环/拆装负向验收
tests/engine-audit.test.mjs           # 运动学审计报告
tests/engine-clearance.test.mjs       # 真实GLB 16件轴向分离验收
.github/workflows/
├── ci.yml                            # test + build
└── pages.yml                         # test + build + GitHub Pages 部署
```

Mechanical Core 不依赖 Three.js。编辑器/渲染器只是适配器，装配状态由 Core 独立管理。

## 架构规范

- [MECHANICAL-SCHEMA.md](docs/MECHANICAL-SCHEMA.md)：完整目标结构、坐标与连接规范。
- [DISASSEMBLY-ENGINE.md](docs/DISASSEMBLY-ENGINE.md)：真实机械级规划与状态事务设计。
- [AUTOMOTIVE-ASSET-SPEC.md](docs/AUTOMOTIVE-ASSET-SPEC.md)：首辆整车资产的扩展目标。
- [P1-ASSEMBLY-IMPLEMENTATION.md](docs/P1-ASSEMBLY-IMPLEMENTATION.md)：**已落地的 P1 功能**和准确性边界。
- [SKILLS-ARCHITECTURE.md](docs/SKILLS-ARCHITECTURE.md)：跨 Codex/Pi/Claude 的 12 项 Skill 和扩展策略。
- [AUTOMOTIVE-BATCH-01.md](docs/AUTOMOTIVE-BATCH-01.md)：首批 76 个 GLB 零件。
- [AUTOMOTIVE-BATCH-02.md](docs/AUTOMOTIVE-BATCH-02.md)：新增 30 个四缸动力系统 GLB 零件。
- [FOUR-CORNER-CONSTRAINTS.md](docs/FOUR-CORNER-CONSTRAINTS.md)：四轮及制动组件的 GLB 连接、依赖和拆装质量验收。
- [ENGINE-I4-KINEMATICS.md](docs/ENGINE-I4-KINEMATICS.md)：四缸解析运动学、装配连接、拆装 DAG、源码偏差和可验证限界。

**实现范围说明**：106 个已生成可浏览 GLB 零件，其中四轮角总成和四缸发动机已有可执行的概念级机械逻辑，其它部件大多仍是展示几何。这不是完整汽车装配 CAD 库。当前轮组使用离散 AABB 碰撞预检；发动机新增的跨气缸 X 轴间隔证明仅排除特定零件对的接触，不等于完整连续网格碰撞。源发动机曲轴相位形状与缸孔仍有已知偏差，不能据此推断制造公差、维修安全或 OEM 性能。

## 下一阶段

- 用真实来源的 CAD/STEP 装配替换程序化 Demo 几何，标注孔位与轴线。
- 在已有示例连接锚点基础上补齐六自由度拖拽、真实连接约束和制造公差。
- 将离散采样 AABB 预检升级为连续 swept volume / BVH，并允许人工复核。
- 实现机械资源可视化 Authoring Studio，建立整车分层资产。

## License

尚未选定许可证。源码及模型资产的授权需要分别明确。

## 工程数据接入声明

本项目内部汽车前方定义为 `-Z`、车辆右侧为 `+X`，与 glTF 标准的资产前方 `+Z` 并不相同；从外部 CAD / glTF 导入时必须明确记录相应坐标基变换。运行单位为米，角度为弧度。参考 [Khronos glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)。

真正实现 CAD 精度升级，需要带有合法再分发许可的 CAD 源数据、设计尺寸/PMI、装配关系和人工工程审核。现有 106 个 GLB 零件均属程序生成概念几何，没有可宣称的车型制造标准。未来的 STEP/AP242 接入需要保留零件名、装配层级、颜色与形位公差来源；新增的 `cad-source-ingestion` Skill 为此定义验收标准，但尚未实现生产级 STEP 导入器。
