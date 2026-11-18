#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const catalog=JSON.parse(fs.readFileSync(path.join(root,"assets/catalog/automotive-fwd-i4-001.json"),"utf8"));
const nodes=new Map(catalog.records.map(n=>[n.id,n]));
const args=process.argv.slice(2);
const flag=(name,fallback)=>{const i=args.indexOf("--"+name);return i>=0?args[i+1]:fallback;};
const system=flag("system","powertrain");
const limit=Math.max(1,Math.min(100,Number.parseInt(flag("limit","30"),10)||30));
const family=catalog.systems;
if(!family.includes(system))throw new Error("Unknown system "+system);
const belongsToSystem=id=>{
  let current=nodes.get(id);
  while(current&&current.parentId&&current.parentId!=="vehicle")
    current=nodes.get(current.parentId);
  return current?.id===system;
};
const priorities=[
  [/engine\.block\.cast|engine\.crankshaft|engine\.piston\.\d+|engine\.rod\.\d+/,1],
  [/engine\.piston\.pin|engine\.piston\.rings|engine\.cylinder\.head|engine\.cam/,2],
  [/engine\.oil\.pan|engine\.timing|engine\.valve\.cover/,3],
  [/gearbox\.housing|gearbox\.input|gearbox\.output|gearbox\.gearset|gearbox\.differential/,4],
  [/clutch\.|drive\.axle/,5]
];
const score=id=>{
  const found=priorities.find(([re])=>re.test(id));
  return found?found[1]:10;
};
const pending=catalog.records.filter(n=>n.kind==="part"&&n.geometryStatus==="planned"&&belongsToSystem(n.id));
pending.sort((a,b)=>score(a.id)-score(b.id)||a.id.localeCompare(b.id));
const selected=pending.slice(0,limit);
const plan={
  planVersion:"0.1.0",
  batchId:flag("batch-id","mw.car.fwd-i4.batch-02"),
  catalogId:catalog.id,
  system,
  qualityTarget:"generated",
  geometrySourceRequired:true,
  engineeringVerified:false,
  geometryStatus:"planned",
  reason:"Generate one subsystem-specific geometry release; never promote these rows until validated named GLB mesh nodes exist.",
  prerequisites:["authorized CAD or reproducible procedural source",
    "stable physical part IDs","actual glTF mesh per instance","manifest","automated validation"],
  candidatePartIds:selected.map(n=>n.id),
  candidates:selected.map(n=>({id:n.id,nameZh:n.nameZh,geometryStatus:n.geometryStatus,priority:score(n.id)})),
  acceptance:[
    "Build real binary GLB for each candidate",
    "Every candidate has a non-empty named glTF node",
    "Run assets:validate for the new manifest",
    "Review licensing, units and source confidence",
    "Implement independent Connector/Mate/Operation data before claiming L3 disassembly"
  ]
};
const outfile=flag("out","");
if(outfile){
  const safe=path.resolve(root,outfile);
  if(!safe.startsWith(root+path.sep))throw Error("Output path must stay inside repository");
  fs.mkdirSync(path.dirname(safe),{recursive:true});
  fs.writeFileSync(safe,JSON.stringify(plan,null,2)+"\n");
  console.log("Created",path.relative(root,safe),"with",selected.length,"planned parts");
}else console.log(JSON.stringify(plan,null,2));
