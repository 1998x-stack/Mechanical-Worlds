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
