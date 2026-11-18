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
test("audit sweeps the TRUE nonlinear slider-crank trajectory, not endpoint interpolation",()=>{
  assert.match(data.algorithm,/true-pose/);
  assert.match(data.trajectoryModel.assumption,/NOT endpoint interpolation/);
  assert.equal(data.trajectoryModel.certifiedOnlyWithSpeedBound,true);
  assert.equal(data.trajectoryModel.budgetExhaustion,"unresolved");
  // The four pistons, rods, pins and rings plus the crank must have speed bounds;
  // every rod/piston/pin/ring Part is nonlinear for this mechanism.
  const nonlinear=data.trajectoryModel.nonlinearParts;
  assert.ok(nonlinear.includes("engine.crankshaft"));
  for(const id of ["engine.rod.1","engine.piston.2","engine.piston.pin.3","engine.piston.rings.4"])
    assert.ok(nonlinear.includes(id),id+" must be declared nonlinear");
  assert.ok(data.solverBudget.maxEvaluations>0&&data.solverBudget.maxDepth>0);
  assert.equal(data.broadphaseStepDeg<=data.stepDeg,true);
});
test("every non-clear pair is classified and none is exempted by an ignore list",()=>{
  const valid=new Set(["design-fit-candidate","design-fit-unresolved",
    "unreviewed-contact","numerical-unresolved"]);
  const tally={"design-fit-candidate":0,"design-fit-unresolved":0,
    "unreviewed-contact":0,"numerical-unresolved":0};
  for(const issue of data.unresolvedOrContactPairs){
    assert.ok(valid.has(issue.classification),issue.classification);
    assert.equal(issue.reviewRequired,true);
    // classification must follow deterministically from status + authored Mate
    const modeled=issue.modeledInterfaceId!=null;
    const expected=issue.status==="unresolved"
      ?(modeled?"design-fit-unresolved":"numerical-unresolved")
      :(modeled?"design-fit-candidate":"unreviewed-contact");
    assert.equal(issue.classification,expected,
      issue.partA+"|"+issue.partB+" status="+issue.status+" mate="+issue.modeledInterfaceId);
    tally[issue.classification]++;
  }
  for(const key of valid)
    assert.equal(tally[key],data.classificationCounts[key]??0,key+" tally mismatch");
  const sum=Object.values(tally).reduce((a,b)=>a+b,0);
  assert.equal(sum,data.resultCounts.unresolved+data.resultCounts["surface-contact"]);
});
