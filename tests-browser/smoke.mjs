import {strict as assert} from "node:assert";
import fs from "node:fs";
import {spawn} from "node:child_process";
import {chromium} from "playwright";

// Fail fast with an actionable message instead of an opaque 60s timeout when the
// CAD B-Rep GLB has not been staged into the production build.
if(!fs.existsSync("public/models/engine-i4-cad-reference.glb")){
  console.error("\nFATAL: public/models/engine-i4-cad-reference.glb is missing.");
  console.error("The CAD node-replacement step cannot run. Generate it first:\n");
  console.error("  npm run assets:cad-stage   # python tools/cad/generate_engine_reference.py --skip-step --output public/models");
  console.error("  npm run build\n");
  process.exit(2);
}

const origin="http://127.0.0.1:4173";
const server=spawn(process.execPath,["./node_modules/vite/bin/vite.js","preview",
  "--host","127.0.0.1","--port","4173","--strictPort"],{
  stdio:["ignore","pipe","pipe"],env:process.env
});
const std=[];for(const stream of [server.stdout,server.stderr])
  stream.on("data",chunk=>std.push(String(chunk).slice(0,500)));
let browser;
try {
  let ready=false;
  for(let i=0;i<50;i++){
    try {
      const response=await fetch(origin+"/automotive.html");
      if(response.ok){ready=true;break;}
    }catch {}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  assert.ok(ready,"Vite preview unavailable: "+std.join("").slice(-800));
  browser=await chromium.launch({headless:true,args:[
    "--no-sandbox","--enable-webgl","--enable-unsafe-swiftshader",
    "--use-gl=angle","--use-angle=swiftshader"
  ]});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(String(error)));
  const response=await page.goto(origin+"/automotive.html",{waitUntil:"domcontentloaded"});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>
    document.getElementById("render-info")?.textContent?.includes("106 GLB PARTS LOADED"),
    {timeout:90000}
  );
  const loading=page.locator("#loading");
  assert.equal(await loading.isVisible(),false,"GLB loader did not hide loading overlay");
  const records=await page.locator("#parts .part-row").count();
  assert.equal(records,106);
  const canvas=await page.locator("#viewport canvas").count();
  assert.equal(canvas,1);
  await page.waitForFunction(()=>
    document.getElementById("engine-cad-status")?.textContent?.includes("已加载 18 件真实 B-Rep"),
    null,{timeout:60000}
  );
  await page.locator("#engine-focus").click();
  await page.locator("#engine-angle").evaluate(element=>{
    element.value="180";element.dispatchEvent(new Event("input",{bubbles:true}));
  });
  await page.waitForFunction(()=>document.getElementById("engine-angle-value")?.textContent==="180°");
  assert.match(await page.locator("#engine-telemetry").textContent(),/P1:.*P4:/);
  await page.locator("#service-corner").selectOption("fl");
  await page.locator("#service-wheel-out").click();
  await page.waitForFunction(()=>
    document.getElementById("service-status")?.textContent?.includes("已完成：FL wheel remove"),
    {timeout:90000}
  );
  fs.mkdirSync("dist-reports",{recursive:true});
  await page.screenshot({path:"dist-reports/automotive-browser-smoke.png",fullPage:true});
  assert.deepEqual(errors,[],"Browser threw JavaScript exception(s)");
  console.log(JSON.stringify({result:"PASS",loadedGLBParts:records,canvas,
    crankAngle:180,wheelFlow:"FL remove",cadBrepNodes:18,browserPageErrors:errors.length},null,2));
  await context.close();
} finally {
  if(browser)await browser.close();
  server.kill("SIGTERM");
}
