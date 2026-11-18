import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
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
test("STEP export is timestamp-normalized and hash-reproducible",()=>{
  const stepBytes=fs.readFileSync(root+"engine-i4-concept-reference.step");
  assert.equal(crypto.createHash("sha256").update(stepBytes).digest("hex"),report.stepSha256);
  assert.equal(report.stepByteReproducible,true);
  assert.equal(report.stepTimestampNormalizedTo,"1970-01-01T00:00:00");
  const head=stepBytes.toString("utf8").slice(0,1000);
  assert.match(head,/FILE_NAME\('[^']*','1970-01-01T00:00:00'/);
  assert.doesNotMatch(head,/'20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d'/,"STEP still embeds a wall-clock timestamp");
});
test("regenerating the reference CAD twice yields byte-identical STEP and GLB",()=>{
  const py=process.env.PYTHON??"python";
  const a=fs.mkdtempSync(path.join(os.tmpdir(),"mw-cad-a-"));
  const b=fs.mkdtempSync(path.join(os.tmpdir(),"mw-cad-b-"));
  const run=out=>execFileSync(py,["tools/cad/generate_engine_reference.py","--output",out],{stdio:"pipe"});
  run(a);run(b);
  const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  assert.equal(sha(path.join(a,"engine-i4-concept-reference.step")),
    sha(path.join(b,"engine-i4-concept-reference.step")),"STEP bytes differ between identical runs");
  assert.equal(sha(path.join(a,"engine-i4-cad-reference.glb")),
    sha(path.join(b,"engine-i4-cad-reference.glb")),"GLB bytes differ between identical runs");
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
