#!/usr/bin/env node
import {spawnSync} from "node:child_process";
const skill=process.argv[2]??"",action=process.argv[3]??"audit";
if(!skill||action==="--help"){
  console.log("Usage: node scripts/check.mjs [audit|skills|catalog|assets]");
  process.exit(0);
}
const run=(args)=>{const result=spawnSync(process.execPath,args,{cwd:process.cwd(),stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);};
if(action==="skills")run(["tools/skills/sync.mjs","check"]);
else if(action==="catalog")run(["--test","tests/catalog.test.mjs"]);
else if(action==="assets")run(["tools/asset-pipeline/validate-glb.mjs"]);
else if(action==="audit"){
  run(["tools/skills/sync.mjs","check"]);
  run(["--test","tests/catalog.test.mjs"]);
  console.log("Skill preflight passed:",skill);
}else throw new Error("Unknown action "+action);
