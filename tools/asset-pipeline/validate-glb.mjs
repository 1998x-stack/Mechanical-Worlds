#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFileSync,existsSync,writeFileSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {generateAutomotive} from "./generate-automotive.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const manifestPath=path.join(root,"assets/generated/automotive/manifest.json");
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
const catalog=JSON.parse(readFileSync(path.join(root,"assets/catalog/automotive-fwd-i4-001.json"),"utf8"));
const assetPath=path.join(root,manifest.geometryUri);
assert.ok(existsSync(assetPath),"Missing committed GLB");
const bytes=readFileSync(assetPath);
function parseGLB(buffer){
  assert.ok(buffer.length>40,"GLB too short");
  assert.equal(buffer.readUInt32LE(0),0x46546c67,"GLB magic");
  assert.equal(buffer.readUInt32LE(4),2,"glTF 2.0 required");
  assert.equal(buffer.readUInt32LE(8),buffer.length,"GLB byte length");
  const jsonSize=buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16),0x4e4f534a,"JSON chunk");
  const jsonEnd=20+jsonSize;
  assert.ok(jsonSize>0 && jsonEnd+8<=buffer.length,"JSON chunk bounds");
  const gltf=JSON.parse(buffer.subarray(20,jsonEnd).toString("utf8"));
  const binBytes=buffer.readUInt32LE(jsonEnd);
  assert.equal(buffer.readUInt32LE(jsonEnd+4),0x004e4942,"BIN chunk");
  assert.equal(jsonEnd+8+binBytes,buffer.length,"Binary chunk bounds");
  assert.equal(gltf.buffers.length,1);
  assert.ok(gltf.buffers[0].byteLength<=binBytes);
  return {gltf,bin:buffer.subarray(jsonEnd+8)};
}
const {gltf,bin}=parseGLB(bytes);
assert.equal(gltf.asset.version,"2.0");
assert.equal(manifest.bytes,bytes.length);
const hasNamedPart=new Map();
for(const node of gltf.nodes){
  assert.ok(node.name && !hasNamedPart.has(node.name),"Duplicate/unbound glTF node "+node.name);
  assert.ok(Number.isInteger(node.mesh) && gltf.meshes[node.mesh],"Node missing mesh "+node.name);
  assert.ok(node.translation?.length===3 && node.translation.every(Number.isFinite));
  hasNamedPart.set(node.name,node);
}
const expected=new Set(manifest.parts.map(p=>p.id));
assert.equal(expected.size,manifest.parts.length,"Duplicate manifest part ID");
assert.equal(hasNamedPart.size,expected.size,"Manifest / GLB node count");
let triangles=0,templates=0;
for(const mesh of gltf.meshes){
  let meshTriangles=0;
  assert.ok(mesh.primitives.length>0,"No primitives: "+mesh.name);
  for(const prim of mesh.primitives){
    assert.equal(prim.mode,4,"Triangle primitive mode expected");
    const vertex=gltf.accessors[prim.attributes.POSITION];
    const normal=gltf.accessors[prim.attributes.NORMAL];
    const indices=gltf.accessors[prim.indices];
    assert.ok(vertex&&normal&&indices,"Missing accessor");
    assert.equal(vertex.type,"VEC3");
    assert.equal(normal.type,"VEC3");
    assert.equal(normal.count,vertex.count);
    assert.equal(indices.type,"SCALAR");
    assert.equal(indices.componentType,5125);
    assert.equal(indices.count%3,0);
    assert.ok(vertex.count>=3,"Insufficient vertices");
    assert.ok(indices.count>=3,"No triangles");
    for(const index of [prim.attributes.POSITION,prim.attributes.NORMAL,prim.indices]){
      const acc=gltf.accessors[index],view=gltf.bufferViews[acc.bufferView];
      assert.ok(view&&view.buffer===0,"Invalid view");
      assert.equal(view.byteOffset%4,0,"Bad 4-byte alignment");
      assert.ok(view.byteOffset>=0&&view.byteOffset+view.byteLength<=bin.length,"Buffer overrun");
    }
    const pView=gltf.bufferViews[vertex.bufferView],nView=gltf.bufferViews[normal.bufferView];
    const iView=gltf.bufferViews[indices.bufferView];
    assert.equal(pView.byteLength,vertex.count*3*4);
    assert.equal(nView.byteLength,normal.count*3*4);
    assert.equal(iView.byteLength,indices.count*4);
    assert.ok(vertex.min.every(Number.isFinite)&&vertex.max.every(Number.isFinite));
    for(let axis=0;axis<3;axis++){
      assert.ok(vertex.min[axis]<=vertex.max[axis]);
      assert.ok(Math.abs(vertex.min[axis])<25 && Math.abs(vertex.max[axis])<25,"Unreasonable local bounds");
    }
    const dataPos=new DataView(bin.buffer,bin.byteOffset+pView.byteOffset,pView.byteLength);
    for(let j=0;j<vertex.count*3;j++){
      const val=dataPos.getFloat32(j*4,true);
      assert.ok(Number.isFinite(val),"NaN/Inf in mesh "+mesh.name);
    }
    const dataIdx=new DataView(bin.buffer,bin.byteOffset+iView.byteOffset,iView.byteLength);
    for(let j=0;j<indices.count;j++){
      const idx=dataIdx.getUint32(j*4,true);
      assert.ok(idx<vertex.count,"Out of range mesh index "+mesh.name);
    }
    meshTriangles+=indices.count/3;
  }
  assert.ok(meshTriangles>0,"Empty mesh template");
  triangles+=meshTriangles;
  templates++;
}
assert.equal(templates,manifest.uniqueMeshTemplates);
assert.equal(triangles,manifest.uniqueTriangles);
const catalogIndex=new Map(catalog.records.map(row=>[row.id,row]));
assert.equal(catalogIndex.size,catalog.records.length,"Duplicate catalog records");
let rendered=0;
for(const entry of catalog.records.filter(r=>r.kind==="part")){
  if(entry.geometryStatus==="generated"){
    rendered++;
    assert.ok(expected.has(entry.id),"Catalog falsely marked generated: "+entry.id);
    assert.equal(entry.geometryNodeName,entry.id);
    assert.equal(entry.geometryUri,manifest.geometryUri);
    assert.equal(entry.geometrySource,manifest.generator);
    assert.equal(entry.engineeringVerified,false,"Generated meshes must not claim CAD review");
  }
}
for(const part of manifest.parts){
  assert.ok(hasNamedPart.has(part.id),"Missing GLB node "+part.id);
  assert.ok(catalogIndex.has(part.id),"Manifest unknown catalog ID "+part.id);
  assert.equal(catalogIndex.get(part.id).kind,"part");
  assert.equal(catalogIndex.get(part.id).geometryStatus,"generated");
  const actualMesh=gltf.meshes[hasNamedPart.get(part.id).mesh];
  assert.equal(actualMesh.name,part.meshType);
  assert.ok(part.triangles>0);
}
assert.equal(rendered,manifest.parts.length,"Generated status count");
assert.equal(catalog.stats.generatedParts,rendered);
assert.equal(catalog.stats.plannedParts,catalog.records.filter(row=>row.kind==="part"&&row.geometryStatus==="planned").length);
const gitSha=createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex");
assert.equal(gitSha,manifest.gitBlobSha,"Committed binary differs from declared Git content hash");
const rebuilt=Buffer.from(generateAutomotive().glb);
const regen=parseGLB(rebuilt);
assert.equal(regen.gltf.asset.version,gltf.asset.version);
assert.deepEqual(regen.gltf.nodes.map(n=>n.name),gltf.nodes.map(n=>n.name));
assert.deepEqual(regen.gltf.meshes.map(m=>m.name),gltf.meshes.map(m=>m.name));
assert.deepEqual(regen.gltf.meshes.map(m=>m.primitives.map(p=>p.indices)),
  gltf.meshes.map(m=>m.primitives.map(p=>p.indices)));
