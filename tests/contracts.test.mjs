import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

test("runtime corner contract export is auditable and matches the committed 76-part geometry",()=>{
  const out=JSON.parse(execFileSync(process.execPath,
    ["tools/asset-pipeline/export-contracts.mjs"],{encoding:"utf8",maxBuffer:1024*1024}));
  assert.equal(out.status,"PASS");
  assert.equal(out.partNodes,76);
  assert.ok(out.mates>=40);
  assert.ok(out.operations>=60);
  assert.equal(out.plans,16);
  const contract=JSON.parse(fs.readFileSync("public/models/automotive-corners-contract.json","utf8"));
  assert.equal(contract.engineeringVerified,false);
  assert.equal(contract.geometryUri,"assets/generated/automotive/fwd-i4-batch-01.glb");
  assert.equal(contract.parts.length,76);
  assert.equal(contract.plans.length,16);
  const ids=new Set(contract.parts.map(n=>n.id));
  assert.equal(ids.size,76);
  for(const n of contract.parts)assert.equal(n.geometryRef.nodeName,n.id);
  for(const c of contract.connectors)assert.ok(ids.has(c.ownerPartId),c.id);
  for(const m of contract.mates){
    assert.equal(m.tolerance.evidence,"conceptual");
    assert.ok(m.tolerance.positionM<=.001);
  }
  for(const check of contract.validation.alignmentAtInitialPose){
    assert.ok(check.positionErrorM<=check.acceptanceTolerance.positionM,check.id);
  }
  const qa=JSON.parse(fs.readFileSync("dist-reports/automotive-corners-audit.json","utf8"));
  assert.equal(qa.result,"PASS");
  assert.equal(qa.initialAlignmentFailures,0);
});
