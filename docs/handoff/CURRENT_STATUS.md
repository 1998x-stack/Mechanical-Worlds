# CURRENT STATUS — Mechanical Worlds

> 本文件是新 Agent 的第一入口。所有结论以当前代码与 `TEST_MATRIX.md` 的实测结果为准。
> 历史见 `WORKLOG.md`，问题见 `ISSUES.md`，下一步见 `NEXT_ACTIONS.md`，机器可读见 `manifest.json`。

## 仓库与构建基线

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/1998x-stack/Mechanical-Worlds |
| 分支 | `agent/pi/handoff-and-browser-acceptance` |
| `main` 基线 | `bb74622cdc9327eab82b409f37bd3e56ce1eb521`（未改动） |
| 本轮起始 SHA | `c843033b5d0e7bd27f06cc35d0fcd8b92fe75180`（第一轮 HEAD） |
| 本轮结果 SHA | 见 `manifest.json` 的 `resultCommit` |
| 远端/PR | 见 `manifest.json` 的 `deployment`/`pullRequest` |

## 环境（本轮实测）

```
Node:    v26.13.1 (主) 与 v22.23.5 (brew node@22，CI 目标) 均通过
         v24 本机二进制损坏（缺 simdjson dylib，与本仓库无关）→ 未测
npm:     11.20.0 / 10.9.9(node22)
Python:  3.12.15 (.venv) 与 3.11.18 → 均 cadquery 2.8.0 / OCP 7.9.3.1.1
Browser: Playwright Chromium (headless, SwiftShader WebGL)
```

## 当前实际运行状态

- `npm run check`（Node 22 与 Node 26）：**退出码 0**。
- **Node 测试 63 / pass 63 / fail 0**；skills 12 canonical / 144 mirrored。
- 两批 GLB：batch-01 **76** + batch-02 **30** = **106 generated**；目录 317 parts（211 planned）+ 42 assemblies。
- CAD：18 件 B-Rep；GLB 400452 B；**STEP/GLB 字节可复现**，且 **Python 3.11 vs 3.12 逐字节一致**。
- 真实 Chromium：`test:browser` PASS、`test:acceptance` **20 检查** PASS、`test:pages-base` PASS。
- `tests-cad`：**7 pass**。

## 本轮关键改动：连续碰撞审查改为“真实姿态”

**根因**：`audit_cad_mesh.mjs` 把区间两端的姿态交给 `mesh-ccd.check()`，而后者对**端点做线性/SLERP 插值**。曲柄机构（连杆/活塞/销/环）的真实位姿是曲轴角的**非线性**函数，端点弦可以“安全”而真实运动中途接触 → 可能误报 `surface-clear`。外层 broadphase 同样只按端点运动量扩张，也不可靠。

**修复**：
1. `src/mesh-ccd.mjs` 新增 `checkTrajectory(getPoseA, getPoseB, {start,end,speedA,speedB,...})`：在区间中点查询**真实** `poseAt(theta)`，并用刚体点速度上界 `speed*(end-start)/2` 给出整段下界；只有下界 > margin 才 `surface-clear`，否则细分，预算耗尽 `unresolved`。`check()` 保留但明确标注仅适用于线性弦路径。
2. `packages/mechanical-core/src/engine-i4.ts` 新增 `engineI4SpeedBounds()`：给出各运动零件对曲轴角的**解析速度上界**（m/rad 平移 与 rad/rad 旋转），乘以 `meshMotionRadius` 得面点速度。
3. `tools/cad/audit_cad_mesh.mjs`：改用 `checkTrajectory` + 基于真实姿态的分片 swept AABB（每 5°），并按“是否有已声明 Mate”分类接触。

**720° 实测结果（`--step-deg=180`，612 对）**：`broadphase-clear 400 / surface-clear 148 / surface-contact 32 / unresolved 32`，其中 **32 接触 + 32 未判定全部是已声明 Mate 的设计接口**（曲柄↔连杆、活塞↔活塞环、销↔活塞/连杆），无“无 Mate 的未审查接触”，无“纯数值未判定”。默认求解预算 `--max-evals=256 --max-depth=18`（本机约 4 分钟）；预算降到 128 会给 16 个块↔活塞环对增加“数值未判定”（诚实但保守）。**整机碰撞仍为 NOT_VERIFIED**（三角形面距离不能证明实体不包含；尺寸非制造商提供）。

## 可运行入口

```bash
npm install
python -m pip install cadquery==2.8.0
npm run assets:cad-stage && npm run build
npm run check                 # skills + assets + 63 tests + build
npm run cad:build             # 18 件 B-Rep STEP + GLB
npm run cad:mesh-audit        # 真实姿态 720° 连续网格审查
node --test tests-cad/*.test.mjs
npm run test:browser          # 106 GLB + 18 CAD smoke
npm run test:acceptance       # 20 项端到端
npm run test:pages-base       # Pages base 子路径静态托管
```

## 几何 / CAD / 碰撞置信度

| 维度 | 级别 |
|---|---|
| 106 GLB 零件 | `generated`（程序生成概念几何） |
| 18 件 CadQuery 实体 | `parametric-brep-unreviewed`（项目自创，非 OEM） |
| `cad-reviewed` / `manufacturing-validated` | ❌ 未达成 |
| 整机碰撞 | `NOT_VERIFIED` |
| CCD 轨迹假设 | 真实解析 `poseAt(theta)`；认证区间用解析点速度上界 |
| 跨缸 X 分离下界 | 0.049 m（仅 16 件跨缸零件轴向投影） |

不得据此推断制造公差、维修安全或 OEM 认证。
