#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {generatePowertrain} from "./generate-powertrain.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"assets/generated/automotive/manifest-02.json"),"utf8"));
const catalog=JSON.parse(fs.readFileSync(path.join(root,"assets/catalog/automotive-fwd-i4-001.json"),"utf8"));
const binary=fs.readFileSync(path.join(root,manifest.geometryUri));
function parse(bytes){
  assert.ok(bytes.length>40);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonBytes=bytes.readUInt32LE(12),jsonStart=20,jsonEnd=jsonStart+jsonBytes;
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  assert.ok(jsonEnd+8<=bytes.length&&jsonBytes%4===0);
  const gltf=JSON.parse(bytes.subarray(jsonStart,jsonEnd).toString("utf8"));
  const binLength=bytes.readUInt32LE(jsonEnd);
  assert.equal(bytes.readUInt32LE(jsonEnd+4),0x004e4942);
  assert.equal(jsonEnd+8+binLength,bytes.length);
  assert.ok(gltf.buffers[0].byteLength<=binLength);
  return {gltf,bin:bytes.subarray(jsonEnd+8)};
}
const {gltf,bin}=parse(binary);
assert.equal(manifest.bytes,binary.length);
assert.equal(gltf.asset.version,"2.0");
assert.equal(gltf.nodes.length,30);
assert.equal(manifest.parts.length,30);
assert.equal(gltf.meshes.length,manifest.uniqueMeshTemplates);
assert.equal(new Set(gltf.nodes.map(n=>n.name)).size,30);
const sha=createHash("sha1").update(Buffer.from("blob "+binary.length+"\0")).update(binary).digest("hex");
assert.equal(sha,manifest.gitBlobSha);
assert.equal(manifest.engineeringVerified,false);
const index=new Map(catalog.records.map(r=>[r.id,r]));
let triangles=0;
for(const mesh of gltf.meshes){
  assert.ok(mesh.primitives.length>0,"Mesh without primitives: "+mesh.name);
  for(const p of mesh.primitives){
    assert.equal(p.mode,4);
    const pos=gltf.accessors[p.attributes.POSITION],
      norm=gltf.accessors[p.attributes.NORMAL],
      ind=gltf.accessors[p.indices];
    assert.ok(pos&&norm&&ind);
    assert.equal(pos.type,"VEC3");assert.equal(norm.type,"VEC3");
    assert.equal(norm.count,pos.count);
    assert.equal(ind.componentType,5125);
    assert.equal(ind.type,"SCALAR");
    assert.ok(pos.count>=3&&ind.count>=3&&ind.count%3===0);
    const getView=a=>{
      const view=gltf.bufferViews[a.bufferView];
      assert.ok(view&&view.buffer===0&&view.byteOffset%4===0);
      assert.ok(view.byteOffset+view.byteLength<=bin.length);
      return view;
    };
    const pv=getView(pos),nv=getView(norm),iv=getView(ind);
    assert.equal(pv.byteLength,pos.count*3*4);
    assert.equal(nv.byteLength,norm.count*3*4);
    assert.equal(iv.byteLength,ind.count*4);
    const d=new DataView(bin.buffer,bin.byteOffset+pv.byteOffset,pv.byteLength);
    const n=new DataView(bin.buffer,bin.byteOffset+nv.byteOffset,nv.byteLength);
    const k=new DataView(bin.buffer,bin.byteOffset+iv.byteOffset,iv.byteLength);
    for(let i=0;i<pos.count*3;i++){
      assert.ok(Number.isFinite(d.getFloat32(i*4,true)),"Nonfinite position");
      assert.ok(Number.isFinite(n.getFloat32(i*4,true)),"Nonfinite normal");
    }
    for(let i=0;i<ind.count;i++)assert.ok(k.getUint32(i*4,true)<pos.count,"Bad mesh index");
    assert.ok(pos.min.every(Number.isFinite)&&pos.max.every(Number.isFinite));
    triangles+=ind.count/3;
  }
}
assert.equal(triangles,manifest.uniqueTriangles);
for(let i=0;i<manifest.parts.length;i++){
  const p=manifest.parts[i],n=gltf.nodes[i],entry=index.get(p.id);
  assert.equal(n.name,p.id,"Missing exact node name");
  assert.equal(p.nodeName,p.id);
  assert.equal(gltf.meshes[n.mesh]?.name,p.meshType);
  assert.deepEqual(n.translation,p.positionM);
  assert.ok(entry&&entry.kind==="part");
  assert.equal(entry.geometryStatus,"generated");
  assert.equal(entry.geometryUri,manifest.geometryUri);
  assert.equal(entry.geometryNodeName,p.id);
  assert.equal(entry.geometrySource,manifest.generator);
  assert.equal(entry.engineeringVerified,false);
}
assert.equal(catalog.stats.generatedParts,106);
assert.equal(catalog.stats.plannedParts,211);
const rebuilt=Buffer.from(generatePowertrain().glb);
const regenerated=parse(rebuilt);
assert.deepEqual(regenerated.gltf.nodes.map(n=>n.name),gltf.nodes.map(n=>n.name));
assert.deepEqual(regenerated.gltf.meshes.map(n=>n.name),gltf.meshes.map(n=>n.name));
let deviation=0;
for(let i=0;i<gltf.accessors.length;i++){
  const a=gltf.accessors[i],b=regenerated.gltf.accessors[i];
  assert.equal(a.count,b.count);assert.equal(a.type,b.type);assert.equal(a.componentType,b.componentType);
  const av=gltf.bufferViews[a.bufferView],bv=regenerated.gltf.bufferViews[b.bufferView];
  assert.equal(av.byteLength,bv.byteLength);
  const x=bin.subarray(av.byteOffset,av.byteOffset+av.byteLength),
    y=regenerated.bin.subarray(bv.byteOffset,bv.byteOffset+bv.byteLength);
  if(a.componentType===5125)assert.ok(x.equals(y),"Index drift");
  else{
    const dx=new DataView(x.buffer,x.byteOffset,x.byteLength),dy=new DataView(y.buffer,y.byteOffset,y.byteLength);
    for(let j=0;j<x.byteLength;j+=4){
      const delta=Math.abs(dx.getFloat32(j,true)-dy.getFloat32(j,true));
      deviation=Math.max(delta,deviation);
      assert.ok(delta<=1e-5,"Generated shape drift >1e-5: "+delta);
    }
  }
}
const report={
  asset:manifest.batchId,result:"PASS",generatedParts:30,gltfNodes:gltf.nodes.length,
  templates:gltf.meshes.length,triangles,bytes:binary.length,gitBlobSha:sha,
  sha256:createHash("sha256").update(binary).digest("hex"),
  maxFloatDeviation:deviation,engineeringVerified:false
};
if(process.argv.includes("--report")){
  const dir=path.join(root,"dist-reports");fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"automotive-batch-02-qa.json"),JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify(report,null,2));
