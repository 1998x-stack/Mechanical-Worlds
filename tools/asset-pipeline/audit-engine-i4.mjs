#!/usr/bin/env node
/** CI quality evidence: mathematical closure + state DAG + manifest reference audit. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createEngineI4Asset,engineI4Constraint,solveEngineI4} from "../../dist-core/packages/mechanical-core/src/engine-i4.js";
import {MechanicalEngine,BlockedOperationError} from "../../dist-core/packages/mechanical-core/src/index.js";
import {mateAlignment} from "../../dist-core/packages/mechanical-core/src/p1.js";
import {validateAsset} from "../../dist-core/packages/mechanical-schema/src/index.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const assetDir=path.join(root,"assets/generated/automotive");
const manifest=JSON.parse(fs.readFileSync(path.join(assetDir,"manifest-02.json"),"utf8"));
const source=JSON.parse(fs.readFileSync(path.join(root,"assets/mechanical/engine-i4-source-brief.json"),"utf8"));
const catalog=JSON.parse(fs.readFileSync(path.join(root,"assets/catalog/automotive-fwd-i4-001.json"),"utf8"));
const asset=createEngineI4Asset(manifest),k=engineI4Constraint(asset),core=new MechanicalEngine(asset);
assert.deepEqual(validateAsset(asset),[]);
assert.equal(k.authoringTier,"generated-conceptual");
assert.equal(manifest.parts.length,30);
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,a+" differs from "+b);
close(k.throwRadiusM,source.kinematics.throwRadiusM);
close(k.rodLengthM,source.kinematics.rodLengthM);
close(k.pistonPinToCenterM,source.kinematics.pistonPinToCenterM);
close(k.rodCenterFromCrankM,source.kinematics.rodCenterFromCrankM);
close(k.pistonRingFromCenterM,source.kinematics.pistonRingFromCenterM);
assert.deepEqual(k.crankCenterWorld,source.kinematics.crankCenterWorldM);
assert.deepEqual(k.phasesRad,source.kinematics.cylinderPhaseRad);
const index=new Map(catalog.records.map(p=>[p.id,p]));
for(const node of asset.nodes.filter(node=>node.kind==="part")){
  assert.equal(index.get(node.id)?.geometryNodeName,node.id);
  assert.equal(index.get(node.id)?.geometryStatus,"generated");
}
const anchorChecks=asset.mates.map(m=>{
  const aligned=mateAlignment(asset,core.getState(),m.id);
  assert.ok(aligned.acceptable,m.id+" not aligned");
  assert.equal(m.tolerance?.evidence,"conceptual");
  return {mateId:m.id,sourceTier:"conceptual",positionErrorM:aligned.distanceM,
    orientationErrorRad:aligned.angleRad,tolerance:m.tolerance};
});
let maxClosureErrorM=0;
const limits=Array.from({length:4},()=>({min:Infinity,max:-Infinity}));
for(let deg=0;deg<=720;deg++){
  const theta=deg*Math.PI/180;
  const frame=solveEngineI4(k,theta,manifest);
  maxClosureErrorM=Math.max(maxClosureErrorM,frame.maxClosureErrorM);
  close(frame.camAngleRad,theta/2);
  for(const cylinder of frame.cylinders){
    const y=frame.parts[k.pistonPartIds[cylinder.index-1]].position[1];
    const range=limits[cylinder.index-1];
    range.min=Math.min(range.min,y);range.max=Math.max(range.max,y);
  }
  const poses=frame.parts;
  close(poses["engine.piston.1"].position[1],poses["engine.piston.4"].position[1]);
  close(poses["engine.piston.2"].position[1],poses["engine.piston.3"].position[1]);
}
assert.ok(maxClosureErrorM<1e-12);
for(const limit of limits)close(limit.max-limit.min,2*k.throwRadiusM,1e-8);
const initialState=core.getState();
await core.runPlan("plan.engine.i4.disassemble");
const removed=Object.values(core.getState().partStatus).filter(s=>s==="detached").length;
assert.equal(removed,26);
assert.throws(()=>core.setRevoluteAngle(k.crankJointId,Math.PI/2),BlockedOperationError);
await core.runPlan("plan.engine.i4.assemble");
const finalState=core.getState();
assert.deepEqual(finalState.partStatus,initialState.partStatus);
assert.deepEqual(finalState.mateStatus,initialState.mateStatus);
assert.deepEqual(finalState.offsets,initialState.offsets);
const report={
  result:"PASS",assetId:asset.id,batchId:manifest.batchId,
  evidence:"mathematical / conceptual only",
  engineParts:manifest.parts.length,assemblyOperations:asset.operations.length,
  plans:asset.plans.length,connectors:asset.connectors.length,mates:asset.mates.length,
  sliderCrankConstraints:asset.kinematics?.length??0,
  testedAngles:721,cycleDeg:720,strokeM:2*k.throwRadiusM,
  maxClosureErrorM,perCylinderPistonYBoundsM:limits,
  roundTripDetachedParts:removed,roundTripAllPartsAndMatesRestored:true,
  blockedCrankRotationDuringTeardown:true,
  collisionCertified:false,mechanicalCADVerified:false,
  knownVisualFidelityRisks:source.knownVisualFidelityRisks
};
const exportContract={
  schemaVersion:asset.schemaVersion,assetId:asset.id,
  sourceBatchId:manifest.batchId,geometryUri:manifest.geometryUri,
  sourceEvidence:source,
  geometryBindings:asset.nodes.filter(n=>n.kind==="part"),
  connectors:asset.connectors,mates:asset.mates,joints:asset.joints,
  kinematics:asset.kinematics,operations:asset.operations,plans:asset.plans,
  motionPaths:asset.motionPaths,
  verification:report
};
const publicDir=path.join(root,"public/models");
const reportDir=path.join(root,"dist-reports");
fs.mkdirSync(publicDir,{recursive:true});
fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(publicDir,"engine-i4-kinematics-contract.json"),
  JSON.stringify(exportContract,null,2)+"\n");
fs.writeFileSync(path.join(reportDir,"engine-i4-qa.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
