import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MechanicalEngine,BlockedOperationError} from "../dist-core/packages/mechanical-core/src/index.js";
import {validateAsset} from "../dist-core/packages/mechanical-schema/src/index.js";
import {
  createEngineI4Asset,engineI4Constraint,solveEngineI4
} from "../dist-core/packages/mechanical-core/src/engine-i4.js";
import {mateAlignment} from "../dist-core/packages/mechanical-core/src/p1.js";

const source=JSON.parse(readFileSync(new URL(
  "../assets/generated/automotive/manifest-02.json",import.meta.url),"utf8"));
const close=(got,expected,eps=1e-9)=>
  assert.ok(Math.abs(got-expected)<=eps,`expected ${got} ≈ ${expected}`);
const create=()=>createEngineI4Asset(source);

test("I4 fixture has all 30 uniquely named generated GLB parts, 1 valid mechanism and two independent plans",()=>{
  const a=create();
  assert.deepEqual(validateAsset(a),[]);
  assert.equal(a.nodes.filter(n=>n.kind==="part").length,30);
  assert.equal(a.kinematics.length,1);
  assert.equal(a.plans.length,2);
  assert.equal(a.joints.length,1);
  assert.equal(new Set(a.nodes.map(n=>n.id)).size,a.nodes.length);
  const parts=new Set(source.parts.map(p=>p.id));
  for(const node of a.nodes.filter(n=>n.kind==="part")){
    assert.ok(parts.has(node.id));
    assert.equal(node.geometryRef.nodeName,node.id);
    assert.equal(node.geometryRef.uri,source.geometryUri);
    assert.equal(node.geometryRef.tier,"generated-conceptual");
  }
  const k=engineI4Constraint(a);
  assert.deepEqual(k.phasesRad,[0,Math.PI,Math.PI,0]);
  assert.equal(k.authoringTier,"generated-conceptual");
  assert.ok(k.rodLengthM>k.throwRadiusM);
});
test("every authored engine Mate aligns at its committed source pose without claiming CAD-reviewed evidence",()=>{
  const a=create(),engine=new MechanicalEngine(a);
  for(const mate of a.mates){
    const measured=mateAlignment(a,engine.getState(),mate.id);
    assert.ok(measured.acceptable,mate.id);
    close(measured.distanceM,0,1e-8);
    assert.equal(mate.tolerance.evidence,"conceptual");
  }
});
test("crank drives coherent 4 cylinder closure over two revolutions and both cams rotate at half speed",()=>{
  const a=create(),k=engineI4Constraint(a);
  for(let deg=0;deg<=720;deg+=3){
    const rad=deg*Math.PI/180;
    const frame=solveEngineI4(k,rad,source);
    assert.equal(frame.cylinders.length,4);
    assert.ok(frame.maxClosureErrorM<1e-12,`closure at ${deg}°`);
    close(frame.camAngleRad,rad/2);
    for(const cylinder of frame.cylinders){
      const i=cylinder.index-1,piston=frame.parts[k.pistonPartIds[i]],
        rod=frame.parts[k.rodPartIds[i]],pin=frame.parts[k.pinPartIds[i]],
        rings=frame.parts[k.ringPartIds[i]];
      close(piston.position[2],k.crankCenterWorld[2]);
      close(pin.position[2],k.crankCenterWorld[2]);
      close(rings.position[1]-piston.position[1],k.pistonRingFromCenterM);
      close(piston.position[1]-pin.position[1],k.pistonPinToCenterM);
      close(Math.hypot(
        cylinder.pistonPinWorld[0]-cylinder.crankPinWorld[0],
        cylinder.pistonPinWorld[1]-cylinder.crankPinWorld[1],
        cylinder.pistonPinWorld[2]-cylinder.crankPinWorld[2]
      ),k.rodLengthM);
      assert.ok(rod.position.every(Number.isFinite));
      assert.ok(piston.position.every(Number.isFinite));
    }
    close(frame.parts["engine.crankshaft"].rotation[0],Math.sin(rad/2));
    close(frame.parts["engine.cam.intake"].rotation[0],Math.sin(rad/4));
    close(frame.parts["engine.cam.exhaust"].rotation[0],Math.sin(rad/4));
  }
  const top=solveEngineI4(k,0,source),bottom=solveEngineI4(k,Math.PI,source);
  close(top.parts["engine.piston.1"].position[1],top.parts["engine.piston.4"].position[1]);
  close(top.parts["engine.piston.2"].position[1],top.parts["engine.piston.3"].position[1]);
  close(top.parts["engine.piston.1"].position[1]-top.parts["engine.piston.2"].position[1],2*k.throwRadiusM);
  close(bottom.parts["engine.piston.1"].position[1],top.parts["engine.piston.2"].position[1]);
});
test("engine crank joint rejects invalid angles and blocks motion once a required mechanism mate/part is removed",async()=>{
  const a=create(),engine=new MechanicalEngine(a),joint=engineI4Constraint(a).crankJointId;
  assert.throws(()=>engine.setRevoluteAngle(joint,Number.NaN),RangeError);
  assert.throws(()=>engine.setRevoluteAngle(joint,-0.01),RangeError);
  assert.throws(()=>engine.setRevoluteAngle(joint,Math.PI*2+.01),RangeError);
  engine.setRevoluteAngle(joint,Math.PI/2);
  close(engine.getState().jointAngles[joint],Math.PI/2);
  assert.equal(engine.getState().revision,1);
  assert.equal(engine.undo(),true);
  close(engine.getState().jointAngles[joint],0);
  assert.equal(engine.redo(),true);
  close(engine.getState().jointAngles[joint],Math.PI/2);
  await assert.rejects(engine.runOperation("op.engine.i4.remove.engine.valve.cover"),BlockedOperationError);
  engine.setRevoluteAngle(joint,0);
  await engine.runOperation("op.engine.i4.remove.engine.valve.cover");
  await assert.rejects(()=>Promise.resolve(engine.setRevoluteAngle(joint,Math.PI/6)),BlockedOperationError);
});
test("I4 teardown and separately authored reassembly restore all Parts, Mates and offsets",async()=>{
  const a=create(),engine=new MechanicalEngine(a);
  await assert.rejects(engine.runOperation("op.engine.i4.remove.engine.crankshaft"),BlockedOperationError);
  await engine.runPlan("plan.engine.i4.disassemble");
  const after=engine.getState();
  assert.equal(after.partStatus["engine.block.cast"],"installed");
  assert.equal(after.partStatus["engine.crankshaft"],"detached");
  assert.equal(after.partStatus["engine.piston.1"],"detached");
  assert.equal(after.partStatus["engine.rod.4"],"detached");
  assert.equal(after.partStatus["gearbox.differential.carrier"],"installed");
  assert.ok(Object.values(after.partStatus).filter(p=>p==="detached").length>=20);
  await assert.rejects(()=>Promise.resolve(
    engine.setRevoluteAngle(engineI4Constraint(a).crankJointId,Math.PI/2)
  ),BlockedOperationError);
  await engine.runPlan("plan.engine.i4.assemble");
  const restored=engine.getState();
  assert.ok(Object.values(restored.partStatus).every(s=>s==="installed"));
  assert.ok(Object.values(restored.mateStatus).every(s=>s==="locked"));
  assert.ok(Object.values(restored.offsets).every(v=>v.every(n=>Math.abs(n)<=1e-12)));
  assert.equal(restored.jointAngles[engineI4Constraint(a).crankJointId],0);
  for(const mate of a.mates)assert.ok(mateAlignment(a,restored,mate.id).acceptable,mate.id);
  engine.setRevoluteAngle(engineI4Constraint(a).crankJointId,Math.PI*2);
  close(engine.getState().jointAngles[engineI4Constraint(a).crankJointId],Math.PI*2);
});
test("cancelled I4 operation rolls back all committed state",async()=>{
  const failedDriver={async play(_duration,preview){
    preview(.37);
    throw new Error("simulated interrupted animation");
  }};
  const engine=new MechanicalEngine(create(),failedDriver);
  const start=engine.getState();
  await assert.rejects(engine.runOperation("op.engine.i4.remove.engine.valve.cover"),/interrupted/);
  assert.deepEqual(engine.getState(),start);
});
test("schema rejects malformed crank geometry and unknown cylinder instance IDs",()=>{
  const first=create(),bad=structuredClone(first);
  bad.kinematics[0].rodLengthM=bad.kinematics[0].throwRadiusM;
  assert.ok(validateAsset(bad).some(x=>x.code==="KINEMATICS_DIMENSIONS"));
  assert.throws(()=>solveEngineI4(bad.kinematics[0],0,source),RangeError);
  const missing=structuredClone(first);
  missing.kinematics[0].rodPartIds[1]="missing.engine.rod";
  assert.ok(validateAsset(missing).some(x=>x.code==="KINEMATICS_PART"));
  const withoutEvidence=structuredClone(first);
  withoutEvidence.kinematics[0].authoringTier="cad-reviewed";
  withoutEvidence.kinematics[0].sourceId="";
  assert.ok(validateAsset(withoutEvidence).some(x=>x.code==="KINEMATICS_SOURCE"));
});
