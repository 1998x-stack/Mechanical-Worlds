import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const data=JSON.parse(fs.readFileSync("dist-cad/engine-i4/engine-i4-mesh-ccd-audit.json","utf8"));
test("engine continuous mesh audit classifies all pairs without silently calling unverified parts safe",()=>{
  assert.equal(data.engineeringVerified,false);
  assert.equal(data.fullEngineCollisionCertified,false);
  assert.equal(data.actualMeshesReviewed,18);
  assert.deepEqual(data.degreesCovered,[0,720]);
  assert.ok(data.totalPairsChecked>0);
  const all=Object.values(data.resultCounts).reduce((a,b)=>a+b,0);
  assert.equal(all,data.totalPairsChecked);
  assert.equal(data.candidatePairsPerInterval,153);
  assert.equal(data.totalPairsChecked,153*720/data.stepDeg);
  for(const issue of data.unresolvedOrContactPairs)
    assert.ok(["unresolved","surface-contact"].includes(issue.status));
  if(data.resultCounts.unresolved||data.resultCounts["surface-contact"])
    assert.equal(data.status,"NOT_VERIFIED");
});
