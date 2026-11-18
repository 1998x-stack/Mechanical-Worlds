# TEST MATRIX — Mechanical Worlds

> 所有结果均为本轮在 Node v26.13.1 / npm 11.20.0 / Python 3.12.15 + CadQuery 2.8.0 / Playwright Chromium 上**实际执行**所得。
> 不得复制旧数字冒充本轮。Commit 见 `manifest.json`。

| # | 测试项 | 执行命令 | 实际结果 | 状态 | 工件 / 日志 | 需人工复核 |
|---|---|---|---|---|---|---|
| 1 | Skills 镜像一致性 | `npm run skills:check` | `12 canonical skills / 144 mirrored files` | PASS | stdout | 否 |
| 2 | GLB 资产校验（两批） | `npm run assets:validate` | batch-01 76 件 sha256 `0374…4b564`、batch-02 30 件；`reproducibleGeometry:true` | PASS | JSON 报告 | 否 |
| 3 | Node 单元/集成测试 | `npm run test` | `tests 55 · pass 55 · fail 0` | PASS | stdout | 否 |
| 4 | I4 运动学 + 拆装 QA | `npm run engine:audit` | 闭环 721 样本、26 步往返恢复、`blockedCrankRotationDuringTeardown:true`、`collisionCertified:false` | PASS | JSON | 否 |
| 5 | 跨缸轴向分离证明 | `npm run engine:clearance` | 16 件、96 对、下界 `0.049 m`、`fullEngineCollisionCertified:false` | PASS | JSON | 是（仅轴向投影） |
| 6 | TypeScript + Vite 生产构建 | `npm run build` | `✓ built`，dist 产物生成 | PASS | dist/ | 否 |
| 7 | 聚合门禁 | `npm run check` | 退出码 `0` | PASS | /tmp/check.log | 否 |
| 8 | CAD 生成（18 件 B-Rep） | `npm run cad:build` | 18 parts；GLB 400452 B；STEP 生成 | PASS | `dist-cad/engine-i4/` | 否 |
| 9 | 连续网格碰撞审查 | `npm run cad:mesh-audit` | 612 对：broadphase-clear 72 / surface-clear 408 / **surface-contact 32 / unresolved 100** | **NOT_VERIFIED** | `engine-i4-mesh-ccd-audit.json` | **是** |
| 10 | CAD 引用测试 | `node --test tests-cad/*.test.mjs` | `5 pass · 0 fail` | PASS | stdout | 否 |
| 11 | STEP/GLB 双生成可复现 | 同上（含新用例） | 两次独立进程 STEP 与 GLB 字节一致（~5.6s） | PASS | stdout | 否 |
| 12 | 浏览器 smoke | `npm run test:browser` | 106 parts / 18 CAD / crank 180 / FL remove / 0 pageerror | PASS | `dist-reports/automotive-browser-smoke.png` | 否 |
| 13 | 浏览器端到端验收 | `npm run test:acceptance` | `checks:20` 全 PASS | PASS | `dist-reports/acceptance-*.png`、`browser-acceptance.json` | 否 |
| 14 | 四角拆装往返 | 验收 [D] | FL/FR/RL/RR wheel+brake remove/install 均“机械状态已提交” | PASS | acceptance json | 否 |
| 15 | 720° 曲轴相位 | 验收 [B] | 0/90/180/360/720 活塞高度符合解析解，闭环误差 <1e-9 | PASS | acceptance json | 否 |
| 16 | Core 驱动阻断 | 验收 [E] | 26 步拆解后旋转曲轴被 Core 阻断 | PASS | acceptance json | 否 |
| 17 | Undo / Redo / Reset | 验收 [G] | 7 步拆解 → 撤销 → 重做 → 重置 → 7 步合成 | PASS | acceptance json | 否 |
| 18 | 交付数量真实性 | 验收 [G] + `tests/catalog.test.mjs` | 首页显示 `106 GENERATED / 211 PLANNED` | PASS | acceptance json | 否 |
| 19 | 查询参数安全 | 验收 [A] | `?utm_source=chatgpt.com` 下资产仍解析 | PASS | acceptance json | 否 |
| 20 | Pages 站路径 | `curl`（只读） | `automotive.html` 200、STEP 200（390013 B） | PASS（线上，非本轮提交） | curl | 是（部署后需重跑） |

## 待人工 / 后续复核

- 第 9 项：`surface-contact` 与 `unresolved` 需 CAD/工程判定（预期销/轴承配合 vs 几何错误），见 `ISSUES.md` IS-01。
- 第 20 项：本轮提交尚未部署；部署后需按 `NEXT_ACTIONS.md` 复核 Pages。
