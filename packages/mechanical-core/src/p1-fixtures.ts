import {
  transform, type MechanicalAsset, type Vec3, type MotionPath, type CollisionProxy,
  type MechanicalJoint
} from "../../mechanical-schema/src/index.js";
import { createWheelAsset, createGlassesAsset } from "./fixtures.js";

// P1 enrichment uses authored coordinates of the procedural fixtures.
// These are exact relative to our demo geometry, not measurements of a real product.
const setPair=(a:MechanicalAsset,mateId:string,source:Vec3,target:Vec3,verified=true):void=>{
  const mate=a.mates.find(m=>m.id===mateId);
  if(!mate)throw new Error("Missing mate "+mateId);
  const first=a.connectors.find(c=>c.id===mate.connectorAId)!;
  const second=a.connectors.find(c=>c.id===mate.connectorBId)!;
  first.local=transform(source);
  second.local=transform(target);
  mate.verified=verified;
};
const proxy=(partId:string,halfExtents:Vec3,center:Vec3=[0,0,0]):CollisionProxy=>
  ({partId,center,halfExtents});
const path=(id:string,kind:MotionPath["kind"],targetPartIds:string[],
  extras:Partial<MotionPath>={}):MotionPath=>
  ({id,kind,targetPartIds,collisionPolicy:"advisory",samples:24,...extras});
const assign=(a:MechanicalAsset,operationId:string,p:MotionPath):void=>{
  const operation=a.operations.find(o=>o.id===operationId);
  if(!operation)throw new Error("Missing operation "+operationId);
  operation.pathId=p.id;
  a.motionPaths!.push(p);
};

export function createP1WheelAsset():MechanicalAsset{
  const a=createWheelAsset();
  a.id="demo.wheel.fl.p1";
  a.label="汽车左前轮 · P1";
  a.description="轮毂与轮辋的局部锚点对齐，五颗螺母按螺旋轨迹预览，轮组按简化 AABB 碰撞预检执行拆卸与合成。";
  a.motionPaths=[];
  a.joints=[];
  setPair(a,"mate.wheel.fl.hub",[.38,0,0],[0,0,0]);
  const lugs=Array.from({length:5},(_,i)=>"wheel.fl.lug."+String(i+1).padStart(2,"0"));
  const wheelParts=["wheel.fl.rim","wheel.fl.tire","wheel.fl.valve"];
  a.collisionProxies=[
    proxy("chassis.hub.fl",[.12,.22,.22]),
    proxy("chassis.brake.disc.fl",[.045,.44,.44]),
    proxy("chassis.brake.caliper.fl",[.09,.14,.19]),
    proxy("wheel.fl.rim",[.10,.47,.47]),
    proxy("wheel.fl.tire",[.15,.76,.76]),
    proxy("wheel.fl.valve",[.04,.11,.04]),
    ...lugs.map(id=>proxy(id,[.07,.067,.067]))
  ];
  for(let i=1;i<=5;i++){
    const id="wheel.fl.lug."+String(i).padStart(2,"0");
    const common={axisWorld:[-1,0,0] as Vec3,turns:2,axialTravelM:.13,screwPhaseFraction:.54,
      ignorePartIds:["wheel.fl.rim","wheel.fl.tire","wheel.fl.valve",...lugs],samples:22,
      collisionPolicy:"required" as const};
    assign(a,"op.wheel.lug."+i+".remove",
      path("path.wheel.lug."+i+".out","screw",[id],common));
    assign(a,"op.wheel.lug."+i+".install",
      path("path.wheel.lug."+i+".in","screw",[id],{...common,axisWorld:[1,0,0],turns:-2}));
  }
  assign(a,"op.wheel.detach",path("path.wheel.fl.out","linear",wheelParts,
    {collisionPolicy:"required",ignorePartIds:lugs,samples:36}));
  assign(a,"op.wheel.attach",path("path.wheel.fl.in","linear",wheelParts,
    {collisionPolicy:"required",ignorePartIds:lugs,samples:36}));
  return a;
}

