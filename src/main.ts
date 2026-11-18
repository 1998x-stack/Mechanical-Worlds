import "./style.css";
import automotiveCatalog from "../assets/catalog/automotive-fwd-i4-001.json";
import { MechanicalEngine, type AnimationDriver } from "../packages/mechanical-core/src/index.js";
import { createP1WheelAsset, createP1GlassesAsset } from "../packages/mechanical-core/src/p1-fixtures.js";
import { mateAlignment } from "../packages/mechanical-core/src/p1.js";
import { validateAsset, type MechanicalAsset } from "../packages/mechanical-schema/src/index.js";
import { MechanicalViewer } from "../packages/mechanical-three/src/index.js";

class BrowserDriver implements AnimationDriver {
  paused=false;
  async play(duration:number,update:(progress:number)=>void,signal?:AbortSignal):Promise<void>{
    await new Promise<void>((resolve,reject)=>{
      let previous=-1,elapsed=0;
      const tick=(now:number)=>{
        if(signal?.aborted){reject(new Error("用户取消了当前操作"));return;}
        if(previous<0)previous=now;
        if(!this.paused)elapsed+=Math.max(0,Math.min(now-previous,60));
        previous=now;
        const t=Math.min(1,elapsed/Math.max(1,duration));
        update(t*t*(3-2*t));
        if(t<1)requestAnimationFrame(tick);else resolve();
      };
      requestAnimationFrame(tick);
    });
  }
}
type Scenario="wheel"|"glasses";
type Intent="disassemble"|"assemble";
const assetFactories:Record<Scenario,()=>MechanicalAsset>={wheel:createP1WheelAsset,glasses:createP1GlassesAsset};
const planIds:Record<Scenario,Record<Intent,string>>={
  wheel:{disassemble:"plan.wheel.remove",assemble:"plan.wheel.install"},
  glasses:{disassemble:"plan.glasses.remove",assemble:"plan.glasses.install"}
};
const $=(id:string)=>document.getElementById(id)!;
$("app").innerHTML=`
<div class="shell">
  <aside class="sidebar">
    <div class="brand"><div class="mark">MW</div><div><strong>MECHANICAL</strong><small>WORLDS · LAB</small></div></div>
    <div class="caption">验收案例 / SCENARIOS</div>
    <button id="scenario-wheel" class="scenario active"><span class="scenario-symbol">◉</span><span><b>汽车左前轮</b><small>五颗螺母 · 轮毂 · 制动系统</small></span>›</button>
    <button id="scenario-glasses" class="scenario"><span class="scenario-symbol">⌐</span><span><b>机械眼镜</b><small>镜片 · 镜腿 · 铰链 · 螺钉</small></span>›</button>
    <a class="scenario" href="${import.meta.env.BASE_URL}automotive.html"><span class="scenario-symbol">▣</span><span><b>汽车 GLB 资产预览</b><small>76 个已生成零件 · 完整 3D 文件</small></span>›</a>
    <div class="caption second">机械结构 / ASSEMBLY TREE</div>
    <div id="tree" class="tree"></div>
    <button id="show-catalog" class="catalog-launch"><span>▤ &nbsp; 整车零件目录</span><strong>76 GENERATED / 317 PLANNED</strong><small>76 个真实 GLB 零件，其余仍需建模</small></button>
    <div class="sidebar-foot"><span class="status-dot"></span>SCHEMA 0.1 · CORE 0.1</div>
  </aside>
  <main class="main">
    <header class="top">
      <div><span class="crumb">Mechanical Worlds</span><span class="slash">/</span><strong id="header-name">左前轮拆装实验</strong></div>
      <a target="_blank" rel="noopener noreferrer" href="https://github.com/1998x-stack/Mechanical-Worlds">GITHUB ↗</a>
    </header>
    <div class="body">
      <section class="center">
        <div class="intro"><div><div class="eyebrow">INTERACTIVE ASSEMBLY</div><h1 id="title">汽车左前轮 · 拆解与回装</h1>
          <p id="description"></p></div><span class="live">● LIVE DEMO</span></div>
        <div class="stage">
          <div id="viewport"></div>
          <div class="stage-badge"><span class="status-dot"></span> THREE.JS / INTERACTIVE 3D</div>
          <div class="stage-hint">拖动旋转 · 滚轮缩放 · 点击选择零件</div>
          <div class="stage-axis">+Y ↑ &nbsp; +X → &nbsp; -Z ⊙</div>
        </div>
        <div class="actions">
          <button id="remove" class="btn blue">◫ &nbsp; 全部拆解</button>
          <button id="install" class="btn green">⬡ &nbsp; 全部合成</button>
          <button id="step" class="btn">▷ &nbsp; 下一步</button>
          <button id="explode" class="btn outline">✳ &nbsp; 爆炸视图</button>
          <button id="reset" class="btn outline">↺ &nbsp; 重置</button>
        </div>
        <div class="subactions" id="hinge-controls" style="display:none">
          <button id="hinge-open">↗ 打开左右镜腿</button>
          <button id="hinge-close">↘ 闭合左右镜腿</button>
        </div>
        <div class="subactions">
          <button id="pause">Ⅱ 暂停 / 继续</button><button id="cancel">✕ 取消</button>
          <button id="undo">↶ 撤销</button><button id="redo">↷ 重做</button>
          <button id="focus">◎ 聚焦零件</button><button id="camera">⊙ 还原视角</button>
        </div>
        <div class="progress"><div class="progress-meta"><span id="progress-kind">拆解进度</span><strong id="progress-count">0 / 7</strong></div>
          <div class="track"><div id="progress-fill"></div></div></div>
        <div class="notice"><span class="status-dot"></span><span id="status">准备完成。</span></div>
      </section>
      <aside class="right">
        <div class="pane"><div class="pane-title">操作依赖图 / EXECUTION PLAN <span id="intent-tag">DISASSEMBLE</span></div>
          <div class="switch"><button id="mode-remove" class="active">拆解顺序</button><button id="mode-install">合成顺序</button></div>
          <div id="operations" class="operations"></div></div>
        <div class="pane"><div class="pane-title">零件检查 / INSPECTOR</div><div id="inspector" class="muted">点击场景中的零件查看信息。</div></div>
        <div class="pane"><div class="pane-title">可运行验收 / ACCEPTANCE</div>
          <p class="muted">两个验收案例使用同一套状态机、依赖规则与操作执行器。</p>
          <button class="btn full" id="acceptance">✓ 双案例自动拆装验收</button><div id="test-results"></div></div>
      </aside>
    </div>
    <footer><span>TRANSACTIONAL ASSEMBLY ENGINE</span><span>程序化演示几何 · 非实际维修指引</span><span id="revision">REV 0</span></footer>
  </main>
  <div id="catalog-modal" class="catalog-modal" hidden role="dialog" aria-modal="true" aria-labelledby="catalog-title">
    <div class="catalog-card">
      <div class="catalog-header">
        <div><div class="eyebrow">ASSET CATALOG / PLANNED</div><h2 id="catalog-title">汽车完整机械零件目录</h2>
          <p>共 317 个计划零件，76 个已生成可加载 GLB；其余 241 个尚未建模。全部零件均未进行 OEM CAD/制造精度验证。</p></div>
        <button id="close-catalog" aria-label="关闭目录">✕</button>
      </div>
      <div class="catalog-filters"><input id="catalog-search" type="search" placeholder="搜索零件名称或 ID…" aria-label="搜索零件"/>
        <select id="catalog-system" aria-label="筛选系统">
          <option value="all">全部系统</option><option value="body">车身系统</option>
          <option value="chassis">底盘系统</option><option value="powertrain">动力系统</option>
          <option value="wheels">车轮系统</option><option value="interior">内饰系统</option>
          <option value="electrical">电气系统</option>
        </select></div>
      <div id="catalog-count" class="catalog-count"></div>
      <div id="catalog-records" class="catalog-records"></div>
      <div class="catalog-bottom">目录状态严格区分 GENERATED 和 PLANNED。GENERATED 是概念几何，不代表工程 CAD 审核。</div>
    </div>
  </div>
</div>`;

