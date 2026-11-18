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
