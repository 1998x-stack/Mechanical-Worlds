# CURRENT STATUS — Mechanical Worlds

> 本文件是新 Agent 的第一入口，保持简洁。权威事实以当前代码与测试结果为准。
> 详细历史见 `WORKLOG.md`，测试矩阵见 `TEST_MATRIX.md`，问题清单见 `ISSUES.md`，下一步见 `NEXT_ACTIONS.md`。

## 仓库与构建基线

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/1998x-stack/Mechanical-Worlds |
| 分支 | `agent/pi/handoff-and-browser-acceptance`（本轮工作分支；`main` 保持 `bb74622`） |
| 本轮起始 SHA | `bb74622cdc9327eab82b409f37bd3e56ce1eb521` |
| 本轮结果 SHA | 见 `manifest.json` 的 `resultCommit`（本地提交 `80f6323c72db447e68c1412794a96909bb8cb653`，未推送） |
| 工作区 | commit 后 clean |
| 远端/PR | 未推送、未创建 PR（本地无推送授权假设） |

## 环境（本轮实测）

```
OS:      macOS (Apple Git-157)
Node:    v26.13.1        npm: 11.20.0
Python:  3.12.15 (.venv)  CadQuery: 2.8.0 (cadquery-ocp 7.9.3.1.1)
Browser: Playwright Chromium (headless, SwiftShader WebGL)
```

## 当前实际运行状态

- `npm run check`（skills:check + assets:validate + 55 个 Node 测试 + build）：**退出码 0**。
- 两批真实 GLB：batch-01 = **76** 件、batch-02 = **30** 件，合计 **106 个 generated 零件**；目录共 **317 个物理零件（211 planned）+ 42 装配节点**。
- CAD B-Rep：`tools/cad/generate_engine_reference.py` 生成 **18** 件参数化实体 + STEP + 三角化 GLB；**STEP 与 GLB 现为字节可复现**（STEP 时间戳已归一化）。
- 真实 Chromium 验收：`test:browser` 与 `test:acceptance`（**20 项检查**）全部 PASS，两页零 pageerror / 零失败请求。

## 本轮完成 / 未完成

**完成**

1. 修复交付数量不真实缺陷：`src/main.ts` 曾硬编码 `76 GENERATED / 317 PLANNED`（应为 106/211），`src/automotive.ts` 免责声明硬编码“106”。现全部从 `assets/catalog/...json` 的 `stats` 派生，并加回归测试守护。
2. 新增 `tests-browser/acceptance.mjs`：真实 Chromium 端到端验收（四角拆装、0/90/180/360/720 曲轴相位、剖视、26 步拆装 + Core 驱动阻断、Undo/Redo、目录搜索、页内双案例验收、`?utm_source` 查询参数安全），输出截图与 `browser-acceptance.json`。
3. `tests-browser/smoke.mjs` 增加 CAD 工件缺失时的**快速失败**提示（此前表现为 60s 超时的模糊错误）。
4. CAD STEP 时间戳归一化，新增“双重生成字节一致”可复现性测试（`tests-cad`，现 5 项）。
5. `.github/workflows/browser-smoke.yml` 增加 acceptance 步骤与工件上传；`package.json` 增加 `test:acceptance`、`assets:cad-stage`。

**未完成 / NOT_VERIFIED**

- 发动机整机碰撞：`cad:mesh-audit` = **NOT_VERIFIED**（32 接触 / 100 未判定）。
- 曲柄视觉相位与真实缸孔形状偏差：需可信 CAD。
- 未选许可证；OEM CAD 缺失 → `BLOCKED`。

## 运行入口

```bash
npm install
npm run build                      # 生成 dist/
# 浏览器验收需先把 CAD GLB staging 到 public/models（需 CadQuery）
npm run assets:cad-stage           # python tools/cad/generate_engine_reference.py --skip-step --output public/models
npm run build
npm run test:browser               # 单页 smoke
npm run test:acceptance            # 20 项端到端验收
npm run dev                        # 本地开发
```

部署地址（只读核对，非本轮部署）：

- https://1998x-stack.github.io/Mechanical-Worlds/
- https://1998x-stack.github.io/Mechanical-Worlds/automotive.html
- B-Rep STEP：https://1998x-stack.github.io/Mechanical-Worlds/models/engine-i4-concept-reference.step

## 几何 / CAD / 碰撞置信度

| 维度 | 级别 |
|---|---|
| 106 GLB 零件 | `generated`（程序生成概念几何） |
| 18 件 CadQuery 实体 | `parametric-brep-unreviewed`（项目自创，非 OEM） |
| `cad-reviewed` | ❌ 未达成 |
| `manufacturing-validated` | ❌ 未达成 |
| 整机碰撞 | `NOT_VERIFIED` |
| 跨缸 X 分离下界 | 0.049 m（仅 16 件跨缸零件的轴向投影证明） |

不得据此推断制造公差、维修安全或 OEM 认证。
