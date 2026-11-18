import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAsset } from "../dist-core/packages/mechanical-schema/src/index.js";
import { MechanicalEngine, BlockedOperationError } from "../dist-core/packages/mechanical-core/src/index.js";
import { createP1WheelAsset, createP1GlassesAsset } from "../dist-core/packages/mechanical-core/src/p1-fixtures.js";
import {
  mateAlignment, snapPosition, getPartPose, checkPathCollision
} from "../dist-core/packages/mechanical-core/src/p1.js";

const closeTo = (value,expected,epsilon=1e-6) =>
  assert.ok(Math.abs(value-expected)<=epsilon, `Expected ${value} ≈ ${expected}`);

test("P1 fixtures have valid joints, path metadata, geometry proxies and DAG", () => {
  for(const fixture of [createP1WheelAsset,createP1GlassesAsset]){
    const a=fixture();
    assert.deepEqual(validateAsset(a),[]);
    assert.ok((a.motionPaths?.length??0)>0);
    assert.ok((a.collisionProxies?.length??0)>0);
  }
});
test("P1 wheel rim/hub connector frames align and produce correct snap target",()=>{
  const a=createP1WheelAsset(),engine=new MechanicalEngine(a),s=engine.getState();
  const measured=mateAlignment(a,s,"mate.wheel.fl.hub");
  closeTo(measured.distanceM,0);
  assert.equal(measured.acceptable,true);
  const mate=a.mates.find(m=>m.id==="mate.wheel.fl.hub");
  const target=snapPosition(a,s,mate.connectorAId,mate.connectorBId);
  closeTo(target[0],-.38);
  closeTo(target[1],.3);
  closeTo(target[2],0);
});
test("P1 wheel full operation path preflight succeeds and mate locks after reassembly",async()=>{
  const a=createP1WheelAsset(),engine=new MechanicalEngine(a);
  await assert.rejects(engine.runOperation("op.wheel.detach"),BlockedOperationError);
  await engine.runPlan("plan.wheel.remove");
  assert.equal(engine.getState().mateStatus["mate.wheel.fl.hub"],"released");
  assert.equal(engine.getState().partStatus["chassis.brake.disc.fl"],"installed");
  await engine.runPlan("plan.wheel.install");
  assert.ok(Object.values(engine.getState().partStatus).every(status=>status==="installed"));
  assert.ok(Object.values(engine.getState().mateStatus).every(status=>status==="locked"));
  assert.equal(mateAlignment(a,engine.getState(),"mate.wheel.fl.hub").acceptable,true);
});
test("P1 left hinge rotates about its pivot and returns to coincident mating anchors",async()=>{
  const a=createP1GlassesAsset(),engine=new MechanicalEngine(a),joint="joint.g.temple.left";
  const before=getPartPose(a,engine.getState(),"g.temple.left");
  await engine.runPlan("plan.glasses.open");
  const openState=engine.getState();
  closeTo(openState.jointAngles[joint],-.78);
  const after=getPartPose(a,openState,"g.temple.left");
  assert.ok(Math.hypot(...after.position.map((v,i)=>v-before.position[i]))>.2);
  assert.equal(mateAlignment(a,openState,"mate.g.temple.hinge.left").acceptable,true);
  await assert.rejects(engine.runOperation("op.g.screw.left.remove"),BlockedOperationError);
  await engine.runPlan("plan.glasses.close");
  closeTo(engine.getState().jointAngles[joint],0);
  assert.equal(mateAlignment(a,engine.getState(),"mate.g.temple.hinge.left").acceptable,true);
});
test("P1 eyeglasses hinge / screw dependency and full round trip",async()=>{
  const a=createP1GlassesAsset(),engine=new MechanicalEngine(a);
  await assert.rejects(engine.runOperation("op.g.temple.right.remove"),BlockedOperationError);
  await engine.runPlan("plan.glasses.remove");
  assert.equal(engine.getState().partStatus["g.temple.right"],"detached");
  await engine.runPlan("plan.glasses.install");
  const state=engine.getState();
  assert.ok(Object.values(state.partStatus).every(x=>x==="installed"));
  assert.ok(Object.values(state.mateStatus).every(x=>x==="locked"));
  assert.ok(Object.values(state.offsets).every(v=>v.every(n=>n===0)));
  for(const m of a.mates.filter(m=>m.verified)){
    assert.equal(mateAlignment(a,state,m.id).acceptable,true,m.id);
  }
});
test("P1 sampled path preflight identifies newly entered obstacle",()=>{
  const a=createP1WheelAsset(),engine=new MechanicalEngine(a);
  const before=engine.getState(),after=structuredClone(before);
  after.offsets["wheel.fl.rim"]=[.5,0,0]; // cross the hub along +X (deliberately invalid)
  const collision=checkPathCollision(a,before,after,{
    id:"test.colliding.path",
    kind:"linear",
    targetPartIds:["wheel.fl.rim"],
    collisionPolicy:"required",
    samples:36
  });
  assert.equal(collision.ok,false);
  assert.ok(collision.contacts.some(hit=>hit.obstaclePartId==="chassis.hub.fl"));
  assert.ok(collision.checkedPairs>0);
});
test("P1 verified mate refuses installation when connector frames are wrong",async()=>{
  const a=createP1WheelAsset();
  const mate=a.mates.find(m=>m.id==="mate.wheel.fl.hub");
  const source=a.connectors.find(c=>c.id===mate.connectorAId);
  source.local.position=[2,0,0]; // corrupt authoring data, not the geometry
  const engine=new MechanicalEngine(a);
  await engine.runPlan("plan.wheel.remove");
  await assert.rejects(engine.runPlan("plan.wheel.install"),BlockedOperationError);
  assert.equal(engine.getState().mateStatus[mate.id],"released");
});
test("P1 operation preview publishes screw rotation and interpolated joint positions",async()=>{
  const events=[];
  const driver={async play(_duration,update){update(.5);update(1);}};
  const e=new MechanicalEngine(createP1WheelAsset(),driver);
  e.subscribe(event=>events.push(event));
  await e.runOperation("op.wheel.lug.1.remove");
  const preview=events.find(ev=>ev.type==="preview" && ev.progress===.5);
  assert.ok(preview);
  closeTo(preview.screwRotations["wheel.fl.lug.01"].angleRad,4*Math.PI*(.5/.54));
  assert.equal(e.getState().partStatus["wheel.fl.lug.01"],"detached");
  const ge=new MechanicalEngine(createP1GlassesAsset(),driver);
  const geEvents=[];ge.subscribe(event=>geEvents.push(event));
  await ge.runOperation("op.g.temple.left.open");
  const gPreview=geEvents.find(ev=>ev.type==="preview"&&ev.progress===.5);
  closeTo(gPreview.jointAngles["joint.g.temple.left"],-.39);
});

test("P1 screw path has axial extraction before moving to the parts tray",async()=>{
  const a=createP1WheelAsset();
  const events=[];
  const driver={async play(_duration,update){update(.27);update(.54);update(1);}};
  const engine=new MechanicalEngine(a,driver);
  engine.subscribe(event=>events.push(event));
  await engine.runOperation("op.wheel.lug.1.remove");
  const atQuarter=events.find(ev=>ev.type==="preview"&&ev.progress===.27);
  const atThreadsEnd=events.find(ev=>ev.type==="preview"&&ev.progress===.54);
  closeTo(atQuarter.offsets["wheel.fl.lug.01"][0],-.065);
  closeTo(atThreadsEnd.offsets["wheel.fl.lug.01"][0],-.13);
  closeTo(atThreadsEnd.screwRotations["wheel.fl.lug.01"].angleRad,Math.PI*4);
  assert.ok(engine.getState().offsets["wheel.fl.lug.01"][0]<-.6);
});
