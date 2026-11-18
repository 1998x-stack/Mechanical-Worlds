#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {createGeneratedCarCornerAsset,CORNERS} from "../../dist-core/packages/mechanical-core/src/automotive-corners.js";
import {MechanicalEngine} from "../../dist-core/packages/mechanical-core/src/index.js";
import {mateAlignment} from "../../dist-core/packages/mechanical-core/src/p1.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"assets/generated/automotive/manifest.json"),"utf8"));
const asset=createGeneratedCarCornerAsset(manifest);
const engine=new MechanicalEngine(asset);
const checked=asset.mates.map(m=>{
  const a=mateAlignment(asset,engine.getState(),m.id);
  assert.ok(a.acceptable,"Conceptual anchor misalignment: "+m.id);
  assert.ok(a.distanceM<=m.tolerance.positionM);
  return {id:m.id,partIds:[asset.connectors.find(c=>c.id===m.connectorAId).ownerPartId,
      asset.connectors.find(c=>c.id===m.connectorBId).ownerPartId],
    positionErrorM:a.distanceM,angleErrorRad:a.angleRad,
    acceptanceTolerance:m.tolerance,fastenerPartIds:m.fastenerPartIds??[]};
});
const parts=asset.nodes.filter(n=>n.kind==="part");
assert.equal(parts.length,manifest.parts.length);
assert.ok(parts.every(n=>n.geometryRef?.nodeName===n.id));
const contract={
  contractVersion:"0.1.0",assetId:asset.id,
  geometryUri:manifest.geometryUri,
  sourceManifest:manifest.batchId,
  sourceConfidence:"conceptual, generated-only; not OEM CAD",
  engineeringVerified:false,
  scope:"Four vehicle wheel/brake corners only, not a full vehicle mechanical model",
  coordinateConvention:{units:"m",handedness:"right",up:"+Y",forward:"-Z"},
  partialCoverage:{
    renderablePartInstances:asset.nodes.filter(n=>n.kind==="part").length,
    activeCorners:CORNERS.length,
    plans:asset.plans.length,
    operations:asset.operations.length,
    mates:asset.mates.length,
    connectors:asset.connectors.length,
    motionPaths:asset.motionPaths?.length??0,
    collisionProxies:asset.collisionProxies?.length??0
  },
  parts:parts.map(n=>({id:n.id,parentId:n.parentId,geometryRef:n.geometryRef,designLocal:n.designLocal})),
  connectors:asset.connectors,mates:asset.mates,joints:asset.joints??[],
  operations:asset.operations,plans:asset.plans,
  motionPaths:asset.motionPaths,
  validation:{
    alignmentAtInitialPose:checked,
    result:"PASS",
    collisionMethod:"discrete sampled AABB; intentional mount contacts allowed explicitly",
    limits:["No continuous collision detection","Conceptual mate frames and screw rotations",
      "Not real vehicle service instructions","Other car parts geometry-only"]
  }
};
const outputDir=path.join(root,"public/models");
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,"automotive-corners-contract.json"),JSON.stringify(contract,null,2)+"\n");
const reportDir=path.join(root,"dist-reports");
fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,"automotive-corners-audit.json"),
  JSON.stringify({
    assetId:asset.id,coverage:contract.partialCoverage,
    initialAlignmentFailures:checked.filter(x=>x.positionErrorM>x.acceptanceTolerance.positionM).length,
    result:"PASS",engineeringVerified:false
  },null,2)+"\n");
console.log(JSON.stringify({status:"PASS",partNodes:parts.length,mates:checked.length,
  operations:asset.operations.length,plans:asset.plans.length,confidence:"conceptual"},null,2));
