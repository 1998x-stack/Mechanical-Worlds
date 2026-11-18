import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MechanicalEngine,BlockedOperationError} from "../dist-core/packages/mechanical-core/src/index.js";
import {createGeneratedCarCornerAsset,CORNERS} from "../dist-core/packages/mechanical-core/src/automotive-corners.js";
import {mateAlignment} from "../dist-core/packages/mechanical-core/src/p1.js";
import {validateAsset} from "../dist-core/packages/mechanical-schema/src/index.js";

const manifest=JSON.parse(readFileSync(
  new URL("../assets/generated/automotive/manifest.json",import.meta.url),"utf8"
));
const create=()=>createGeneratedCarCornerAsset(manifest);
test("every generated wheel/brake Part has exact manifest glTF binding and aligned conceptual Mates",()=>{
  const asset=create();
  assert.deepEqual(validateAsset(asset),[]);
  assert.equal(asset.nodes.filter(n=>n.kind==="part").length,76);
  assert.equal(asset.plans.length,16);
  const sourceIds=new Set(manifest.parts.map(p=>p.id));
  const core=new MechanicalEngine(asset);
  for(const n of asset.nodes.filter(n=>n.kind==="part")){
    assert.ok(sourceIds.has(n.id));
    assert.equal(n.geometryRef.nodeName,n.id);
    assert.equal(n.geometryRef.uri,manifest.geometryUri);
    assert.equal(n.geometryRef.tier,"generated-conceptual");
  }
  for(const m of asset.mates){
    const d=mateAlignment(asset,core.getState(),m.id);
    assert.ok(d.acceptable,m.id+" "+JSON.stringify(d));
    assert.ok(d.distanceM<1e-8);
    assert.equal(m.tolerance.evidence,"conceptual");
  }
});
for(const corner of CORNERS){
  test(corner.toUpperCase()+" wheel removal/reinstallation preserves all hub and brake components",async()=>{
    const e=new MechanicalEngine(create());
    await assert.rejects(e.runOperation("op.generated."+corner+".wheel.remove"),BlockedOperationError);
    await e.runPlan("plan.generated."+corner+".wheel.remove");
    const s=e.getState();
    assert.equal(s.partStatus["wheel."+corner+".rim"],"detached");
    assert.equal(s.partStatus["wheel."+corner+".tire"],"detached");
    assert.equal(s.partStatus["chassis.hub."+corner],"installed");
    assert.equal(s.partStatus["chassis.brake.disc."+corner],"installed");
    assert.equal(s.partStatus["chassis.brake.caliper."+corner],"installed");
    await e.runPlan("plan.generated."+corner+".wheel.install");
    assert.ok(Object.values(e.getState().partStatus).every(status=>status==="installed"));
    assert.ok(Object.values(e.getState().mateStatus).every(status=>status==="locked"));
  });
  test(corner.toUpperCase()+" brake-service requires wheel removal, then reassembles reversibly",async()=>{
    const a=create(),e=new MechanicalEngine(a);
    await assert.rejects(e.runOperation("op.generated."+corner+".caliper.remove"),BlockedOperationError);
    await assert.rejects(e.runOperation("op.generated."+corner+".disc.remove"),BlockedOperationError);
    await e.runPlan("plan.generated."+corner+".brakes.remove");
    const state=e.getState();
    for(const id of [
      "wheel."+corner+".rim","chassis.brake.caliper."+corner,
      "chassis.brake.pad.in."+corner,"chassis.brake.pad.out."+corner,
      "chassis.brake.disc."+corner
    ])assert.equal(state.partStatus[id],"detached",id);
    assert.equal(state.partStatus["chassis.hub."+corner],"installed");
    await e.runPlan("plan.generated."+corner+".brakes.install");
    const restored=e.getState();
    assert.ok(Object.values(restored.partStatus).every(status=>status==="installed"));
    assert.ok(Object.values(restored.mateStatus).every(status=>status==="locked"));
    assert.ok(Object.values(restored.offsets).every(v=>v.every(x=>Math.abs(x)<1e-10)));
    for(const m of a.mates)assert.ok(mateAlignment(a,restored,m.id).acceptable,m.id);
  });
}
test("cancelled corner fastener operation does not mutate committed state",async()=>{
  const driver={async play(_ms,preview,signal){
    preview(.4);
    if(signal?.aborted)throw new Error("abort");
    throw new Error("cancelled on purpose");
  }};
  const e=new MechanicalEngine(create(),driver),initial=e.getState();
  await assert.rejects(e.runOperation("op.generated.fl.lug.1.remove"));
  assert.deepEqual(e.getState(),initial);
});
