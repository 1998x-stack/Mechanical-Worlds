# WORKLOG — Mechanical Worlds

追加式记录，不覆盖历史。

---

## 2026-11-18 · Agent: Pi (Principal Mechanical SW / CAD / Three.js / QA)

**起始 Git SHA**: `bb74622cdc9327eab82b409f37bd3e56ce1eb521`（`main`，工作区 clean）
**任务目标**: 完整部署 → 真实运行 → 找出并修复可复现问题 → 自动验收 → 提交 → Handoff。

### 实施操作与设计决策

1. **环境建立（首次在本机可运行）**
   - `npm install`（Node 26 / npm 11）。注意 npm 11 默认拦截 esbuild postinstall；本仓库构建未依赖其被拦截的后置脚本，`vite build` 正常。
   - 建 `.venv`（Python 3.12.15）并安装 `cadquery==2.8.0`（系统 `python3` 为 3.9.6，未被使用）。
   - 决策：Python 3.9 不用于 CAD；3.12 与仓库 CAD CI（3.11）行为一致（OCC 7.9 轮子可用）。

2. **完整基线验证**：`skills:check`、`assets:validate`、`test`、`engine:audit`、`engine:clearance`、`build`、`cad:build`、`cad:mesh-audit`、`tests-cad` 全部按文档复现（详见 `TEST_MATRIX.md`）。

3. **发现 #1（P1，交付数量不真实）**
   - `src/main.ts` 硬编码 `76 GENERATED / 317 PLANNED`、`76 个已生成零件`、`其余 241 个尚未建模`；`src/automotive.ts` 免责声明硬编码 `106 个零件`。
   - 权威 `assets/catalog/automotive-fwd-i4-001.json` 的 `stats` = 317 parts / 106 generated / 211 planned。
   - **根因**：批量新增 batch-02（30 件）后未同步首页文案；违反 AGENTS.md「实际交付数量」要求。
   - **修复**：改为从 `automotiveCatalog.stats` / `generated.length` 派生。加 `tests/catalog.test.mjs` 静态回归（禁止这些字面量复现），并做 red-green 验证（人为还原旧字面量 → 测试失败）。

4. **发现 #2（P1，测试基础设施缺失）**
   - 现有浏览器测试只有单页 smoke（1 个轮角、1 个角度）。仓库声明的四角往返、720° 相位、26 步拆装、Core 阻断、Undo/Redo 无端到端覆盖。
   - **新增** `tests-browser/acceptance.mjs`：真实 Chromium 覆盖 [A]–[H]，20 项检查，输出两张截图与 `dist-reports/browser-acceptance.json`。
   - 测试设计注意：长拆装流程会中途输出 advisory 诊断，故用**确定性终止标记轮询**而非“文本稳定窗口”；页内验收按钮在操作收尾间隙会丢弃点击，故用有界重试（其自身 guard 保证安全）。

5. **发现 #3（P2，DX）**
   - 本地未 staging CAD GLB 时，`test:browser` 以 60s 超时的模糊错误失败。
   - **修复**：`smoke.mjs` 开头检测 `public/models/engine-i4-cad-reference.glb`，缺失即以退出码 2 给出可执行命令。新增 `assets:cad-stage` 脚本。

6. **发现 #4（P2，工件不可复现）**
   - 连续两次 `cad:build`：**GLB 字节一致**（sha 恒定），**STEP 字节不同**——差异**仅**为 OCC 写入 `FILE_NAME` 的墙钟时间戳（整文件逐行 diff 确认只有第 4 行不同）。
   - **修复**：导出后将 `FILE_NAME` 时间戳归一化为固定 epoch，记账 `stepSha256`。新增 `tests-cad` 用例：断言 manifest 哈希一致 + 时间戳已归一化 + **两次独立进程生成 STEP/GLB 字节一致**。

7. **Pages 路径核查**：`GITHUB_PAGES=true` 构建正常；本地 `vite preview` 在 base 子路径下对 `automotive.html` 触发 SPA fallback（返回 index），但 `dist` 内文件正确、`curl` 直取 200、**线上 Pages 的 `automotive.html` 与 STEP 均 200 正常**。判定为 **vite preview 的测试环境怪癖，非部署缺陷**，记入 ISSUES 供后续注意。

### 修改文件

```
src/main.ts                              # 交付数量改为从 catalog 派生
src/automotive.ts                        # 免责声明数量派生
tests/catalog.test.mjs                   # +1 静态回归（55 tests）
tests-browser/acceptance.mjs             # 新增端到端验收（20 检查）
tests-browser/smoke.mjs                  # CAD 工件缺失快速失败
tests-cad/reference.test.mjs             # +2（哈希/时间戳 + 双生成可复现）
tools/cad/generate_engine_reference.py   # STEP 时间戳归一化 + stepSha256
package.json                             # +test:acceptance +assets:cad-stage
.github/workflows/browser-smoke.yml      # 运行 acceptance + 上传工件
.gitignore                               # +.venv/ +__pycache__/
docs/handoff/*                           # 本目录
```

