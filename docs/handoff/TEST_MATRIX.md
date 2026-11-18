# TEST MATRIX — Mechanical Worlds

> 第二轮实测。环境：Node v26.13.1 与 v22.23.5；Python 3.12.15 与 3.11.18（cadquery 2.8.0 / OCP 7.9.3.1.1）；Playwright Chromium (SwiftShader)。
> 同一代码提交上记录。**不得复制旧数字冒充本轮。**

| # | 测试项 | 执行命令 | 实际结果 | 状态 | 工件 | 需人工复核 |
|---|---|---|---|---|---|---|
| 1 | Skills 镜像 | `npm run skills:check` | 12 canonical / 144 mirrored | PASS | stdout | 否 |
| 2 | GLB 资产 | `npm run assets:validate` | batch-01 76 + batch-02 30；`reproducibleGeometry:true` | PASS | JSON | 否 |
| 3 | Node 测试 (Node 26) | `npm run test` | `tests 63 · pass 63 · fail 0` | PASS | stdout | 否 |
| 3b | Node 测试 (Node 22) | `PATH=node@22 … node --test tests/*.test.mjs` | `# tests 63 · # pass 63 · # fail 0` | PASS | stdout | 否 |
| 3c | Node 24 | `node --version` | 本机二进制损坏（缺 simdjson dylib，与本仓库无关） | NOT_RUN | dyld 错误 | 是（换机验证） |
| 4 | I4 运动学/拆装 QA | `npm run engine:audit` | 721 样本闭环；26 步往返；`blockedCrankRotationDuringTeardown:true`；`collisionCertified:false` | PASS | JSON | 否 |
| 5 | 跨缸轴向分离 | `npm run engine:clearance` | 16 件 / 96 对 / 0.049 m / 仅轴向 | PASS | JSON | 是 |
| 6 | 生产构建 | `npm run build` | `✓ built` | PASS | dist/ | 否 |
| 7 | 聚合门禁 (Node 26) | `npm run check` | 退出码 0 | PASS | /tmp/check.log | 否 |
| 7b | 聚合门禁 (Node 22) | `PATH=node@22 … npm run check` | 退出码 0 | PASS | /tmp/check22.log | 否 |
| 8 | CAD 生成 | `npm run cad:build` | 18 parts；GLB 400452 B；STEP 归一化 | PASS | dist-cad/engine-i4 | 否 |
| 9 | **真实姿态 720° 碰撞审查** | `npm run cad:mesh-audit` | 612 对：broadphase-clear 400 / surface-clear 148 / **surface-contact 32 / unresolved 32**；非 clear 全部有 Mate | **NOT_VERIFIED** | `engine-i4-mesh-ccd-audit.json` | **是** |
| 9b | 碰撞轨迹假设 | `tests-cad/collision.test.mjs` | `algorithm` 含 `true-pose`；`certifiedOnlyWithSpeedBound:true`；预算耗尽=`unresolved` | PASS | stdout | 否 |
| 9c | 分类确定性 | 同上 | 32 design-fit-candidate + 32 design-fit-unresolved；0 unreviewed / 0 numerical | PASS | stdout | 否 |
| 10 | CCD 反例（红→绿） | `node --test tests/mesh-ccd.test.mjs` | 端点弦闭合回环误报 clear（记录）；`checkTrajectory` 命中 contact | PASS | stdout | 否 |
| 11 | 速度上界严谨性 | `node --test tests/engine-i4.test.mjs` | 解析上界 ≥ 4001 点数值速度；连杆/活塞非线性（弦偏差 >0.1mm） | PASS | stdout | 否 |
| 12 | CAD 引用测试 | `node --test tests-cad/*.test.mjs` | 7 pass / 0 fail（含 STEP/GLB 双生成字节一致） | PASS | stdout | 否 |
| 13 | **跨 Python 版本 CAD** | 3.11 vs 3.12 各生成一次比对 sha | STEP 与 GLB **逐字节一致**（STEP `25d6f292…`，GLB `dadfd980…`） | PASS | /tmp/cad311, /tmp/cad312 | 否 |
| 14 | 浏览器 smoke | `npm run test:browser` | 106 parts / 18 CAD / crank 180 / FL remove / 0 pageerror | PASS | `dist-reports/automotive-browser-smoke.png` | 否 |
| 15 | 浏览器端到端 | `npm run test:acceptance` | `checks=20` 全 PASS | PASS | acceptance-*.png, browser-acceptance.json | 否 |
| 16 | 四角拆装往返 | 验收 [D] | FL/FR/RL/RR wheel+brake remove/install 已提交 | PASS | acceptance json | 否 |
| 17 | 720° 曲轴相位 | 验收 [B] | 0/90/180/360/720 活塞高度符合解析解，闭环 <1e-9 | PASS | acceptance json | 否 |
| 18 | Core 驱动阻断 | 验收 [E] | 26 步拆解后旋转曲轴被阻断 | PASS | acceptance json | 否 |
| 19 | Undo/Redo/Reset + 数量真实性 | 验收 [G] | 撤销/重做/重置通过；首页 `106 GENERATED / 211 PLANNED` | PASS | acceptance json | 否 |
| 20 | **Pages base 子路径** | `npm run test:pages-base` | `/Mechanical-Worlds/` 下 index+automotive 200、106 parts、18 CAD、`?utm_source` 生效、0 pageerror/0 同源失败 | PASS | dist-pages/ | 否 |
| 21 | 线上 Pages（只读） | `curl` | `automotive.html` 200、STEP 200 | PASS（旧部署） | curl | 是（部署后重跑） |
| 22 | CI / CAD / Browser 工作流 | GitHub Actions | 本提交未推送 → 未触发 | NOT_RUN | — | 是（推送后核对） |

## 待人工复核

- #9 碰撞：32 接触 + 32 未判定均为有 Mate 的设计接口，需工程判定是否在预期配合内（IS-01）。
- #21/#22：部署与 CI 需在推送后重新核对。
