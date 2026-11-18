import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync,} from "node:child_process";
import {readFileSync} from "node:fs";
import {proveAxialSeparation} from "../dist-core/packages/mechanical-core/src/engine-clearance.js";

test("analytical inter-cylinder interval exclusion flags overlap and malformed source",()=>{
  const parts=Array.from({length:4},(_,i)=>
    Array.from({length:4},(_,j)=>({
      partId:"p"+i+"-"+j,cylinder:i+1,translationX:i*.205,
      minLocalX:-.08,maxLocalX:.08
    }))).flat();
  const proof=proveAxialSeparation(parts);
  assert.equal(proof.status,"PASS");
  assert.equal(proof.testedPairs,96);
  assert.ok(proof.minGuaranteedSeparationM>.044);
  parts[4].translationX=.1;
  const violated=proveAxialSeparation(parts);
  assert.equal(violated.status,"FAIL");
  assert.ok(violated.violatingPairs.length>=4);
  assert.throws(()=>proveAxialSeparation(parts,-.01),RangeError);
  assert.throws(()=>proveAxialSeparation(parts.slice(0,15)),/four/);
});
test("engine GLB actual vertex bounds provide 720-degree inter-cylinder exclusion proof",()=>{
  const report=JSON.parse(execFileSync(process.execPath,
    ["tools/asset-pipeline/audit-engine-clearance.mjs"],
    {encoding:"utf8",maxBuffer:1024*1024}));
  assert.equal(report.status,"PASS");
  assert.equal(report.checkedGLBParts,16);
  assert.equal(report.checkedCylinderPairs,96);
  assert.ok(report.lowerBoundClearanceM>0);
  assert.equal(report.fullEngineCollisionCertified,false);
  const details=JSON.parse(readFileSync("dist-reports/engine-i4-axial-clearance.json","utf8"));
  assert.equal(details.partEnvelopes.length,16);
  assert.ok(details.excludedCases.length>=5);
});
