#!/usr/bin/env python3
"""Authored I4 B-Rep CAD generator, not licensed external/OEM engineering CAD.

18 physical Part instances: exact cylinders with four through-bores, crankshaft
with 1&4 vs 2&3 opposite pin phases, connecting rods with X-axis bearing holes,
hollow piston skirts with X-axis pin holes, piston pins and independent ring packs.
STEP uses millimeters. Viewer GLB uses meters. Source geometry is conceptual.
"""
import argparse
import hashlib
import json
import math
import pathlib
import struct

import cadquery as cq

PITCH = 205.0
THROW = 85.0
ROD = 245.0
CRANK_Y = 520.0
Z = -1440.0
BORE_R = 76.0
PISTON_R = 72.0
PHASES = (0.0, math.pi, math.pi, 0.0)

def cyl(radius, height, x=0, y=0, z=0, axis=(1,0,0)):
    v = cq.Vector(*axis)
    return cq.Solid.makeCylinder(radius, height, cq.Vector(x,y,z)-v.multiply(height/2), v)

def brick(x,y,z,cx=0,cy=0,cz=0):
    return cq.Workplane("XY").box(x,y,z).translate((cx,cy,cz)).val()

def block():
    solid = brick(940,380,570)
    for i in range(4):
        solid = solid.cut(cyl(BORE_R,430,(i-1.5)*PITCH,0,0,(0,1,0)))
    return solid.cut(brick(850,90,400,cy=-160))

def piston():
    shell=cyl(PISTON_R,96,axis=(0,1,0))
    shell=shell.cut(cyl(60,66,y=-25,axis=(0,1,0)))
    return shell.cut(cyl(18.4,170,y=-35,axis=(1,0,0)))

def connecting_rod():
    solid=brick(37,245,39,cy=7.5)
    solid=solid.fuse(cyl(53,45,y=-115))
    solid=solid.fuse(cyl(28,43,y=130))
    solid=solid.cut(cyl(28.3,55,y=-115))
    return solid.cut(cyl(18.4,55,y=130))

def ring_pack():
    rings=[]
    for y in (-23,3,30):
        shell=cyl(74.2,2.5,y=y,axis=(0,1,0))
        rings.append(shell.cut(cyl(71.8,4,y=y,axis=(0,1,0))))
    return cq.Compound.makeCompound(rings)

def crankshaft():
    shaft=cyl(37.5,1050)
    for i in range(4):
        x=(i-1.5)*PITCH
        throw_y=(1 if i in (0,3) else -1)*THROW
        for dx in (-52,52):
            shaft=shaft.fuse(brick(24,185,93,cx=x+dx,cy=throw_y/2))
        shaft=shaft.fuse(cyl(27.6,87,x,throw_y))
    return shaft

def make_reference(manifest):
    elements={"engine.block.cast":block(),"engine.crankshaft":crankshaft()}
    source_piston=piston()
    source_rod=connecting_rod()
    source_pin=cyl(18,140)
    source_rings=ring_pack()
    for i in range(1,5):
        elements["engine.piston."+str(i)]=source_piston
        elements["engine.rod."+str(i)]=source_rod
        elements["engine.piston.pin."+str(i)]=source_pin
        elements["engine.piston.rings."+str(i)]=source_rings
    assert len(elements)==18
    known={p["id"]:p for p in manifest["parts"]}
    if any(pid not in known for pid in elements):
        raise ValueError("CAD Part ID does not exist in Batch 02")
    positions={}
    for pid in elements:
        if pid in ("engine.block.cast","engine.crankshaft"):
            positions[pid]=known[pid]["positionM"]
            continue
        i=int(pid.rsplit(".",1)[-1])
        crankpin=CRANK_Y+THROW*math.cos(PHASES[i-1])
        piston_pin=crankpin+ROD
        piston_y=piston_pin+35
        if ".pin." in pid:y=piston_pin
        elif ".rings." in pid:y=piston_y+45
        elif ".rod." in pid:y=crankpin+115
        else:y=piston_y
        positions[pid]=[(i-2.5)*PITCH/1000,y/1000,Z/1000]
    return elements,positions

