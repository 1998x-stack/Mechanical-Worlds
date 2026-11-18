import {
  transform, validateAsset,
  type Vec3, type Quat, type MechanicalAsset, type MechanicalNode,
  type PartDefinition, type Connector, type Mate, type Operation,
  type OperationPlan, type Predicate, type Effect, type SliderCrankConstraint,
  type MotionPath
} from "../../mechanical-schema/src/index.js";

/**
 * A slider-crank's geometric closure is enforced analytically:
 * crank pin: y=r*cos(theta), z=r*sin(theta)
 * piston pin: y=r*cos(theta)+sqrt(L^2-r^2*sin(theta)^2), z=0
 *
 * All dimensions are generated concept parameters, NOT OEM engineering data.
 * Coordinate system is RH, Y up, X crankshaft axis, vehicle front -Z.
 */
export interface EngineI4Manifest {
  geometryUri:string;
  parts:{id:string;meshType:string;positionM:Vec3}[];
}
export type EnginePose={position:Vec3;rotation:Quat};
export interface CylinderPose {
  index:number; phaseRad:number;
  crankPinWorld:Vec3; pistonPinWorld:Vec3;
  rodPitchRad:number; rodLengthErrorM:number;
}
export interface EngineI4Frame {
  crankAngleRad:number;camAngleRad:number;
  parts:Record<string,EnginePose>;
  cylinders:CylinderPose[];
  maxClosureErrorM:number;
}

const zero:Vec3=[0,0,0];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const magnitude=(a:Vec3):number=>Math.hypot(...a);
const quatX=(angle:number):Quat=>[Math.sin(angle/2),0,0,Math.cos(angle/2)];
const identity:Quat=[0,0,0,1];
const rodId=(n:number)=>"engine.rod."+n;
const pistonId=(n:number)=>"engine.piston."+n;
const pinId=(n:number)=>"engine.piston.pin."+n;
const ringId=(n:number)=>"engine.piston.rings."+n;
const jointId="joint.engine.i4.crankshaft";
const mechanismId="mechanism.engine.i4.slider-crank";

