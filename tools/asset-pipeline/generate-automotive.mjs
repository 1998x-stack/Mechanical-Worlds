import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const generateAutomotive = function generateAutomotive(){
 const vertices=[]; // reserved to make the generator source self-contained
 const palette=[
  ["alloy",[.64,.73,.83,1],.81,.28],
  ["brushed-metal",[.42,.52,.62,1],.76,.4],
  ["rubber",[.07,.09,.13,1],.02,.93],
  ["cast-iron",[.34,.40,.48,1],.8,.51],
  ["brake-metal",[.54,.60,.64,1],.89,.4],
  ["accent",[.94,.40,.15,1],.62,.32],
  ["brass",[.81,.65,.42,1],.82,.28],
  ["pads",[.15,.16,.18,1],.1,.85],
  ["frame-coat",[.16,.28,.40,1],.68,.38]
 ];
 const mIndex=Object.fromEntries(palette.map((x,i)=>[x[0],i]));
 const pi=Math.PI, root2=pi*2;
 const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
 const mul=(a,n)=>[a[0]*n,a[1]*n,a[2]*n];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const norm=v=>{const d=Math.hypot(...v);return d>1e-12?mul(v,1/d):[1,0,0];};
 function buildShape(){
  const matBuckets=Object.create(null);
  function bucket(mat){const id=mIndex[mat]; if(id===undefined)throw new Error("Unknown material "+mat);return matBuckets[id]??(matBuckets[id]={p:[],n:[],i:[]});}
  function tri(a,b,c,mat){
   const N=cross(sub(b,a),sub(c,a));const l=Math.hypot(...N);if(l<1e-11)return;
   const n=mul(N,1/l),o=bucket(mat),idx=o.p.length/3;
   o.p.push(...a,...b,...c,...n.slice(0,0)); // deliberately append coordinates only
   o.n.push(...n,...n,...n);
   o.i.push(idx,idx+1,idx+2);
  }
  function quad(a,b,c,d,mat){tri(a,b,c,mat);tri(a,c,d,mat);}
  function box(center,size,mat){
   const [x,y,z]=center,[u,v,w]=size.map(a=>a*.5);
   const p=[
    [x-u,y-v,z-w],[x+u,y-v,z-w],[x+u,y+v,z-w],[x-u,y+v,z-w],
    [x-u,y-v,z+w],[x+u,y-v,z+w],[x+u,y+v,z+w],[x-u,y+v,z+w]];
   for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]])
     quad(p[a],p[b],p[c],p[d],mat);
  }
  function annulusX(front,back,rIn,rOut,mat,segments=48){
   for(let k=0;k<segments;k++){
    const a=root2*k/segments,b=root2*(k+1)/segments;
    const pt=(x,r,t)=>[x,r*Math.cos(t),r*Math.sin(t)];
    quad(pt(front,rIn,a),pt(front,rIn,b),pt(front,rOut,b),pt(front,rOut,a),mat);
    quad(pt(back,rOut,a),pt(back,rOut,b),pt(back,rIn,b),pt(back,rIn,a),mat);
    quad(pt(front,rOut,a),pt(front,rOut,b),pt(back,rOut,b),pt(back,rOut,a),mat);
    quad(pt(back,rIn,a),pt(back,rIn,b),pt(front,rIn,b),pt(front,rIn,a),mat);
   }
  }
  function torusX(R,r,mat,N=56,M=12,offset=[0,0,0]){
   const P=(a,b)=>add(offset,[r*Math.sin(b),(R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a)]);
   for(let i=0;i<N;i++)for(let j=0;j<M;j++){
    const a=root2*i/N,a2=root2*(i+1)/N,b=root2*j/M,b2=root2*(j+1)/M;
    quad(P(a,b),P(a2,b),P(a2,b2),P(a,b2),mat);
   }
  }
  function tube(a,b,r,mat,segments=12){
   const d=norm(sub(b,a)),base=Math.abs(d[1])>.85?[1,0,0]:[0,1,0],u=norm(cross(d,base)),v=norm(cross(d,u));
   const point=(c,t)=>add(c,add(mul(u,Math.cos(t)*r),mul(v,Math.sin(t)*r)));
   for(let i=0;i<segments;i++){
    const A=root2*i/segments,B=root2*(i+1)/segments;
    quad(point(a,A),point(a,B),point(b,B),point(b,A),mat);
    tri(a,point(a,B),point(a,A),mat);
    tri(b,point(b,A),point(b,B),mat);
   }
  }
  function coil(c,rad,height,turns,tubeR,mat){
   const steps=turns*20,facets=8;
   const pos=t=>[c[0]+rad*Math.cos(t),c[1]+height*(t/(root2*turns)-.5),c[2]+rad*Math.sin(t)];
   const p=(t,b)=>{
    const center=pos(t),tangent=norm([-rad*Math.sin(t),height/(root2*turns),rad*Math.cos(t)]);
    const reference=[0,1,0],u=norm(cross(tangent,reference)),v=norm(cross(tangent,u));
    return add(center,add(mul(u,tubeR*Math.cos(b)),mul(v,tubeR*Math.sin(b))));
   };
   for(let i=0;i<steps;i++)for(let j=0;j<facets;j++){
    const t=root2*turns*i/steps,t2=root2*turns*(i+1)/steps;
    const b=root2*j/facets,b2=root2*(j+1)/facets;
    quad(p(t,b),p(t2,b),p(t2,b2),p(t,b2),mat);
   }
  }
  return {matBuckets,quad,tri,box,annulusX,torusX,tube,coil};
 }
 const shapeFns={
  rim(b){
   b.annulusX(-.105,.105,.249,.291,"alloy",64);
   b.annulusX(-.114,-.079,.265,.299,"alloy",64);
   b.annulusX(-.131,-.072,.074,.096,"cast-iron",50);
   b.annulusX(-.118,-.076,.092,.110,"alloy",50);
   for(let i=0;i<5;i++){
    const a=root2*i/5;
    for(const d of [-.07,.07]){
     b.tube([-.118,.099*Math.cos(a+d),.099*Math.sin(a+d)],
      [-.116,.258*Math.cos(a+d*.32),.258*Math.sin(a+d*.32)],.025,"alloy",10);
    }
    b.annulusX(-.139,-.117,.016,.026,"brushed-metal",20);
   }
   b.torusX(.279,.012,"alloy",64,10,[-.125,0,0]);
  },
  tire(b){
   b.torusX(.318,.082,"rubber",72,20);
   b.annulusX(-.113,.113,.29,.337,"rubber",56);
   for(let i=0;i<48;i++){
    const a=root2*i/48;
    const y=.387*Math.cos(a),z=.387*Math.sin(a);
    const p=[-.04,y,z],q=[.04,y,z];
    b.tube(p,q,.016,"rubber",6);
   }
   for(const x of [-.117,.117])b.torusX(.296,.009,"pads",64,8,[x,0,0]);
  },
  valve(b){
   b.tube([0,0,0],[0,.10,.015],.014,"brass",12);
   b.tube([0,.095,.012],[0,.132,.016],.018,"rubber",12);
  },
  lug(b){
   b.annulusX(-.05,.042,.003,.028,"brass",6);
   b.annulusX(.043,.090,.005,.015,"brushed-metal",18);
   b.annulusX(-.055,-.048,.007,.019,"cast-iron",6);
  },
  hub(b){
   b.annulusX(-.12,.12,.041,.076,"brushed-metal");
   b.annulusX(-.09,-.048,.076,.149,"cast-iron",56);
   b.annulusX(.09,.125,.04,.09,"alloy",44);
   for(let i=0;i<5;i++){
    const a=root2*i/5;
    b.tube([-.115,.116*Math.cos(a),.116*Math.sin(a)],[-.174,.116*Math.cos(a),.116*Math.sin(a)],.014,"brass",12);
   }
  },
  bearing(b){
   b.annulusX(-.064,.064,.060,.097,"alloy",48);
   b.annulusX(-.071,.071,.056,.067,"cast-iron");
   b.annulusX(-.071,.071,.091,.105,"brushed-metal");
   for(let i=0;i<12;i++){
    const a=root2*i/12;
    b.torusX(.077,.009,"brass",12,8,[0,.077*Math.cos(a)*.1,.077*Math.sin(a)*.1]);
   }
  },
  "brake-disc"(b){
   b.annulusX(-.036,-.021,.095,.251,"brake-metal",64);
   b.annulusX(.018,.036,.095,.251,"brake-metal",64);
   b.annulusX(-.042,.042,.250,.256,"cast-iron",64);
   b.annulusX(-.052,-.020,.060,.113,"cast-iron");
   for(let i=0;i<22;i++){
    const a=root2*i/22;
    const y=.226*Math.cos(a),z=.226*Math.sin(a);
    b.tube([-.022,y,z],[.022,y,z],.012,"cast-iron",8);
   }
   b.torusX(.183,.004,"cast-iron",64,6,[-.038,0,0]);
   b.torusX(.183,.004,"cast-iron",64,6,[.038,0,0]);
  },
  caliper(b){
   b.box([0,0,0],[.135,.168,.245],"accent");
   b.box([-.090,0,0],[.085,.202,.256],"accent");
   b.box([.084,0,0],[.05,.175,.268],"accent");
   for(const z of [-.072,.072])b.tube([-.111,.010,z],[.11,.010,z],.044,"brushed-metal",18);
   b.tube([0,.083,-.105],[0,.135,-.140],.018,"cast-iron");
  },
  pad(b){
   b.box([0,0,0],[.024,.15,.195],"pads");
   b.box([0,.080,0],[.046,.033,.212],"brushed-metal");
  },
  damper(b){
   b.tube([0,-.30,0],[0,.20,0],.065,"cast-iron",24);
   b.tube([0,.10,0],[0,.53,0],.031,"alloy",20);
   b.annulusX(-.09,.09,.055,.10,"brushed-metal",32);
   b.tube([-.075,-.35,0],[.075,-.35,0],.046,"brushed-metal",18);
  },
  spring(b){
   b.coil([0,0,0],.120,.52,7,.023,"brushed-metal");
   b.torusX(.13,.024,"cast-iron",32,8,[0,.29,0]);
  },
  knuckle(b){
   b.tube([0,-.24,0],[0,.26,0],.078,"cast-iron",14);
   b.tube([-.02,-.16,0],[.25,-.39,.12],.069,"cast-iron");
   b.tube([.04,.15,0],[.17,.38,-.08],.055,"cast-iron");
   b.annulusX(-.09,.11,.059,.11,"brushed-metal",30);
  },
  "lower-arm"(b){
   b.tube([-.52,0,-.25],[.31,0,0],.052,"cast-iron",14);
   b.tube([-.52,0,.26],[.31,0,0],.052,"cast-iron",14);
   b.tube([-.52,0,-.25],[-.52,0,.26],.044,"cast-iron");
   for(const p of [[-.52,0,-.25],[-.52,0,.26],[.31,0,0]])
    b.torusX(.068,.025,"brushed-metal",20,8,p);
  },
  "tie-rod"(b){
   b.tube([-.33,0,0],[.34,0,0],.024,"brushed-metal",16);
   b.torusX(.055,.022,"rubber",24,8,[-.33,0,0]);
   b.torusX(.052,.019,"rubber",24,8,[.34,0,0]);
  },
  subframe(b){
   for(const x of [-.55,.55]){
    b.tube([x,0,-.42],[x,0,.42],.084,"frame-coat",18);
    for(const z of [-.37,.37])b.torusX(.09,.027,"brushed-metal",18,8,[x,0,z]);
   }
   for(const z of [-.36,.24])b.tube([-.55,0,z],[.55,0,z],.071,"frame-coat",18);
   b.tube([-.50,0,-.36],[.5,0,.24],.047,"cast-iron");
   b.tube([.50,0,-.36],[-.5,0,.24],.047,"cast-iron");
  },
  "stabilizer-link"(b){
   b.tube([0,-.17,0],[0,.17,0],.021,"brushed-metal");
   b.torusX(.044,.018,"rubber",18,8,[0,-.17,0]);
   b.torusX(.044,.018,"rubber",18,8,[0,.17,0]);
  },
  "stabilizer-front"(b){
   b.tube([-.68,0,0],[.68,0,0],.032,"cast-iron",20);
   b.tube([-.68,0,0],[-.76,.05,-.26],.032,"cast-iron");
   b.tube([.68,0,0],[.76,.05,-.26],.032,"cast-iron");
   b.torusX(.042,.020,"rubber",22,7,[-.50,0,0]);
   b.torusX(.042,.020,"rubber",22,7,[.50,0,0]);
  },
  "torsion-beam"(b){
   b.tube([-.70,0,0],[.70,0,0],.090,"frame-coat",20);
   for(const x of [-.7,.7]){
    b.tube([x,0,-.45],[x,0,.43],.065,"cast-iron",18);
    b.torusX(.082,.023,"alloy",26,8,[x,0,.39]);
   }
  },
  "steering-rack"(b){
   b.tube([-.73,0,0],[.73,0,0],.063,"cast-iron",22);
   b.tube([-.83,0,0],[.83,0,0],.020,"alloy",18);
   for(const x of [-.68,.68])b.torusX(.06,.035,"rubber",32,12,[x,0,0]);
  },
  "body-biw"(b){
   for(const x of [-.70,.70]){
    b.tube([x,.05,-1.95],[x,.05,1.88],.055,"frame-coat",18);
    b.tube([x,.95,-.72],[x,.95,.94],.050,"frame-coat",18);
    b.tube([x,.05,-.88],[x,.95,-.72],.057,"frame-coat");
    b.tube([x,.05,.18],[x,.95,.18],.055,"frame-coat");
    b.tube([x,.05,1.17],[x,.95,.94],.052,"frame-coat");
    b.tube([x,.05,-1.95],[x,.28,-2.06],.045,"frame-coat");
   }
   for(const y of [.05,.95])for(const z of [-.72,.18,.94])
     b.tube([-.70,y,z],[.70,y,z],.046,"frame-coat",18);
   for(const z of [-1.72,1.59])b.tube([-.7,.05,z],[.7,.05,z],.056,"frame-coat");
  },
  "floor-pan"(b){
   b.box([0,0,0],[1.38,.05,2.48],"frame-coat");
   for(const x of [-.38,0,.38])b.tube([x,.044,-1.15],[x,.044,1.16],.032,"cast-iron");
  }
 };
 const meshes=[], geometryNames=Object.keys(shapeFns);
 const encodedPrimitives=[];
 const matData=palette.map(x=>({name:x[0],pbrMetallicRoughness:{
  baseColorFactor:x[1],metallicFactor:x[2],roughnessFactor:x[3]},doubleSided:true}));
 for(const [type,fn] of Object.entries(shapeFns)){
  const b=buildShape();fn(b);
  const prims=Object.entries(b.matBuckets).map(([material,shape])=>{
   if(shape.p.length===0)throw new Error("Empty geometry "+type);
   return {material:Number(material),...shape};
  });
  meshes.push({type,prims});
 }
 const partInstances=[];
 const place=(id,type,t,side=1)=>{
  if(!shapeFns[type])throw new Error("Unknown mesh type "+type);
  partInstances.push({id,type,t,rotation:side===1?[0,0,0,1]:[0,1,0,0]});
 };
 for(const side of ["fl","fr","rl","rr"]){
  const front=side[0]==="f",right=side[1]==="r";
  const sign=right?1:-1,z=front?-1.35:1.30,x=sign*.85,y=.435;
  const at=(dx,dy=0,dz=0)=>[x+sign*dx,y+dy,z+dz];
  place("wheel."+side+".rim","rim",at(.15),sign);
  place("wheel."+side+".tire","tire",at(.15),sign);
  place("wheel."+side+".valve","valve",at(.15,.25,.20),sign);
  for(let i=0;i<5;i++){
   const a=root2*i/5;
   place("wheel."+side+".lug."+(i+1),"lug",at(.260,.111*Math.cos(a),.111*Math.sin(a)),sign);
  }
  place("chassis.hub."+side,"hub",at(0),sign);
  place("chassis.bearing."+side,"bearing",at(-.052),sign);
  place("chassis.brake.disc."+side,"brake-disc",at(.01),sign);
  place("chassis.brake.caliper."+side,"caliper",at(-.006,.218,.102),sign);
  place("chassis.brake.pad.in."+side,"pad",at(-.055,.218,.10),sign);
  place("chassis.brake.pad.out."+side,"pad",at(.058,.218,.10),sign);
  place("chassis.damper."+side,"damper",at(-.104,.43,.02),sign);
  place("chassis.spring."+side,"spring",at(-.10,.51,.02),sign);
  if(front){
   place("chassis.knuckle."+side,"knuckle",at(-.070,-.012,.04),sign);
   place("chassis.arm.lower."+side,"lower-arm",at(-.22,-.236,.02),sign);
   place("chassis.tie-rod."+side,"tie-rod",at(-.12,-.06,.27),sign);
  }
 }
 place("chassis.subframe.front","subframe",[0,.22,-1.36]);
 place("chassis.stabilizer.front","stabilizer-front",[0,.31,-1.12]);
 place("chassis.torsion.beam","torsion-beam",[0,.31,1.30]);
 place("chassis.steering.rack","steering-rack",[0,.43,-1.52]);
 place("body.biw","body-biw",[0,.20,0]);
 place("body.floor.pan","floor-pan",[0,.245,0]);
 if(new Set(partInstances.map(x=>x.id)).size!==partInstances.length)throw new Error("Duplicate part identity");
 const bufferChunks=[];
 let offset=0;
 function push(bytes){let n=bytes.length;const padded=(n+3)&~3;
  const newBytes=new Uint8Array(padded);newBytes.set(bytes);
  const here=offset;offset+=padded;bufferChunks.push({offset:here,bytes:newBytes});
  return {byteOffset:here,byteLength:n};
 }
 function encodeF32(values){const a=new Uint8Array(values.length*4),view=new DataView(a.buffer);
  values.forEach((v,i)=>{if(!Number.isFinite(v))throw new Error("Nonfinite float");view.setFloat32(i*4,v,true);});
  return a;
 }
 function encodeU32(values){const a=new Uint8Array(values.length*4),view=new DataView(a.buffer);
  values.forEach((v,i)=>view.setUint32(i*4,v,true));return a;
 }
 const views=[],accessors=[],gltfMeshes=[],meshIndex={};
 let totalTriangles=0;
 for(const shape of meshes){
  const gltfPrim=[];
  for(const primitive of shape.prims){
   const n=primitive.p.length/3,triangles=primitive.i.length/3;
   const posRange=push(encodeF32(primitive.p));
   const norRange=push(encodeF32(primitive.n));
   const indRange=push(encodeU32(primitive.i));
   const pv=views.push({...posRange,target:34962,buffer:0})-1;
   const nv=views.push({...norRange,target:34962,buffer:0})-1;
   const iv=views.push({...indRange,target:34963,buffer:0})-1;
   const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<primitive.p.length;i+=3)for(let axis=0;axis<3;axis++){
    mins[axis]=Math.min(mins[axis],primitive.p[i+axis]);
    maxs[axis]=Math.max(maxs[axis],primitive.p[i+axis]);
   }
   const pa=accessors.push({bufferView:pv,componentType:5126,count:n,type:"VEC3",min:mins,max:maxs})-1;
   const na=accessors.push({bufferView:nv,componentType:5126,count:n,type:"VEC3"})-1;
   const ia=accessors.push({bufferView:iv,componentType:5125,count:primitive.i.length,type:"SCALAR"})-1;
   gltfPrim.push({attributes:{POSITION:pa,NORMAL:na},indices:ia,material:primitive.material,mode:4});
   totalTriangles+=triangles;
  }
  meshIndex[shape.type]=gltfMeshes.length;
  gltfMeshes.push({name:shape.type,primitives:gltfPrim});
 }
 const nodes=partInstances.map(({id,type,t,rotation})=>({name:id,mesh:meshIndex[type],translation:t,rotation}));
 const gltf={
  asset:{version:"2.0",generator:"Mechanical Worlds deterministic geometry builder 0.2",copyright:"Generated concept geometry - non-OEM"},
  scene:0,scenes:[{name:"automotive-fwd-i4-batch-01",nodes:nodes.map((_,i)=>i)}],
  nodes,meshes:gltfMeshes,materials:matData,bufferViews:views,accessors,
  buffers:[{byteLength:offset}]
 };
 const ascii=text=>{const arr=new Uint8Array(text.length);
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c>127)throw new Error("GLB JSON must be ASCII-only");arr[i]=c;}return arr;
 };
 const jsonRaw=ascii(JSON.stringify(gltf)),jsonPadded=(jsonRaw.length+3)&~3;
 const binSize=offset,fullSize=12+8+jsonPadded+8+binSize;
 const glb=new Uint8Array(fullSize);const dv=new DataView(glb.buffer);
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,fullSize,true);
 dv.setUint32(12,jsonPadded,true);dv.setUint32(16,0x4e4f534a,true);
 glb.fill(32,20,20+jsonPadded);glb.set(jsonRaw,20);
 const bstart=20+jsonPadded;dv.setUint32(bstart,binSize,true);dv.setUint32(bstart+4,0x004e4942,true);
 for(const chunk of bufferChunks)glb.set(chunk.bytes,bstart+8+chunk.offset);
 const perMeshTriangles=Object.fromEntries(meshes.map(shape=>
  [shape.type,shape.prims.reduce((sum,primitive)=>sum+primitive.i.length/3,0)]));
 const manifest={
  batchId:"mw.car.fwd-i4.batch-01",batchVersion:"0.2.0",
  catalogId:"mw.car.fwd-i4.catalog.001",
  geometryUri:"assets/generated/automotive/fwd-i4-batch-01.glb",
  generator:"tools/asset-pipeline/generate-automotive.mjs",
  designTier:"generated-conceptual",engineeringVerified:false,
  geometrySource:"deterministic procedural triangle meshes (not OEM CAD)",
  units:"m",coordinate:{handedness:"right",up:"+Y",forward:"-Z",vehicleRight:"+X"},
  gltfAssetNodes:partInstances.length,uniqueMeshTemplates:gltfMeshes.length,
  uniqueTriangles:totalTriangles,bytes:glb.length,
  parts:partInstances.map(p=>({id:p.id,nodeName:p.id,meshType:p.type,triangles:perMeshTriangles[p.type],positionM:p.t})),
  releaseNotes:"Actual binary GLB meshes, separately selectable by catalog ID; measurements and fits not manufacturer validated"
 };
 return {glb,manifest};
};

const main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const {glb,manifest}=generateAutomotive();
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
  const filename=path.join(root,manifest.geometryUri);
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,Buffer.from(glb));
  const manifestPath=path.join(path.dirname(filename),"manifest.json");
  // Preserve previously assigned Git blob metadata when regenerating.
  let prev={};try{prev=JSON.parse(fs.readFileSync(manifestPath,"utf8"));}catch{}
  fs.writeFileSync(manifestPath,JSON.stringify({...manifest,...(prev.gitBlobSha?{gitBlobSha:prev.gitBlobSha}:{})},null,2)+"\n");
  console.log(`Generated ${manifest.parts.length} parts, ${manifest.uniqueTriangles} template triangles, ${glb.length} GLB bytes`);
}