def to_glb(shapes,positions,tolerance=1):
    meshes=[];nodes=[];views=[];accessors=[];materials=[];chunks=[]
    offset=0
    def add_buffer(data,target):
        nonlocal offset
        idx=len(views)
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(data),"target":target})
        chunks.append(data+b"\0"*((-len(data))%4))
        offset+=len(chunks[-1])
        return idx
    for i,(part_id,shape) in enumerate(shapes.items()):
        verts,faces=shape.tessellate(tolerance,0.25)
        if len(verts)<3 or not faces:raise ValueError("Empty CAD triangulation "+part_id)
        pos=add_buffer(b"".join(struct.pack("<fff",v.x*.001,v.y*.001,v.z*.001) for v in verts),34962)
        ind=add_buffer(b"".join(struct.pack("<III",*face) for face in faces),34963)
        pa=len(accessors)
        accessors.append({"bufferView":pos,"componentType":5126,"count":len(verts),
            "type":"VEC3","min":[min(getattr(v,a) for v in verts)*.001 for a in "xyz"],
            "max":[max(getattr(v,a) for v in verts)*.001 for a in "xyz"]})
        ia=len(accessors)
        accessors.append({"bufferView":ind,"componentType":5125,"count":len(faces)*3,"type":"SCALAR"})
        materials.append({"name":"BRep "+part_id,"pbrMetallicRoughness":{
            "baseColorFactor":[.68,.75,.8,1] if i%2==0 else [.5,.61,.72,1],
            "metallicFactor":.62,"roughnessFactor":.42},"doubleSided":True})
        meshes.append({"name":part_id,"primitives":[{"attributes":{"POSITION":pa},
            "indices":ia,"material":i,"mode":4}]})
        nodes.append({"name":part_id,"mesh":i,"translation":positions[part_id]})
    gltf={"asset":{"version":"2.0","generator":"Mechanical Worlds CadQuery BRep reference (non-OEM)"},
        "scene":0,"scenes":[{"nodes":list(range(len(nodes)))}],
        "nodes":nodes,"meshes":meshes,"materials":materials,
        "accessors":accessors,"bufferViews":views,"buffers":[{"byteLength":offset}]}
    data=json.dumps(gltf,separators=(",",":"),ensure_ascii=True).encode("ascii")
    jchunk=data+b" "*((-len(data))%4)
    bchunk=b"".join(chunks)
    result=struct.pack("<III",0x46546c67,2,12+8+len(jchunk)+8+len(bchunk))
    return result+struct.pack("<II",len(jchunk),0x4e4f534a)+jchunk+struct.pack("<II",len(bchunk),0x004e4942)+bchunk

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",default="assets/generated/automotive/manifest-02.json")
    p.add_argument("--output",default="dist-cad/engine-i4")
    p.add_argument("--skip-step",action="store_true")
    args=p.parse_args()
    manifest=json.loads(pathlib.Path(args.manifest).read_text())
    shapes,positions=make_reference(manifest)
    for name,shape in shapes.items():
        if not shape.isValid() or shape.Volume()<=0:
            raise ValueError("Invalid BRep or nonpositive volume "+name)
    output=pathlib.Path(args.output)
    output.mkdir(parents=True,exist_ok=True)
    if not args.skip_step:
        assembly=cq.Assembly(name="inline-four-concept-brep")
        for name,shape in shapes.items():
            assembly.add(shape,name=name,loc=cq.Location(cq.Vector(*[
                value*1000 for value in positions[name]
            ])))
        assembly.export(str(output/"engine-i4-concept-reference.step"),unit="MM")
    binary=to_glb(shapes,positions)
    (output/"engine-i4-cad-reference.glb").write_bytes(binary)
    report={
        "status":"parametric-brep-unreviewed","engineeringVerified":False,
        "geometrySource":"Original CadQuery BRep source, NOT external OEM CAD",
        "partCount":len(shapes),"partIds":list(shapes),"positionsM":positions,
        "units":{"STEP":"mm","glTF":"m"},"glbBytes":len(binary),
        "glbSha256":hashlib.sha256(binary).hexdigest(),
        "boreDiameterMm":2*BORE_R,"pistonDiameterMm":2*PISTON_R,
        "conceptualRadialClearanceMm":BORE_R-PISTON_R,
        "crankRadiusMm":THROW,"rodCenterDistanceMm":ROD,
        "crankPhaseRad":PHASES,"validBRep":True,
        "notVerified":["OEM dimensions and GD&T","actual bearing caps",
            "assembly collision/fit of all surfaces","manufacturing tolerances"],
    }
    (output/"engine-i4-cad-manifest.json").write_text(
        json.dumps(report,indent=2)+"\n"
    )
    print(json.dumps({"parts":len(shapes),"glbBytes":len(binary),
        "STEP":None if args.skip_step else str(output/"engine-i4-concept-reference.step"),
        "report":str(output/"engine-i4-cad-manifest.json")}))

if __name__=="__main__":main()
