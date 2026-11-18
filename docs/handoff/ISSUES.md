# ISSUES — Mechanical Worlds

按严重程度排序。每条含可复现步骤与证据。

---

## IS-01 · P1 · 发动机整机碰撞未验证（`NOT_VERIFIED`），且此前算法存在端点插值缺陷（已修）

- **影响模块**: `tools/cad/audit_cad_mesh.mjs`、`src/mesh-ccd.mjs`、`packages/mechanical-core/src/engine-i4.ts`。
- **已修缺陷（第二轮）**: 旧流程把区间端点姿态交给对端点做线性/SLERP 插值的 `check()`；曲柄机构为非线性，端点弦可能“安全”而真实路径接触 → 可误报 `surface-clear`。外层 broadphase 亦按端点运动量扩张，同样不可靠。
  - **复现反例**: `tests/mesh-ccd.test.mjs` 的闭合回环 `B(t)=(sin2πt,1−cos2πt)`（端点相同、中途穿越障碍）。旧 `check()` → `surface-clear`（错误）；`checkTrajectory` → `surface-contact`。
- **当前实现**: 真实 `poseAt(theta)` 采样 + 解析点速度上界（`engineI4SpeedBounds × meshMotionRadius`）认证；预算耗尽回退 `unresolved`；外层为每 5° 片的真实姿态 swept AABB。
- **本轮结果（612 对）**: `surface-contact 32` + `unresolved 32`；分类为 `design-fit-candidate 32` + `design-fit-unresolved 32`，`unreviewed-contact 0`、`numerical-unresolved 0`。全部非 clear 对均有已声明 Mate。
- **为何仍 NOT_VERIFIED**: 三角形面距离无法证明实体不包含；B-Rep 尺寸为项目自创参数；未建模的齿轮/垫片/壳体不在 18 件内；设计接口是否在预期配合内需工程判定。
- **复现**: `npm run cad:build && npm run cad:mesh-audit`。
- **状态**: 算法缺陷 **DONE**；碰撞合格性 **NOT_VERIFIED**。
- **证据**: `dist-cad/engine-i4/engine-i4-mesh-ccd-audit.json`、`tests-cad/collision.test.mjs`、`tests/mesh-ccd.test.mjs`。
- **下一步**: NA-02。

## IS-02 · P1 · 曲柄视觉相位与缸孔形状偏差

- **影响模块**: `tools/asset-pipeline/generate-powertrain.mjs`（batch-02 GLB）、CAD 参考。
- **实际表现**: 源 GLB 曲柄编码交替曲拐而非 1&4 / 2&3 相位分组；缸体为简化实心特征，非真实镗孔。
- **复现**: `npm run engine:audit` 的 `knownVisualFidelityRisks`。
- **根因**: 概念几何；缺可信 CAD。
- **状态**: **BLOCKED**（需合法可再分发 CAD）。
- **下一步**: NA-03。

## IS-03 · P2 · `vite preview` 在 base 子路径下对 `automotive.html` 触发 SPA fallback

- **影响模块**: 本地测试环境（**非**产品/Pages）。
- **现状**: 已用 `tests-browser/pages-base.mjs`（内置静态服务器 + `GITHUB_PAGES=true` 构建）绕开；真实 Pages 与静态托管均 200。
- **状态**: 规避并回归覆盖。
- **下一步**: 无（保留测试）。

## IS-04 · P2 · 开发工具链依赖漏洞

- **影响模块**: `vite` → `picomatch`/`fdir`/`tinyglobby`（devDependencies）。
- **实际表现**: `npm audit` 报 4 high；修复需 vite 降级（breaking）。
- **影响范围**: 仅开发/构建，不进浏览器产物。
- **状态**: 未修复；记录。
- **下一步**: 跟踪上游。

## IS-05 · P1 · 仓库未选定许可证

- **影响模块**: 全仓库源码与资产。
- **状态**: **BLOCKED**（需仓库所有者决策）。
- **下一步**: NA-05。

## IS-06 · P2 · 浏览器验收仅在软件 WebGL（SwiftShader）下验证

- **影响模块**: `tests-browser/*`。
- **状态**: 已知限制。
- **下一步**: 可选真实 GPU / 多浏览器矩阵。

## IS-07 · P2 · Node 24 本机二进制损坏（环境，非仓库）

- **实际表现**: `brew --prefix node@24` 的 node 启动即崩溃：缺 `/opt/homebrew/opt/simdjson/lib/libsimdjson.34.dylib`。
- **影响**: 无法在本机验证 Node 24；CI 使用 Node 22，已通过。
- **状态**: 环境问题，非仓库缺陷。

## IS-08 · P3 · CI / Pages 未在本提交验证

- **实际表现**: 本轮提交未推送，故 `ci.yml`、`cad-reference.yml`、`browser-smoke.yml`、`pages.yml` 未触发。
- **状态**: **NOT_VERIFIED**（推送后需核对）。
- **下一步**: NA-01/NA-06。
