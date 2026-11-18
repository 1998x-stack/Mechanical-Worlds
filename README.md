# Mechanical Worlds

> 面向汽车、发动机、机器人和工业设备的交互式 3D 机械拆解与装配平台。  
> **Mechanical Worlds — An interactive mechanical disassembly and assembly platform.**

## 项目愿景

让用户能够探索整机、逐层拆解组件、检查零件及其连接关系，并按照受约束的操作顺序重新装配。系统以**机械结构和装配关系数据**为核心，而不是仅把 Mesh 向外移动的爆炸视图。

**当前阶段：架构与资产规范设计（Design Specification，尚非可运行产品）**。本仓库的文档描述目标接口和验收规则，不代表引擎、汽车资产或碰撞算法已经实现或验证。

## 核心能力

- **Assembly hierarchy**：整机 → 子系统 → 子装配体 → 物理零件实例。
- **Connector & joints**：连接锚点、紧固件、固定/旋转/滑动等约束。
- **Operation DAG**：拆卸前置条件、条件动作、并行步骤与安全约束。
- **Deterministic runtime**：执行、暂停、重试、回滚、事件记录和状态重放。
- **Motion planning**：预标注轨迹优先，简化碰撞检测与人工复核。
- **Exploded view**：只更改展示变换，不更改真实装配状态。
- **Assembly validation**：锚点对齐、几何公差、约束与回归测试。
- **Asset authoring**：由 CAD/STEP → 拆分零件 → GLB → 机械元数据 → 质量审核。

## Architecture specifications

| 文档 | 内容 | 角色 |
|---|---|---|
| [MECHANICAL-SCHEMA.md](docs/MECHANICAL-SCHEMA.md) | 资产包、坐标/单位、装配树、零件、锚点、关节、紧固件、操作、轨迹、状态与验证 | 数据契约 |
| [DISASSEMBLY-ENGINE.md](docs/DISASSEMBLY-ENGINE.md) | 运行时模块、依赖规划、状态机、事务执行、路径/碰撞检测、动画、撤销及测试 | 引擎契约 |
| [AUTOMOTIVE-ASSET-SPEC.md](docs/AUTOMOTIVE-ASSET-SPEC.md) | 一辆前置发动机、前轮驱动乘用车的部件结构、拆装用例、锚点、BOM 及验收 | 首个参考资产 |

建议按 **Schema → Engine → Automotive reference asset** 的顺序阅读和实施。

## Architecture at a glance

```text
Authoring Studio / CLI
  CAD/STEP, GLB import → part segmentation → assembly/connector authoring
                              ↓
Asset Package: manifest + geometry.glb + mechanical JSON
                              ↓
Mechanical Core (framework-agnostic, no Three.js dependency)
  Assembly Graph + Connector/Joint Graph + Operation Planner + State Store
                              ↓
Runtime Adapter (Three.js): selection + transforms + animations + visualization
                              ↓
Validator: structural checks + route checks + disassemble/reassemble round trip
```

## 工程原则

1. **单一事实来源**：一个独立物理零件拥有稳定的实例 ID；多个可渲染 Mesh 可归属于同一个实例；四个车轮可以共享一个零件定义。
2. **装配状态与展示状态分离**：爆炸视图不是“已拆卸”。
3. **操作是可校验的状态变换**：满足前置条件、释放约束、沿合法路径移动、提交后置条件。
4. **可恢复**：在每个提交点生成事件和快照，失败时不留下半装配状态。
5. **安全不等于渲染正确**：高保真机械拆装需 CAD/装配规程和工程复核；网页演示不得替代实际车辆维修指引。

## 里程碑

| 阶段 | 交付 |
|---|---|
| P0 | 数据契约、装配树、零件选择、确定性操作调度、手工标注轨迹、爆炸/拆装往返测试 |
| P1 | 锚点吸附、关节约束、依赖 DAG、几何碰撞验证、Authoring Studio |
| P2 | CAD 批量接入、参考资产库、自动报告、协作审核 |
| P3 | AI 辅助结构推断和轨迹建议（必须人审） |

## 参与开发

提案及数据结构变更应首先更新对应规范，包含版本迁移说明、可验证实例、反例和验收测试。新的机械资产必须满足 [Automotive Asset Specification](docs/AUTOMOTIVE-ASSET-SPEC.md) 所体现的资产质量规则，非汽车资产可采用同样数据合同。

## License

尚未选定许可证。请在公开复用源码或资产前明确代码、CAD 源文件、材质纹理及第三方资源的许可。