/** This solver has NO physical mesh collision/force simulation. */
export function solveEngineI4(constraint:SliderCrankConstraint,theta:number,
  source:EngineI4Manifest):EngineI4Frame {
  if(!Number.isFinite(theta))throw new RangeError("Crank angle must be finite");
  const r=constraint.throwRadiusM,L=constraint.rodLengthM;
  if(!(r>0 && L>r))throw new RangeError("Rod must be longer than crank radius");
  if(constraint.pistonPartIds.length!==4||constraint.rodPartIds.length!==4||
     constraint.pinPartIds.length!==4||constraint.ringPartIds.length!==4||
     constraint.phasesRad.length!==4)throw new Error("I4 solver requires four cylinders");
  const parts:Record<string,EnginePose>={};
  for(const p of source.parts)parts[p.id]={position:[...p.positionM] as Vec3,rotation:identity};
  const set=(id:string,p:Vec3,rotation:Quat=identity)=>{
    if(!parts[id])throw new Error("Missing GLB node for mechanism Part "+id);
    parts[id]={position:p,rotation};
  };
  set(constraint.crankPartId,constraint.crankCenterWorld,quatX(theta));
  if(parts["engine.crankshaft.pulley"])
    set("engine.crankshaft.pulley",
      parts["engine.crankshaft.pulley"].position,quatX(theta));
  for(const cam of ["engine.cam.intake","engine.cam.exhaust"])
    if(parts[cam])set(cam,parts[cam].position,quatX(theta/2));
  const cylinders:CylinderPose[]=[];
  let maxClosureErrorM=0;
  for(let i=0;i<4;i++){
    const part=source.parts.find(p=>p.id===constraint.pistonPartIds[i]);
    if(!part)throw new Error("Missing cylinder "+(i+1));
    const phase=theta+constraint.phasesRad[i];
    const sine=Math.sin(phase),cosine=Math.cos(phase);
    const lower:Vec3=[part.positionM[0],
      constraint.crankCenterWorld[1]+r*cosine,
      constraint.crankCenterWorld[2]+r*sine];
    const rise=Math.sqrt(L*L-r*r*sine*sine);
    const upper:Vec3=[part.positionM[0],lower[1]+rise,constraint.crankCenterWorld[2]];
    const direction=sub(upper,lower);
    const pitch=Math.atan2(direction[2],direction[1]);
    const rodCenter=add(lower,[
      0,Math.cos(pitch)*constraint.rodCenterFromCrankM,
      Math.sin(pitch)*constraint.rodCenterFromCrankM
    ]);
    const pistonCenter:Vec3=[upper[0],
      upper[1]+constraint.pistonPinToCenterM,upper[2]];
    const ringCenter:Vec3=[pistonCenter[0],
      pistonCenter[1]+constraint.pistonRingFromCenterM,pistonCenter[2]];
    set(constraint.rodPartIds[i],rodCenter,quatX(pitch));
    set(constraint.pistonPartIds[i],pistonCenter);
    set(constraint.pinPartIds[i],upper);
    set(constraint.ringPartIds[i],ringCenter);
    const error=Math.abs(magnitude(direction)-L);
    maxClosureErrorM=Math.max(maxClosureErrorM,error);
    cylinders.push({index:i+1,phaseRad:phase,
      crankPinWorld:lower,pistonPinWorld:upper,
      rodPitchRad:pitch,rodLengthErrorM:error});
  }
  return {crankAngleRad:theta,camAngleRad:theta/2,
    parts,cylinders,maxClosureErrorM};
}
export function engineI4Constraint(asset:MechanicalAsset):SliderCrankConstraint {
  const entry=asset.kinematics?.find(k=>k.type==="slider-crank"&&k.id===mechanismId);
  if(!entry)throw new Error("Missing inline-four kinematics contract");
  return entry;
}
export interface EngineI4PartSpeed{translationPerRad:number;rotationPerRad:number;}
/**
 * Rigorous upper bounds on the surface-point speed of each MOVABLE Part with
 * respect to crank angle in the analytic slider-crank closure. Combine the
 * angular term with a Part's mesh motion radius to obtain a metres-per-radian
 * surface-speed bound. Parts not present in the returned map are static in this
 * mechanism (identity rotation and fixed manifest position).
 *
 * Slider-crank closure (per cylinder, phase-independent worst case):
 *   rise  = sqrt(L^2 - r^2 sin^2 phi)
 *   piston pin y = crankCenterY + r cos phi + rise
 *   rod pitch = atan2(-r sin phi, rise)
 * so |d(rise)/dphi| <= r^2/(2 sqrt(L^2-r^2)), |d(pistonY)/dphi| <= r + that,
 * and |d(pitch)/dphi| <= r(L + |d(rise)|)/L^2 (denominator is exactly L^2).
 */
export function engineI4SpeedBounds(
  constraint:SliderCrankConstraint):Record<string,EngineI4PartSpeed> {
  const r=constraint.throwRadiusM,L=constraint.rodLengthM;
  if(!(r>0&&L>r))throw new RangeError("Rod must be longer than crank radius");
  const root=Math.sqrt(L*L-r*r);
  const riseSpeed=r*r/(2*root);
  const pistonSpeed=r+riseSpeed;
  const pitchSpeed=r*(L+riseSpeed)/(L*L);
  const rodTranslation=r+constraint.rodCenterFromCrankM*pitchSpeed;
  const out:Record<string,EngineI4PartSpeed>={};
  out[constraint.crankPartId]={translationPerRad:0,rotationPerRad:1};
  out["engine.crankshaft.pulley"]={translationPerRad:0,rotationPerRad:1};
  out["engine.cam.intake"]={translationPerRad:0,rotationPerRad:0.5};
  out["engine.cam.exhaust"]={translationPerRad:0,rotationPerRad:0.5};
  for(const id of constraint.pistonPartIds)out[id]={translationPerRad:pistonSpeed,rotationPerRad:0};
  for(const id of constraint.ringPartIds)out[id]={translationPerRad:pistonSpeed,rotationPerRad:0};
  for(const id of constraint.pinPartIds)out[id]={translationPerRad:pistonSpeed,rotationPerRad:0};
  for(const id of constraint.rodPartIds)
    out[id]={translationPerRad:rodTranslation,rotationPerRad:pitchSpeed};
  return out;
}

