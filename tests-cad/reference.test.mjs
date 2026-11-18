import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {transferGlbParts} from "../src/glb-part-binding.mjs";

const root="dist-cad/engine-i4/";
const report=JSON.parse(fs.readFileSync(root+"engine-i4-cad-manifest.json","utf8"));
const bytes=fs.readFileSync(root+"engine-i4-cad-reference.glb");
test("BRep STEP contains 18 individually source-linked physical parts, not OEM claims",()=>{
  assert.equal(report.status,"parametric-brep-unreviewed");
  assert.equal(report.validBRep,true);
  assert.equal(report.engineeringVerified,false);
  assert.equal(report.partCount,18);
  assert.equal(report.boreDiameterMm,152);
  assert.equal(report.pistonDiameterMm,144);
  assert.equal(report.crankRadiusMm,85);
  assert.equal(report.rodCenterDistanceMm,245);
  assert.equal(report.conceptualRadialClearanceMm,4);
  assert.equal(report.glbBytes,bytes.length);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),report.glbSha256);
  const step=fs.readFileSync(root+"engine-i4-concept-reference.step","utf8");
  assert.match(step.slice(0,1000),/ISO-10303-21/);
  assert.equal(new Set(report.partIds).size,18);
});
test("CadQuery BRep GLB is real loadable Three.js mesh with exact node identity and transforms",async()=>{
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const scene=(await new Promise((resolve,reject)=>
    new GLTFLoader().parse(buffer,"",resolve,reject))).scene;
  const target=new THREE.Group(),seen=new Map();
  const count=transferGlbParts(scene,target,report.partIds.map(id=>({id})),(id,node)=>seen.set(id,node));
  assert.equal(count,18);
  assert.equal(seen.size,18);
  assert.equal(scene.children.length,0);
  for(const id of report.partIds){
    const node=seen.get(id);
    assert.equal(node.name,id);
    assert.ok(node.position.distanceTo(new THREE.Vector3(...report.positionsM[id]))<1e-9);
    const b=new THREE.Box3().setFromObject(node),dims=b.getSize(new THREE.Vector3());
    assert.ok(dims.lengthSq()>1e-5,"Missing generated BRep triangles: "+id);
  }
});
