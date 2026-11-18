import * as THREE from "three";
import {MeshBVH} from "three-mesh-bvh";

/**
 * Conservative continuous SURFACE-contact audit for linearly interpolated rigid poses.
 *
 * At a midpoint t, BVH gives the minimum triangle-surface distance d. Every
 * vertex can move no farther than V*dt/2, where V is translation path length
 * plus (bounding radius about the local origin * rotation arc length).
 * If d > summed displacement + margin, no triangles can contact anywhere
 * in that entire interval. Otherwise recursively subdivide.
 *
 * Never call this a solid/volume contact proof for a non-watertight mesh:
 * a complete mesh enclosed by another without touching its surface is NOT
 * detectable by triangle distance alone.
 */
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
  const radius=g=>g.boundingSphere.center.length()+g.boundingSphere.radius;
  const radii=[radius(a),radius(b)];
  const vec=v=>new THREE.Vector3(...v);
  const quat=q=>new THREE.Quaternion(...q);
  function endpoint(value){
    if(!Array.isArray(value?.position)||value.position.length!==3||
       !Array.isArray(value?.rotation)||value.rotation.length!==4)
      throw new TypeError("Pose needs position [x,y,z] and rotation [x,y,z,w]");
    if(![...value.position,...value.rotation].every(Number.isFinite))
      throw new TypeError("Nonfinite pose components");
    const q=quat(value.rotation);
    if(Math.abs(q.length()-1)>1e-5)throw new RangeError("Rotation quaternion must be normalized");
    return {p:vec(value.position),q};
  }
  const blend=(from,to,t)=>new THREE.Matrix4().compose(
    from.p.clone().lerp(to.p,t),
    from.q.clone().slerp(to.q,t),
    new THREE.Vector3(1,1,1)
  );
  const motionBound=(start,end,r)=>
    start.p.distanceTo(end.p)+2*r*Math.acos(Math.min(1,Math.abs(start.q.dot(end.q))));
  return {
    check(poseA0,poseA1,poseB0,poseB1,{marginM=0,maxDepth=22,maxEvaluations=1200}={}){
      if(!Number.isFinite(marginM)||marginM<0)throw new RangeError("marginM must be nonnegative");
      if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>30)
        throw new RangeError("maxDepth outside valid range");
      if(!Number.isInteger(maxEvaluations)||maxEvaluations<1)
        throw new RangeError("maxEvaluations must be positive");
      const A0=endpoint(poseA0),A1=endpoint(poseA1),
        B0=endpoint(poseB0),B1=endpoint(poseB1);
      const moveA=motionBound(A0,A1,radii[0]),moveB=motionBound(B0,B1,radii[1]);
      let evals=0,minimumCertifiedSeparationM=Infinity;
      const query=t=>{
        const aMat=blend(A0,A1,t),bMat=blend(B0,B1,t);
        const relative=new THREE.Matrix4().copy(aMat).invert().multiply(bMat);
        if(a.boundsTree.intersectsGeometry(b,relative))return {hit:true,distance:0};
        const hit=a.boundsTree.closestPointToGeometry(b,relative);
        if(!hit||!Number.isFinite(hit.distance))
          throw new Error("BVH failed to compute finite triangle separation");
        return {hit:false,distance:hit.distance};
      };
      const solve=(start,end,depth)=>{
        if(evals>=maxEvaluations)return {status:"unresolved",at:(start+end)/2,reason:"evaluation-budget"};
        const middle=(start+end)/2;
        const {hit,distance}=query(middle);evals++;
        if(hit||distance<=marginM)return {status:"surface-contact",at:middle,clearanceM:distance};
        const arcLimit=(moveA+moveB)*(end-start)*.5;
        const certifiedLower=distance-arcLimit;
        if(certifiedLower>marginM){
          minimumCertifiedSeparationM=Math.min(minimumCertifiedSeparationM,certifiedLower);
          return {status:"surface-clear"};
        }
        if(depth>=maxDepth)
          return {status:"unresolved",at:middle,reason:"subdivision-tolerance",
            conservativeDistanceM:certifiedLower};
        const before=solve(start,middle,depth+1);
        if(before.status!=="surface-clear")return before;
        return solve(middle,end,depth+1);
      };
      const verdict=solve(0,1,0);
      return {
        ...verdict,method:"adaptive-BVH-triangle-distance-motion-bound",
        checks:evals,marginM,
        ...(verdict.status==="surface-clear"?{
          conservativeSurfaceSeparationM:minimumCertifiedSeparationM
        }:{}),
        claim:"surface-contact only; solid containment, mesh defects and physical tolerances not certified"
      };
    },
    dispose(){a.dispose();b.dispose();}
  };
}
