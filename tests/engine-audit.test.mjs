import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";

test("engine I4 CAD-evidence and kinematic quality contract is reproducible",()=>{
  const output=execFileSync(process.execPath,["tools/asset-pipeline/audit-engine-i4.mjs"],{
    cwd:process.cwd(),encoding:"utf8",maxBuffer:2*1024*1024
  });
  const result=JSON.parse(output);
  assert.equal(result.result,"PASS");
  assert.equal(result.engineParts,30);
  assert.equal(result.testedAngles,721);
  assert.equal(result.cycleDeg,720);
  assert.ok(result.maxClosureErrorM<1e-12);
  assert.equal(result.roundTripDetachedParts,26);
  assert.equal(result.roundTripAllPartsAndMatesRestored,true);
  assert.equal(result.collisionCertified,false);
  assert.equal(result.mechanicalCADVerified,false);
  const contract=JSON.parse(fs.readFileSync("public/models/engine-i4-kinematics-contract.json","utf8"));
  assert.equal(contract.kinematics.length,1);
  assert.equal(contract.kinematics[0].pistonPartIds.length,4);
  assert.equal(contract.geometryBindings.length,30);
  assert.ok(contract.sourceEvidence.knownVisualFidelityRisks.length>0);
});
