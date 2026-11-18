import * as THREE from "three";
import {MeshBVH} from "three-mesh-bvh";

/**
 * Conservative continuous SURFACE-contact audits for rigid triangle meshes.
 *
 * Two entry points exist on purpose:
 *
 *  - `check` audits a LINEARLY interpolated sweep between two endpoint poses
 *    (lerp translation, slerp rotation). Use it only when the body really does
 *    travel the straight chord, e.g. a scripted linear disassembly path.
 *
 *  - `checkTrajectory` audits a TRUE nonlinear trajectory described by exact
 *    pose queries `getPose(theta)`. A slider-crank, cam or linkage does NOT
 *    move along the endpoint chord, so `check` is unsound for it and can report
 *    a false `surface-clear`. `checkTrajectory` never does: every certified
 *    interval is bounded by a caller-supplied rigid-body point-speed bound.
 *
 * At a sub-interval midpoint the BVH gives the minimum triangle-surface
 * distance d. A body whose surface points move no faster than `speed` metres per
 * parameter unit can move no farther than speed*(end-start)/2 from its midpoint
 * pose, so the whole sub-interval is separated by at least
 * d - (speedA+speedB)*(end-start)/2. Only when that bound exceeds the margin is
 * `surface-clear` returned; otherwise the interval is subdivided and any budget
 * exhaustion fails closed as `unresolved`.
 *
 * Never call this a solid/volume contact proof for a non-watertight mesh:
 * a complete mesh enclosed by another without touching its surface is NOT
 * detectable by triangle distance alone.
 */
function quatOf(value){
  if(!Array.isArray(value?.rotation)||value.rotation.length!==4)
    throw new TypeError("Pose needs rotation [x,y,z,w]");
  const q=new THREE.Quaternion(...value.rotation);
  if(Math.abs(q.length()-1)>1e-5)throw new RangeError("Rotation quaternion must be normalized");
  return q;
}
function poseOf(value){
  if(!Array.isArray(value?.position)||value.position.length!==3)
    throw new TypeError("Pose needs position [x,y,z]");
  if(![...value.position,...(value.rotation??[])].every(Number.isFinite))
    throw new TypeError("Nonfinite pose components");
  return {p:new THREE.Vector3(...value.position),q:quatOf(value)};
}
/** Rigorous upper bound (metres) on the distance of any mesh point from its
 *  local origin; multiplies an angular speed into a linear surface speed. */
