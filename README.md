# Mechanical Worlds

> 3D 机械结构、拆卸依赖、装配状态与交互式教学演示系统。

**当前版本：P1 机械交互垂直切片（演示级）。** 本仓库已包含 TypeScript 数据模型、确定性拆装引擎、Three.js 程序化几何演示，以及左前轮和机械眼镜两个自动化验收案例。示例几何和运动轨迹是**演示级**，并非工业 CAD 或真实维修规程。

**P1 新增**：局部锚点与世界坐标对齐、Mate 配合校验、眼镜左右镜腿 Revolute 铰链和限位、螺钉分段轴向旋出/旋入、采样式 AABB 碰撞代理预检，以及可搜索的整车结构目录。

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
npm run test         # 编译 schema/core；执行 Node.js 自动测试
npm run build        # TypeScript Web 类型检查 + Vite 发布产物
npm run check        # 测试和构建
npm run preview      # 预览 production 构建
```

[GitHub Pages Demo](https://1998x-stack.github.io/Mechanical-Worlds/) —— 需要仓库 Settings → Pages 将 Source 设置为 **GitHub Actions**，且 Pages 工作流部署成功后才可访问。

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

### 交互功能

- Three.js 鼠标旋转、缩放、点击零件；左侧零件树选中同一部件。
- 点击任意步骤可以尝试单独执行，阻断时显示原因。
- 全部拆解、全部合成、逐步执行、取消/暂停、Undo/Redo、重置。
- **爆炸视图**只更改显示位置，不改变任何机械运行状态。
- 右侧“**双案例自动拆装验收**”可以在页面里执行结构校验与往返测试。
- 左侧“**整车零件目录**”提供六大系统的文本搜索和筛选，目录包含 317 个拟建模零件及 42 个装配节点。**这些目录条目不是已建成的 3D 模型。**

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
assets/catalog/automotive-fwd-i4-001.json  # 6 系统、317 Part 的规划目录
tests/engine.test.mjs                 # 无浏览器 headless regression
tests/p1.test.mjs                     # P1 锚点、铰链、螺纹、碰撞
tests/catalog.test.mjs                # 完整汽车目录结构审查
.github/workflows/
├── ci.yml                            # test + build
└── pages.yml                         # test + build + GitHub Pages 部署
```

Mechanical Core 不依赖 Three.js。编辑器/渲染器只是适配器，装配状态由 Core 独立管理。

## 架构规范

- [MECHANICAL-SCHEMA.md](docs/MECHANICAL-SCHEMA.md)：完整目标结构、坐标与连接规范。
- [DISASSEMBLY-ENGINE.md](docs/DISASSEMBLY-ENGINE.md)：真实机械级规划与状态事务设计。
- [AUTOMOTIVE-ASSET-SPEC.md](docs/AUTOMOTIVE-ASSET-SPEC.md)：首辆整车资产的扩展目标。
- [P1-ASSEMBLY-IMPLEMENTATION.md](docs/P1-ASSEMBLY-IMPLEMENTATION.md)：**本次已落地功能**、数学与碰撞边界、测试及 CAD 生产计划。

**实现范围说明**：此版为 P1 的一部分，不包含真实 CAD/STEP 导入、任意关节求解、连续碰撞检测、真实轮胎拆装工艺或已完成的整车 100+ 高精度 Mesh。当前碰撞为 AABB 采样演示，不能用于机械安全认证。物理尺寸、螺纹和精密装配需要工程数据和审查，不能从程序化几何推断。

## 下一阶段

- 用真实来源的 CAD/STEP 装配替换程序化 Demo 几何，标注孔位与轴线。
- 在已有示例连接锚点基础上补齐六自由度拖拽、真实连接约束和制造公差。
- 将离散采样 AABB 预检升级为连续 swept volume / BVH，并允许人工复核。
- 实现机械资源可视化 Authoring Studio，建立整车分层资产。

## License

尚未选定许可证。源码及模型资产的授权需要分别明确。