let scenario:Scenario="wheel";
let intent:Intent="disassemble";
let asset:MechanicalAsset=createP1WheelAsset();
let driver=new BrowserDriver();
let engine=new MechanicalEngine(asset,driver);
let viewer:MechanicalViewer;
let selected:string|null=null;
let running=false;
let controller:AbortController|null=null;
const currentPlan=()=>planIds[scenario][intent];
function status(message:string):void{$("status").textContent=message;}
function treeMarkup(parent:string,depth:number):string{
  return asset.nodes.filter(n=>n.parentId===parent).map(n=>
    `<div class="tree-node"><button class="node ${n.id===selected?"selected":""}" data-node="${n.id}" style="padding-left:${10+depth*14}px">
      <span>${n.kind==="assembly"?"▣":"◇"}</span>${n.name}</button>${treeMarkup(n.id,depth+1)}</div>`).join("");
}
function showInspector():void{
  const n=asset.nodes.find(n=>n.id===selected);
  if(!n){$("inspector").innerHTML="点击场景中的零件查看信息。";return;}
  const current=engine.getState();
  const joint=asset.joints?.find(j=>j.drivenPartId===n.id);
  const mats=asset.mates.filter(m=>
    asset.connectors.some(c=>(c.id===m.connectorAId||c.id===m.connectorBId)&&c.ownerPartId===n.id));
  const checked=mats.find(m=>m.verified);
  const alignment=checked?mateAlignment(asset,current,checked.id):null;
  $("inspector").innerHTML=`
    <div class="inspector-head"><span>◇</span><div><strong>${n.name}</strong><small>${n.id}</small></div></div>
    <div class="property"><span>节点</span><b>${n.kind==="part"?"物理零件":"装配体"}</b></div>
    <div class="property"><span>状态</span><b>${n.kind==="part"?current.partStatus[n.id]:"ASSEMBLY"}</b></div>
    <div class="property"><span>锚点</span><b>${asset.connectors.filter(c=>c.ownerPartId===n.id).length}</b></div>
    <div class="property"><span>装配父级</span><b>${n.parentId??"ROOT"}</b></div>
    ${joint?`<div class="property"><span>铰链角度</span><b>${((current.jointAngles[joint.id]??0)*180/Math.PI).toFixed(1)}°</b></div>`:""}
    ${alignment?`<div class="property"><span>锚点偏差</span><b>${(alignment.distanceM*1000).toFixed(1)} mm</b></div>`:""}`;
}
function update():void{
  const plan=currentPlan(),ops=engine.operationsFor(plan),p=engine.progress(plan);
  $("operations").innerHTML=ops.map((o,i)=>{const done=engine.isComplete(o);
    return `<button data-op="${o.id}" class="operation ${done?"done":""}">
      <span class="num">${done?"✓":String(i+1).padStart(2,"0")}</span>
      <span class="op-text"><b>${o.label}</b><small>${o.targetId}</small></span>
      <span class="op-status">${done?"DONE":"PENDING"}</span>
    </button>`;}).join("");
  $("progress-kind").textContent=intent==="assemble"?"合成进度":"拆解进度";
  $("progress-count").textContent=p.done+" / "+p.total;
  $("progress-fill").style.width=(100*p.done/Math.max(p.total,1))+"%";
  $("revision").textContent="REV "+engine.getState().revision;
  $("intent-tag").textContent=intent==="assemble"?"ASSEMBLE":"DISASSEMBLE";
  $("mode-remove").classList.toggle("active",intent==="disassemble");
  $("mode-install").classList.toggle("active",intent==="assemble");
  $("tree").innerHTML=treeMarkup(asset.rootId,0);
  document.querySelectorAll<HTMLElement>("[data-node]").forEach(b=>
    b.addEventListener("click",()=>viewer.select(b.dataset.node!)));
  document.querySelectorAll<HTMLElement>("[data-op]").forEach(b=>
    b.addEventListener("click",()=>{if(!running)void perform(signal=>engine.runOperation(b.dataset.op!,signal));}));
  showInspector();
}
function loadScenario():void{
  asset=assetFactories[scenario]();intent="disassemble";driver=new BrowserDriver();engine=new MechanicalEngine(asset,driver);
  selected=null;viewer?.dispose();
  viewer=new MechanicalViewer($("viewport"),asset,engine,id=>{selected=id;update();});
  engine.subscribe(event=>{
    if(event.type==="commit"){
      const op=asset.operations.find(o=>o.id===event.operationId);
      status("已完成："+(op?.label??event.operationId));
    }else if(event.type==="diagnostic")status("几何提示："+event.message);
    else if(event.type==="state")update();
  });
  $("scenario-wheel").classList.toggle("active",scenario==="wheel");
  $("scenario-glasses").classList.toggle("active",scenario==="glasses");
  $("header-name").textContent=scenario==="wheel"?"左前轮拆装实验":"眼镜拆装实验";
  $("title").textContent=scenario==="wheel"?"汽车左前轮 · 拆解与回装":"机械眼镜 · 拆解与回装";
  $("description").textContent=asset.description;
  $("hinge-controls").style.display=scenario==="glasses"?"flex":"none";
  $("test-results").innerHTML="";
  status("场景就绪。选择拆解、合成，或点击模型查看零件。");
  update();
}
function switchScenario(next:Scenario):void{
  if(running){status("请先取消当前操作。");return;}
  scenario=next;loadScenario();
}
function setIntent(next:Intent):void{intent=next;update();}
async function perform(task:(signal:AbortSignal)=>Promise<unknown>):Promise<void>{
  if(running){status("另一项操作正在执行。");return;}
  running=true;driver.paused=false;controller=new AbortController();
  try{await task(controller.signal);if(!engine.progress(currentPlan()).next)status("此计划已执行完成。");}
  catch(e){status("操作停止："+(e instanceof Error?e.message:String(e)));}
  finally{running=false;controller=null;update();}
}
$("scenario-wheel").addEventListener("click",()=>switchScenario("wheel"));
$("scenario-glasses").addEventListener("click",()=>switchScenario("glasses"));
$("mode-remove").addEventListener("click",()=>setIntent("disassemble"));
$("mode-install").addEventListener("click",()=>setIntent("assemble"));
$("hinge-open").addEventListener("click",()=>{
  if(scenario==="glasses")void perform(signal=>engine.runPlan("plan.glasses.open",signal));
});
$("hinge-close").addEventListener("click",()=>{
  if(scenario==="glasses")void perform(signal=>engine.runPlan("plan.glasses.close",signal));
});
$("remove").addEventListener("click",()=>{setIntent("disassemble");void perform(s=>engine.runPlan(currentPlan(),s));});
$("install").addEventListener("click",()=>{setIntent("assemble");void perform(s=>engine.runPlan(currentPlan(),s));});
$("step").addEventListener("click",()=>void perform(s=>engine.step(currentPlan(),s)));
$("explode").addEventListener("click",()=>{
  viewer.setExploded(viewer.isExploded()?0:1);
  $("explode").classList.toggle("active",viewer.isExploded());
  status("爆炸视图仅改变视觉位置，不会修改机械装配状态。");
});
$("reset").addEventListener("click",()=>{
  if(running){status("请先取消操作。");return;}
  engine.reset();viewer.setExploded(0);viewer.resetCamera();update();status("机械状态已重置。");
});
$("pause").addEventListener("click",()=>{if(running){driver.paused=!driver.paused;status(driver.paused?"已暂停动画。":"动画继续。");}});
$("cancel").addEventListener("click",()=>{controller?.abort();driver.paused=false;});
$("undo").addEventListener("click",()=>{status(engine.undo()?"已撤销最近一步。":"当前无法撤销。");});
$("redo").addEventListener("click",()=>{status(engine.redo()?"已重做最近一步。":"当前无法重做。");});
$("focus").addEventListener("click",()=>viewer.focus());
$("camera").addEventListener("click",()=>viewer.resetCamera());
$("acceptance").addEventListener("click",async()=>{
  if(running){status("请先完成正在进行的操作。");return;}
  const rows:string[]=[];
  for(const name of ["wheel","glasses"] as Scenario[]){
    try{
      const candidate=assetFactories[name](),issues=validateAsset(candidate);
      if(issues.length)throw new Error(issues.map(i=>i.code).join(", "));
      const testEngine=new MechanicalEngine(candidate);
      if(name==="glasses"){
        await testEngine.runPlan("plan.glasses.open");
        await testEngine.runPlan("plan.glasses.close");
      }
      await testEngine.runPlan(planIds[name].disassemble);
      if(!Object.values(testEngine.getState().partStatus).some(p=>p==="detached"))
        throw new Error("没有零件发生分离");
      await testEngine.runPlan(planIds[name].assemble);
      const state=testEngine.getState();
      if(!Object.values(state.partStatus).every(s=>s==="installed"))throw new Error("零件未全部装回");
      if(!Object.values(state.mateStatus).every(s=>s==="locked"))throw new Error("连接未全部恢复");
      if(!Object.values(state.offsets).every(v=>v.every(n=>Math.abs(n)<1e-8)))
        throw new Error("零件位置发生漂移");
      rows.push(`<div class="result pass">✓ ${candidate.label}：拆装往返通过</div>`);
    }catch(error){rows.push(`<div class="result fail">✕ ${name}：${String(error)}</div>`);}
  }
  $("test-results").innerHTML=rows.join("");
  status(rows.every(r=>r.includes("pass"))?"双案例验收通过。":"自动验收未全部通过，请检查错误信息。");
});
loadScenario();