export function meshMotionRadius(geometry){
  if(!geometry?.getAttribute?.("position"))throw new TypeError("meshMotionRadius needs a triangle BufferGeometry");
  if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  return geometry.boundingSphere.center.length()+geometry.boundingSphere.radius;
}
export function createMeshCCD(geometryA,geometryB){
  if(!geometryA?.getAttribute?.("position")||!geometryB?.getAttribute?.("position"))
    throw new TypeError("CCD requires two triangle BufferGeometry instances");
  const a=geometryA.clone(),b=geometryB.clone();
  for(const g of [a,b]){
    if(!g.getAttribute("position")||g.getAttribute("position").count<3)
      throw new Error("CCD requires a populated triangle mesh");
    g.computeBoundingSphere();
    g.boundsTree=new MeshBVH(g);
  }
  const radii=[meshMotionRadius(a),meshMotionRadius(b)];
  const blend=(from,to,t)=>new THREE.Matrix4().compose(
    from.p.clone().lerp(to.p,t),
    from.q.clone().slerp(to.q,t),
    new THREE.Vector3(1,1,1)
  );
  const matrix=pose=>new THREE.Matrix4().compose(pose.p,pose.q,new THREE.Vector3(1,1,1));
  const motionBound=(start,end,r)=>
    start.p.distanceTo(end.p)+2*r*Math.acos(Math.min(1,Math.abs(start.q.dot(end.q))));
  const distanceAt=(matA,matB)=>{
    const relative=new THREE.Matrix4().copy(matA).invert().multiply(matB);
    if(a.boundsTree.intersectsGeometry(b,relative))return {hit:true,distance:0};
    const hit=a.boundsTree.closestPointToGeometry(b,relative);
    if(!hit||!Number.isFinite(hit.distance))
      throw new Error("BVH failed to compute finite triangle separation");
    return {hit:false,distance:hit.distance};
  };
  const claim="surface-contact only; solid containment, mesh defects and physical tolerances not certified";
  return {
    /** Linear endpoint-chord sweep. Unsound for nonlinear mechanisms. */
    check(poseA0,poseA1,poseB0,poseB1,{marginM=0,maxDepth=22,maxEvaluations=1200}={}){
      if(!Number.isFinite(marginM)||marginM<0)throw new RangeError("marginM must be nonnegative");
      if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>30)
        throw new RangeError("maxDepth outside valid range");
      if(!Number.isInteger(maxEvaluations)||maxEvaluations<1)
        throw new RangeError("maxEvaluations must be positive");
      const A0=poseOf(poseA0),A1=poseOf(poseA1),B0=poseOf(poseB0),B1=poseOf(poseB1);
      const halfA=motionBound(A0,A1,radii[0])/2,halfB=motionBound(B0,B1,radii[1])/2;
      return solve({
        query:t=>distanceAt(blend(A0,A1,t),blend(B0,B1,t)),
        halfMotion:(t0,t1)=>(halfA+halfB)*(t1-t0),
        lo:0,hi:1,marginM,maxDepth,maxEvaluations,
        method:"adaptive-BVH-triangle-distance-motion-bound"
      });
    },
    /**
     * True nonlinear sweep. `getPoseA`/`getPoseB` must return the exact rigid
     * pose at a scalar parameter; `speedA`/`speedB` must be rigorous upper
     * bounds in metres of surface displacement per parameter unit (translation
     * speed plus angular speed times `meshMotionRadius`).
     */
    checkTrajectory(getPoseA,getPoseB,{
      start,end,speedA,speedB,marginM=0,maxDepth=22,maxEvaluations=1200}={}){
      if(typeof getPoseA!=="function"||typeof getPoseB!=="function")
        throw new TypeError("checkTrajectory requires getPoseA and getPoseB functions");
      if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
        throw new RangeError("checkTrajectory needs finite start<end");
      for(const [name,speed] of [["speedA",speedA],["speedB",speedB]])
        if(!Number.isFinite(speed)||speed<0)
          throw new RangeError(name+" must be a finite nonnegative point speed (m per parameter unit)");
      if(!Number.isFinite(marginM)||marginM<0)throw new RangeError("marginM must be nonnegative");
      if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>30)
        throw new RangeError("maxDepth outside valid range");
      if(!Number.isInteger(maxEvaluations)||maxEvaluations<1)
        throw new RangeError("maxEvaluations must be positive");
      const sampledA=new Map(),sampledB=new Map();
      const poseA=theta=>{
        if(!sampledA.has(theta))sampledA.set(theta,poseOf(getPoseA(theta)));
        return sampledA.get(theta);
      };
      const poseB=theta=>{
        if(!sampledB.has(theta))sampledB.set(theta,poseOf(getPoseB(theta)));
        return sampledB.get(theta);
      };
      return solve({
        query:theta=>distanceAt(matrix(poseA(theta)),matrix(poseB(theta))),
        halfMotion:(t0,t1)=>(speedA+speedB)*(t1-t0)/2,
        lo:start,hi:end,marginM,maxDepth,maxEvaluations,
        method:"adaptive-BVH-triangle-distance-true-pose-speed-bound"
      });
    },
    dispose(){a.dispose();b.dispose();}
  };
  function solve({query,halfMotion,lo,hi,marginM,maxDepth,maxEvaluations,method}){
    let evals=0,minimumCertifiedSeparationM=Infinity;
    const recurse=(start,end,depth)=>{
      if(evals>=maxEvaluations)return {status:"unresolved",at:(start+end)/2,reason:"evaluation-budget"};
      const middle=(start+end)/2;
      const {hit,distance}=query(middle);evals++;
      if(hit||distance<=marginM)return {status:"surface-contact",at:middle,clearanceM:distance};
      const certifiedLower=distance-halfMotion(start,end);
      if(certifiedLower>marginM){
        minimumCertifiedSeparationM=Math.min(minimumCertifiedSeparationM,certifiedLower);
        return {status:"surface-clear"};
      }
      if(depth>=maxDepth)
        return {status:"unresolved",at:middle,reason:"subdivision-tolerance",
          conservativeDistanceM:certifiedLower};
      const before=recurse(start,middle,depth+1);
      if(before.status!=="surface-clear")return before;
      return recurse(middle,end,depth+1);
    };
    const verdict=recurse(lo,hi,0);
    return {
      ...verdict,method,checks:evals,marginM,
      ...(verdict.status==="surface-clear"?{
        conservativeSurfaceSeparationM:minimumCertifiedSeparationM
      }:{}),
      claim
    };
  }
}
