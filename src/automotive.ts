import "./automotive.css";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {transferGlbParts} from "./glb-part-binding.mjs";
import {MechanicalEngine, type AnimationDriver} from "../packages/mechanical-core/src/index.js";
import {
  createGeneratedCarCornerAsset,
  type Corner,type GeneratedManifest
} from "../packages/mechanical-core/src/automotive-corners.js";
import type {Vec3} from "../packages/mechanical-schema/src/index.js";
import {
  createEngineI4Asset,engineI4Constraint,solveEngineI4,
  type EngineI4Manifest
} from "../packages/mechanical-core/src/engine-i4.js";
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
    <section class="servicebar enginebar">
      <div class="service-title">四缸发动机 · 曲柄连杆机构 <span>ANALYTIC SLIDER-CRANK / 4 CYLINDERS</span></div>
      <div class="engine-controls">
        <label for="engine-angle">曲轴角度 <output id="engine-angle-value">0°</output></label>
        <input type="range" id="engine-angle" min="0" max="720" step="1" value="0" aria-label="曲轴角度"/>
        <button id="engine-rotate">连续旋转</button>
        <button id="engine-stop">停止旋转</button>
        <button id="engine-focus">聚焦发动机</button>
        <button id="engine-cutaway">剖视发动机</button>
        <button id="engine-cad-load">加载 18 件 B-Rep CAD</button>
        <button id="engine-teardown">发动机拆卸</button>
        <button id="engine-assemble">重新装配</button>
        <button id="engine-home">归零位置</button>
      </div>
      <div id="engine-status" role="status">运动学闭环和拆装状态由 Headless Mechanical Core 验证，载入后可操作。</div>
      <div id="engine-telemetry" class="engine-telemetry">活塞高度：未加载 · 理论连杆闭环误差：未加载</div>
      <div id="engine-cad-status" class="engine-telemetry">基础 GLB：概念网格；CAD B-Rep 版本尚未载入。</div>
      <div class="engine-note">剖视模式中的彩色连杆线和关节点，是数学约束中心线（非制造几何）；4 个活塞和连杆均由同一曲轴角度求解，凸轮轴按 2:1 转动。源 GLB 的曲柄形状仍有需要通过 CAD 修正的偏差。<a href="${import.meta.env.BASE_URL}models/engine-i4-kinematics-contract.json" target="_blank" rel="noopener noreferrer">检查运动学合同</a> · <a href="${import.meta.env.BASE_URL}models/engine-i4-axial-clearance.json" target="_blank" rel="noopener noreferrer">查看跨缸几何间隔审查</a></div>
    </section>
    <div class="disclaimer">106 个零件均可独立选择；四轮及制动组件、概念四缸发动机已接入独立机械操作 DAG。完整变速箱、自动碰撞窄相与 OEM CAD 制造精度仍未实现。视觉爆炸预览不会修改机械状态。</div>
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
    <a class="manifest-link" href="${import.meta.env.BASE_URL}models/automotive-corners-contract.json" target="_blank" rel="noopener noreferrer">查看四轮连接 / 拆装 DAG 合同 ↗</a>
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
/** Exact kinematic centerlines are guides, not extra physical GLB parts. */
const engineGuideLayer=new THREE.Group();
engineGuideLayer.name="i4-mathematical-constraint-guides";
engineGuideLayer.visible=false;
scene.add(engineGuideLayer);
const linePositions:THREE.BufferAttribute[]=[];
const guides:{crank:THREE.Mesh;pin:THREE.Mesh}[]=[];
const jointMarkerGeometry=new THREE.SphereGeometry(.015,12,10);
for(let i=0;i<4;i++){
  const geometry=new THREE.BufferGeometry();
  const positions=new THREE.BufferAttribute(new Float32Array(6),3);
  geometry.setAttribute("position",positions);
  const color=[0x65d9f5,0x9acaee,0xdabef5,0xffc384][i];
  const material=new THREE.LineBasicMaterial({color,depthTest:false});
  const line=new THREE.Line(geometry,material);
  line.renderOrder=20;
  line.frustumCulled=false;
  engineGuideLayer.add(line);
  linePositions.push(positions);
  const ballMaterial=new THREE.MeshBasicMaterial({color,depthTest:false});
  const crank=new THREE.Mesh(jointMarkerGeometry,ballMaterial);
  const pin=new THREE.Mesh(jointMarkerGeometry,ballMaterial);
  crank.renderOrder=21;pin.renderOrder=21;
  engineGuideLayer.add(crank,pin);
  guides.push({crank,pin});
}
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
let engineMechanical:MechanicalEngine|null=null;
let enginePreviewOffsets:Record<string,Vec3>={};
let engineSpinning=false;
let engineCutaway=false;
let cadLoading=false;
let cadLoaded=false;
const cadPartIds=[
  "engine.block.cast","engine.crankshaft",
  ...Array.from({length:4},(_,i)=>[
    "engine.piston."+(i+1),"engine.rod."+(i+1),
    "engine.piston.pin."+(i+1),"engine.piston.rings."+(i+1)
  ]).flat()
];
let enginePreviousFrame=0;
const engineJointId="joint.engine.i4.crankshaft";
const engineStatus=(message:string)=>{$("engine-status").textContent=message;};
const updateEngineLabel=(angle:number)=>{
  const deg=Math.round(angle*180/Math.PI);
  ($("engine-angle") as HTMLInputElement).value=String(deg);
  $("engine-angle-value").textContent=deg+"°";
};
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
  const engineState=engineMechanical?.getState();
  const theta=engineState?.jointAngles[engineJointId]??0;
  const engineFrame=engineMechanical
    ?solveEngineI4(engineI4Constraint(engineMechanical.asset),theta,manifest02 as unknown as EngineI4Manifest)
    :null;
  for(const [id,obj] of byId){
    const original=originalPos.get(id)!;
    const authored=engineFrame?.parts[id];
    const pose=authored?.position??[original.x,original.y,original.z];
    const offset=previewOffsets[id]??enginePreviewOffsets[id]??state?.offsets[id]??
      engineState?.offsets[id]??[0,0,0];
    const system=systemFor(id);
    const extra=exploded?system==="body"?new THREE.Vector3(0,.55,0):
      system==="wheels"?new THREE.Vector3(Math.sign(original.x)*.45,0,0):
      system==="chassis"?new THREE.Vector3(Math.sign(original.x)*.12,-.13,0):
      new THREE.Vector3():new THREE.Vector3();
    obj.position.set(pose[0]+offset[0],pose[1]+offset[1],pose[2]+offset[2]).add(extra);
    if(authored){
      const rotation=authored.rotation;
      obj.quaternion.set(rotation[0],rotation[1],rotation[2],rotation[3]);
    }
  }
  engineGuideLayer.visible=engineCutaway&&!!engineFrame&&
    !!engineState&&
    engineFrame.cylinders.every(c=>engineState.partStatus["engine.rod."+c.index]==="installed");
  if(engineGuideLayer.visible&&engineFrame){
    for(const cylinder of engineFrame.cylinders){
      const i=cylinder.index-1,arr=linePositions[i];
      const a=cylinder.crankPinWorld,b=cylinder.pistonPinWorld;
      arr.setXYZ(0,a[0],a[1],a[2]);
      arr.setXYZ(1,b[0],b[1],b[2]);
      arr.needsUpdate=true;
      guides[i].crank.position.set(...a);
      guides[i].pin.position.set(...b);
    }
  }
  if(engineFrame){
    const y=engineFrame.cylinders.map((c,i)=>{
      const id="engine.piston."+(i+1);
      return "P"+(i+1)+": "+engineFrame.parts[id].position[1].toFixed(3)+"m";
    }).join(" · ");
    $("engine-telemetry").textContent=y+
      " · 闭环数值误差 "+engineFrame.maxClosureErrorM.toExponential(1)+" m";
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
    ...((mechanical?.getState().partStatus[id]??engineMechanical?.getState().partStatus[id])
      ?['<div class="pair"><span>机械演示状态</span><b>'+
          (mechanical?.getState().partStatus[id]??engineMechanical?.getState().partStatus[id])+'</b></div>']
      :[]),
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
    const isEngineShell=engineCutaway&&[
      "engine.block.cast","engine.cylinder.head","engine.valve.cover",
      "engine.timing.cover","engine.oil.pan"
    ].includes(id);
    node.visible=!(bodyHidden&&system==="body")&&!isEngineShell&&
      (!isolated||id===selectedId);
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
$("engine-angle").addEventListener("input",()=>{
  engineSpinning=false;
  if(!engineMechanical){engineStatus("请先载入发动机 GLB");return;}
  if(operating){engineStatus("拆装任务进行中，不允许旋转曲轴。");return;}
  const value=Number(($("engine-angle") as HTMLInputElement).value)*Math.PI/180;
  try{
    engineMechanical.setRevoluteAngle(engineJointId,value,false);
    updateEngineLabel(value);
    applyPositions();
  }catch(error){engineStatus("曲轴受阻："+String(error));}
});
function loadCadReference():void{
  if(cadLoaded||cadLoading)return;
  if(!root||!engineMechanical)return;
  cadLoading=true;
  $("engine-cad-status").textContent="正在加载带曲面 CAD 来源的 18 件 B-Rep 网格...";
  const file=import.meta.env.BASE_URL+"models/engine-i4-cad-reference.glb";
  new GLTFLoader().load(file,gltf=>{
    try{
      const container=new THREE.Group(),newParts=new Map<string,THREE.Object3D>();
      const moved=transferGlbParts(gltf.scene,container,cadPartIds.map(id=>({id})),
        (id:string,node:THREE.Object3D)=>newParts.set(id,node));
      if(moved!==18||newParts.size!==18)throw new Error("CAD Part 数量不一致");
      for(const [id,node] of newParts){
        const old=byId.get(id);
        if(!old||!old.parent)throw new Error("Missing existing geometry to replace "+id);
        old.parent.remove(old);
        root!.add(node);
        byId.set(id,node);
        originalPos.set(id,node.position.clone());
      }
      cadLoaded=true;
      cadLoading=false;
      applyPositions();updateVisibility();
      if(selectedId&&newParts.has(selectedId))select(selectedId);
      $("engine-cad-status").textContent="已加载 18 件真实 B-Rep 曲面生成的 GLB；未获得 OEM CAD 或制造验证。";
      $("engine-cad-load").textContent="B-Rep 已载入";
    }catch(error){
      cadLoading=false;
      $("engine-cad-status").textContent="CAD GLB 替换未成功："+String(error);
    }
  },undefined,error=>{
    cadLoading=false;
    $("engine-cad-status").textContent="CAD B-Rep 附加文件暂不可用，继续使用原概念 GLB："+String(error);
  });
}
$("engine-cad-load").addEventListener("click",loadCadReference);
$("engine-rotate").addEventListener("click",()=>{
  if(!engineMechanical||operating){engineStatus("引擎未就绪或拆装任务未完成。");return;}
  try{
    engineCutaway=true;bodyHidden=true;
    $("engine-cutaway").textContent="恢复发动机外壳";
    $("body-toggle").textContent="显示车身骨架";
    updateVisibility();
    const current=engineMechanical.getState().jointAngles[engineJointId]??0;
    engineMechanical.setRevoluteAngle(engineJointId,current,false);
    enginePreviousFrame=0;engineSpinning=true;
    engineStatus("发动机运转中：曲轴↔活塞↔连杆运动由相同约束求解。");
  }catch(error){engineSpinning=false;engineStatus("发动机启动受阻："+String(error));}
});
$("engine-stop").addEventListener("click",()=>{
  engineSpinning=false;engineStatus("曲轴已停止；可调整角度或执行拆装。");
});
$("engine-focus").addEventListener("click",()=>{
  camera.position.set(2.9,2.25,.65);
  controls.target.set(.06,.94,-1.44);controls.update();
  bodyHidden=true;engineCutaway=true;
  $("body-toggle").textContent="显示车身骨架";
  $("engine-cutaway").textContent="恢复发动机外壳";
  updateVisibility();
  select("engine.crankshaft");
});
$("engine-cutaway").addEventListener("click",()=>{
  engineCutaway=!engineCutaway;
  $("engine-cutaway").textContent=engineCutaway?"恢复发动机外壳":"剖视发动机";
  updateVisibility();
});
$("engine-home").addEventListener("click",()=>{
  engineSpinning=false;
  if(!engineMechanical||operating){engineStatus("引擎未就绪或拆装正在执行。");return;}
  try{
    engineMechanical.setRevoluteAngle(engineJointId,0);
    updateEngineLabel(0);applyPositions();
    engineStatus("发动机曲轴已归位 0°；现在可运行拆装流程。");
  }catch(error){engineStatus("归位受阻："+String(error));}
});
async function runEnginePlan(intent:"disassemble"|"assemble"):Promise<void>{
  engineSpinning=false;
  if(!engineMechanical||operating){engineStatus("发动机未就绪或机械操作尚未结束。");return;}
  operating=true;exploded=false;$("explosion").textContent="结构爆炸预览";
  const name="plan.engine.i4."+intent;
  try{
    const steps=engineMechanical.operationsFor(name).length;
    engineStatus("执行四缸发动机 "+intent+"，共 "+steps+" 个概念拆装操作。");
    await engineMechanical.runPlan(name);
    engineStatus("已执行："+intent+"；Core Revision "+
      engineMechanical.getState().revision+"。未认证实车维修。");
  }catch(error){
    engineStatus("发动机流程被 Core 阻断："+(error instanceof Error?error.message:String(error)));
  }finally{
    operating=false;applyPositions();
    if(selectedId)displayPart(selectedId);
  }
}
$("engine-teardown").addEventListener("click",()=>void runEnginePlan("disassemble"));
$("engine-assemble").addEventListener("click",()=>void runEnginePlan("assemble"));

renderFilters();renderList();
const loader=new GLTFLoader();
const imported=new THREE.Group();
const waiters=manifests.map((manifest,batchIndex)=>new Promise<void>((resolve,reject)=>{
  const filename="automotive-fwd-i4-batch-"+String(batchIndex+1).padStart(2,"0")+".glb";
  loader.load(import.meta.env.BASE_URL+"models/"+filename,gltf=>{
    try{
      const transferred=transferGlbParts(gltf.scene,imported,manifest.parts,(id:string,node:THREE.Object3D)=>{
        if(byId.has(id))throw new Error("Duplicate GLB Part ID: "+id);
        byId.set(id,node);
        originalPos.set(id,node.position.clone());
      });
      if(transferred!==manifest.parts.length)throw new Error("Incomplete GLB Part transfer");
    }catch(error){reject(error);return;}
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
  engineMechanical=new MechanicalEngine(createEngineI4Asset(manifest02 as unknown as EngineI4Manifest),new FrameDriver());
  engineMechanical.subscribe(event=>{
    if(event.type==="preview")enginePreviewOffsets=event.offsets;
    else if(event.type==="commit"||event.type==="cancel"||event.type==="state")enginePreviewOffsets={};
    if(event.type==="diagnostic")engineStatus("路径审查警告："+event.message);
    applyPositions();
  });
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
  // Pages contains a separate CAD-generated BRep GLB; local dev may not.
  // This non-blocking upgrade preserves all 106 Part IDs and uses the same Core.
  loadCadReference();
}).catch(error=>{
  $("loading").textContent="资产载入失败："+String(error);
  $("render-info").textContent="LOAD ERROR";
});
function animate(now=0):void{
  requestAnimationFrame(animate);
  if(engineSpinning&&engineMechanical&&!operating){
    if(!enginePreviousFrame)enginePreviousFrame=now;
    const dt=Math.max(0,Math.min(100,now-enginePreviousFrame));
    enginePreviousFrame=now;
    const angle=engineMechanical.getState().jointAngles[engineJointId]??0;
    const next=(angle+dt*Math.PI*2/4200)%(Math.PI*4);
    try{
      engineMechanical.setRevoluteAngle(engineJointId,next,false);
      updateEngineLabel(next);
      applyPositions();
    }catch(error){
      engineSpinning=false;engineStatus("旋转被阻止："+String(error));
    }
  }
  controls.update();
  if(selectedHelper)selectedHelper.update();
  renderer.render(scene,camera);
}
animate();
