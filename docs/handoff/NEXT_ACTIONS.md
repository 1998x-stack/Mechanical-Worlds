# NEXT ACTIONS — Mechanical Worlds

面向下一位 Agent。每项含优先级、目标、文件、输入、建议、依赖与验收标准。

---

## NA-01 · P0 · 复现并守住本轮门禁（先做）

- **目标**: 在干净环境复现 `npm run check`、`test:browser`、`test:acceptance`、`tests-cad`。
- **文件**: 无（验证）。
- **输入**: Node 22+；Python 3.11/3.12 + `cadquery==2.8.0`。
- **步骤**:
  ```
  npm install
  python -m pip install cadquery==2.8.0
  npm run assets:cad-stage && npm run build
  npm run check
  npm run test:browser && npm run test:acceptance
  npm run cad:build && node --test tests-cad/*.test.mjs
  ```
- **验收**: `check` 退出码 0；`test:acceptance` checks=20 PASS；`tests-cad` 5 pass。

## NA-02 · P1 · 消解碰撞 `unresolved` 并分类预期接触

- **目标**: 对 612 对逐一分类：预期配合（提供 Mate 依据）/ 真实干涉 / 仍无法判定。
- **文件**: `tools/cad/audit_cad_mesh.mjs`、`src/mesh-ccd.mjs`、`tools/cad/generate_engine_reference.py`。
- **输入**: `engine-i4-mesh-ccd-audit.json`、`engine-i4-kinematics-contract.json` 的 Mates。
- **建议**: 提高自适应预算并把“因预算不足”的 `unresolved` 与“几何重叠”的 `surface-contact` 分开计数；对预期配合必须引用明确 Mate/尺寸证据，禁止静默白名单。
- **依赖**: 无。
- **验收**: `unresolved` 下降且每项有依据；`NOT_VERIFIED` 仅在确有未决项时保留；新增针对真实发现的干涉回归。
- **完成标准**: 输出按零件对/时间区间/方法/阈值可复核的报告。

## NA-03 · P1 · 用可信 CAD 替换概念曲柄/缸孔（BLOCKED 输入）

- **目标**: 让曲柄相位与真实缸孔几何可信。
- **文件**: `tools/cad/generate_engine_reference.py`、`tools/asset-pipeline/generate-powertrain.mjs`、catalog。
- **输入**: 合法可再分发、带尺寸/PMI 的 CAD（STEP/AP242）；许可证与来源 URL。
- **依赖**: IS-05（许可证）。
- **验收**: 几何标签从 `parametric-brep-unreviewed` 提升到 `cad-reviewed` 前必须有人工工程复核记录。
- **完成标准**: 来源、单位、基准坐标、许可全部可追溯。

## NA-04 · P2 · 子路径多页部署 e2e（规避 `vite preview` 怪癖）

- **目标**: 在真实 base 子路径下验证 `index.html` 与 `automotive.html` 均正确（非 SPA fallback）。
- **文件**: `tests-browser/*`（可新增脚本）。
- **建议**: 使用静态文件服务器（如 `npx serve dist` 于 `/Mechanical-Worlds`）或 `python -m http.server`，而非 `vite preview`。
- **验收**: 两页分别返回各自 HTML、各自的 hashed JS 均 200、无 404。

## NA-05 · P1 · 选定许可证

- **目标**: 为源码与资产分别明确许可。
- **文件**: `README.md`、`LICENSE`。
- **输入**: 仓库所有者决策。
- **依赖**: 无。
- **验收**: 无歧义的再分发条款。
