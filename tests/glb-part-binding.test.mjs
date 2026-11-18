import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {transferGlbParts} from "../src/glb-part-binding.mjs";

for(const [filename,manifestFile,expected] of [
 ["fwd-i4-batch-01.glb","manifest.json",76],
 ["fwd-i4-batch-02.glb","manifest-02.json",30]
]){
 test("REAL Three.js GLTFLoader reparent all "+expected+" nodes without skipping: "+filename,async()=>{
   const manifest=JSON.parse(readFileSync("assets/generated/automotive/"+manifestFile,"utf8"));
   const file=readFileSync("assets/generated/automotive/"+filename);
   const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(
      file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),"",resolve,reject));
   const source=gltf.scene,target=new THREE.Group();
   assert.equal(source.children.length,expected);
   const allOriginal=[...source.children];
   const map=new Map();
   const moved=transferGlbParts(source,target,manifest.parts,(id,node)=>map.set(id,node));
   assert.equal(moved,expected);
   assert.equal(source.children.length,0);
   assert.equal(target.children.length,expected);
   assert.equal(map.size,expected);
   assert.equal(new Set(target.children).size,expected);
   assert.equal(new Set(allOriginal).size,expected);
   for(const part of manifest.parts){
     const node=map.get(part.id);
     assert.ok(node,"Missing "+part.id);
     assert.equal(node.name,part.id);
     assert.equal(node.parent,target);
     assert.ok(node.userData.partId===part.id);
     assert.ok(allOriginal.includes(node));
     const size=new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
     assert.ok(size.lengthSq()>0);
   }
 });
}
test("invalid or duplicate catalog Part IDs do not partially reparent a GLB",()=>{
 const src=new THREE.Group(),dest=new THREE.Group();
 const a=new THREE.Object3D();a.name="a";
 const b=new THREE.Object3D();b.name="b";
 src.add(a,b);
 assert.throws(()=>transferGlbParts(src,dest,[{id:"a"},{id:"missing"}]),/missing catalog/);
 assert.equal(dest.children.length,0);
 assert.equal(src.children.length,2);
 assert.throws(()=>transferGlbParts(src,dest,[{id:"a"},{id:"a"}]),/Duplicate/);
 assert.equal(dest.children.length,0);
 const moved=transferGlbParts(src,dest,[{id:"b"},{id:"a"}]);
 assert.equal(moved,2);
 assert.equal(dest.children[0],b);
 assert.equal(dest.children[1],a);
});
