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
  const result=ccd.check(pose(-2),pose(-1),pose(0),pose(0),{
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

// ---- true nonlinear trajectory audits -------------------------------------
// Obstacle A sits at the apex (0,2,0); body B traverses a closed loop of
// radius 1 about (0,1,0): B(t) = (sin 2pi t, 1 - cos 2pi t, 0). Its poses at
// t=0 and t=1 are IDENTICAL, so the endpoint-chord sweep sees zero motion and
// certifies "clear" while the real path passes straight through A at t=0.5.
const loopPose=t=>({position:[Math.sin(2*Math.PI*t),1-Math.cos(2*Math.PI*t),0],rotation:[0,0,0,1]});
const staticPose=()=>({position:[0,2,0],rotation:[0,0,0,1]});
const LOOP_SPEED=2*Math.PI; // |d/dt (sin,1-cos)| = 2pi, no rotation

test("endpoint-chord sweep is UNSOUND for a closed loop (documents the trap)",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(0.2,0.2,0.2));
  const linear=ccd.check(loopPose(0),loopPose(1),staticPose(),staticPose());
  assert.equal(linear.status,"surface-clear","endpoint chord really does look clear here");
  ccd.dispose();
});

test("true-pose trajectory sweep catches contact that endpoint interpolation misses",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(0.2,0.2,0.2));
  const swept=ccd.checkTrajectory(
    ()=>staticPose(),loopPose,
    {start:0,end:1,speedA:0,speedB:LOOP_SPEED,marginM:1e-5});
  assert.equal(swept.status,"surface-contact");
  assert.ok(swept.at>0.2&&swept.at<0.8,"witness should be near the apex, got "+swept.at);
  ccd.dispose();
});

test("true-pose trajectory uses the real parameter domain, not a normalized [0,1] chord",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(0.2,0.2,0.2));
  // Same loop shifted into theta in [10.3, 11.3]; a solver that recursed on a
  // normalized [0,1] range would query the wrong parameter and miss the apex.
  const swept=ccd.checkTrajectory(()=>staticPose(),t=>loopPose(t-10.3),
    {start:10.3,end:11.3,speedA:0,speedB:LOOP_SPEED,marginM:1e-5});
  assert.equal(swept.status,"surface-contact");
  assert.ok(swept.at>10.3&&swept.at<11.3,"witness must be in the real domain, got "+swept.at);
  ccd.dispose();
});

test("true-pose trajectory sweep certifies a genuinely separated nonlinear path",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(0.2,0.2,0.2));
  // Same loop, but the obstacle is moved well outside the swept annulus.
  const farA=()=>({position:[0,4,0],rotation:[0,0,0,1]});
  const swept=ccd.checkTrajectory(farA,loopPose,
    {start:0,end:1,speedA:0,speedB:LOOP_SPEED,marginM:1e-5});
  assert.equal(swept.status,"surface-clear");
  assert.ok(swept.conservativeSurfaceSeparationM>0);
  ccd.dispose();
});

test("true-pose trajectory sweep fails closed as unresolved under a tiny budget",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(0.2,0.2,0.2));
  const swept=ccd.checkTrajectory(()=>staticPose(),loopPose,
    {start:0,end:1,speedA:0,speedB:LOOP_SPEED,maxDepth:0,maxEvaluations:3});
  assert.equal(swept.status,"unresolved");
  ccd.dispose();
});

test("true-pose trajectory sweep requires rigorous, nonnegative speed bounds",()=>{
  const ccd=createMeshCCD(new THREE.BoxGeometry(1,1,1),new THREE.BoxGeometry(0.2,0.2,0.2));
  assert.throws(()=>ccd.checkTrajectory(()=>staticPose(),loopPose,{start:0,end:1,speedA:0}),RangeError);
  assert.throws(()=>ccd.checkTrajectory(()=>staticPose(),loopPose,
    {start:1,end:0,speedA:0,speedB:1}),RangeError);
  ccd.dispose();
});
