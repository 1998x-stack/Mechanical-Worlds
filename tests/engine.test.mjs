import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAsset } from "../dist-core/packages/mechanical-schema/src/index.js";
import { MechanicalEngine, BlockedOperationError } from "../dist-core/packages/mechanical-core/src/index.js";
import { createWheelAsset, createGlassesAsset } from "../dist-core/packages/mechanical-core/src/fixtures.js";

test("both demo assets pass structural schema and DAG validation", () => {
  for (const asset of [createWheelAsset(), createGlassesAsset()]) {
    assert.deepEqual(validateAsset(asset), []);
  }
});
test("wheel cannot detach before five lug nuts are removed", async () => {
  const engine = new MechanicalEngine(createWheelAsset());
  await assert.rejects(engine.runOperation("op.wheel.detach"), BlockedOperationError);
  await assert.rejects(engine.runOperation("op.wheel.release-mount"), BlockedOperationError);
  assert.equal(engine.getState().mateStatus["mate.wheel.fl.hub"], "locked");
});
test("wheel full disassembly and assembly preserve hub/brake parts", async () => {
  const engine = new MechanicalEngine(createWheelAsset());
  await engine.runPlan("plan.wheel.remove");
  let s = engine.getState();
  assert.equal(s.mateStatus["mate.wheel.fl.hub"], "released");
  assert.equal(s.partStatus["wheel.fl.rim"], "detached");
  assert.equal(s.partStatus["chassis.brake.disc.fl"], "installed");
  assert.equal(s.partStatus["chassis.brake.caliper.fl"], "installed");
  for (let i = 1; i <= 5; i++) assert.equal(s.partStatus["wheel.fl.lug." + String(i).padStart(2, "0")], "detached");
  await engine.runPlan("plan.wheel.install");
  s = engine.getState();
  assert.equal(s.mateStatus["mate.wheel.fl.hub"], "locked");
  for (const status of Object.values(s.partStatus)) assert.equal(status, "installed");
  for (const offset of Object.values(s.offsets)) assert.deepEqual(offset, [0, 0, 0]);
});
test("glasses screws precede temple detachment, then all parts reassemble", async () => {
  const engine = new MechanicalEngine(createGlassesAsset());
  await assert.rejects(engine.runOperation("op.g.temple.left.remove"), BlockedOperationError);
  await engine.runPlan("plan.glasses.remove");
  let s = engine.getState();
  assert.equal(s.partStatus["g.frame"], "installed");
  assert.equal(s.partStatus["g.temple.left"], "detached");
  assert.equal(s.partStatus["g.hinge.right"], "detached");
  assert.equal(s.mateStatus["mate.g.temple.hinge.left"], "released");
  await engine.runPlan("plan.glasses.install");
  s = engine.getState();
  assert.ok(Object.values(s.partStatus).every(state => state === "installed"));
  assert.ok(Object.values(s.mateStatus).every(state => state === "locked"));
  assert.ok(Object.values(s.offsets).every(v => v.every(n => n === 0)));
});
test("undo/redo restores committed mechanical state", async () => {
  const engine = new MechanicalEngine(createWheelAsset());
  await engine.step("plan.wheel.remove");
  const s = engine.getState();
  assert.equal(s.partStatus["wheel.fl.lug.01"], "detached");
  assert.equal(engine.undo(), true);
  assert.equal(engine.getState().partStatus["wheel.fl.lug.01"], "installed");
  assert.equal(engine.redo(), true);
  assert.equal(engine.getState().partStatus["wheel.fl.lug.01"], "detached");
});
test("aborted animation never commits state or offset", async () => {
  const brokenDriver = { async play(_ms, update) { update(0.7); throw new Error("animation cancelled"); } };
  const engine = new MechanicalEngine(createWheelAsset(), brokenDriver);
  const before = engine.getState();
  await assert.rejects(engine.step("plan.wheel.remove"), /animation cancelled/);
  assert.deepEqual(engine.getState(), before);
  assert.equal(engine.isBusy(), false);
});
test("schema validator rejects operation dependency cycles", () => {
  const a = createWheelAsset();
  a.operations[0].dependsOn.push(a.operations[1].id);
  a.operations[1].dependsOn.push(a.operations[0].id);
  assert.ok(validateAsset(a).some(issue => issue.code === "OPERATION_CYCLE"));
});
test("re-running a completed plan is idempotent", async () => {
  const engine = new MechanicalEngine(createGlassesAsset());
  await engine.runPlan("plan.glasses.remove");
  const oldRevision = engine.getState().revision;
  await engine.runPlan("plan.glasses.remove");
  assert.equal(engine.getState().revision, oldRevision);
});
