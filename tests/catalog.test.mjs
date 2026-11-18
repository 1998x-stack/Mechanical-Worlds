import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const catalog = JSON.parse(readFileSync(new URL("../assets/catalog/automotive-fwd-i4-001.json",import.meta.url),"utf8"));
const records = catalog.records;
const byId = new Map(records.map(r=>[r.id,r]));
const systemOf = (node)=>{
  const visited=new Set();
  while(node && node.parentId!=="vehicle" && node.id!=="vehicle"){
    assert.ok(!visited.has(node.id),"Parent cycle: "+node.id);
    visited.add(node.id);
    node=byId.get(node.parentId);
  }
  return node?.id;
};
test("automotive catalog has six systems and a non-duplicated hierarchy",()=>{
  assert.deepEqual(catalog.systems,["body","chassis","powertrain","wheels","interior","electrical"]);
  assert.ok(records.length>=300);
  assert.equal(byId.size,records.length);
  assert.equal(catalog.stats.assemblies,records.filter(r=>r.kind==="assembly").length);
  assert.equal(catalog.stats.parts,records.filter(r=>r.kind==="part").length);
  assert.equal(catalog.stats.totalNodes,records.length);
  assert.equal(catalog.stats.generatedParts,records.filter(r=>r.kind==="part"&&r.geometryStatus==="generated").length);
  assert.equal(catalog.stats.plannedParts,records.filter(r=>r.kind==="part"&&r.geometryStatus==="planned").length);
  const root=byId.get(catalog.rootId);
  assert.ok(root && root.kind==="assembly" && root.parentId===null);
  for(const entry of records){
    if(entry.id===catalog.rootId)continue;
    assert.ok(byId.has(entry.parentId),entry.id+" missing parent "+entry.parentId);
    assert.equal(byId.get(entry.parentId).kind,"assembly");
    assert.ok(catalog.systems.includes(systemOf(entry)),"Invalid system for "+entry.id);
  }
});
test("catalog differentiates real generated GLB nodes from unmodeled plans",()=>{
  const generated=records.filter(r=>r.kind==="part"&&r.geometryStatus==="generated");
  assert.equal(generated.length,106);
  for(const part of records.filter(r=>r.kind==="part")){
    assert.ok(["planned","generated"].includes(part.geometryStatus),part.id);
    assert.equal(part.engineeringVerified,false,part.id);
    assert.ok(part.nameZh);
    if(part.geometryStatus==="generated"){
      assert.equal(part.geometryNodeName,part.id);
      assert.ok(part.geometryUri?.endsWith(".glb"));
      assert.ok(part.geometrySource?.includes("generate-automotive")||
        part.geometrySource?.includes("generate-powertrain"));
    }else{
      assert.equal(part.geometryUri,undefined,part.id+" falsely contains a generated asset URL");
    }
  }
});
test("front-wheel hub/brake parts stay in chassis, removable wheel in wheels",()=>{
  for(const id of ["chassis.hub.fl","chassis.brake.disc.fl","chassis.brake.caliper.fl"]){
    assert.equal(systemOf(byId.get(id)),"chassis");
  }
  for(const id of ["wheel.fl.rim","wheel.fl.tire","wheel.fl.lug.1","wheel.fl.lug.5"]){
    assert.equal(systemOf(byId.get(id)),"wheels");
  }
});
