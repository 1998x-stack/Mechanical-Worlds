import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

export const generatePowertrain = function generatePowertrain(){
 const palette=[
  ["cast-aluminum",[.65,.71,.76,1],.78,.38],
  ["cast-iron",[.27,.34,.4,1],.68,.51],
  ["machined-steel",[.72,.79,.85,1],.88,.24],
  ["brass",[.77,.58,.3,1],.76,.3],
  ["dark-rubber",[.10,.13,.17,1],.08,.87],
  ["colored-housing",[.26,.41,.53,1],.48,.42],
  ["oilpan",[.35,.4,.47,1],.56,.54]
 ];
 const mats=Object.fromEntries(palette.map((entry,i)=>[entry[0],i]));
 const TAU=Math.PI*2;
 const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
 const scale=(a,t)=>[a[0]*t,a[1]*t,a[2]*t];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const norm=a=>scale(a,1/Math.max(Math.hypot(...a),1e-12));
 const make=()=>{
  const buckets={};
  const out=mat=>buckets[mats[mat]]??(buckets[mats[mat]]={p:[],n:[],i:[]});
  const tri=(a,b,c,mat)=>{
   const v=cross(sub(b,a),sub(c,a)),len=Math.hypot(...v);if(len<=1e-9)return;
   const n=scale(v,1/len),r=out(mat),offset=r.p.length/3;
   r.p.push(...a,...b,...c);r.n.push(...n,...n,...n);r.i.push(offset,offset+1,offset+2);
  };
  const quad=(a,b,c,d,mat)=>{tri(a,b,c,mat);tri(a,c,d,mat);};
  const box=(center,size,mat)=>{
   const [x,y,z]=center,[a,b,c]=size.map(t=>t/2);
   const p=[[x-a,y-b,z-c],[x+a,y-b,z-c],[x+a,y+b,z-c],[x-a,y+b,z-c],
    [x-a,y-b,z+c],[x+a,y-b,z+c],[x+a,y+b,z+c],[x-a,y+b,z+c]];
   for(const [i,j,k,l] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]])quad(p[i],p[j],p[k],p[l],mat);
  };
  const tube=(a,b,r,mat,count=16)=>{
   const direction=norm(sub(b,a)),seed=Math.abs(direction[1])>.95?[0,0,1]:[0,1,0];
   const ux=norm(cross(direction,seed)),uy=norm(cross(direction,ux));
   const P=(p,t)=>add(p,add(scale(ux,r*Math.cos(t)),scale(uy,r*Math.sin(t))));
   for(let i=0;i<count;i++){
    const t=TAU*i/count,u=TAU*(i+1)/count;
    quad(P(a,t),P(a,u),P(b,u),P(b,t),mat);
    tri(a,P(a,u),P(a,t),mat);tri(b,P(b,t),P(b,u),mat);
   }
  };
  const ring=(axis,inner,outer,width,mat,center=[0,0,0],steps=44)=>{
   const plane=(offset,r,t)=>{
    const c=Math.cos(t)*r,s=Math.sin(t)*r;
    const xyz=axis==="x"?[offset,c,s]:axis==="y"?[c,offset,s]:[c,s,offset];
    return add(center,xyz);
   };
   const f=width/2,h=-f;
   for(let i=0;i<steps;i++){
    const t=TAU*i/steps,u=TAU*(i+1)/steps;
    quad(plane(h,inner,t),plane(h,outer,t),plane(h,outer,u),plane(h,inner,u),mat);
    quad(plane(f,inner,t),plane(f,inner,u),plane(f,outer,u),plane(f,outer,t),mat);
    quad(plane(h,outer,t),plane(f,outer,t),plane(f,outer,u),plane(h,outer,u),mat);
    quad(plane(h,inner,t),plane(h,inner,u),plane(f,inner,u),plane(f,inner,t),mat);
   }
  };
  const helix=(c,R,height,turns,wire,mat)=>{
   const segments=turns*24;
   const P=t=>add(c,[R*Math.cos(t),height*(t/(TAU*turns)-.5),R*Math.sin(t)]);
   for(let i=0;i<segments;i++)tube(P(TAU*i/segments),P(TAU*(i+1)/segments),wire,mat,8);
  };
  return {buckets,box,tube,ring,helix};
 };
 const shapes={
  block(b){
   b.box([0,0,0],[.94,.37,.57],"cast-iron");
   b.box([0,.21,0],[.96,.09,.59],"cast-aluminum");
   for(let i=0;i<4;i++){
    const x=(i-1.5)*.205;
    b.ring("y",.066,.100,.03,"machined-steel",[x,.265,0],32);
    b.tube([x,-.2,0],[x,.27,0],.060,"cast-iron",32);
    b.ring("y",.055,.065,.030,"colored-housing",[x,.29,0],32);
   }
   for(const z of [-.23,.23])for(const x of [-.38,0,.38]){
    b.box([x,-.20,z],[.09,.13,.075],"cast-aluminum");
   }
  },
  crankshaft(b){
   b.tube([-.48,0,0],[.52,0,0],.044,"machined-steel",24);
   for(let i=0;i<5;i++){const x=-.42+i*.208;b.ring("x",.04,.085,.057,"cast-iron",[x,0,0],36);}
   for(let i=0;i<4;i++){
    const x=-.32+i*.208,o=i%2?-.085:.085;
    for(const shift of [-.035,.035])b.ring("x",.033,.074,.022,"machined-steel",[x+shift,o,0],28);
    b.tube([x-.05,o,0],[x+.05,o,0],.031,"machined-steel",18);
    b.tube([x-.05,0,0],[x-.05,o,0],.026,"cast-iron",16);
   }
  },
  pulley(b){b.ring("x",.045,.145,.055,"cast-aluminum",[0,0,0],50);
   b.ring("x",.132,.16,.034,"dark-rubber",[0,0,0],50);
   for(let i=0;i<6;i++){const t=TAU*i/6;b.tube([-.032,.105*Math.cos(t),.105*Math.sin(t)],[.032,.105*Math.cos(t),.105*Math.sin(t)],.013,"machined-steel");}},
  piston(b){
   b.tube([0,-.065,0],[0,.045,0],.072,"cast-aluminum",36);
   b.ring("y",.048,.076,.022,"machined-steel",[0,.055,0],44);
   b.ring("y",.070,.077,.007,"dark-rubber",[0,-.006,0],40);
   b.ring("y",.070,.078,.007,"dark-rubber",[0,.026,0],40);
   b.tube([0,-.04,-.05],[0,-.04,.05],.020,"cast-iron",16);
  },
  rod(b){
   b.ring("z",.026,.071,.045,"machined-steel",[0,-.115,0],32);
   b.ring("z",.016,.040,.036,"cast-aluminum",[0,.13,0],28);
   b.tube([0,-.11,0],[0,.13,0],.027,"machined-steel",14);
   b.box([0,.014,0],[.048,.085,.039],"cast-iron");
  },
  cam(b){
   b.tube([-.46,0,0],[.46,0,0],.025,"machined-steel",18);
   for(let i=0;i<8;i++){const x=-.385+i*.11;b.ring("x",.018,.045,.027,"cast-iron",[x,0,(i%2?.016:-.016)],28);}
   for(const x of [-.40,.38])b.ring("x",.025,.069,.032,"machined-steel",[x,0,0],36);
  },
  head(b){
   b.box([0,0,0],[.95,.19,.59],"cast-aluminum");
   b.box([0,.105,0],[.94,.048,.56],"machined-steel");
   for(let i=0;i<4;i++){const x=(i-1.5)*.205;
    b.ring("y",.054,.090,.010,"cast-iron",[x,-.11,0],30);
    for(const z of [-.16,.16])b.tube([x,-.09,z],[x,.12,z],.025,"machined-steel",14);
   }
   for(const z of [-.29,.29])b.box([0,-.040,z],[.86,.09,.046],"cast-iron");
  },
  pin(b){b.tube([0,0,-.09],[0,0,.09],.022,"machined-steel",24);
   b.ring("z",.014,.024,.018,"cast-aluminum",[0,0,-.075],28);},
  rings(b){for(const y of [-.020,.004,.028])b.ring("y",.067,.077,.006,"machined-steel",[0,y,0],44);},
  oilpan(b){
   b.box([0,0,0],[.94,.145,.52],"oilpan");
   b.box([0,.090,0],[.96,.026,.55],"cast-aluminum");
   for(const x of [-.41,0,.41])b.box([x,-.094,0],[.025,.035,.51],"cast-iron");
   b.tube([.36,-.069,-.20],[.36,-.145,-.20],.025,"brass",18);
  },
  belt(b){
   const loop=[[0,-.24,-.145],[0,.22,-.145],[0,.25,.143],[0,-.20,.143]];
   for(let i=0;i<loop.length;i++)b.tube(loop[i],loop[(i+1)%loop.length],.022,"dark-rubber",18);
   for(const y of [-.20,.20])b.ring("x",.025,.085,.020,"dark-rubber",[0,y,0],32);
  },
  cover(b){
   b.box([0,0,0],[.035,.67,.43],"colored-housing");
   for(const y of [-.26,.26])for(const z of [-.15,.15])b.ring("x",.007,.020,.04,"machined-steel",[0,y,z],16);
  },
  tensioner(b){b.ring("x",.028,.097,.048,"cast-iron",[0,0,0],40);
   b.ring("x",.013,.038,.05,"machined-steel",[0,0,0],24);},
  valvecover(b){
   b.box([0,0,0],[.94,.115,.54],"colored-housing");
   for(const z of [-.18,0,.18])b.box([0,.067,z],[.88,.028,.045],"cast-aluminum");
   b.tube([-.33,.079,0],[-.33,.12,0],.040,"dark-rubber",20);
  },
  diffcarrier(b){b.ring("x",.06,.22,.21,"cast-iron",[0,0,0],44);
   b.ring("x",.04,.09,.24,"machined-steel",[0,0,0],30);
   for(let i=0;i<8;i++){const a=TAU*i/8;b.tube([-.1,.16*Math.cos(a),.16*Math.sin(a)],[.1,.16*Math.cos(a),.16*Math.sin(a)],.017,"cast-aluminum",12);}
  },
  diffpinion(b){b.tube([-.12,0,0],[.12,0,0],.035,"machined-steel",18);
   b.ring("x",.028,.125,.095,"brass",[0,0,0],34);
   for(let i=0;i<12;i++){const a=TAU*i/12;b.tube([-.045,.113*Math.cos(a),.113*Math.sin(a)],[.045,.113*Math.cos(a),.113*Math.sin(a)],.016,"machined-steel",8);}
  },
  diffside(b){for(const x of [-.095,.095])b.ring("x",.035,.135,.045,"machined-steel",[x,0,0],40);
   b.tube([-.14,0,0],[.14,0,0],.035,"brass",16);}
 };
 const ids=[
  ["engine.block.cast","block",[0,.78,-1.44]],
  ["engine.crankshaft","crankshaft",[0,.52,-1.44]],
  ["engine.crankshaft.pulley","pulley",[.57,.52,-1.44]],
  ...Array.from({length:4},(_,i)=>[`engine.piston.${i+1}`,"piston",[(i-1.5)*.205,.99,-1.44]]),
  ...Array.from({length:4},(_,i)=>[`engine.rod.${i+1}`,"rod",[(i-1.5)*.205,.73,-1.44]]),
  ["engine.cam.exhaust","cam",[0,1.30,-1.29]],
  ["engine.cam.intake","cam",[0,1.30,-1.59]],
  ["engine.cylinder.head","head",[0,1.16,-1.44]],
  ...Array.from({length:4},(_,i)=>[`engine.piston.pin.${i+1}`,"pin",[(i-1.5)*.205,.955,-1.44]]),
  ...Array.from({length:4},(_,i)=>[`engine.piston.rings.${i+1}`,"rings",[(i-1.5)*.205,1.035,-1.44]]),
  ["engine.oil.pan","oilpan",[0,.34,-1.44]],
  ["engine.timing.belt","belt",[.57,.91,-1.44]],
  ["engine.timing.cover","cover",[.63,.90,-1.44]],
  ["engine.timing.tensioner","tensioner",[.65,.79,-1.36]],
  ["engine.valve.cover","valvecover",[0,1.45,-1.44]],
  ["gearbox.differential.carrier","diffcarrier",[.87,.59,-1.14]],
  ["gearbox.differential.pinion","diffpinion",[.87,.59,-1.14]],
  ["gearbox.differential.side","diffside",[.87,.59,-1.14]]
 ];
 if(ids.length!==30||new Set(ids.map(x=>x[0])).size!==30)throw Error("Expected 30 unique physical instances");
 const built={};for(const [key,draw] of Object.entries(shapes)){
  const builder=make();draw(builder);
  built[key]=Object.entries(builder.buckets).map(([mat,v])=>({material:Number(mat),...v}));
 }
 const chunk=[],views=[],accessors=[],meshes=[];
 let offset=0,totalTriangles=0;
 const push=u=>{
  const padded=Math.ceil(u.length/4)*4,out=new Uint8Array(padded);out.set(u);
  const start=offset;offset+=padded;chunk.push({start,bytes:out});return {buffer:0,byteOffset:start,byteLength:u.length};
 };
 const f32=a=>{const o=new Uint8Array(a.length*4),dv=new DataView(o.buffer);
  a.forEach((v,i)=>{if(!Number.isFinite(v))throw Error("Nonfinite mesh coordinate");dv.setFloat32(i*4,v,true);});
  return o;};
 const u32=a=>{const o=new Uint8Array(a.length*4),dv=new DataView(o.buffer);a.forEach((v,i)=>dv.setUint32(i*4,v,true));return o;};
 const meshIndex={},triByType={};
 for(const [name,primitives] of Object.entries(built)){
  meshIndex[name]=meshes.length;
  const prims=[];
  let triangles=0;
  for(const p of primitives){
   const pV=views.push({...push(f32(p.p)),target:34962})-1;
   const nV=views.push({...push(f32(p.n)),target:34962})-1;
   const iV=views.push({...push(u32(p.i)),target:34963})-1;
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let j=0;j<p.p.length;j+=3)for(let k=0;k<3;k++){
    min[k]=Math.min(min[k],p.p[j+k]);max[k]=Math.max(max[k],p.p[j+k]);
   }
   const pos=accessors.push({bufferView:pV,componentType:5126,count:p.p.length/3,type:"VEC3",min,max})-1;
   const nor=accessors.push({bufferView:nV,componentType:5126,count:p.n.length/3,type:"VEC3"})-1;
   const ind=accessors.push({bufferView:iV,componentType:5125,count:p.i.length,type:"SCALAR"})-1;
   prims.push({attributes:{POSITION:pos,NORMAL:nor},indices:ind,material:p.material,mode:4});
   triangles+=p.i.length/3;
  }
  totalTriangles+=triangles;triByType[name]=triangles;
  meshes.push({name,primitives:prims});
 }
 const nodes=ids.map(([id,kind,position])=>({name:id,mesh:meshIndex[kind],translation:position}));
 const gltf={
  asset:{version:"2.0",generator:"Mechanical Worlds I4 conceptual parametric generator 0.3",copyright:"Original non-OEM concept geometry"},
  scene:0,scenes:[{name:"automotive-fwd-i4-batch-02-powertrain",nodes:nodes.map((_,i)=>i)}],
  nodes,meshes,materials:palette.map(m=>({name:m[0],pbrMetallicRoughness:{baseColorFactor:m[1],metallicFactor:m[2],roughnessFactor:m[3]},doubleSided:true})),
  bufferViews:views,accessors,buffers:[{byteLength:offset}]
 };
 const json=JSON.stringify(gltf),data=new Uint8Array(json.length);
 for(let i=0;i<json.length;i++){if(json.charCodeAt(i)>127)throw Error("Expected ASCII glTF JSON");data[i]=json.charCodeAt(i);}
 const jSize=Math.ceil(data.length/4)*4,total=12+8+jSize+8+offset,out=new Uint8Array(total);
 const dv=new DataView(out.buffer);
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);
 dv.setUint32(12,jSize,true);dv.setUint32(16,0x4e4f534a,true);
 out.fill(32,20,20+jSize);out.set(data,20);
 const binStart=20+jSize;dv.setUint32(binStart,offset,true);dv.setUint32(binStart+4,0x004e4942,true);
 for(const c of chunk)out.set(c.bytes,binStart+8+c.start);
 const manifest={
  batchId:"mw.car.fwd-i4.batch-02",batchVersion:"0.3.0",catalogId:"mw.car.fwd-i4.catalog.001",
  geometryUri:"assets/generated/automotive/fwd-i4-batch-02.glb",
  generator:"tools/asset-pipeline/generate-powertrain.mjs",
  designTier:"generated-conceptual",engineeringVerified:false,
  geometrySource:"authored parametric triangle mesh generator, no automotive OEM CAD",
  units:"m",coordinate:{handedness:"right",up:"+Y",forward:"-Z",vehicleRight:"+X"},
  gltfAssetNodes:ids.length,uniqueMeshTemplates:meshes.length,uniqueTriangles:totalTriangles,bytes:out.length,
  parts:ids.map(([id,kind,position])=>({id,nodeName:id,meshType:kind,triangles:triByType[kind],positionM:position})),
  releaseNotes:"These 30 powertrain parts are conceptual mechanical visuals, not dimension-verified CAD or physically operable engine geometry"
 };
 return {glb:out,manifest};
};

const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
  const {glb,manifest}=generatePowertrain();
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
  const filename=path.join(root,manifest.geometryUri);
  fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,Buffer.from(glb));
  const hash=createHash("sha1").update(Buffer.from("blob "+glb.length+"\0")).update(Buffer.from(glb)).digest("hex");
  fs.writeFileSync(path.join(path.dirname(filename),"manifest-02.json"),JSON.stringify({...manifest,gitBlobSha:hash},null,2)+"\n");
  console.log("Generated",manifest.parts.length,"powertrain parts and",glb.length,"GLB bytes");
}
