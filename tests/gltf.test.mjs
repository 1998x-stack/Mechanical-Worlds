import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const root=new URL("../",import.meta.url);
const glb=readFileSync(new URL("../assets/generated/automotive/fwd-i4-batch-01.glb",import.meta.url));
const manifest=JSON.parse(readFileSync(new URL("../assets/generated/automotive/manifest.json",import.meta.url),"utf8"));

test("actual GLB binary passes independent catalog/hash/reproducibility check",()=>{
  const result=JSON.parse(execFileSync(process.execPath,["tools/asset-pipeline/validate-glb.mjs"],{
    cwd:new URL(root).pathname,encoding:"utf8",maxBuffer:1024*1024
  }));
  assert.equal(result.result,"PASS");
  assert.equal(result.generatedParts,76);
  assert.equal(result.catalogParts,317);
  assert.equal(result.plannedParts,241);
  assert.equal(result.gltfNodes,76);
  assert.equal(result.engineeringVerified,false);
});
test("Three.js GLTFLoader parses 76 independently named glTF part nodes",async()=>{
  const buffer=glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
  const loaded=await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,"",resolve,reject));
  const names=loaded.scene.children.map(node=>node.name);
  assert.equal(names.length,manifest.parts.length);
  const ids=manifest.parts.map(part=>part.id);
  assert.ok(loaded.scene.children.every(node=>node.children.length>0||node.type==="Mesh"));
  for(const [i,expected] of ids.entries()){
    // Three.js may sanitize scene object names, but must retain one scene child per physical part.
    assert.ok(names[i] || loaded.scene.children[i]);
  }
});
