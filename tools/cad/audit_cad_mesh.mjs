#!/usr/bin/env node
/**
 * Whole-reference engine collision *audit* across CAD-derived triangle meshes.
 *
 * Correctness contract (this is the whole point of the audit):
 *  - The 18 CAD Parts are NOT linearly interpolated. Rods, pistons, pins and
 *    rings follow a nonlinear analytic slider-crank closure, so an endpoint
 *    chord can pass while the true arc collides. We therefore query the EXACT
 *    `poseAt(theta)` and bound every certified interval with a rigorous
 *    rigid-body point-speed bound (engineI4SpeedBounds x mesh motion radius).
 *  - `surface-clear` is only ever emitted for an interval whose whole true
 *    sweep is separated. Anything the budget cannot prove fails closed as
 *    `unresolved`; contact witnesses are `surface-contact`.
 *  - Contacts are classified into a possible design fit (the pair has an
 *    authored Mate), an unreviewed contact, or a numerical unresolved. No
 *    ignore-list is used to raise the pass rate.
 *
 * BRep source itself is NOT OEM-validated, and 3D solid containment, native
 * CAD clearances, friction, oil films and manufacturing tolerance are out of
 * scope. A contact/unresolved pair does NOT get relabeled safe.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {transferGlbParts} from "../../src/glb-part-binding.mjs";
import {createMeshCCD,meshMotionRadius} from "../../src/mesh-ccd.mjs";
import {createEngineI4Asset,engineI4Constraint,solveEngineI4,engineI4SpeedBounds} from
  "../../dist-core/packages/mechanical-core/src/engine-i4.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const cadDir=path.join(root,"dist-cad/engine-i4");
const report=JSON.parse(fs.readFileSync(path.join(cadDir,"engine-i4-cad-manifest.json"),"utf8"));
const binary=fs.readFileSync(path.join(cadDir,"engine-i4-cad-reference.glb"));
const manifest=JSON.parse(fs.readFileSync(
  path.join(root,"assets/generated/automotive/manifest-02.json"),"utf8"));
const raw=await new Promise((resolve,reject)=>{
  const bytes=binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength);
  new GLTFLoader().parse(bytes,"",resolve,reject);
});
const combined=new THREE.Group(),nodes=new Map();
transferGlbParts(raw.scene,combined,report.partIds.map(id=>({id})),
  (id,node)=>nodes.set(id,node));
const asset=createEngineI4Asset(manifest),kinematics=engineI4Constraint(asset);
const speedTable=engineI4SpeedBounds(kinematics);
const connectorOwner=new Map(asset.connectors.map(c=>[c.id,c.ownerPartId]));
const pairKey=(a,b)=>[a,b].sort().join("|");
const modeledInterfaces=new Map();
for(const mate of asset.mates){
  const a=connectorOwner.get(mate.connectorAId),
    b=connectorOwner.get(mate.connectorBId);
  if(a&&b)modeledInterfaces.set(pairKey(a,b),mate.id);
}
const degreeStep=Number(process.argv.find(s=>s.startsWith("--step-deg="))?.split("=")[1]??60);
if(!Number.isInteger(degreeStep)||degreeStep<=0||720%degreeStep!==0)
  throw Error("--step-deg must be a positive integer divisor of 720");
const broadphaseStepDeg=Number(process.argv.find(s=>s.startsWith("--broadphase-deg="))
  ?.split("=")[1]??5);
const maxEvaluations=Number(process.argv.find(s=>s.startsWith("--max-evals="))
  ?.split("=")[1]??256);
const maxDepth=Number(process.argv.find(s=>s.startsWith("--max-depth="))
  ?.split("=")[1]??18);
const ids=report.partIds;
const poseAt=(id,theta)=>solveEngineI4(kinematics,theta,manifest).parts[id];
const vector=v=>new THREE.Vector3(...v),quaternion=q=>new THREE.Quaternion(...q);
const matrix=pose=>new THREE.Matrix4().compose(
  vector(pose.position),quaternion(pose.rotation),new THREE.Vector3(1,1,1)
);
const shapes=new Map(),speed=new Map();
for(const id of ids){
  const rootObject=nodes.get(id);
  let mesh;
  rootObject.traverse(child=>{if(child.isMesh){if(mesh)throw Error("Multiple CAD mesh components "+id);mesh=child;}});
  if(!mesh||!mesh.geometry.getAttribute("position"))throw Error("Missing CAD mesh "+id);
  mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  shapes.set(id,mesh.geometry);
  // Rigorous surface-point speed bound (m per radian) = translation speed plus
  // angular speed times the mesh radius about its own origin. Static Parts get 0.
  const bound=speedTable[id]??{translationPerRad:0,rotationPerRad:0};
  speed.set(id,bound.translationPerRad+bound.rotationPerRad*meshMotionRadius(mesh.geometry));
}
const broadphaseStep=broadphaseStepDeg*Math.PI/180;
/** Swept world AABB over [start,end] from true poses, rigorous by speed bound. */
const sweptBox=(id,start,end)=>{
  let box=null;
  for(let t=start;t<end-1e-12;){
    const next=Math.min(end,t+broadphaseStep);
    const slice=shapes.get(id).boundingBox.clone()
      .applyMatrix4(matrix(poseAt(id,t)))
      .expandByScalar(speed.get(id)*(next-t));
    box=box?box.union(slice):slice;
    t=next;
  }
  return box;
};
const pairs=[],counts={"broadphase-clear":0,"surface-clear":0,"surface-contact":0,"unresolved":0};
const classifications={"design-fit-candidate":0,"design-fit-unresolved":0,
  "unreviewed-contact":0,"numerical-unresolved":0};
