#!/usr/bin/env node
/**
 * GitHub Pages base-subpath acceptance.
 *
 * `vite preview` has an SPA-fallback quirk that hides broken multi-page routes
 * under a base path, so this test builds with GITHUB_PAGES=true and serves the
 * output from a plain static file server rooted at /Mechanical-Worlds/ — the
 * same way GitHub Pages serves the artifact. It then loads both pages in real
 * Chromium (with a query string) and asserts the assets resolve.
 *
 * Requires public/models/engine-i4-cad-reference.glb (see README).
 */
import {strict as assert} from "node:assert";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright";

const cwd=process.cwd();
const BASE="/Mechanical-Worlds/";
const distDir=path.join(cwd,"dist-pages");
if(!fs.existsSync("public/models/engine-i4-cad-reference.glb")){
  console.error("\nFATAL: public/models/engine-i4-cad-reference.glb is missing.");
  console.error("Run: npm run assets:cad-stage && npm run build\n");
  process.exit(2);
}
console.log("Building Pages-base bundle into dist-pages ...");
execFileSync(process.execPath,["./node_modules/vite/bin/vite.js","build","--outDir","dist-pages"],
  {cwd,env:{...process.env,GITHUB_PAGES:"true"},stdio:"inherit"});

const mime=rel=>rel.endsWith(".js")?"text/javascript":rel.endsWith(".css")?"text/css":
  rel.endsWith(".html")?"text/html":rel.endsWith(".json")?"application/json":
  rel.endsWith(".glb")?"model/gltf-binary":"application/octet-stream";
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost");
  const name=decodeURIComponent(url.pathname);
  if(!name.startsWith(BASE)){res.writeHead(404);res.end("outside base");return;}
  const rel=name.slice(BASE.length)||"index.html";
  const full=path.resolve(distDir,rel);
  if(!full.startsWith(path.resolve(distDir))||!fs.existsSync(full)||fs.statSync(full).isDirectory()){
    res.writeHead(404);res.end("not found");return;
  }
  res.writeHead(200,{"content-type":mime(rel)});fs.createReadStream(full).pipe(res);
});
await new Promise(resolve=>server.listen(4199,"127.0.0.1",resolve));
const origin="http://127.0.0.1:4199"+BASE;
let browser;
try{
  browser=await chromium.launch({headless:true,args:[
    "--no-sandbox","--enable-webgl","--enable-unsafe-swiftshader",
    "--use-gl=angle","--use-angle=swiftshader"]});
  const page=await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  const errors=[],failed=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")errors.push("[console] "+m.text());});
  page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));

  const response=await page.goto(origin+"automotive.html?utm_source=chatgpt.com",{waitUntil:"domcontentloaded"});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>
    document.getElementById("render-info")?.textContent?.includes("106 GLB PARTS LOADED"),{timeout:90000});
  await page.waitForFunction(()=>
    document.getElementById("engine-cad-status")?.textContent?.includes("已加载 18 件真实 B-Rep"),
    null,{timeout:60000});

  const indexResponse=await page.goto(origin,{waitUntil:"domcontentloaded"});
  assert.equal(indexResponse?.status(),200);
  await page.waitForFunction(()=>document.querySelectorAll("#operations .operation").length>0);
  assert.match(await page.locator("#show-catalog strong").textContent(),/106 GENERATED \/ 211 PLANNED/);

  assert.deepEqual(errors,[],"page/console errors under base path");
  // Fail on same-origin asset failures only; a third-party font CDN being
  // unreachable is not a Pages asset-resolution defect.
  assert.deepEqual(failed.filter(u=>u.startsWith(origin)&&!/favicon/.test(u)),[],
    "failed same-origin requests under base path");
  console.log(JSON.stringify({result:"PASS",base:BASE,automotiveStatus:200,
    indexStatus:200,glbParts:106,cadBrepNodes:18,pageErrors:errors.length},null,2));
}finally{
  if(browser)await browser.close();
  server.close();
}
