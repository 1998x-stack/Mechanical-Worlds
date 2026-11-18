#!/usr/bin/env node
/**
 * Whole-reference engine collision *audit* across CAD-derived triangle meshes.
 * Robustly classifies finite swept intervals as broadphase-clear, certified
 * triangle-surface-clear, witnessed-surface-contact, or unresolved.
 *
 * BRep source itself is NOT OEM-validated, and 3D solid containment, native
 * CAD clearances, friction, oil films and manufacturing tolerance are out of
 * scope. A contact/unresolved pair does NOT get relabeled safe.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {transferGlbParts} from "../../src/glb-part-binding.mjs";
import {createMeshCCD} from "../../src/mesh-ccd.mjs";
import {createEngineI4Asset,engineI4Constraint,solveEngineI4} from
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
const degreeStep=Number(process.argv.find(s=>s.startsWith("--step-deg="))?.split("=")[1]??60);
if(!Number.isInteger(degreeStep)||degreeStep<=0||720%degreeStep!==0)
  throw Error("--step-deg must be a positive integer divisor of 720");
const ids=report.partIds;
const poseAt=(id,theta)=>solveEngineI4(kinematics,theta,manifest).parts[id];
const vector=v=>new THREE.Vector3(...v),quaternion=q=>new THREE.Quaternion(...q);
const matrix=pose=>new THREE.Matrix4().compose(
  vector(pose.position),quaternion(pose.rotation),new THREE.Vector3(1,1,1)
);
const shapes=new Map();
for(const id of ids){
  const rootObject=nodes.get(id);
  let mesh;
  rootObject.traverse(child=>{if(child.isMesh){if(mesh)throw Error("Multiple CAD mesh components "+id);mesh=child;}});
  if(!mesh||!mesh.geometry.getAttribute("position"))throw Error("Missing CAD mesh "+id);
  mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  shapes.set(id,mesh.geometry);
}
const conservativeBox=(geometry,start,end)=>{
  const a=geometry.boundingBox.clone().applyMatrix4(matrix(start));
  const b=geometry.boundingBox.clone().applyMatrix4(matrix(end));
  const q0=quaternion(start.rotation),q1=quaternion(end.rotation);
  const radius=geometry.boundingSphere.center.length()+geometry.boundingSphere.radius;
  const motion=vector(start.position).distanceTo(vector(end.position))+
    2*radius*Math.acos(Math.min(1,Math.abs(q0.dot(q1))));
  return a.union(b).expandByScalar(motion);
};
const pairs=[],counts={"broadphase-clear":0,"surface-clear":0,"surface-contact":0,"unresolved":0};
for(let deg=0;deg<720;deg+=degreeStep){
  const initial=new Map(),next=new Map(),bounds=new Map();
  const start=deg*Math.PI/180,end=(deg+degreeStep)*Math.PI/180;
  for(const id of ids){
    const p0=poseAt(id,start),p1=poseAt(id,end);
    initial.set(id,p0);next.set(id,p1);
    bounds.set(id,conservativeBox(shapes.get(id),p0,p1));
  }
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const a=ids[i],b=ids[j];
    let state="broadphase-clear",diagnostic=null;
    if(bounds.get(a).intersectsBox(bounds.get(b))){
      const solver=createMeshCCD(shapes.get(a),shapes.get(b));
      const result=solver.check(initial.get(a),next.get(a),initial.get(b),next.get(b),
        {marginM:1e-5,maxDepth:12,maxEvaluations:24});
      state=result.status;diagnostic=result;
      solver.dispose();
    }
    counts[state]++;
    if(state!=="broadphase-clear"&&state!=="surface-clear")
      pairs.push({partA:a,partB:b,startDeg:deg,endDeg:deg+degreeStep,
        status:state,diagnostic});
  }
}
const output={
  status:counts["surface-contact"]||counts.unresolved?"NOT_VERIFIED":"SURFACE_CLEAR_ONLY",
  sourceStatus:"parametric-brep-unreviewed",
  glbSha256:report.glbSha256,
  actualMeshesReviewed:ids.length,
  degreesCovered:[0,720],stepDeg:degreeStep,
  candidatePairsPerInterval:ids.length*(ids.length-1)/2,
  totalPairsChecked:Object.values(counts).reduce((a,b)=>a+b,0),
  resultCounts:counts,unresolvedOrContactPairs:pairs,
  algorithm:"swept conservative world AABB, adaptive BVH triangle-to-triangle distance with motion bound",
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
  start:0,end:720,angleStep:degreeStep},null,2));
