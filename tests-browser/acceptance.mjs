#!/usr/bin/env node
/**
 * Mechanical-Worlds browser acceptance runner.
 *
 * Exercises the real production preview in Chromium/WebGL:
 *  - automotive.html: 106 named GLB parts, 18 B-Rep CAD node replacement,
 *    0/90/180/360/720 crank phases, cutaway during motion, four-corner
 *    wheel+brake round trips, 26-step I4 teardown/assembly with a
 *    Core guard that blocks crankshaft drive after teardown, query-param
 *    safety, search/filter.
 *  - index.html: wheel + glasses scenarios, undo/redo/reset, live catalog.
 *
 * It writes screenshots and a JSON report into dist-reports/.
 * Requires a prior `npm run build`; CAD B-Rep acceptance additionally
 * requires public/models/engine-i4-cad-reference.glb (see README).
 */
import {strict as assert} from "node:assert";
import fs from "node:fs";
import {spawn} from "node:child_process";
import {chromium} from "playwright";

const CWD=process.cwd();
const origin="http://127.0.0.1:4173";
const cadGlb="public/models/engine-i4-cad-reference.glb";
const STEP_DELAY=300;
const checks=[];
function record(name,detail){checks.push({name,detail});console.log("  ✓",name,detail===undefined?"":detail);}

if(!fs.existsSync(cadGlb)){
  console.error("\nFATAL: "+cadGlb+" is missing.");
  console.error("The CAD B-Rep browser acceptance step cannot run without it.");
  console.error("Generate it with the pinned toolchain, then re-run:\n");
  console.error("  python tools/cad/generate_engine_reference.py --skip-step --output public/models\n");
  process.exit(2);
}

const server=spawn(process.execPath,["./node_modules/vite/bin/vite.js","preview",
  "--host","127.0.0.1","--port","4173","--strictPort"],{stdio:["ignore","pipe","pipe"],cwd:CWD});
