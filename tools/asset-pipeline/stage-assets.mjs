#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,"assets/generated/automotive/manifest.json"),"utf8"));
const src=path.join(root,manifest.geometryUri);
const targetDir=path.join(root,"public/models");
fs.mkdirSync(targetDir,{recursive:true});
const name="automotive-fwd-i4-batch-01.glb";
fs.copyFileSync(src,path.join(targetDir,name));
fs.copyFileSync(path.join(root,"assets/generated/automotive/manifest.json"),
  path.join(targetDir,"automotive-fwd-i4-batch-01-manifest.json"));
console.log("Published static GLB from",manifest.geometryUri,"to",path.join("public/models",name));
