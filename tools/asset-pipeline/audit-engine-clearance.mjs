#!/usr/bin/env node
/**
 * Real GLB POSITION accessor bounds: proves inter-cylinder disjoint X
 * projections for 16 rotating/sliding source meshes at ALL crank angles.
 * This is NOT general continuous collision detection.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createEngineI4Asset,engineI4Constraint,solveEngineI4} from "../../dist-core/packages/mechanical-core/src/engine-i4.js";
import {proveAxialSeparation} from "../../dist-core/packages/mechanical-core/src/engine-clearance.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const source=JSON.parse(fs.readFileSync(
  path.join(root,"assets/generated/automotive/manifest-02.json"),"utf8"));
const bytes=fs.readFileSync(path.join(root,source.geometryUri));
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
const size=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+size).toString("utf8"));
const asset=createEngineI4Asset(source),k=engineI4Constraint(asset);
const envelopes=[];
for(let i=1;i<=4;i++)for(const id of [
  "engine.piston."+i,"engine.rod."+i,
  "engine.piston.pin."+i,"engine.piston.rings."+i
]){
  const node=gltf.nodes.find(item=>item.name===id);
  if(!node||!Number.isInteger(node.mesh))throw Error("Missing GLB node "+id);
  assert.ok(!node.scale||node.scale.every(n=>n===1),"Non-unit mesh scaling");
  assert.ok(!node.rotation||node.rotation.every((n,j)=>Math.abs(n-(j===3?1:0))<1e-9),
    "Unexpected authored rotation; X projection invariant must be re-proved");
  const mesh=gltf.meshes[node.mesh];
  let low=Infinity,high=-Infinity;
  for(const p of mesh.primitives){
    const accessor=gltf.accessors[p.attributes.POSITION];
    assert.ok(accessor?.min&&accessor?.max);
    low=Math.min(low,accessor.min[0]);
    high=Math.max(high,accessor.max[0]);
  }
  assert.ok(Number.isFinite(low)&&Number.isFinite(high));
  envelopes.push({
    partId:id,cylinder:i,translationX:node.translation[0],
    minLocalX:low,maxLocalX:high
  });
}
for(let degree=0;degree<=720;degree+=3){
  const frame=solveEngineI4(k,degree*Math.PI/180,source);
  for(const e of envelopes){
    const p=frame.parts[e.partId];
    assert.ok(p);
    assert.ok(Math.abs(p.position[0]-e.translationX)<1e-10,
      "A Part moved along the supposedly invariant X axis: "+e.partId);
    assert.ok(Math.abs(p.rotation[1])<1e-9&&Math.abs(p.rotation[2])<1e-9,
      "A Part rotated away from the crank X-axis: "+e.partId);
  }
}
const proof=proveAxialSeparation(envelopes,0);
assert.equal(proof.status,"PASS","Cross-cylinder geometric X projection overlaps");
assert.equal(proof.testedPairs,96);
assert.ok(proof.minGuaranteedSeparationM>0,"Not enough X-axis separation");
const report={
  assetId:asset.id,sourceGLB:source.geometryUri,
  status:proof.status,method:"continuous fixed-axis separation of GLB mesh X extents",
  proofKind:"projection broadphase exclusion, not swept mesh collision",
  confidence:"exact for named conceptual GLB X intervals under specified slider/crank rotation only",
  testedPairs:proof.testedPairs,minGuaranteedSeparationM:proof.minGuaranteedSeparationM,
  partEnvelopes:envelopes,mathematicalAssumption:proof.assumption,
  excludedCases:["same-cylinder rod/piston contacts","crankshaft and bearing interference",
    "piston/block bore clearance","cams and timing train","all assembly/disassembly extraction paths",
    "mesh defects, material elasticity and source manufacturing tolerance"],
  engineeringVerified:false,fullEngineCollisionCertified:false
};
const dir=path.join(root,"dist-reports"),pub=path.join(root,"public/models");
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(pub,{recursive:true});
fs.writeFileSync(path.join(dir,"engine-i4-axial-clearance.json"),JSON.stringify(report,null,2)+"\n");
fs.writeFileSync(path.join(pub,"engine-i4-axial-clearance.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({
  status:report.status,checkedGLBParts:envelopes.length,
  checkedCylinderPairs:report.testedPairs,
  lowerBoundClearanceM:report.minGuaranteedSeparationM,
  certified:"cross-cylinder axial projection only",fullEngineCollisionCertified:false
},null,2));