assert.equal(regen.gltf.accessors.length,gltf.accessors.length);
let largestDeviation=0;
for(let idx=0;idx<gltf.accessors.length;idx++){
  const a=gltf.accessors[idx],b=regen.gltf.accessors[idx];
  assert.equal(a.componentType,b.componentType,"Regeneration component type drift");
  assert.equal(a.count,b.count,"Regeneration vertex/index count drift");
  assert.equal(a.type,b.type,"Regeneration accessor shape drift");
  const viewA=gltf.bufferViews[a.bufferView],viewB=regen.gltf.bufferViews[b.bufferView];
  assert.equal(viewA.byteLength,viewB.byteLength,"Regeneration topology/buffer drift");
  if(a.componentType===5125){
    assert.ok(bin.subarray(viewA.byteOffset,viewA.byteOffset+viewA.byteLength)
      .equals(regen.bin.subarray(viewB.byteOffset,viewB.byteOffset+viewB.byteLength)),
      "Regeneration index topology drift");
  }else{
    const dataA=new DataView(bin.buffer,bin.byteOffset+viewA.byteOffset,viewA.byteLength);
    const dataB=new DataView(regen.bin.buffer,regen.bin.byteOffset+viewB.byteOffset,viewB.byteLength);
    for(let i=0;i<viewA.byteLength;i+=4){
      const delta=Math.abs(dataA.getFloat32(i,true)-dataB.getFloat32(i,true));
      largestDeviation=Math.max(largestDeviation,delta);
      assert.ok(delta<=1e-5,"Regenerated float coordinate drift beyond 1e-5: "+delta);
    }
  }
}

const qa={
  asset:manifest.batchId,
  uri:manifest.geometryUri,
  geometryTier:manifest.designTier,
  catalogParts:catalog.stats.parts,
  generatedParts:rendered,
  plannedParts:catalog.stats.plannedParts,
  gltfNodes:hasNamedPart.size,
  gltfTemplates:templates,
  distinctTemplateTriangles:triangles,
  binaryBytes:bytes.length,
  sha256:createHash("sha256").update(bytes).digest("hex"),
  gitBlobSha:gitSha,
  reproducibleGeometry:true,
  maxFloatRegenerationDeviation:largestDeviation,
  result:"PASS",
  engineeringVerified:false
};
console.log(JSON.stringify(qa,null,2));
if(process.argv.includes("--report")){
  const out=path.join(root,"dist-reports","automotive-batch-01-qa.json");
  mkdirSync(path.dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(qa,null,2)+"\n");
}
