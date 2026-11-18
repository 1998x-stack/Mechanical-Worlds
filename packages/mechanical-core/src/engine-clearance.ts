/**
 * One rigorously scoped, continuous collision exclusion test.
 * If two independently moving objects have disjoint projections onto a
 * fixed axis for ALL poses, they cannot touch in 3D. This tests only the
 * four cylinder moving groups, not gears, crankshaft, engine casing or
 * removal trajectories.
 */
export interface AxialMeshEnvelope {
  partId: string; cylinder: number;
  translationX: number; minLocalX: number; maxLocalX: number;
}
export interface AxialPair {
  partA: string; partB: string; cylinderA: number; cylinderB: number;
  guaranteedSeparationM: number;
}
export interface AxialClearanceProof {
  status: "PASS" | "FAIL";
  assumption: string;
  testedPairs: number; minGuaranteedSeparationM: number;
  violatingPairs: AxialPair[];
}
export function proveAxialSeparation(
  entries: AxialMeshEnvelope[],requiredClearanceM=0
): AxialClearanceProof {
  if(!Number.isFinite(requiredClearanceM)||requiredClearanceM<0)
    throw new RangeError("Required clearance must be nonnegative");
  const ids=new Set<string>(),groups=new Map<number,number>();
  for(const e of entries){
    if(ids.has(e.partId))throw new Error("Duplicate axial Part ID "+e.partId);
    ids.add(e.partId);
    if(!Number.isInteger(e.cylinder)||e.cylinder<1||e.cylinder>4)
      throw new Error("Cylinder index out of bounds: "+e.partId);
    if(![e.translationX,e.minLocalX,e.maxLocalX].every(Number.isFinite)||
       e.minLocalX>e.maxLocalX)throw new Error("Invalid mesh X interval "+e.partId);
    groups.set(e.cylinder,(groups.get(e.cylinder)??0)+1);
  }
  if(entries.length!==16||groups.size!==4||
    [...groups.values()].some(size=>size!==4))
    throw new Error("Expected four piston/rod/pin/ring GLB meshes per cylinder");
  const failures:AxialPair[]=[];
  let testedPairs=0,minGuaranteedSeparationM=Infinity;
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j];
    if(a.cylinder===b.cylinder)continue;
    const lowA=a.translationX+a.minLocalX,highA=a.translationX+a.maxLocalX;
    const lowB=b.translationX+b.minLocalX,highB=b.translationX+b.maxLocalX;
    const gap=Math.max(lowB-highA,lowA-highB);
    testedPairs++;
    minGuaranteedSeparationM=Math.min(minGuaranteedSeparationM,gap);
    if(gap<=requiredClearanceM)failures.push({
      partA:a.partId,partB:b.partId,cylinderA:a.cylinder,cylinderB:b.cylinder,
      guaranteedSeparationM:gap
    });
  }
  return {
    status:failures.length?"FAIL":"PASS",
    assumption:"Only assembled slider-crank motion: 16 GLB Part nodes rotate solely about X or slide in YZ, with fixed world X translations. Other parts and all teardown paths excluded.",
    testedPairs,minGuaranteedSeparationM,violatingPairs:failures
  };
}
