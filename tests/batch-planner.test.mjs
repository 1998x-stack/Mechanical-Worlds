import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

test("next-batch planner selects only still unmodeled Part IDs",()=>{
  const result=JSON.parse(execFileSync(process.execPath,
    ["tools/asset-pipeline/plan-next-batch.mjs","--system","powertrain","--limit","20"],
    {encoding:"utf8",maxBuffer:2*1024*1024}));
  const catalog=JSON.parse(readFileSync("assets/catalog/automotive-fwd-i4-001.json","utf8"));
  const rows=new Map(catalog.records.map(item=>[item.id,item]));
  assert.equal(result.candidates.length,20);
  assert.equal(new Set(result.candidatePartIds).size,20);
  assert.ok(result.candidatePartIds.some(id=>id.startsWith("engine.")));
  for(const id of result.candidatePartIds){
    assert.equal(rows.get(id).geometryStatus,"planned",id);
    assert.equal(rows.get(id).kind,"part",id);
  }
  assert.equal(result.engineeringVerified,false);
  assert.equal(result.geometryStatus,"planned");
});

test("checked-in batch 02 candidates remain planned and belong to powertrain",()=>{
  const plan=JSON.parse(readFileSync("assets/plans/automotive-batch-02.json","utf8"));
  const catalog=JSON.parse(readFileSync("assets/catalog/automotive-fwd-i4-001.json","utf8"));
  const index=new Map(catalog.records.map(row=>[row.id,row]));
  assert.equal(plan.geometryStatus,"planned");
  assert.equal(plan.candidatePartIds.length,30);
  assert.equal(new Set(plan.candidatePartIds).size,30);
  for(const id of plan.candidatePartIds){
    const row=index.get(id);
    assert.equal(row.kind,"part");
    assert.equal(row.geometryStatus,"planned");
    let n=row;
    while(n&&n.parentId&&n.parentId!=="vehicle")n=index.get(n.parentId);
    assert.equal(n?.id,"powertrain",id);
  }
});
