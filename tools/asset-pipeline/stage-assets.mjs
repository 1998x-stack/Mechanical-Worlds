#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=process.cwd(),output=path.join(root,"public/models");
fs.mkdirSync(output,{recursive:true});
for(const i of [1,2]){
  const name=i===1?"manifest.json":"manifest-02.json";
  const m=JSON.parse(fs.readFileSync(path.join(root,"assets/generated/automotive",name),"utf8"));
  const prefix="automotive-fwd-i4-batch-"+String(i).padStart(2,"0");
  fs.copyFileSync(path.join(root,m.geometryUri),path.join(output,prefix+".glb"));
  fs.copyFileSync(path.join(root,"assets/generated/automotive",name),path.join(output,prefix+"-manifest.json"));
  console.log("Staged",prefix+".glb",m.parts.length,"parts");
}