### 运行命令与验证结果（本轮真实输出）

- `npm run check` → 退出码 0（skills 12/144、assets PASS×2、node tests 55 pass / 0 fail、vite build ✓）
- `npm run test:browser` → PASS（106 parts / 18 CAD / crank 180 / FL remove / 0 pageerror）
- `npm run test:acceptance` → PASS（checks=20）
- `node --test tests-cad/*.test.mjs` → 5 pass / 0 fail（含双生成可复现，约 5.6s）
- `npm run cad:mesh-audit` → NOT_VERIFIED（612 对：72 broadphase-clear / 408 surface-clear / 32 surface-contact / 100 unresolved）
- `npm run engine:clearance` → PASS（16 件、96 对、下界 0.049 m、仅跨缸轴向）
- 线上 Pages `automotive.html` / STEP：HTTP 200

### 提交

- 工作分支：`agent/pi/handoff-and-browser-acceptance`
- 结果 SHA：见 `manifest.json`
- 未推送（本地无推送授权假设）。

### 未完成 / 延续

- 整机碰撞仍 NOT_VERIFIED；曲柄视觉相位与缸孔形状需可信 CAD（`BLOCKED`）。
- 许可证未选定。
- dev 工具链 `npm audit` 报 4 个 high（vite→picomatch 系，dev-only）。

---

## 2026-11-18 · Agent: Pi (第二轮：碰撞轨迹修正 + 跨环境复现 + 合并准备)

**起始 Git SHA**: `c843033b5d0e7bd27f06cc35d0fcd8b92fe75180`（第一轮 HEAD，工作区 clean）
**任务目标**: 交接一致性；修复连续碰撞验证的运动路径错误；跨 Node/Python/浏览器/CAD 复现；升级 Handoff；准备远端合并。

### 第一工作包 — 交接一致性

- 核对 `manifest.resultCommit=80f6323` 与 HEAD `c843033` 的关系：前者是“代码+文档”提交，后者是其后的 bookkeeping 提交（仅记录该 SHA）。判定为**含糊指向**，本轮改为：`resultCommit` 一律记录代码+文档主提交，并在 `CURRENT_STATUS.md` 同时给出 HEAD。
- 复跑全部门禁（详见 `TEST_MATRIX.md`），检查敏感文件（无 `.env`/token/cert）、生成工件（`dist/`、`public/models/`、`dist-cad/`、`dist-pages/` 均 gitignore）、许可证（仍未选定，IS-05）。

### 第二工作包 — 连续碰撞验证的根因与修复

**Phase 1 根因**：`tools/cad/audit_cad_mesh.mjs` 取区间端点姿态 `poseAt(id,start)/poseAt(id,end)`，`src/mesh-ccd.mjs` 的 `check()` 对端点做 `lerp`+`slerp` 插值。但 `solveEngineI4` 的连杆/活塞/销/环位姿是曲轴角的非线性函数，且外层 broadphase 也用端点运动量扩张。→ 端点弦可“安全”而真实路径中途接触，**可能误报 `surface-clear`**。
**可复现反例**：端点**完全相同**的闭合回环 `B(t)=(sin2πt, 1-cos2πt)`，障碍在回环顶点。`check()` 因端点零位移直接 `surface-clear`（错误）；`checkTrajectory` 在中点命中 → `surface-contact`。单元测试 `tests/mesh-ccd.test.mjs` 固定该反例。

**Phase 4 实现（一处根因、最小改动）**：
1. `src/mesh-ccd.mjs`：新增 `checkTrajectory(getPoseA,getPoseB,{start,end,speedA,speedB,marginM,maxDepth,maxEvaluations})`；中点查真实姿态，`certifiedLower = d − (speedA+speedB)*(end−start)/2`，仅当 > margin 才 `surface-clear`；预算耗尽 `unresolved`。新增导出 `meshMotionRadius()`。`solve()` 抽为共享内部函数；`check()` 保留（线性弦专用）并加显著警示。
2. `packages/mechanical-core/src/engine-i4.ts`：新增 `engineI4SpeedBounds()`。解析上界（每缸、相位无关的最坏情况）：
   `|d(rise)/dφ| ≤ r²/(2√(L²−r²))`；`|d(pistonY)/dφ| ≤ r + 上式`；`|d(rodPitch)/dφ| ≤ r(L+上式)/L²`（分母恒为 L²）。曲柄/皮带轮旋转速度 1，凸轮 0.5，静态件不在表中。