for(let deg=0;deg<720;deg+=degreeStep){
  const start=deg*Math.PI/180,end=(deg+degreeStep)*Math.PI/180;
  const boxes=new Map();
  for(const id of ids)boxes.set(id,sweptBox(id,start,end));
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=ids[i],b=ids[j];
    let state="broadphase-clear",diagnostic=null,classification=null;
    if(boxes.get(a).intersectsBox(boxes.get(b))){
      const solver=createMeshCCD(shapes.get(a),shapes.get(b));
      const result=solver.checkTrajectory(
        theta=>poseAt(a,theta),theta=>poseAt(b,theta),
        {start,end,speedA:speed.get(a),speedB:speed.get(b),
          marginM:1e-5,maxDepth,maxEvaluations});
      state=result.status;diagnostic=result;
      solver.dispose();
    }
    counts[state]++;
    if(state!=="broadphase-clear"&&state!=="surface-clear"){
      const modeledInterfaceId=modeledInterfaces.get(pairKey(a,b))??null;
      classification=state==="unresolved"
        ?(modeledInterfaceId?"design-fit-unresolved":"numerical-unresolved")
        :(modeledInterfaceId?"design-fit-candidate":"unreviewed-contact");
      classifications[classification]++;
      pairs.push({partA:a,partB:b,startDeg:deg,endDeg:deg+degreeStep,
        status:state,classification,modeledInterfaceId,reviewRequired:true,diagnostic});
    }
  }
}
const output={
  status:counts["surface-contact"]||counts.unresolved?"NOT_VERIFIED":"SURFACE_CLEAR_ONLY",
  sourceStatus:"parametric-brep-unreviewed",
  glbSha256:report.glbSha256,
  actualMeshesReviewed:ids.length,
  degreesCovered:[0,720],stepDeg:degreeStep,broadphaseStepDeg,
  solverBudget:{maxEvaluations,maxDepth,marginM:1e-5},
  candidatePairsPerInterval:ids.length*(ids.length-1)/2,
  totalPairsChecked:Object.values(counts).reduce((a,b)=>a+b,0),
  resultCounts:counts,
  classificationCounts:classifications,
  designFitCandidateCount:classifications["design-fit-candidate"],
  designFitUnresolvedCount:classifications["design-fit-unresolved"],
  unreviewedContactCount:classifications["unreviewed-contact"],
  numericalUnresolvedCount:classifications["numerical-unresolved"],
  unresolvedOrContactPairs:pairs,
  algorithm:"true-pose slider-crank sweep, rigid-body speed-bound broadphase + adaptive BVH triangle-to-triangle distance",
  trajectoryModel:{
    assumption:"poses sampled from the analytic solveEngineI4 closure, NOT endpoint interpolation",
    poseSource:"dist-core/packages/mechanical-core/src/engine-i4.js solveEngineI4",
    speedBoundSource:"engineI4SpeedBounds x meshMotionRadius",
    nonlinearParts:Object.keys(speedTable),
    certifiedOnlyWithSpeedBound:true,
    budgetExhaustion:"unresolved"
  },
  disabledCertificationReasons:[
    "Some CAD meshes touch at intended bearings or share moving joints",
    "B-Rep dimensions are original reference inputs, not manufacturer-supplied",
    "Triangle-surface distance cannot prove solid noncontainment",
    "Not every engine part, gear, gasket or housing is represented",
    "Unknown contact pairs or budget exhaustion fail closed as NOT_VERIFIED"
  ],
  engineeringVerified:false,fullEngineCollisionCertified:false
};
const filename=path.join(cadDir,"engine-i4-mesh-ccd-audit.json");
fs.writeFileSync(filename,JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({status:output.status,meshCount:ids.length,
  totalPairsChecked:output.totalPairsChecked,resultCounts:counts,
  classificationCounts:classifications,start:0,end:720,angleStep:degreeStep,
  broadphaseStepDeg},null,2));