const installed=(id:string):Predicate=>({kind:"part",id,equals:"installed"});
const detached=(id:string):Predicate=>({kind:"part",id,equals:"detached"});
const effectPart=(id:string,state:"installed"|"detached"):Effect=>({kind:"part",id,state});
const effectOffset=(id:string,value:Vec3):Effect=>({kind:"offset",id,value});
const effectMate=(id:string,state:"locked"|"released"):Effect=>({kind:"mate",id,state});

export function createEngineI4Asset(manifest:EngineI4Manifest):MechanicalAsset {
  if(!manifest.geometryUri.endsWith(".glb"))throw new Error("Engine source must be a GLB");
  const table=new Map(manifest.parts.map(p=>[p.id,p]));
  if(table.size!==manifest.parts.length || table.size!==30)
    throw new Error("Expected exactly 30 unique Batch 02 GLB parts");
  const pos=(id:string):Vec3=>{
    const item=table.get(id);
    if(!item)throw new Error("Missing powertrain geometry "+id);
    return item.positionM;
  };
  const definitions:PartDefinition[]=[],defs=new Set<string>();
  const nodes:MechanicalNode[]=[
    {kind:"assembly",id:"assembly.engine.car",name:"Powertrain mechanical reference",parentId:null,designLocal:transform(zero)},
    {kind:"assembly",id:"assembly.engine.i4",name:"Inline 4",parentId:"assembly.engine.car",designLocal:transform(zero)},
    {kind:"assembly",id:"assembly.engine.differential",name:"Differential visual reference",parentId:"assembly.engine.car",designLocal:transform(zero)}
  ];
  for(const item of manifest.parts) {
    const definitionId="def.engine."+item.meshType;
    if(!defs.has(definitionId)){
      defs.add(definitionId);
      definitions.push({id:definitionId,name:item.meshType,category:"generated-conceptual"});
    }
    nodes.push({kind:"part",id:item.id,name:item.id,definitionId,
      parentId:item.id.startsWith("gearbox.")?"assembly.engine.differential":"assembly.engine.i4",
      geometryKey:item.meshType,designLocal:transform(item.positionM),
      geometryRef:{uri:manifest.geometryUri,nodeName:item.id,tier:"generated-conceptual"}});
  }
  const connectors:Connector[]=[],mates:Mate[]=[],operations:Operation[]=[];
  const motionPaths:MotionPath[]=[],plans:OperationPlan[]=[];
  const connection=(id:string,left:string,right:string,world:Vec3):void=>{
    connectors.push(
      {id:"c."+id+".a",ownerPartId:left,kind:"mount",local:transform(sub(world,pos(left)))},
      {id:"c."+id+".b",ownerPartId:right,kind:"mount",local:transform(sub(world,pos(right)))}
    );
    mates.push({id,connectorAId:"c."+id+".a",connectorBId:"c."+id+".b",
      initialState:"locked",verified:true,
      tolerance:{positionM:.001,angleRad:.02,evidence:"conceptual"}});
  };
  const block="engine.block.cast",crank="engine.crankshaft";
  const names={
    bearing:"mate.engine.i4.crank.bearing",
    head:"mate.engine.i4.head.block",
    oilpan:"mate.engine.i4.oilpan.block",
    valvecover:"mate.engine.i4.valvecover.head",
    pulley:"mate.engine.i4.pulley.crank",
    intake:"mate.engine.i4.cam.intake",
    exhaust:"mate.engine.i4.cam.exhaust",
    cover:"mate.engine.i4.timing.cover",
    belt:"mate.engine.i4.timing.belt",
    tensioner:"mate.engine.i4.timing.tensioner"
  };
  connection(names.bearing,crank,block,pos(crank));
  connection(names.head,"engine.cylinder.head",block,pos("engine.cylinder.head"));
  connection(names.oilpan,"engine.oil.pan",block,pos("engine.oil.pan"));
  connection(names.valvecover,"engine.valve.cover","engine.cylinder.head",pos("engine.valve.cover"));
  connection(names.pulley,"engine.crankshaft.pulley",crank,pos("engine.crankshaft.pulley"));
  connection(names.intake,"engine.cam.intake","engine.cylinder.head",pos("engine.cam.intake"));
  connection(names.exhaust,"engine.cam.exhaust","engine.cylinder.head",pos("engine.cam.exhaust"));
  connection(names.cover,"engine.timing.cover",block,pos("engine.timing.cover"));
  connection(names.belt,"engine.timing.belt","engine.crankshaft.pulley",pos("engine.timing.belt"));
  connection(names.tensioner,"engine.timing.tensioner",block,pos("engine.timing.tensioner"));
  const rodMates:string[]=[];
  const pistonParts=Array.from({length:4},(_,i)=>pistonId(i+1));
  const rodParts=Array.from({length:4},(_,i)=>rodId(i+1));
  const pins=Array.from({length:4},(_,i)=>pinId(i+1));
  const rings=Array.from({length:4},(_,i)=>ringId(i+1));
  for(let i=1;i<=4;i++){
    const rodMate="mate.engine.i4.rod.crank."+i;
    rodMates.push(rodMate);
    connection(rodMate,rodId(i),crank,pos(rodId(i)));
    connection("mate.engine.i4.pin.piston."+i,pinId(i),pistonId(i),pos(pinId(i)));
    connection("mate.engine.i4.pin.rod."+i,pinId(i),rodId(i),pos(pinId(i)));
    connection("mate.engine.i4.rings.piston."+i,ringId(i),pistonId(i),pos(ringId(i)));
  }
  const constraint:SliderCrankConstraint={
    id:mechanismId,type:"slider-crank",crankJointId:jointId,crankPartId:crank,
    crankCenterWorld:pos(crank),
    crankAxisWorld:[1,0,0],pistonAxisWorld:[0,1,0],
    throwRadiusM:.085,rodLengthM:.245,
    phasesRad:[0,Math.PI,Math.PI,0],
    pistonPartIds:pistonParts,rodPartIds:rodParts,pinPartIds:pins,ringPartIds:rings,
    pistonPinToCenterM:.035,rodCenterFromCrankM:.115,pistonRingFromCenterM:.045,
    authoringTier:"generated-conceptual",
    sourceId:"assets/generated/automotive/manifest-02.json",
    requiresMateIds:[names.bearing,...rodMates]
  };
  const removed=new Map<string,string>(),installedIds=new Map<string,string>();
  const addOperation=(item:{
    id:string;partId:string;label:string;intent:"disassemble"|"assemble";
    dependsOn?:string[]; requires?:Predicate[]; effects?:Effect[];
    targetOffset?:Vec3; mates?:string[];
  }):void=>{
    const pathId="path."+item.id;
    const delta:Vec3=item.targetOffset??[.3,.28,.14];
    const effects:Effect[]=[
      effectPart(item.partId,item.intent==="disassemble"?"detached":"installed"),
      effectOffset(item.partId,item.intent==="disassemble"?delta:zero),
      ...(item.mates??[]).map(id=>effectMate(id,item.intent==="disassemble"?"released":"locked")),
      ...(item.effects??[])
    ];
    operations.push({
      id:item.id,label:item.label,intent:item.intent,targetId:item.partId,
      dependsOn:item.dependsOn??[],
      requires:[{kind:"joint",id:jointId,equalsRad:0},
        item.intent==="disassemble"?installed(item.partId):detached(item.partId),
        ...(item.requires??[])],
      effects,durationMs:260,pathId
    });
    motionPaths.push({
      id:pathId,kind:"linear",targetPartIds:[item.partId],
      collisionPolicy:"advisory",samples:24
    });
    (item.intent==="disassemble"?removed:installedIds).set(item.partId,item.id);
  };
  const remove=(id:string,deps:string[]=[],mates:string[]=[],shift:Vec3=[.28,.26,.14])=>{
    addOperation({id:"op.engine.i4.remove."+id,label:"Remove "+id,intent:"disassemble",
      partId:id,dependsOn:deps,mates,targetOffset:shift});
  };
  const install=(id:string,deps:string[]=[],mates:string[]=[])=>{
    addOperation({id:"op.engine.i4.install."+id,label:"Install "+id,intent:"assemble",
      partId:id,dependsOn:deps,mates});
  };
  const valve="engine.valve.cover",cover="engine.timing.cover",belt="engine.timing.belt",
    tensioner="engine.timing.tensioner",camIn="engine.cam.intake",
    camEx="engine.cam.exhaust",head="engine.cylinder.head",
    oilpan="engine.oil.pan",pulley="engine.crankshaft.pulley";
  // A deliberate *conceptual* service DAG. Production engine removal also
  // needs bearing caps, pin clips and tools not yet present in the 317 catalog.
  remove(valve,[],[names.valvecover]);
  remove(cover,[removed.get(valve)!],[names.cover]);
  remove(belt,[removed.get(cover)!],[names.belt]);
  remove(tensioner,[removed.get(belt)!],[names.tensioner]);
  remove(camIn,[removed.get(belt)!,removed.get(valve)!],[names.intake]);
  remove(camEx,[removed.get(belt)!,removed.get(valve)!],[names.exhaust]);
  remove(head,[removed.get(camIn)!,removed.get(camEx)!],[names.head]);
  remove(oilpan,[],[names.oilpan],[0,-.45,0]);
  remove(pulley,[removed.get(belt)!],[names.pulley]);
  for(let i=1;i<=4;i++){
    remove(ringId(i),[removed.get(head)!],["mate.engine.i4.rings.piston."+i],[0,.47,.24+i*.035]);
    remove(pinId(i),[removed.get(ringId(i))!],
      ["mate.engine.i4.pin.piston."+i,"mate.engine.i4.pin.rod."+i],[.35,.40,.25+i*.035]);
    remove(pistonId(i),[removed.get(pinId(i))!],[],[0,.61,.13+i*.042]);
    remove(rodId(i),[removed.get(pistonId(i))!,removed.get(oilpan)!],
      [rodMates[i-1]],[.28,-.4,.15+i*.04]);
  }
  remove(crank,[removed.get(oilpan)!,removed.get(pulley)!,
    ...rodParts.map(id=>removed.get(id)!)],[names.bearing],[.45,-.32,.2]);
  install(crank,[],[names.bearing]);
  for(let i=1;i<=4;i++){
    install(rodId(i),[installedIds.get(crank)!],[rodMates[i-1]]);
    install(pistonId(i),[installedIds.get(rodId(i))!]);
    install(pinId(i),[installedIds.get(pistonId(i))!],
      ["mate.engine.i4.pin.piston."+i,"mate.engine.i4.pin.rod."+i]);
    install(ringId(i),[installedIds.get(pinId(i))!],["mate.engine.i4.rings.piston."+i]);
  }
  install(oilpan,rodParts.map(id=>installedIds.get(id)!),[names.oilpan]);
  install(pulley,[installedIds.get(crank)!],[names.pulley]);
  install(head,rings.map(id=>installedIds.get(id)!),[names.head]);
  install(camIn,[installedIds.get(head)!],[names.intake]);
  install(camEx,[installedIds.get(head)!],[names.exhaust]);
  install(tensioner,[installedIds.get(head)!],[names.tensioner]);
  install(belt,[installedIds.get(pulley)!,installedIds.get(camIn)!,
    installedIds.get(camEx)!,installedIds.get(tensioner)!],[names.belt]);
  install(cover,[installedIds.get(belt)!],[names.cover]);
  install(valve,[installedIds.get(camIn)!,installedIds.get(camEx)!,
    installedIds.get(cover)!],[names.valvecover]);
  plans.push({
    id:"plan.engine.i4.disassemble",
    label:"I4 conceptual teardown",
    intent:"disassemble",operationIds:[...removed.values()]
  },{
    id:"plan.engine.i4.assemble",
    label:"I4 independent reassembly",
    intent:"assemble",operationIds:[...installedIds.values()]
  });
  const asset:MechanicalAsset={
    schemaVersion:"0.1.0",id:"mw.engine.i4.kinematic.p1",label:"I4 slider crank",
    description:"A generated 30-Part engine with one kinematic mechanism and a separate conceptual teardown DAG",
    rootId:"assembly.engine.car",
    nodes,definitions,connectors,mates,operations,plans,motionPaths,
    joints:[{
      id:jointId,type:"revolute",mateId:names.bearing,drivenPartId:crank,
      pivotWorld:pos(crank),axisWorld:[1,0,0],
      minRad:0,maxRad:Math.PI*4,initialRad:0
    }],
    kinematics:[constraint]
  };
  const issues=validateAsset(asset).filter(issue=>issue.severity==="error");
  if(issues.length)throw new Error(issues.map(i=>i.code+":"+i.path).join("; "));
  return asset;
}
