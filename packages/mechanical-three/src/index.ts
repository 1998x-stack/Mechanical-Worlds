import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { add, type MechanicalAsset, type PartNode, type Vec3 } from "../../mechanical-schema/src/index.js";
import type { MechanicalEngine } from "../../mechanical-core/src/index.js";
import { getPartPose, axisAngle } from "../../mechanical-core/src/p1.js";

const material=(color:number, metalness=0.5, roughness=0.35)=>
  new THREE.MeshStandardMaterial({color,metalness,roughness});
function mesh(geo:THREE.BufferGeometry, mat:THREE.Material):THREE.Mesh{
  const o=new THREE.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;return o;
}
function cylinder(r:number,thick:number,color:number):THREE.Mesh{
  const o=mesh(new THREE.CylinderGeometry(r,r,thick,40),material(color,.82));o.rotation.z=Math.PI/2;return o;
}
function torus(r:number,t:number,color:number,xAxis=false):THREE.Mesh{
  const o=mesh(new THREE.TorusGeometry(r,t,16,72),material(color,.65));if(xAxis)o.rotation.y=Math.PI/2;return o;
}
function block(x:number,y:number,z:number,color:number):THREE.Mesh{
  return mesh(new THREE.BoxGeometry(x,y,z),material(color));
}
function partGeometry(node:PartNode):THREE.Group{
  const g=new THREE.Group(), key=node.geometryKey;
  if(key==="hub"){
    g.add(cylinder(.25,.22,0x7fa1b7));
    const axle=cylinder(.11,.65,0x48657a);axle.position.x=.2;g.add(axle);
  }else if(key==="brake-disc"){
    g.add(cylinder(.46,.07,0x9aaebb));g.add(cylinder(.19,.12,0x485b73));
    for(let i=0;i<14;i++){const a=i*Math.PI*2/14;const hole=cylinder(.028,.08,0x253447);hole.position.set(-.004,Math.cos(a)*.36,Math.sin(a)*.36);g.add(hole);}
  }else if(key==="caliper"){
    g.add(block(.22,.27,.42,0xf5a64a));const cap=block(.26,.09,.28,0x677486);cap.position.y=.08;g.add(cap);
  }else if(key==="rim"){
    g.add(cylinder(.50,.18,0x9aafc6));const face=cylinder(.38,.2,0xd4e2ef);face.position.x=-.02;g.add(face);
    g.add(torus(.50,.04,0xe4f2fa,true));
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5;const hole=cylinder(.09,.21,0x314458);hole.position.set(-.03,.25*Math.cos(a),.25*Math.sin(a));g.add(hole);}
  }else if(key==="tire"){
    g.add(torus(.61,.17,0x1a2230,true));
    for(let i=0;i<26;i++){const a=i*2*Math.PI/26;const tread=block(.31,.052,.12,0x2d394a);
      tread.position.set(0,.744*Math.cos(a),.744*Math.sin(a));tread.rotation.x=a;g.add(tread);}
  }else if(key==="valve"){
    const stem=mesh(new THREE.CylinderGeometry(.026,.026,.17,14),material(0x344658));g.add(stem);
    const cap=mesh(new THREE.SphereGeometry(.041,16,10),material(0x171f2b));cap.position.y=.1;g.add(cap);
  }else if(key==="lug-nut"){
    g.add(cylinder(.067,.11,0xf0b873));const dot=cylinder(.036,.12,0x3c4859);dot.position.x=-.005;g.add(dot);
  }else if(key==="glasses-frame"){
    for(const sign of [-1,1]){const ring=torus(.55,.065,0xd0a773);ring.position.x=sign*.79;g.add(ring);
      const highlight=torus(.55,.016,0xf8d6a4);highlight.position.set(sign*.79,.01,-.025);g.add(highlight);
      const end=block(.22,.085,.19,0xc7975f);end.position.set(sign*1.35,0,.08);g.add(end);}
    const bridge=block(.53,.075,.11,0xcba36d);bridge.position.set(0,.17,-.01);g.add(bridge);
  }else if(key==="lens"){
    g.add(mesh(new THREE.CircleGeometry(.49,64),new THREE.MeshPhysicalMaterial({
      color:0x7dcfe7,side:THREE.DoubleSide,transparent:true,opacity:.52,metalness:0,roughness:.1,depthWrite:false
    })));g.add(torus(.49,.017,0xa7dfef));
  }else if(key==="temple"){
    g.add(block(.095,.11,1.72,0xb49368));const tip=block(.12,.13,.36,0x25374b);tip.position.z=.70;g.add(tip);
    const head=block(.15,.13,.18,0xd2ad7d);head.position.z=-.79;g.add(head);
  }else if(key==="hinge"){
    g.add(mesh(new THREE.CylinderGeometry(.078,.078,.22,20),material(0xc6d3df,.9)));
    const plate=block(.18,.09,.21,0xd3a978);plate.position.z=.04;g.add(plate);
  }else if(key==="hinge-screw"){
    g.add(mesh(new THREE.CylinderGeometry(.042,.042,.24,16),material(0xd4e2ed,.9)));
    const head=mesh(new THREE.CylinderGeometry(.073,.073,.035,20),material(0xa6b8c7,.9));head.position.y=.14;g.add(head);
    const slot=block(.10,.008,.013,0x43576a);slot.position.y=.161;g.add(slot);
  }else if(key==="nose-pad"){
    const pad=mesh(new THREE.SphereGeometry(.14,20,14),
      new THREE.MeshStandardMaterial({color:0xd3e7f2,transparent:true,opacity:.83}));
    pad.scale.set(.65,1,.42);g.add(pad);
  }
  g.traverse(o=>{o.userData.partId=node.id;});
  return g;
}
function explodedOffset(node:PartNode,glasses:boolean):Vec3{
  const id=node.id,side=id.includes("left")?-1:id.includes("right")?1:0;
  if(glasses){
    if(id.includes("lens"))return [side*.4,.28,.55];
    if(id.includes("temple"))return [side*.7,.1,.5];
    if(id.includes("screw"))return [side*.48,.65,.15];
    if(id.includes("hinge"))return [side*.54,-.18,.17];
    if(id.includes("pad"))return [side*.34,-.36,.38];
    return [0,0,0];
  }
  if(id.includes(".lug."))return [-.68,.35,.2];
  if(id.includes("wheel.fl."))return [-.82,.16,0];
  if(id.includes("caliper"))return [0,.7,0];
  if(id.includes("brake.disc"))return [-.3,.07,0];
  return [0,0,0];
}
export class MechanicalViewer{
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(44,1,.08,60);
  private renderer:THREE.WebGLRenderer;
  private controls:OrbitControls;
  private groups=new Map<string,THREE.Group>();
  private base=new Map<string,THREE.Vector3>();
  private observer:ResizeObserver;
  private unsubscribe:()=>void;
  private frame=0;
  private previewOffsets:Record<string,Vec3>={};
  private previewJoints:Record<string,number>={};
  private previewScrews:Record<string,{axis:Vec3;angleRad:number}>={};
  private explosion=0;
  private selected:string|null=null;
  private pointerStart:{x:number;y:number}|null=null;
  private down=(e:PointerEvent)=>{this.pointerStart={x:e.clientX,y:e.clientY};};
  private up=(e:PointerEvent)=>{
    if(!this.pointerStart||Math.hypot(e.clientX-this.pointerStart.x,e.clientY-this.pointerStart.y)>5)return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    const point=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    const raycaster=new THREE.Raycaster();raycaster.setFromCamera(point,this.camera);
    const hit=raycaster.intersectObjects([...this.groups.values()],true).find(h=>h.object.userData.partId);
    if(hit)this.select(hit.object.userData.partId as string);
  };
  constructor(private container:HTMLElement,private asset:MechanicalAsset,private engine:MechanicalEngine,
    private onSelect:(id:string)=>void){
    const glasses=asset.id.includes("glasses");
    this.scene.background=new THREE.Color(0x0b1627);
    this.scene.fog=new THREE.Fog(0x0b1627,9,25);
    this.renderer=new THREE.WebGLRenderer({antialias:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=true;
    this.container.appendChild(this.renderer.domElement);
    this.camera.position.set(glasses?.2:-2.9,2.0,glasses?5.4:4.0);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.minDistance=1.1;this.controls.maxDistance=12;
    this.controls.target.set(glasses?0:-.4,glasses?.55:.3,0);this.controls.update();
    this.scene.add(new THREE.HemisphereLight(0xdae9ff,0x24354a,2));
    const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-4,7,5);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0x62b4ff,1.6);fill.position.set(4,2,-5);this.scene.add(fill);
    const floor=mesh(new THREE.PlaneGeometry(25,25),material(0x122236,.15,.8));floor.rotation.x=-Math.PI/2;floor.position.y=-.55;floor.castShadow=false;this.scene.add(floor);
    const grid=new THREE.GridHelper(18,30,0x36546e,0x284054);grid.position.y=-.545;
    const gridMat=grid.material as THREE.Material;gridMat.transparent=true;gridMat.opacity=.25;this.scene.add(grid);
    const nodes=new Map(asset.nodes.map(n=>[n.id,n]));
    const world=(id:string):THREE.Vector3=>{
      const n=nodes.get(id)!,p=new THREE.Vector3(...n.designLocal.position);
      if(!n.parentId)return p;
      const parent=nodes.get(n.parentId)!;
      return world(parent.id).add(p.applyQuaternion(new THREE.Quaternion(...parent.designLocal.rotation)));
    };
    for(const n of asset.nodes)if(n.kind==="part"){
      const group=partGeometry(n),p=world(n.id);group.position.copy(p);
      this.groups.set(n.id,group);this.base.set(n.id,p);this.scene.add(group);
    }
    this.unsubscribe=engine.subscribe(event=>{
      if(event.type==="preview"){
        this.previewOffsets=event.offsets;
        this.previewJoints=event.jointAngles;
        this.previewScrews=event.screwRotations;
      }else if(event.type==="commit"||event.type==="cancel"||event.type==="state"){
        this.previewOffsets={};this.previewJoints={};this.previewScrews={};
      }
      this.updatePositions();
    });
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    this.renderer.domElement.addEventListener("pointerdown",this.down);
    this.renderer.domElement.addEventListener("pointerup",this.up);
    this.resize();this.updatePositions();
    const tick=()=>{this.frame=requestAnimationFrame(tick);this.controls.update();this.renderer.render(this.scene,this.camera);};tick();
  }
  private resize():void{const w=Math.max(this.container.clientWidth,1),h=Math.max(this.container.clientHeight,1);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  private updatePositions():void{
    const committed=this.engine.getState(),glasses=this.asset.id.includes("glasses");
    const state={
      ...committed,
      offsets:{...committed.offsets,...this.previewOffsets},
      jointAngles:{...committed.jointAngles,...this.previewJoints}
    };
    for(const node of this.asset.nodes)if(node.kind==="part"){
      const pose=getPartPose(this.asset,state,node.id);
      const extra=explodedOffset(node,glasses);
      const group=this.groups.get(node.id)!;
      group.position.set(
        pose.position[0]+extra[0]*this.explosion,
        pose.position[1]+extra[1]*this.explosion,
        pose.position[2]+extra[2]*this.explosion
      );
      group.quaternion.set(...pose.rotation);
      const screw=this.previewScrews[node.id];
      if(screw)group.quaternion.premultiply(new THREE.Quaternion(...axisAngle(screw.axis,screw.angleRad)));
    }
  }
  setExploded(progress:number):void{this.explosion=Math.max(0,Math.min(1,progress));this.updatePositions();}
  isExploded():boolean{return this.explosion>0;}
  select(id:string):void{
    this.selected=id;
    for(const [partId,g] of this.groups)g.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const m=o.material as THREE.MeshStandardMaterial;
      if("emissive" in m&&m.emissive){m.emissive.setHex(partId===id?0x235f95:0x000000);m.emissiveIntensity=partId===id?.5:0;}
    });
    this.onSelect(id);
  }
  focus():void{if(this.selected){const p=this.groups.get(this.selected)?.position;if(p)this.controls.target.copy(p);}}
  resetCamera():void{
    const g=this.asset.id.includes("glasses");
    this.camera.position.set(g?.2:-2.9,2,g?5.4:4);this.controls.target.set(g?0:-.4,g?.55:.3,0);this.controls.update();
  }
  dispose():void{
    cancelAnimationFrame(this.frame);this.observer.disconnect();this.unsubscribe();
    this.renderer.domElement.removeEventListener("pointerdown",this.down);
    this.renderer.domElement.removeEventListener("pointerup",this.up);
    this.controls.dispose();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();
      for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    this.renderer.dispose();this.renderer.domElement.remove();
  }
}