const catalogRecords=automotiveCatalog.records;
const catalogIndex=new Map(catalogRecords.map(n=>[n.id,n]));
const catalogSystemOf=(id:string):string=>{
  let current=catalogIndex.get(id);
  while(current && current.parentId && current.parentId!=="vehicle")
    current=catalogIndex.get(current.parentId);
  return current?.id??"unknown";
};
function renderCatalog():void{
  const query=($("catalog-search") as HTMLInputElement).value.trim().toLowerCase();
  const system=($("catalog-system") as HTMLSelectElement).value;
  const matched=catalogRecords.filter(n=>(system==="all"||catalogSystemOf(n.id)===system) &&
    (!query||n.nameZh.toLowerCase().includes(query)||n.id.toLowerCase().includes(query)));
  $("catalog-count").textContent="匹配 "+matched.length+" 条 · 显示前 "+Math.min(120,matched.length)+" 条";
  $("catalog-records").innerHTML=matched.slice(0,120).map(n=>
    '<div class="catalog-record"><span class="catalog-kind">'+(n.kind==="assembly"?"ASSEMBLY":"PART")+
    '</span><div><strong>'+n.nameZh+'</strong><small>'+n.id+
    '</small></div><span class="catalog-planned">'+(n.geometryStatus==="generated"?"GLB READY":"PLANNED")+'</span></div>').join("");
}
$("show-catalog").addEventListener("click",()=>{
  $("catalog-modal").hidden=false;renderCatalog();
  ($("catalog-search") as HTMLInputElement).focus();
});
$("close-catalog").addEventListener("click",()=>{$("catalog-modal").hidden=true;});
$("catalog-modal").addEventListener("click",event=>{
  if(event.target===$("catalog-modal"))$("catalog-modal").hidden=true;
});
$("catalog-search").addEventListener("input",renderCatalog);
$("catalog-system").addEventListener("change",renderCatalog);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")$("catalog-modal").hidden=true;
});
