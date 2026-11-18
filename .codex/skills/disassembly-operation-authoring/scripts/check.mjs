#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const runner=path.join(root,"tools/skills/skill-runner.mjs");
const result=spawnSync(process.execPath,[runner,"disassembly-operation-authoring",...process.argv.slice(2)],{cwd:root,stdio:"inherit"});
process.exit(result.status??1);
