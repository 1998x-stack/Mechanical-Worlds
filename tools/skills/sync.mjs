#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),mode=process.argv[2]??"check";
if(!["check","sync"].includes(mode))throw new Error("Use check or sync");
const canonical=path.join(root,".agents/skills");
const targets=[".codex/skills",".claude/skills",".pi/skills"];
const names=fs.readdirSync(canonical,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();
if(names.length<7)throw new Error("Expected at least 7 canonical skills");
let mirrored=0;
for(const name of names){
  const source=path.join(canonical,name);
  const relative=["SKILL.md","references/guide.md","scripts/check.mjs","assets/brief.template.json"];
  const front=fs.readFileSync(path.join(source,"SKILL.md"),"utf8");
  const match=front.match(/^---\s*\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---\s*\n/);
  if(!match||match[1]!==name||match[2].length>1024)
    throw new Error("Invalid skill frontmatter: "+name);
  JSON.parse(fs.readFileSync(path.join(source,"assets/brief.template.json"),"utf8"));
  for(const target of targets)for(const file of relative){
    const src=fs.readFileSync(path.join(source,file));
    const dst=path.join(root,target,name,file);
    if(mode==="sync"){
      fs.mkdirSync(path.dirname(dst),{recursive:true});
      fs.writeFileSync(dst,src);
    }else if(!fs.existsSync(dst)||!src.equals(fs.readFileSync(dst))){
      console.error("Skill mirror drift: "+path.relative(root,dst));
      process.exitCode=1;
    }
    mirrored++;
  }
}
console.log(`${mode}: ${names.length} canonical skills / ${mirrored} mirrored files`);