export function createP1GlassesAsset():MechanicalAsset{
  const a=createGlassesAsset();
  a.id="demo.glasses.p1";
  a.label="机械眼镜 · P1";
  a.description="左右镜腿具有独立转动铰链、开合限位，螺钉沿铰链轴螺旋移出；镜片与鼻托按安装依赖回装。";
  a.motionPaths=[];
  a.joints=[];
  a.collisionProxies=[
    proxy("g.frame",[1.39,.12,.07]),
    ...(["left","right"] as const).flatMap(side=>[
      proxy("g.lens."+side,[.48,.48,.025]),
      proxy("g.hinge."+side,[.10,.13,.13]),
      proxy("g.temple."+side,[.09,.10,.85]),
      proxy("g.screw."+side,[.08,.16,.08]),
      proxy("g.pad."+side,[.12,.14,.09])
    ])
  ];
  for(const side of ["left","right"] as const){
    const sign=side==="left"?-1:1;
    const pivot:Vec3=[sign*1.37,.65,.12];
    const templePosition:Vec3=[sign*1.42,.63,1.00];
    const framePosition:Vec3=[0,.64,0];
    setPair(a,"mate.g.temple.hinge."+side,
      [pivot[0]-templePosition[0],pivot[1]-templePosition[1],pivot[2]-templePosition[2]],
      [0,0,0]);
    setPair(a,"mate.g.hinge.frame."+side,[0,0,0],
      [pivot[0]-framePosition[0],pivot[1]-framePosition[1],pivot[2]-framePosition[2]]);
    const lensPosition:Vec3=[sign*.79,.64,0];
    setPair(a,"mate.g.lens."+side,[0,0,0],
      [lensPosition[0]-framePosition[0],0,0]);
    const padPosition:Vec3=[sign*.22,.32,.10];
    setPair(a,"mate.g.pad."+side,[0,0,0],
      [padPosition[0],padPosition[1]-.64,padPosition[2]]);
    const jointId="joint.g.temple."+side;
    const angle=sign*.78;
    const joint:MechanicalJoint={
      id:jointId,type:"revolute",mateId:"mate.g.temple.hinge."+side,
      drivenPartId:"g.temple."+side,
      pivotWorld:pivot,axisWorld:[0,1,0],
      minRad:Math.min(0,angle),maxRad:Math.max(0,angle),initialRad:0
    };
    a.joints.push(joint);
    const remove=a.operations.find(op=>op.id==="op.g.screw."+side+".remove")!;
    remove.requires.push({kind:"joint",id:jointId,equalsRad:0});
    assign(a,remove.id,path("path.g.screw."+side+".out","screw",
      ["g.screw."+side],{axisWorld:[0,1,0],turns:3,axialTravelM:.14,screwPhaseFraction:.55,
      ignorePartIds:["g.frame","g.hinge."+side,"g.temple."+side],collisionPolicy:"advisory"}));
    assign(a,"op.g.screw."+side+".install",
      path("path.g.screw."+side+".in","screw",["g.screw."+side],
        {axisWorld:[0,-1,0],turns:-3,axialTravelM:.14,screwPhaseFraction:.55,ignorePartIds:["g.frame","g.hinge."+side,"g.temple."+side]}));
    assign(a,"op.g.temple."+side+".remove",path("path.g.temple."+side+".out","linear",
      ["g.temple."+side],{collisionPolicy:"advisory",ignorePartIds:["g.hinge."+side]}));
    assign(a,"op.g.temple."+side+".attach",path("path.g.temple."+side+".in","linear",
      ["g.temple."+side],{collisionPolicy:"advisory",ignorePartIds:["g.hinge."+side]}));
    const openId="op.g.temple."+side+".open",closeId="op.g.temple."+side+".close";
    a.operations.push({
      id:openId,label:"打开"+(side==="left"?"左":"右")+"镜腿",
      intent:"operate",targetId:"g.temple."+side,dependsOn:[],
      requires:[
        {kind:"part",id:"g.temple."+side,equals:"installed"},
        {kind:"mate",id:"mate.g.temple.hinge."+side,equals:"locked"},
        {kind:"joint",id:jointId,equalsRad:0}
      ],
      effects:[{kind:"joint",id:jointId,angleRad:angle}],
      pathId:"path.g.temple."+side+".open",durationMs:660
    });
    a.operations.push({
      id:closeId,label:"闭合"+(side==="left"?"左":"右")+"镜腿",
      intent:"operate",targetId:"g.temple."+side,dependsOn:[],
      requires:[
        {kind:"part",id:"g.temple."+side,equals:"installed"},
        {kind:"mate",id:"mate.g.temple.hinge."+side,equals:"locked"},
        {kind:"joint",id:jointId,equalsRad:angle}
      ],
      effects:[{kind:"joint",id:jointId,angleRad:0}],
      pathId:"path.g.temple."+side+".close",durationMs:660
    });
    a.motionPaths.push(
      path("path.g.temple."+side+".open","hinge",["g.temple."+side],{jointId}),
      path("path.g.temple."+side+".close","hinge",["g.temple."+side],{jointId})
    );
  }
  a.plans.push({
    id:"plan.glasses.open",label:"打开左右镜腿",intent:"operate",
    operationIds:["op.g.temple.left.open","op.g.temple.right.open"]
  });
  a.plans.push({
    id:"plan.glasses.close",label:"闭合左右镜腿",intent:"operate",
    operationIds:["op.g.temple.left.close","op.g.temple.right.close"]
  });
  for(const side of ["left","right"] as const){
    for(const partName of ["lens","pad"] as const){
      const target="g."+partName+"."+side;
      const id="op.g."+partName+"."+side+".remove";
      assign(a,id,path("path."+target+".out","linear",[target],{
        collisionPolicy:"advisory",ignorePartIds:["g.frame"]}));
      assign(a,"op.g."+partName+"."+side+".attach",
        path("path."+target+".in","linear",[target],{
          collisionPolicy:"advisory",ignorePartIds:["g.frame"]}));
    }
    assign(a,"op.g.hinge."+side+".remove",
      path("path.g.hinge."+side+".out","linear",["g.hinge."+side],
        {collisionPolicy:"advisory",ignorePartIds:["g.frame"]}));
    assign(a,"op.g.hinge."+side+".attach",
      path("path.g.hinge."+side+".in","linear",["g.hinge."+side],
        {collisionPolicy:"advisory",ignorePartIds:["g.frame"]}));
  }
  return a;
}
