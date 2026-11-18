# Mechanical Worlds

> 3D 机械结构、拆卸依赖、装配状态与交互式教学演示系统。

**当前版本：可运行 P0 参考实现。** 本仓库已包含 TypeScript 数据模型、确定性拆装引擎、Three.js 程序化几何演示，以及左前轮和机械眼镜两个自动化验收案例。示例几何和运动轨迹是**演示级**，并非工业 CAD 或真实维修规程。

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
4. 不满足依赖时直接点击后续步骤会被拦截。
5. 任意时刻可暂停/继续、取消当前动作、撤销/重做已提交的步骤。

### 机械眼镜

1. 左右镜片和鼻托可独立拆卸。
2. 拆卸镜腿前，必须移除对应的铰链螺钉；铰链座在镜腿拆卸之后才能取下。
3. 合成时依次恢复铰链座、镜腿及螺钉；镜片与鼻托独立复位。
4. 使用同一套 Schema / Core Operation Engine 运行，非眼镜专用动画脚本。

### 交互功能

- Three.js 鼠标旋转、缩放、点击零件；左侧零件树选中同一部件。
- 点击任意步骤可以尝试单独执行，阻断时显示原因。
- 全部拆解、全部合成、逐步执行、取消/暂停、Undo/Redo、重置。
- **爆炸视图**只更改显示位置，不改变任何机械运行状态。
- 右侧“**双案例自动拆装验收**”可以在页面里执行结构校验与往返测试。

## 技术架构

```text
packages/
├── mechanical-schema/src/index.ts    # 物理零件定义/实例、Connector、Mate、Operation 数据合同和静态验证
├── mechanical-core/src/index.ts      # Operation DAG、guards、effect、原子提交、预览、取消、undo/redo
├── mechanical-core/src/fixtures.ts   # 汽车左前轮及眼镜参考资产
└── mechanical-three/src/index.ts     # Three.js 程序化 3D 几何、部件拾取、视图变换
src/
├── main.ts                           # 浏览器交互与验收控制
└── style.css                         # 响应式界面
tests/engine.test.mjs                 # 无浏览器 headless regression
.github/workflows/
├── ci.yml                            # test + build
└── pages.yml                         # test + build + GitHub Pages 部署
```

Mechanical Core 不依赖 Three.js。编辑器/渲染器只是适配器，装配状态由 Core 独立管理。

## 架构规范

- [MECHANICAL-SCHEMA.md](docs/MECHANICAL-SCHEMA.md)：完整目标结构、坐标与连接规范。
- [DISASSEMBLY-ENGINE.md](docs/DISASSEMBLY-ENGINE.md)：真实机械级规划与状态事务设计。
- [AUTOMOTIVE-ASSET-SPEC.md](docs/AUTOMOTIVE-ASSET-SPEC.md)：首辆整车资产的扩展目标。

**实现范围说明**：此版只实现上述规范的一个可运行垂直切片。还未包括真实 CAD/STEP 导入、任意关节求解、连续碰撞检测、真实轮胎拆装工艺和整车 100+ 零件模型。物理尺寸、螺纹和精密装配需要工程数据和审查，不能从程序化几何推断。

## 下一阶段

- 用真实来源的 CAD/STEP 装配替换程序化 Demo 几何，标注孔位与轴线。
- 实现 Connector/Joints 的精确几何配合与公差校验。
- 为运动路径加入 swept collision 检测和人工确认。
- 实现机械资源可视化 Authoring Studio，建立整车分层资产。

## License

尚未选定许可证。源码及模型资产的授权需要分别明确。
