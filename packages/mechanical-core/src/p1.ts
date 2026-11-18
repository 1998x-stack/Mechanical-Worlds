import {
  add, lerp, type Vec3, type Quat, type MechanicalAsset, type Connector,
  type MotionPath, type Operation, type CollisionProxy
} from "../../mechanical-schema/src/index.js";
import type { RuntimeState } from "./index.js";

// Demonstration-grade kinematic and sampled collision checks, not an industrial physics solver.
export type WorldPose = { position: Vec3; rotation: Quat };
export type Contact = { movingPartId: string; obstaclePartId: string; sample: number; progress: number };
export type CollisionReport = {
  pathId: string; policy: MotionPath["collisionPolicy"];
  ok: boolean; sampleCount: number; checkedPairs: number; contacts: Contact[];
};
const sub = (a: Vec3,b:Vec3):Vec3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale = (a: Vec3,n:number):Vec3 => [a[0]*n,a[1]*n,a[2]*n];
export const identityQuat:Quat=[0,0,0,1];
export function multiplyQuat(a:Quat,b:Quat):Quat {
  const [x,y,z,w]=a,[u,v,k,t]=b;
  return [w*u+x*t+y*k-z*v,w*v-x*k+y*t+z*u,w*k+x*v-y*u+z*t,w*t-x*u-y*v-z*k];
}
export function axisAngle(axis:Vec3,angle:number):Quat {
  const s=Math.sin(angle/2);
  return [axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(angle/2)];
}
export function rotateVector(v:Vec3,q:Quat):Vec3 {
  const [x,y,z,w]=q;
  const cross=(a:Vec3,b:Vec3):Vec3=>
    [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const uv=cross([x,y,z],v),uuv=cross([x,y,z],uv);
  return add(v,add(scale(uv,2*w),scale(uuv,2)));
}
export function getPartPose(asset:MechanicalAsset,state:RuntimeState,id:string,
  joints?:Record<string,number>):WorldPose{
  const nodes=new Map(asset.nodes.map(n=>[n.id,n]));
  const cache=new Map<string,WorldPose>();
  const world=(nodeId:string):WorldPose=>{
    const existing=cache.get(nodeId);if(existing)return existing;
    const n=nodes.get(nodeId);
    if(!n)throw new Error("Unknown node "+nodeId);
    const parent=n.parentId?world(n.parentId):{position:[0,0,0] as Vec3,rotation:identityQuat};
    const pose={
      position:add(parent.position,rotateVector(n.designLocal.position,parent.rotation)),
      rotation:multiplyQuat(parent.rotation,n.designLocal.rotation)
    };
    cache.set(nodeId,pose);return pose;
  };
  const base=world(id),n=nodes.get(id);
  if(n?.kind!=="part")return base;
  const offset:Vec3=state.offsets[id]??[0,0,0];
  let result:WorldPose={position:add(base.position,offset),rotation:base.rotation};
  const j=asset.joints?.find(item=>item.drivenPartId===id);
  if(j){
    const angle=joints?.[j.id]??state.jointAngles[j.id]??j.initialRad;
    const q=axisAngle(j.axisWorld,angle);
    result={
      position:add(j.pivotWorld,rotateVector(sub(result.position,j.pivotWorld),q)),
      rotation:multiplyQuat(q,result.rotation)
    };
  }
  return result;
}
export function connectorPose(asset:MechanicalAsset,state:RuntimeState,c:Connector):WorldPose{
  const owner=getPartPose(asset,state,c.ownerPartId);
  return {
    position:add(owner.position,rotateVector(c.local.position,owner.rotation)),
    rotation:multiplyQuat(owner.rotation,c.local.rotation)
  };
}
export function mateAlignment(asset:MechanicalAsset,state:RuntimeState,mateId:string):{
  distanceM:number;angleRad:number;acceptable:boolean
}{
  const mate=asset.mates.find(m=>m.id===mateId);
  if(!mate)throw new Error("Unknown mate "+mateId);
  const a=asset.connectors.find(c=>c.id===mate.connectorAId);
  const b=asset.connectors.find(c=>c.id===mate.connectorBId);
  if(!a||!b)throw new Error("Unknown connector");
  const left=connectorPose(asset,state,a),right=connectorPose(asset,state,b);
  const distanceM=Math.hypot(...sub(left.position,right.position));
  const qa=left.rotation,qb=right.rotation;
  const d=Math.min(1,Math.abs(qa[0]*qb[0]+qa[1]*qb[1]+qa[2]*qb[2]+qa[3]*qb[3]));
  const angleRad=2*Math.acos(d);
  const revolute=asset.joints?.some(j=>j.mateId===mateId&&j.type==="revolute");
  return {distanceM,angleRad,acceptable:distanceM<=.015&&(revolute||angleRad<=.03)};
}
export function snapPosition(asset:MechanicalAsset,state:RuntimeState,
  sourceConnectorId:string,targetConnectorId:string):Vec3{
  const source=asset.connectors.find(c=>c.id===sourceConnectorId);
  const target=asset.connectors.find(c=>c.id===targetConnectorId);
  if(!source||!target)throw new Error("Unknown source or target connector");
  const pose=getPartPose(asset,state,source.ownerPartId);
  const targetWorld=connectorPose(asset,state,target);
  return sub(targetWorld.position,rotateVector(source.local.position,pose.rotation));
}
type Box={min:Vec3;max:Vec3};
function bounds(asset:MechanicalAsset,state:RuntimeState,proxy:CollisionProxy):Box{
  const pose=getPartPose(asset,state,proxy.partId),c=add(pose.position,rotateVector(proxy.center,pose.rotation));
  const axes:Vec3[]=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rotateVector(v,pose.rotation));
  const e=proxy.halfExtents;
  const extent:[number,number,number]=[0,1,2].map(i=>
    Math.abs(axes[0][i])*e[0]+Math.abs(axes[1][i])*e[1]+Math.abs(axes[2][i])*e[2]) as Vec3;
  return {min:sub(c,extent),max:add(c,extent)};
}
function overlap(a:Box,b:Box):boolean{
  return [0,1,2].every(i=>a.min[i]<b.max[i]-1e-8&&b.min[i]<a.max[i]-1e-8);
}
export function checkPathCollision(asset:MechanicalAsset,before:RuntimeState,after:RuntimeState,
  path:MotionPath):CollisionReport{
  const proxies=asset.collisionProxies??[];
  const moving=new Set(path.targetPartIds),ignored=new Set(path.ignorePartIds??[]);
  const movers=proxies.filter(p=>moving.has(p.partId));
  const obstacles=proxies.filter(p=>!moving.has(p.partId)&&!ignored.has(p.partId));
  const initiallyTouching=new Set<string>(),pair=(a:string,b:string)=>a+"|"+b;
  for(const p of movers)for(const o of obstacles)
    if(overlap(bounds(asset,before,p),bounds(asset,before,o)))
      initiallyTouching.add(pair(p.partId,o.partId));
  const samples=path.samples??24,contacts:Contact[]=[];
  let checkedPairs=0;
  for(let step=1;step<=samples;step++){
    const t=step/samples;
    const s:RuntimeState={...before,offsets:{...before.offsets},jointAngles:{...before.jointAngles}};
    for(const id of moving)s.offsets[id]=lerp(before.offsets[id]??[0,0,0],after.offsets[id]??[0,0,0],t);
    if(path.kind==="hinge"&&path.jointId)
      s.jointAngles[path.jointId]=(before.jointAngles[path.jointId]??0)+
        ((after.jointAngles[path.jointId]??0)-(before.jointAngles[path.jointId]??0))*t;
    for(const p of movers)for(const o of obstacles){
      checkedPairs++;
      if(initiallyTouching.has(pair(p.partId,o.partId)))continue;
      if(overlap(bounds(asset,s,p),bounds(asset,s,o)))
        contacts.push({movingPartId:p.partId,obstaclePartId:o.partId,sample:step,progress:t});
    }
  }
  return {
    pathId:path.id,policy:path.collisionPolicy,
    ok:path.collisionPolicy!=="required"||contacts.length===0,
    sampleCount:samples,checkedPairs,contacts
  };
}
export function inspectMotion(asset:MechanicalAsset,before:RuntimeState,after:RuntimeState,
  op:Operation):CollisionReport|null{
  if(!op.pathId)return null;
  const path=asset.motionPaths?.find(p=>p.id===op.pathId);
  if(!path)throw new Error("Unknown path "+op.pathId);
  return checkPathCollision(asset,before,after,path);
}
export function screwPreview(asset:MechanicalAsset,op:Operation,t:number):
  Record<string,{axis:Vec3;angleRad:number}>{
  const path=asset.motionPaths?.find(p=>p.id===op.pathId);
  if(path?.kind!=="screw"||!path.axisWorld||!path.turns)return {};
  const axis=path.axisWorld,turns=path.turns;
  return Object.fromEntries(path.targetPartIds.map(id=>
    [id,{axis,angleRad:2*Math.PI*turns*t}]));
}
export function jointPreview(op:Operation,state:RuntimeState,t:number):Record<string,number>{
  const values:Record<string,number>={};
  for(const e of op.effects)if(e.kind==="joint"){
    const start=state.jointAngles[e.id]??0;
    values[e.id]=start+(e.angleRad-start)*t;
  }
  return values;
}