3. `tools/cad/audit_cad_mesh.mjs`：外层 broadphase 改为**真实姿态分片 swept AABB**（每 5° 片，按 `speed*Δt` 扩张后并集），内层用 `checkTrajectory`；接触分类 `design-fit-candidate / design-fit-unresolved / unreviewed-contact / numerical-unresolved`（依据 status + 已声明 Mate），并输出 `trajectoryModel`。
4. `tests/engine-i4.test.mjs`：新增“解析速度上界 ≥ 数值采样速度”（4001 采样点）与“连杆/活塞路径非线性（弦偏差 > 0.1mm）”两项，证明上界严谨且弦插值不成立。

**自检发现的次生缺陷（本轮内修复）**：初版 `checkTrajectory` 仍让 `solve()` 在归一化 `[0,1]` 上递归，除非 `start=0,end=1` 会查询错误的参数。反例测试暴露后改为在**真实参数域**递归（`lo/hi`），并新增 `tests/mesh-ccd.test.mjs`：非 `[0,1]` 区间（θ∈[10.3,11.3]）必须命中顶点接触（红→绿已验证）。修复后的默认预算 `--max-evals=256 --max-depth=18`。

**720° 结果**：612 对 → broadphase-clear 400 / surface-clear 148 / surface-contact 32 / unresolved 32；**全部非 clear 对均为已声明 Mate 的设计接口**；状态 `NOT_VERIFIED`（如实保留，未用忽略名单提升通过率）。

### 第三工作包 — 跨环境复现

- Node 22（`brew node@22` v22.23.5）：`npm run check` 退出 0，`63 pass / 0 fail`。Node 26 同样 63/0。Node 24 本机二进制损坏（缺 `libsimdjson.34.dylib`，与本仓库无关）→ 未测。
- Python 3.11.18 与 3.12.15（均 cadquery 2.8.0 / OCP 7.9.3.1.1）：`generate_engine_reference.py` 两次独立生成，**STEP 与 GLB 逐字节一致**（STEP sha `25d6f292…`，GLB sha `dadfd980…`）。
- 浏览器：`test:browser`（106 GLB + 18 CAD，0 pageerror）、`test:acceptance`（20 检查）、`test:pages-base`（真实 base 子路径 + 查询参数，0 pageerror / 0 同源失败请求）。
- 线上 Pages（只读）：`automotive.html` 200、STEP 200；本轮提交未部署 → NOT_VERIFIED。

### 修改文件

```
src/mesh-ccd.mjs                          # +checkTrajectory +meshMotionRadius；check 标注为线性弦专用
packages/mechanical-core/src/engine-i4.ts # +engineI4SpeedBounds
tools/cad/audit_cad_mesh.mjs              # 真实姿态 swept AABB + checkTrajectory + 分类
tests/mesh-ccd.test.mjs                   # +5（含闭合回环反例）
tests/engine-i4.test.mjs                  # +2（速度上界严谨性、非线性证据）
tests-cad/collision.test.mjs              # +2（真实轨迹假设、分类确定性）
tests-browser/pages-base.mjs              # 新增 Pages base 子路径验收
tests-browser/acceptance.mjs              # 同源失败请求过滤
package.json                              # +test:pages-base
.github/workflows/browser-smoke.yml        # +pages-base 步骤
README.md / .gitignore                    # 文档与忽略 dist-pages/
docs/handoff/*                            # 本目录更新
```

### 提交 / 远端 / CI

- 工作分支：`agent/pi/handoff-and-browser-acceptance`（已推送）。
- 结果 SHA：`96ab23f`（代码+文档主提交）；其后为 bookkeeping / CI 工作流提交。
- PR：**#1** https://github.com/1998x-stack/Mechanical-Worlds/pull/1 （OPEN，MERGEABLE；`main` 未改动）。
- **补上 CI 覆盖缺口**：`cad-reference.yml`、`browser-smoke.yml` 原先只在 `main` 触发，PR 得不到 CAD/浏览器验证；已加 `pull_request` 触发。
- PR 检查（`pull_request`）：`validate`（ci.yml）**success 16s**、`cad`（cad-reference.yml）**success 7m06s**、`chromium-glb`（browser-smoke.yml）**success 6m37s**。
- Pages（`pages.yml`）：仅 `main` 推送触发 → 本 PR **未部署**（合并后重跑）。

### 未完成 / 延续

- 整机碰撞仍 `NOT_VERIFIED`：32 接触 + 32 未判定均为有 Mate 的设计接口，尚未证明其在预期配合内（可能真实干涉）——需 CAD/工程判定（IS-01）。
- 曲柄视觉相位/缸孔形状仍依赖可信 CAD（IS-02，`BLOCKED`）。
- 许可证未选定（IS-05，`BLOCKED`）。