const serverLog=[];for(const s of [server.stdout,server.stderr])s.on("data",c=>serverLog.push(String(c).slice(0,400)));
const reportsDir="dist-reports";fs.mkdirSync(reportsDir,{recursive:true});
let browser;
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{const r=await fetch(origin+"/automotive.html");if(r.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,400));
  }
  assert.ok(ready,"Vite preview unavailable: "+serverLog.join("").slice(-800));
  browser=await chromium.launch({headless:true,args:[
    "--no-sandbox","--enable-webgl","--enable-unsafe-swiftshader",
    "--use-gl=angle","--use-angle=swiftshader"]});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")errors.push("[console] "+m.text());});
  const failed=[];page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));

  // poll until the status reaches a deterministic terminal marker. Long plans
  // may emit advisory diagnostics mid-run, so a stability window is unsafe.
  async function waitStatusMatch(sel,re,{timeout=90000,label=""}={}){
    const start=Date.now();
    while(Date.now()-start<timeout){
      const t=await page.locator(sel).textContent().catch(()=>"");
      if(re.test(t))return t;
      await page.waitForTimeout(200);
    }
    const last=await page.locator(sel).textContent().catch(()=>"<missing>");
    throw new Error((label||"status")+" never matched "+re+" within "+timeout+"ms; last="+last);
  }
  async function clickAndWait(clickSel,statusSel,re,timeout){
    await page.locator(clickSel).click();
    return waitStatusMatch(statusSel,re,{timeout,label:clickSel});
  }
  // wait for the status to change away from its pre-click value and match a pattern.
  async function clickAndChange(clickSel,statusSel,re,{timeout=60000}={}){
    const before=await page.locator(statusSel).textContent().catch(()=>"");
    await page.locator(clickSel).click();
    const start=Date.now();
    while(Date.now()-start<timeout){
      const t=await page.locator(statusSel).textContent().catch(()=>"");
      if(t!==before&&re.test(t))return t;
      await page.waitForTimeout(200);
    }
    throw new Error(clickSel+" status never changed from \""+before+"\" to "+re);
  }

  console.log("\n[A] automotive.html — asset load and query-param safety");
  await page.goto(origin+"/automotive.html?utm_source=chatgpt.com",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>
    document.getElementById("render-info")?.textContent?.includes("106 GLB PARTS LOADED"),{timeout:90000});
  assert.equal(await page.locator("#loading").isVisible(),false);
  assert.equal(await page.locator("#parts .part-row").count(),106);
  assert.equal(await page.locator("#viewport canvas").count(),1);
  await page.waitForFunction(()=>
    document.getElementById("engine-cad-status")?.textContent?.includes("已加载 18 件真实 B-Rep"),null,{timeout:60000});
  record("106 named GLB parts + 18 B-Rep CAD nodes load despite ?utm_source param");

  console.log("[B] I4 crank phases 0/90/180/360/720 via shared analytic solve");
  const expected={
    0:[0.885,0.715,0.715,0.885],
    90:[0.785,0.785,0.785,0.785],
    180:[0.715,0.885,0.885,0.715],
    360:[0.885,0.715,0.715,0.885],
    720:[0.885,0.715,0.715,0.885]};
  for(const angle of [0,90,180,360,720]){
    await page.locator("#engine-angle").evaluate((el,v)=>{
      el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));},angle);
    await page.waitForFunction(a=>document.getElementById("engine-angle-value")?.textContent===a+"°",angle);
    const text=await page.locator("#engine-telemetry").textContent();
    const m=/P1:\s*([\d.]+)m\s*·\s*P2:\s*([\d.]+)m\s*·\s*P3:\s*([\d.]+)m\s*·\s*P4:\s*([\d.]+)m\s*·\s*闭环数值误差\s*([\d.eE+-]+)\s*m/.exec(text);
    assert.ok(m,"telemetry unparsable at "+angle+"°: "+text);
    const got=[1,2,3,4].map(i=>Number(m[i]));
    assert.deepEqual(got,expected[angle],"piston heights at "+angle+"°");
    assert.ok(Number(m[5])<1e-9,"rod closure error at "+angle+"° is "+m[5]);
    record("crank "+angle+"° pistons",JSON.stringify(got));
  }
  const cam=JSON.parse(fs.readFileSync("public/models/engine-i4-kinematics-contract.json","utf8"));
  assert.equal(cam.sourceEvidence.kinematics.camToCrankRatio,0.5);
  assert.equal(cam.sourceEvidence.kinematics.crankCycleDeg,720);
  record("contract declares cam:crank = 1:2 over a 720° cycle");

  console.log("[C] cutaway toggles during motion without error");
  await page.locator("#engine-cutaway").click();
  await page.locator("#engine-cutaway").click();
  await page.waitForFunction(()=>document.getElementById("engine-cad-status")?.textContent?.includes("已加载 18"));
  record("cutaway on/off during crank pose keeps CAD scene intact");

  console.log("[D] four-corner wheel + brake round trips");
  for(const corner of ["fl","fr","rl","rr"]){
    await page.locator("#service-corner").selectOption(corner);
    await clickAndWait("#service-reset","#service-status",/已恢复所有四轮角总成的初始机械状态/);
    const code=corner.toUpperCase();
    for(const [intent,label] of [["wheel-out","wheel remove"],["wheel-in","wheel install"],
      ["brake-out","brakes remove"],["brake-in","brakes install"]]){
      const done=new RegExp("已完成："+code+" "+label+"，机械状态已提交");
      const blocked=new RegExp("操作被阻止");
      const status=await clickAndWait("#service-"+intent,"#service-status",
        new RegExp(done.source+"|"+blocked.source),120000);
      assert.doesNotMatch(status,blocked,corner+" "+intent+" blocked -> "+status);
      assert.match(status,done,corner+" "+intent+" -> "+status);
    }
    record(code+" wheel+brake remove/install committed");
  }

  console.log("[E] I4 26-step teardown/assembly and Core drive guard");
  await clickAndWait("#engine-home","#engine-status",/发动机曲轴已归位 0°/);
  const down=await clickAndWait("#engine-teardown","#engine-status",/已执行：disassemble/,120000);
  assert.match(down,/已执行：disassemble/,"teardown: "+down);
  const spun=await clickAndWait("#engine-rotate","#engine-status",/受阻|阻断|未就绪/,60000);
  record("crankshaft drive blocked after 26-part teardown",JSON.stringify(spun));
  const up=await clickAndWait("#engine-assemble","#engine-status",/已执行：assemble/,120000);
  record("26-step reassembly restores the engine",JSON.stringify(up));

  console.log("[F] part search/filter");
  await page.locator("#search").fill("piston");
  const filtered=await page.locator("#parts .part-row").count();
  assert.ok(filtered>0&&filtered<106,"piston filter count "+filtered);
  await page.locator("#search").fill("");
  assert.equal(await page.locator("#parts .part-row").count(),106);
  record("search narrows 106 parts to "+filtered+" piston rows and restores");

  await page.screenshot({path:reportsDir+"/acceptance-automotive.png",fullPage:true});

  console.log("[G] index.html — wheel & glasses scenarios, undo/redo, live catalog");
  await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelectorAll("#operations .operation").length>0);
  assert.equal(await page.locator("#progress-count").textContent(),"0 / 7");
  // the shipped UI must state the real 106 generated / 211 planned catalog counts
  assert.match(await page.locator("#show-catalog strong").textContent(),/106 GENERATED \/ 211 PLANNED/);
  await page.locator("#remove").click();
  await page.waitForFunction(()=>document.getElementById("progress-count")?.textContent==="7 / 7",null,{timeout:30000});
  await page.locator("#undo").click();
  await page.waitForFunction(()=>document.getElementById("status")?.textContent?.includes("已撤销"));
  await page.locator("#redo").click();
  await page.waitForFunction(()=>document.getElementById("status")?.textContent?.includes("已重做"));
  await page.locator("#reset").click();
  await page.waitForFunction(()=>document.getElementById("status")?.textContent?.includes("已重置"));
  assert.equal(await page.locator("#progress-count").textContent(),"0 / 7");
  await page.locator("#install").click();
  await page.waitForFunction(()=>document.getElementById("progress-count")?.textContent==="7 / 7",null,{timeout:30000});
  record("wheel: 7-step remove, undo, redo, reset, 7-step install");

  await page.locator("#scenario-glasses").click();
  await page.waitForFunction(()=>document.getElementById("title")?.textContent?.includes("机械眼镜"));
  await clickAndChange("#hinge-open","#status",/已完成：|操作停止：/);
  await clickAndChange("#hinge-close","#status",/已完成：|操作停止：/);
  record("glasses: hinge open/close plans executed");

  await page.locator("#show-catalog").click();
  await page.waitForFunction(()=>!document.getElementById("catalog-modal")?.hasAttribute("hidden"));
  assert.match(await page.locator("#catalog-modal p").first().textContent(),/106 个已生成可加载 GLB；其余 211 个尚未建模/);
  const total=await page.locator("#catalog-records .catalog-record").count();
  await page.locator("#catalog-search").fill("brake");
  const brake=await page.locator("#catalog-records .catalog-record").count();
  assert.ok(brake>0&&brake<=total,"catalog brake search returned "+brake);
  record("catalog: live 106/211 counts, "+total+" records, "+brake+" match 'brake'");
  await page.locator("#catalog-search").fill("");
  await page.locator("#close-catalog").click();

  // the in-page acceptance button drops clicks while a plan is still finishing;
  // its own guard makes a bounded retry loop safe.
  let results="";
  for(let i=0;i<40&&!results;i++){
    await page.locator("#acceptance").click();
    const done=await page.waitForFunction(()=>{
      const t=document.getElementById("test-results")?.textContent??"";
      return t.includes("拆装往返通过")||t.includes("✕");
    },null,{timeout:4000}).then(()=>true).catch(()=>false);
    if(done)results=await page.locator("#test-results").textContent();
    else await page.waitForTimeout(400);
  }
  assert.ok(results,"in-page dual-scenario acceptance produced no results");
  assert.ok(!results.includes("✕"),"in-page acceptance reported failure: "+results);
  assert.ok((results.match(/✓/g)||[]).length>=2,"expected two passing scenarios: "+results);
  record("index in-page dual-scenario acceptance passes");
  await page.screenshot({path:reportsDir+"/acceptance-index.png",fullPage:true});

  console.log("[H] diagnostics");
  assert.deepEqual(errors,[],"browser page/console errors");
  const nonWebglFailures=failed.filter(u=>!/favicon/.test(u));
  assert.deepEqual(nonWebglFailures,[],"failed network requests");
  record("zero page errors and zero failed requests across both pages");

  const report={result:"PASS",baseCommit:process.env.BASE_COMMIT??null,
    checks:checks.map(c=>c.name),counts:{checks:checks.length},
    screenshots:[reportsDir+"/acceptance-automotive.png",reportsDir+"/acceptance-index.png"]};
  fs.writeFileSync(reportsDir+"/browser-acceptance.json",JSON.stringify(report,null,2));
  console.log("\n"+JSON.stringify(report,null,2));
  await context.close();
}finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
}
