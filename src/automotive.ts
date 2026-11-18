import "./automotive.css";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {MechanicalEngine, type AnimationDriver} from "../packages/mechanical-core/src/index.js";
import {
  createGeneratedCarCornerAsset,
  type Corner,type GeneratedManifest
} from "../packages/mechanical-core/src/automotive-corners.js";
import type {Vec3} from "../packages/mechanical-schema/src/index.js";
import catalog from "../assets/catalog/automotive-fwd-i4-001.json";
import manifest01 from "../assets/generated/automotive/manifest.json";
import manifest02 from "../assets/generated/automotive/manifest-02.json";
const manifests=[manifest01,manifest02];

type CatalogPart=typeof catalog.records[number];
const generated=catalog.records.filter(row=>row.kind==="part"&&row.geometryStatus==="generated");
const recordMap=new Map(catalog.records.map(row=>[row.id,row]));
const geometryMap=new Map(manifests.flatMap(manifest=>manifest.parts.map(row=>[row.id,{...row,batchId:manifest.batchId}])));
const $=(id:string)=>document.getElementById(id)!;
const systemNames:Record<string,string>={
  all:"全部系统",body:"车身骨架",chassis:"底盘／制动／悬架",
  wheels:"车轮总成",powertrain:"发动机 / 传动系",
  interior:"内饰（待建模）",electrical:"电气（待建模）"
};
function systemFor(id:string):string{
  let node=recordMap.get(id);
  while(node&&node.parentId&&node.parentId!=="vehicle")
    node=recordMap.get(node.parentId);
  return node?.id??"unknown";
}
$("car-app").innerHTML=`
<div class="app">
  <aside class="left">
    <a class="brand" href="${import.meta.env.BASE_URL}"><span class="brandmark">MW</span>
      <span><b>MECHANICAL WORLDS</b><small>ASSET FACTORY / AUTOMOTIVE</small></span></a>
    <div class="side-label">3D ASSET PRODUCTION</div>
    <div class="kpi"><strong>${generated.length}<span> / ${catalog.stats.parts}</span></strong>
      <small>已生成真实 GLB 零件 / 规划数量</small>
      <div class="meter"><span style="width:${100*generated.length/catalog.stats.parts}%"></span></div>
      <em>其余 ${catalog.stats.plannedParts} 个仍为 PLANNED</em>
    </div>
    <div class="side-label">资产搜索</div>
    <input id="search" type="search" placeholder="输入零件名称或编号" aria-label="搜索已生成零件"/>
    <div id="filters" class="filter-buttons"></div>
    <div class="side-label with-space">生成零件 / PART INSTANCES</div>
    <div id="parts" class="parts-list"></div>
    <div class="sidebar-foot">SCHEMA v0.1 · GEOMETRY v0.2 · GENERATED</div>
  </aside>
  <main class="center">
    <header class="topbar">
      <div class="bread"><a href="${import.meta.env.BASE_URL}">拆装实验</a> <span>/</span> 汽车三维资产工厂</div>
      <a class="github" href="https://github.com/1998x-stack/Mechanical-Worlds" target="_blank" rel="noopener noreferrer">查看源码 ↗</a>
    </header>
    <section class="heading">
      <div><div class="eyebrow">TWO REAL GLB GEOMETRY BATCHES</div>
        <h1>汽车 · 结构化三维资产</h1>
        <p>已输出两批独立零件 GLB：车身骨架、四轮、悬架、制动系统，以及四缸发动机和差速器概念几何。</p></div>
      <span class="status">● GENERATED GEOMETRY</span>
    </section>
    <div id="viewport-wrap">
      <div id="viewport"></div>
      <div class="viewport-top">THREE.JS · GLTFLOADER · ${generated.length} NAMED PARTS</div>
      <div class="viewport-bottom">左键拖动旋转 · 右键平移 · 滚轮缩放 · 点击模型选择</div>
      <div id="loading" class="loading">正在加载真实 GLB 几何与材质…</div>
    </div>
    <div class="toolbar">
      <button id="show-all" class="primary">显示全部</button>
      <button id="isolate">隔离所选</button>
      <button id="body-toggle">隐藏车身骨架</button>
      <button id="explosion">结构爆炸预览</button>
      <button id="camera">还原视角</button>
    </div>
    <section class="servicebar">
      <div class="service-title">四角机械拆装验证 <span>AUTHORED CONCEPT OPERATIONS</span></div>
      <div class="service-actions">
        <select id="service-corner" aria-label="选择车轮角总成">
          <option value="fl">左前轮 FL</option><option value="fr">右前轮 FR</option>
          <option value="rl">左后轮 RL</option><option value="rr">右后轮 RR</option>
        </select>
        <button id="service-wheel-out">拆卸车轮</button>
        <button id="service-wheel-in">重新安装</button>
        <button id="service-brake-out">拆卸制动组件</button>
        <button id="service-brake-in">回装制动组件</button>
        <button id="service-reset">机械重置</button>
      </div>
      <div id="service-status" role="status">模型加载后可执行。汽车制动与紧固件动作仅用于概念级软件演示。</div>
    </section>
    <div class="disclaimer">当前 106 个 GLB 零件具备可选中几何；四轮角总成具有演示级拆装 DAG。动力系统尚未具备实际拆装约束。爆炸预览与拆装状态相互独立。所有示例均非 OEM CAD 或真实维修规程。</div>
    <footer>MECHANICAL WORLDS · CONCEPT GEOMETRY ENGINE <span id="render-info">GLB LOADING</span></footer>
  </main>
  <aside class="right">
    <div class="panel-label">ASSET INSPECTOR</div>
    <div id="inspector" class="inspector empty">点击场景中的零件，或在左侧列表选中查看属性。</div>
    <div class="panel-label">GEOMETRY RELEASE</div>
    <div class="release">
      <div class="pair"><span>资产批次</span><b>Batch 01 / 02</b></div>
      <div class="pair"><span>Part Nodes</span><b>${generated.length}</b></div>
      <div class="pair"><span>Mesh Templates</span><b>${manifests.reduce((sum,m)=>sum+m.uniqueMeshTemplates,0)}</b></div>
      <div class="pair"><span>Template Triangles</span><b>${manifests.reduce((sum,m)=>sum+m.uniqueTriangles,0).toLocaleString()}</b></div>
      <div class="pair"><span>GLB 大小</span><b>${(manifests.reduce((sum,m)=>sum+m.bytes,0)/1048576).toFixed(2)} MiB</b></div>
      <div class="pair"><span>坐标单位</span><b>m · RH +Y</b></div>
      <div class="pair"><span>工程复核</span><b class="warn">NOT VERIFIED</b></div>
    </div>
    <a class="manifest-link" href="${import.meta.env.BASE_URL}models/automotive-fwd-i4-batch-02-manifest.json" target="_blank" rel="noopener noreferrer">查看新增动力系统 Manifest ↗</a>
    <div class="panel-label next">NEXT BATCH</div>
    <p class="pending">发动机已经生成首批 30 件概念 GLB；完整齿轮箱、座椅、车门和电气系统仍有大量规划零件尚未建模。</p>
  </aside>
</div>`;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c192b);
scene.fog=new THREE.Fog(0x0c192b,10,25);
const camera=new THREE.PerspectiveCamera(44,1,0.1,100);
camera.position.set(5.2,3.8,5.8);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
$("viewport").appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.maxDistance=18;controls.minDistance=1.5;
controls.target.set(0,.6,0);
controls.update();
scene.add(new THREE.HemisphereLight(0xd9eeff,0x203144,2.3));
const light=new THREE.DirectionalLight(0xffffff,3.1);
light.position.set(3,8,6);scene.add(light);
const fill=new THREE.DirectionalLight(0x6abaff,2.0);
fill.position.set(-4,3,-5);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),
  new THREE.MeshStandardMaterial({color:0x132439,roughness:.95,metalness:.05}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.12;scene.add(floor);
const grid=new THREE.GridHelper(24,40,0x3f6279,0x274157);
grid.position.y=-.115;scene.add(grid);
const resize=()=>{const w=Math.max(1,$("viewport").clientWidth),h=Math.max(1,$("viewport").clientHeight);
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
const observer=new ResizeObserver(resize);observer.observe($("viewport"));
resize();
let root:THREE.Group|null=null;
const byId=new Map<string,THREE.Object3D>();
const originalPos=new Map<string,THREE.Vector3>();
let selectedId:string|null=null;
let selectedHelper:THREE.BoxHelper|null=null;
let exploded=false,bodyHidden=false,isolated=false,filter="all",query="";
let operating=false;
let chosenCorner:Corner="fl";
let mechanical:MechanicalEngine|null=null;
let previewOffsets:Record<string,Vec3>={};
class FrameDriver implements AnimationDriver {
  async play(ms:number,update:(t:number)=>void,signal?:AbortSignal):Promise<void>{
    await new Promise<void>((resolve,reject)=>{
      let previous=-1,elapsed=0;
      const tick=(now:number)=>{
        if(signal?.aborted){reject(new Error("当前拆装动画已取消"));return;}
        if(previous<0)previous=now;
        elapsed+=Math.max(0,Math.min(60,now-previous));
        previous=now;
        const t=Math.min(1,elapsed/Math.max(1,ms));
        update(t*t*(3-2*t));
        if(t>=1)resolve();else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
const cornerFromId=(id:string):Corner|null=>{
  for(const side of ["fl","fr","rl","rr"]as Corner[]){
    if(id.includes("."+side+".")||id.endsWith("."+side))return side;
  }
  return null;
};
const serviceMessage=(message:string)=>{$("service-status").textContent=message;};
function applyPositions():void{
  const state=mechanical?.getState();
  for(const [id,obj] of byId){
    const original=originalPos.get(id)!;
    const offset=previewOffsets[id]??state?.offsets[id]??[0,0,0];
    const system=systemFor(id);
    const extra=exploded?system==="body"?new THREE.Vector3(0,.55,0):
      system==="wheels"?new THREE.Vector3(Math.sign(original.x)*.45,0,0):
      system==="chassis"?new THREE.Vector3(Math.sign(original.x)*.12,-.13,0):new THREE.Vector3():new THREE.Vector3();
    obj.position.copy(original).add(new THREE.Vector3(...offset)).add(extra);
  }
  if(selectedHelper)selectedHelper.update();
}

const raycaster=new THREE.Raycaster();
const coords=new THREE.Vector2();
const nodeOf=(hit:THREE.Object3D):string|null=>{
  let n:THREE.Object3D|null=hit;
  while(n){const id=n.userData.partId as string|undefined;if(id&&byId.has(id))return id;n=n.parent;}
  return null;
};
let pointerDown:{x:number;y:number}|null=null;
renderer.domElement.addEventListener("pointerdown",e=>{pointerDown={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener("pointerup",e=>{
  if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();
  coords.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(coords,camera);
  const hits=raycaster.intersectObjects(root?.children??[],true);
  const id=hits.map(hit=>nodeOf(hit.object)).find(id=>id!==null);
  if(id)select(id);
});
function displayPart(id:string):void{
  const record=recordMap.get(id),g=geometryMap.get(id),part=byId.get(id);
  if(!record||!g){$("inspector").textContent="找不到该资产。";return;}
  let dims="—";
  if(part){const box=new THREE.Box3().setFromObject(part),size=box.getSize(new THREE.Vector3());
    dims=[size.x,size.y,size.z].map(v=>(v*1000).toFixed(0)).join(" × ")+" mm";}
  $("inspector").innerHTML=[
    '<div class="selection-tag">● GENERATED · CONCEPTUAL</div>',
    '<h2>'+record.nameZh+'</h2>',
    '<div class="monospace">'+record.id+'</div>',
    '<div class="pair"><span>子系统</span><b>'+systemNames[systemFor(id)]+'</b></div>',
    '<div class="pair"><span>Mesh 类别</span><b>'+g.meshType+'</b></div>',
    '<div class="pair"><span>来源批次</span><b>'+g.batchId+'</b></div>',
    '<div class="pair"><span>模板三角面</span><b>'+g.triangles.toLocaleString()+'</b></div>',
    '<div class="pair"><span>世界尺寸</span><b>'+dims+'</b></div>',
    '<div class="pair"><span>几何状态</span><b class="good">generated</b></div>',
    '<div class="pair"><span>制造认证</span><b class="warn">否</b></div>',
    ...(mechanical?.getState().partStatus[id]?['<div class="pair"><span>机械演示状态</span><b>'+mechanical.getState().partStatus[id]+'</b></div>']:[]),
    '<p class="inspector-tip">这是从参数化生成脚本构造出的独立 GLB 节点，可用于渲染和结构探索。实际装配配合、强度和制造公差尚未验证。</p>'
  ].join("");
}
function select(id:string):void{
  selectedId=id;
  if(selectedHelper){scene.remove(selectedHelper);selectedHelper.geometry.dispose();}
  const obj=byId.get(id);
  if(obj){
    selectedHelper=new THREE.BoxHelper(obj,0x80d2ff);
    scene.add(selectedHelper);
    if(isolated)updateVisibility();
  }
  const side=cornerFromId(id);
  if(side){chosenCorner=side;($("service-corner") as HTMLSelectElement).value=side;}
  displayPart(id);renderList();
}
function updateVisibility():void{
  for(const [id,node] of byId){
    const system=systemFor(id);
    node.visible=!(bodyHidden&&system==="body")&&(!isolated||id===selectedId);
  }
  if(selectedHelper)selectedHelper.visible=!selectedId?false:!!byId.get(selectedId)?.visible;
}
const systemKeys=["all","body","chassis","wheels","powertrain"];
function renderFilters():void{
  $("filters").innerHTML=systemKeys.map(id=>'<button class="filter '+(filter===id?'active':'')+'" data-filter="'+id+'">'+systemNames[id]+'</button>').join("");
  document.querySelectorAll<HTMLElement>("[data-filter]").forEach(node=>
    node.addEventListener("click",()=>{filter=node.dataset.filter!;renderFilters();renderList();}));
}
function renderList():void{
  const rows=generated.filter(row=>(filter==="all"||systemFor(row.id)===filter)&&
    (!query||row.nameZh.toLowerCase().includes(query)||row.id.toLowerCase().includes(query)));
  $("parts").innerHTML=rows.map(row=>
    '<button class="part-row '+(row.id===selectedId?'chosen':'')+'" data-id="'+row.id+'">'+
    '<span class="part-icon">◇</span><span><strong>'+row.nameZh+'</strong><small>'+row.id+'</small></span>'+
    '<em>GLB</em></button>').join("");
  document.querySelectorAll<HTMLElement>("[data-id]").forEach(node=>
    node.addEventListener("click",()=>select(node.dataset.id!)));
}
$("search").addEventListener("input",()=>{
  query=($("search") as HTMLInputElement).value.trim().toLowerCase();renderList();
});
$("show-all").addEventListener("click",()=>{isolated=false;bodyHidden=false;updateVisibility();$("body-toggle").textContent="隐藏车身骨架";});
$("isolate").addEventListener("click",()=>{
  if(!selectedId)return;
  isolated=!isolated;updateVisibility();
  $("isolate").textContent=isolated?"显示其它零件":"隔离所选";
});
$("body-toggle").addEventListener("click",()=>{
  bodyHidden=!bodyHidden;updateVisibility();
  $("body-toggle").textContent=bodyHidden?"显示车身骨架":"隐藏车身骨架";
});
$("explosion").addEventListener("click",()=>{
  exploded=!exploded;
  applyPositions();
  $("explosion").textContent=exploded?"恢复装配展示":"结构爆炸预览";
});
$("camera").addEventListener("click",()=>{camera.position.set(5.2,3.8,5.8);controls.target.set(0,.6,0);controls.update();});
$("service-corner").addEventListener("change",()=>{
  chosenCorner=($("service-corner") as HTMLSelectElement).value as Corner;
});
async function runService(component:"wheel"|"brakes",intent:"remove"|"install"):Promise<void>{
  if(!mechanical){serviceMessage("模型尚未完成加载。");return;}
  if(operating){serviceMessage("上一项拆装流程仍在执行。");return;}
  operating=true;exploded=false;$("explosion").textContent="结构爆炸预览";applyPositions();
  const plan="plan.generated."+chosenCorner+"."+component+"."+intent;
  const steps=mechanical.operationsFor(plan).length;
  serviceMessage("执行 "+chosenCorner.toUpperCase()+" "+component+" "+intent+"，共 "+steps+" 个步骤。");
  try{
    await mechanical.runPlan(plan);
    serviceMessage("已完成："+chosenCorner.toUpperCase()+" "+component+" "+intent+"，机械状态已提交。");
  }catch(error){
    serviceMessage("操作被阻止："+(error instanceof Error?error.message:String(error)));
  }finally{
    operating=false;
    if(selectedId)displayPart(selectedId);
  }
}
for(const [id,part,intent] of [
  ["service-wheel-out","wheel","remove"],
  ["service-wheel-in","wheel","install"],
  ["service-brake-out","brakes","remove"],
  ["service-brake-in","brakes","install"]
]as [string,"wheel"|"brakes","remove"|"install"][]){
  $(id).addEventListener("click",()=>{void runService(part,intent);});
}
$("service-reset").addEventListener("click",()=>{
  if(!mechanical||operating){serviceMessage("请先完成当前拆装操作。");return;}
  mechanical.reset();previewOffsets={};applyPositions();
  serviceMessage("已恢复所有四轮角总成的初始机械状态。");
});

renderFilters();renderList();
const loader=new GLTFLoader();
const imported=new THREE.Group();
const waiters=manifests.map((manifest,batchIndex)=>new Promise<void>((resolve,reject)=>{
  const filename="automotive-fwd-i4-batch-"+String(batchIndex+1).padStart(2,"0")+".glb";
  loader.load(import.meta.env.BASE_URL+"models/"+filename,gltf=>{
    if(gltf.scene.children.length!==manifest.parts.length){
      reject(new Error(filename+": expected "+manifest.parts.length+" named Parts, found "+gltf.scene.children.length));return;
    }
    for(let i=0;i<manifest.parts.length;i++){
      const node=gltf.scene.children[i],id=manifest.parts[i].id;
      if(byId.has(id)){reject(new Error("Duplicate GLB Part ID: "+id));return;}
      node.name=id;
      node.userData.partId=id;
      node.traverse(child=>child.userData.partId=id);
      imported.add(node);
      byId.set(id,node);
      originalPos.set(id,node.position.clone());
    }
    $("loading").textContent="已加载 "+byId.size+" / "+generated.length+" 个实际 GLB 零件";
    resolve();
  },undefined,reject);
}));
Promise.all(waiters).then(()=>{
  root=imported;scene.add(root);
  const missing=generated.filter(row=>!byId.has(row.id));
  if(missing.length)throw new Error("缺少 "+missing.length+" 个已标记生成的 GLB 零件");
  $("loading").style.display="none";
  $("render-info").textContent=byId.size+" GLB PARTS LOADED";
  mechanical=new MechanicalEngine(createGeneratedCarCornerAsset(manifest01 as unknown as GeneratedManifest),new FrameDriver());
  mechanical.subscribe(event=>{
    if(event.type==="preview")previewOffsets=event.offsets;
    else if(event.type==="commit"||event.type==="cancel"||event.type==="state")previewOffsets={};
    if(event.type==="commit"){
      serviceMessage("已提交："+event.operationId+"（机械 Revision "+event.revision+"）");
    }else if(event.type==="diagnostic")serviceMessage("碰撞预检："+event.message);
    applyPositions();
  });
  serviceMessage("四轮角总成已接入机械引擎。选择左前、右前、左后或右后车轮进行拆装。");
  applyPositions();updateVisibility();
  select(geometryMap.has("engine.crankshaft")?"engine.crankshaft":generated[0].id);
}).catch(error=>{
  $("loading").textContent="资产载入失败："+String(error);
  $("render-info").textContent="LOAD ERROR";
});
function animate():void{
  requestAnimationFrame(animate);controls.update();
  if(selectedHelper)selectedHelper.update();
  renderer.render(scene,camera);
}
animate();
