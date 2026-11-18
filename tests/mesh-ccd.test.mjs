import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createMeshCCD} from "../src/mesh-ccd.mjs";
const pose=x=>({position:[x,0,0],rotation:[0,0,0,1]});
test("BVH swept mesh CCD verifies separated boxes without temporal sampling false-safe",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(1,1,1));
  const check=ccd.check(pose(-4),pose(-3),pose(0),pose(0));
  assert.equal(check.status,"surface-clear");
  assert.ok(check.conservativeSurfaceSeparationM>0);
  assert.ok(check.checks>0);
  ccd.dispose();
});
test("BVH CCD catches contact hidden between path endpoints",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(1,1,1));
  const report=ccd.check(pose(-3),pose(3),pose(0),pose(0));
  assert.equal(report.status,"surface-contact");
  assert.ok(report.at>0&&report.at<1);
  ccd.dispose();
});
test("BVH CCD reports unresolved when adaptive budget insufficient rather than claiming clear",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(1,1,1));
  const result=ccd.check(pose(-2),pose(-1.001),pose(0),pose(0),{
    maxDepth:0,maxEvaluations:3
  });
  assert.equal(result.status,"unresolved");
  ccd.dispose();
});
test("BVH CCD validates transform frame and safety margins",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(1,1,1));
  assert.throws(()=>ccd.check(pose(0),pose(0),pose(1),pose(1),{marginM:-1}),RangeError);
  assert.throws(()=>ccd.check(pose(0),pose(0),{position:[0,0,0],rotation:[0,0,0,2]},pose(1)),RangeError);
  ccd.dispose();
});
