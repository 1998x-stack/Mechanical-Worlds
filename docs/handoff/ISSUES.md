# ISSUES — Mechanical Worlds

按严重程度排序。每条均含可复现步骤与证据。

---

## IS-01 · P1 · 发动机整机碰撞未验证（`NOT_VERIFIED`）

- **影响模块**: `tools/cad/audit_cad_mesh.mjs`、`src/mesh-ccd.mjs`、18 件 B-Rep 网格。
- **实际表现**: 612 对中含 **32 个 `surface-contact`** 与 **100 个 `unresolved`**，整体状态 `NOT_VERIFIED`。
- **复现**: `npm run cad:build && npm run cad:mesh-audit`。
- **预期**: 要么证明无真实干涉，要么把 `unresolved` 全部消解；不得自动放行。
- **根因**: 自适应 BVH 预算不足 + 概念缸孔/轴颈配合几何 + 部分非封闭网格；`surface-contact` 中可能含**预期**销/轴承配合。
- **状态**: 未修复（**NOT_VERIFIED**）。
- **验证证据**: `dist-cad/engine-i4/engine-i4-mesh-ccd-audit.json`；`tests-cad/collision.test.mjs` 断言不得静默放行。
- **下一步**: 见 `NEXT_ACTIONS.md` NA-02；需可信闭合网格或工程配合数据。

## IS-02 · P1 · 曲柄视觉相位与缸孔形状偏差

- **影响模块**: `tools/asset-pipeline/generate-powertrain.mjs`（batch-02 GLB）、CAD 参考。
- **实际表现**: 源 GLB 曲柄编码交替曲拐而非 1&4 / 2&3 相位分组；缸体为简化实心特征，非真实镗孔。
- **复现**: `npm run engine:audit` 输出的 `knownVisualFidelityRisks`。
- **根因**: 概念几何；缺 OEM/可信 CAD 基准。
- **状态**: **BLOCKED**（需合法可再分发 CAD）。
- **下一步**: NA-03。

## IS-03 · P2 · `vite preview` 在 base 子路径下对 `automotive.html` 触发 SPA fallback

- **影响模块**: 本地验收环境（**非**产品/Pages）。
- **实际表现**: `GITHUB_PAGES=true` 构建后，`vite preview` 下请求 `/Mechanical-Worlds/automotive.html` 返回 index.html 内容；而 `dist/automotive.html` 存在且 `curl` 直取 200，线上 Pages 亦 200。
- **复现**: `GITHUB_PAGES=true npm run build && node node_modules/vite/bin/vite.js preview`，再 `curl .../Mechanical-Worlds/automotive.html`。
- **影响**: 无法用 `vite preview` 直接验证子路径多页路由；**真实 Pages 不受影响**。
- **状态**: 规避/记录（不修产品代码）。
- **下一步**: NA-04（可选：用静态服务器或 `serve` 做子路径 e2e）。

## IS-04 · P2 · 开发工具链依赖漏洞

- **影响模块**: `vite` → `picomatch`/`fdir`/`tinyglobby`（devDependencies）。
- **实际表现**: `npm audit` 报 **4 个 high**；修复需 `vite` 降级（breaking）。
- **影响范围**: 仅开发/构建时，不进浏览器产物。
- **状态**: 未修复；记录。
- **下一步**: 跟踪上游，待非破坏性升级再处理。

## IS-05 · P1 · 仓库未选定许可证

- **影响模块**: 全仓库源码与资产。
- **实际表现**: `README.md` 明确“尚未选定许可证”。
- **影响**: 无法合法声称可再分发；第三方 CAD 接入受阻。
- **状态**: **BLOCKED**（需仓库所有者决策）。
- **下一步**: NA-05。

## IS-06 · P2 · dev/demo 验收仅在 SwiftShader 软件 WebGL 下验证

- **影响模块**: `tests-browser/*`。
- **实际表现**: 验收使用 `--use-angle=swiftshader`。
- **影响**: 未在真实 GPU/多浏览器矩阵验证；可能存在驱动相关差异。
- **状态**: 已知限制。
- **下一步**: 可选加入 Firefox/WebKit 或真实 GPU CI（成本高）。
