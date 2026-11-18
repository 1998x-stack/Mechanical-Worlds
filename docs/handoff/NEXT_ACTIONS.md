# NEXT ACTIONS — Mechanical Worlds

面向下一位 Agent。每项含优先级、目标、文件、输入、建议、依赖与验收标准。

---

## NA-01 · P0 · 复现门禁（先做）

- **目标**: 在干净环境复现本轮全部结果。
- **输入**: Node 22（或 26）；Python 3.11/3.12 + `cadquery==2.8.0`。
- **步骤**:
  ```
  npm install
  python -m pip install cadquery==2.8.0
  npm run assets:cad-stage && npm run build
  npm run check                                  # 期望 63 tests / exit 0
  npm run cad:build && npm run cad:mesh-audit    # NOT_VERIFIED
  node --test tests-cad/*.test.mjs               # 7 pass
  npm run test:browser && npm run test:acceptance && npm run test:pages-base
  ```
- **验收**: 以上全部符合 `TEST_MATRIX.md` 的当前值。

## NA-02 · P1 · 判定设计接口接触：预期配合 vs 真实干涉

- **目标**: 对 64 个非 clear 对（32 `design-fit-candidate` + 32 `design-fit-unresolved`）逐一裁定：预期配合（给出尺寸/公差依据）还是真实干涉。
- **文件**: `tools/cad/audit_cad_mesh.mjs`、`packages/mechanical-core/src/engine-i4.ts`、`tools/cad/generate_engine_reference.py`。
- **输入**: `engine-i4-mesh-ccd-audit.json`、`engine-i4-kinematics-contract.json` 的 Mate 与名义尺寸。
- **建议**:
  - 为销/活塞孔、销/连杆小头、活塞环/活塞提供**名义间隙**并据此把“可能有配合”与“重叠”分开；重叠必须作为真实干涉报告。
  - 目前 `unresolved` 全部为销联接（三角形面距离 ~0，接近贴合）→ 用**解析间隙**或平面/圆柱距离判定，而非无限细分。
  - 禁止用忽略名单提升通过率；`resolved-clear` 必须来自可复核的下界。
- **依赖**: 无。
- **验收**: 每个非 clear 对有明确裁定与依据；`unreviewed-contact`/`numerical-unresolved` 有解释；仍未有依据者保持 `NOT_VERIFIED`。

## NA-03 · P1 · 可信 CAD 替换（BLOCKED 输入）

- **目标**: 用合法可再分发的 CAD（STEP/AP242，含尺寸/PMI）替换概念曲柄/缸孔。
- **文件**: `tools/cad/generate_engine_reference.py`、`tools/asset-pipeline/generate-powertrain.mjs`、catalog。
- **输入**: 来源 URL、版本、许可证；单位与基准坐标；装配层级。
- **依赖**: IS-05（许可证）。
- **验收**: 提升 `cad-reviewed` 前必须有人工工程复核记录；来源/单位/许可可追溯。

## NA-04 · P2 · 碰撞审查性能与分辨率

- **目标**: 当前 `--step-deg=180` + 每 5° 分片运行约 100 s；评估更细步长（如 60°/30°）对 `unresolved` 的影响与成本。
- **文件**: `tools/cad/audit_cad_mesh.mjs`。
- **建议**: 记录不同 `--step-deg`/`--max-evals` 的结果矩阵，选择既不误报也非无限细分的设置。
- **验收**: 报告不同设置下 counts 与耗时；结论稳定。

## NA-05 · P1 · 选定许可证

- **文件**: `README.md`、`LICENSE`。
- **依赖**: 仓库所有者决策。
- **验收**: 无歧义的再分发条款。

## NA-06 · P0 · 推送后核对 CI 与 Pages

- **目标**: 工作分支推送/合并后，确认 `ci.yml`、`cad-reference.yml`、`browser-smoke.yml`、`pages.yml` 全绿，并核对线上 106 GLB、18 CAD、STEP 下载与 `automotive.html`。
- **验收**: 记录各 workflow run URL 与 Pages 落地结果到 `TEST_MATRIX.md`。
