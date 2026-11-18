import {
  transform, validateAsset, type Vec3, type MechanicalAsset, type MechanicalNode,
  type PartDefinition, type Connector, type Mate, type Operation, type OperationPlan,
  type CollisionProxy, type MotionPath, type Effect, type Predicate
} from "../../mechanical-schema/src/index.js";

export type Corner = "fl" | "fr" | "rl" | "rr";
export const CORNERS: Corner[] = ["fl","fr","rl","rr"];
export type GeneratedManifest = {
  geometryUri: string;
  parts: {id:string;meshType:string;positionM:Vec3}[];
};
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const installed=(id:string):Predicate=>({kind:"part",id,equals:"installed"});
const detached=(id:string):Predicate=>({kind:"part",id,equals:"detached"});
const part=(id:string,state:"installed"|"detached"):Effect=>({kind:"part",id,state});
const mateEffect=(id:string,state:"locked"|"released"):Effect=>({kind:"mate",id,state});
const offset=(id:string,value:Vec3):Effect=>({kind:"offset",id,value});

export function createGeneratedCarCornerAsset(manifest:GeneratedManifest):MechanicalAsset {
  const byId=new Map(manifest.parts.map(p=>[p.id,p]));
  if(byId.size!==manifest.parts.length)throw Error("Duplicate GLB Part names");
  const position=(id:string):Vec3=>{
    const row=byId.get(id);
    if(!row)throw Error("Missing GLB Part "+id);
    return row.positionM;
  };
  const definitions:PartDefinition[]=[];
  const defIds=new Set<string>();
  const nodes:MechanicalNode[]=[
    {kind:"assembly",id:"generated.car",name:"Generated car",parentId:null,designLocal:transform([0,0,0])}
  ];
  for(const id of ["chassis","wheels","body"])nodes.push(
    {kind:"assembly",id:"assembly."+id,name:id,parentId:"generated.car",designLocal:transform([0,0,0])}
  );
  for(const row of manifest.parts){
    const kind=row.id.startsWith("wheel.")?"wheels":
      row.id.startsWith("chassis.")?"chassis":"body";
    if(kind==="body"&&!row.id.startsWith("body."))throw Error("Unknown part family "+row.id);
    const definitionId="def.generated."+row.meshType;
    if(!defIds.has(definitionId)){
      defIds.add(definitionId);
      definitions.push({id:definitionId,name:row.meshType,category:"conceptual"});
    }
    nodes.push({
      kind:"part",id:row.id,name:row.id,parentId:"assembly."+kind,
      definitionId,geometryKey:row.meshType,designLocal:transform(row.positionM),
      geometryRef:{uri:manifest.geometryUri,nodeName:row.id,tier:"generated-conceptual"}
    });
  }
  const connectors:Connector[]=[],mates:Mate[]=[],operations:Operation[]=[];
  const plans:OperationPlan[]=[],motionPaths:MotionPath[]=[],collisionProxies:CollisionProxy[]=[];
  const connection=(id:string,a:string,b:string,anchor:Vec3,fasteners:string[]=[]):void=>{
    const left="c."+id+".a",right="c."+id+".b";
    connectors.push(
      {id:left,ownerPartId:a,kind:"mount",local:transform(sub(anchor,position(a)))},
      {id:right,ownerPartId:b,kind:"mount",local:transform(sub(anchor,position(b)))}
    );
    mates.push({id,connectorAId:left,connectorBId:right,initialState:"locked",verified:true,
      tolerance:{positionM:.001,angleRad:.02,evidence:"conceptual"},
      ...(fasteners.length?{fastenerPartIds:fasteners}:{})});
  };
  const motion=(name:string,targetPartIds:string[],kind:MotionPath["kind"],extra:Partial<MotionPath>={}):string=>{
    const id="path.generated."+name;
    motionPaths.push({id,kind,targetPartIds,collisionPolicy:"advisory",samples:24,...extra});
    return id;
  };
  const action=(id:string,label:string,intent:Operation["intent"],targetId:string,
    dependsOn:string[],requires:Predicate[],effects:Effect[],pathId:string):void=>{
    operations.push({id,label,intent,targetId,dependsOn,requires,effects,durationMs:260,pathId});
  };
  for(const corner of CORNERS){
    const side=corner.endsWith("l")?-1:1,stem="generated."+corner;
    const rim="wheel."+corner+".rim",tire="wheel."+corner+".tire",valve="wheel."+corner+".valve",
      hub="chassis.hub."+corner,disc="chassis.brake.disc."+corner,
      caliper="chassis.brake.caliper."+corner,padIn="chassis.brake.pad.in."+corner,
      padOut="chassis.brake.pad.out."+corner;
    const lugs=Array.from({length:5},(_,i)=>"wheel."+corner+".lug."+(i+1));
    const moving=[rim,tire,valve],wheelMate="mate."+stem+".hub";
    connection(wheelMate,rim,hub,position(hub),lugs);
    const brakeMates={
      disc:"mate."+stem+".disc",caliper:"mate."+stem+".caliper",
      padIn:"mate."+stem+".pad.in",padOut:"mate."+stem+".pad.out"
    };
    connection(brakeMates.disc,disc,hub,position(disc));
    connection(brakeMates.caliper,caliper,hub,position(caliper));
    connection(brakeMates.padIn,padIn,caliper,position(padIn));
    connection(brakeMates.padOut,padOut,caliper,position(padOut));
    const removeNuts:string[]=[],installNuts:string[]=[];
    for(let i=0;i<5;i++){
      const lug=lugs[i],id="mate."+stem+".lug."+(i+1);
      connection(id,lug,rim,position(lug));
      const remove="op."+stem+".lug."+(i+1)+".remove";
      const install="op."+stem+".lug."+(i+1)+".install";
      removeNuts.push(remove);installNuts.push(install);
      action(remove,"拆螺母 "+(i+1),"disassemble",lug,[],
        [installed(lug),{kind:"flag",id:"virtualVehicleSupported",equals:true}],
        [part(lug,"detached"),mateEffect(id,"released"),
         offset(lug,[side*(.36+.03*i),.09+.08*i,.10+.055*i])],
        motion(stem+".lug."+(i+1)+".out",[lug],"screw",{
          axisWorld:[side,0,0],turns:2,axialTravelM:.085,screwPhaseFraction:.55,
          ignorePartIds:[...lugs,rim,tire,valve]
        }));
      action(install,"装螺母 "+(i+1),"assemble",lug,["op."+stem+".wheel.install"],
        [detached(lug),installed(rim)],
        [part(lug,"installed"),mateEffect(id,"locked"),offset(lug,[0,0,0])],
        motion(stem+".lug."+(i+1)+".in",[lug],"screw",{
          axisWorld:[-side,0,0],turns:-2,axialTravelM:.085,screwPhaseFraction:.55,
          ignorePartIds:[...lugs,rim,tire,valve]
        }));
    }
    const removeWheel="op."+stem+".wheel.remove",installWheel="op."+stem+".wheel.install";
    const outward:Vec3=[side*.66,.035,0];
    action(removeWheel,"拆下"+corner.toUpperCase()+"车轮","disassemble",rim,removeNuts,
      [installed(rim),...lugs.map(detached)],
      [mateEffect(wheelMate,"released"),...moving.flatMap(id=>[part(id,"detached"),offset(id,outward)])],
      motion(stem+".wheel.out",moving,"linear",{collisionPolicy:"required",samples:36,ignorePartIds:lugs}));
    const removeCaliper="op."+stem+".caliper.remove",
      removePadIn="op."+stem+".pad.in.remove",removePadOut="op."+stem+".pad.out.remove",
      removeDisc="op."+stem+".disc.remove";
    action(removeCaliper,"拆卸"+corner.toUpperCase()+"卡钳","disassemble",caliper,[removeWheel],
      [detached(rim),installed(caliper)],
      [part(caliper,"detached"),mateEffect(brakeMates.caliper,"released"),offset(caliper,[side*.20,.40,.26])],
      motion(stem+".caliper.out",[caliper],"linear"));
    for(const [target,mateName,opId,vec] of [
      [padIn,brakeMates.padIn,removePadIn,[side*.27,.44,.28]],
      [padOut,brakeMates.padOut,removePadOut,[side*.30,.49,.35]]
    ]as [string,string,string,Vec3][]){
      action(opId,"取下刹车片","disassemble",target,[removeCaliper],
        [detached(caliper),installed(target)],
        [part(target,"detached"),mateEffect(mateName,"released"),offset(target,vec)],
        motion(stem+"."+target+".out",[target],"linear"));
    }
    action(removeDisc,"拆卸"+corner.toUpperCase()+"制动盘","disassemble",disc,[removePadIn,removePadOut],
      [detached(caliper),detached(rim),installed(disc)],
      [part(disc,"detached"),mateEffect(brakeMates.disc,"released"),offset(disc,[side*.53,.1,0])],
      motion(stem+".disc.out",[disc],"linear"));
    const installDisc="op."+stem+".disc.install",
      installPadIn="op."+stem+".pad.in.install",installPadOut="op."+stem+".pad.out.install",
      installCaliper="op."+stem+".caliper.install";
    action(installDisc,"回装"+corner.toUpperCase()+"制动盘","assemble",disc,[],
      [detached(disc),installed(hub)],
      [part(disc,"installed"),mateEffect(brakeMates.disc,"locked"),offset(disc,[0,0,0])],
      motion(stem+".disc.in",[disc],"linear"));
    for(const [target,mateName,opId] of [
      [padIn,brakeMates.padIn,installPadIn],[padOut,brakeMates.padOut,installPadOut]
    ]){
      action(opId,"回装刹车片","assemble",target,[installDisc],[detached(target),installed(disc)],
        [part(target,"installed"),mateEffect(mateName,"locked"),offset(target,[0,0,0])],
        motion(stem+"."+target+".in",[target],"linear"));
    }
    action(installCaliper,"回装"+corner.toUpperCase()+"卡钳","assemble",caliper,[installPadIn,installPadOut],
      [detached(caliper),installed(disc),installed(padIn),installed(padOut)],
      [part(caliper,"installed"),mateEffect(brakeMates.caliper,"locked"),offset(caliper,[0,0,0])],
      motion(stem+".caliper.in",[caliper],"linear"));
    action(installWheel,"回装"+corner.toUpperCase()+"车轮","assemble",rim,[installCaliper],
      [detached(rim),installed(disc),installed(caliper)],
      [mateEffect(wheelMate,"locked"),...moving.flatMap(id=>[part(id,"installed"),offset(id,[0,0,0])])],
      motion(stem+".wheel.in",moving,"linear",{collisionPolicy:"required",samples:36,ignorePartIds:lugs}));
    plans.push(
      {id:"plan."+stem+".wheel.remove",label:corner+" wheel removal",intent:"disassemble",
       operationIds:[...removeNuts,removeWheel]},
      {id:"plan."+stem+".wheel.install",label:corner+" wheel reinstallation",intent:"assemble",
       operationIds:[installWheel,...installNuts]},
      {id:"plan."+stem+".brakes.remove",label:corner+" wheel and brake removal",intent:"disassemble",
       operationIds:[...removeNuts,removeWheel,removeCaliper,removePadIn,removePadOut,removeDisc]},
      {id:"plan."+stem+".brakes.install",label:corner+" wheel and brake reinstallation",intent:"assemble",
       operationIds:[installDisc,installPadIn,installPadOut,installCaliper,installWheel,...installNuts]}
    );
    for(const [id,ext] of [
      [rim,[.105,.30,.30]],[tire,[.15,.405,.405]],[valve,[.018,.075,.018]],
      [hub,[.11,.14,.14]],[disc,[.05,.26,.26]],[caliper,[.075,.12,.135]],
      [padIn,[.02,.08,.09]],[padOut,[.02,.08,.09]],
      ...lugs.map(id=>[id,[.035,.035,.035]])
    ]as [string,Vec3][])collisionProxies.push({partId:id,center:[0,0,0],halfExtents:ext});
  }
  const result:MechanicalAsset={
    schemaVersion:"0.1.0",id:"mw.car.corners.generated.p1",
    label:"Four vehicle corners bound to generated GLB",
    description:"Conceptual mechanical operation graph for four wheel and brake corner assemblies.",
    rootId:"generated.car",definitions,nodes,connectors,mates,operations,plans,motionPaths,
    collisionProxies,flags:{virtualVehicleSupported:true}
  };
  const errors=validateAsset(result);
  if(errors.length)throw Error(errors.map(e=>e.code+":"+e.path).join(", "));
  return result;
}
