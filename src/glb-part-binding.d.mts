import type {Object3D} from "three";

export interface GlbManifestPart {id:string}
export declare function transferGlbParts(
  source:Object3D,
  target:Object3D,
  manifestParts:ReadonlyArray<GlbManifestPart>,
  register?:(id:string,node:Object3D)=>void
):number;
