import {PropertyBinding} from "three";

/**
 * Move one glTF Part instance per catalog ID into a combined scene.
 *
 * A Three.Object3D can only have one parent. Calling target.add(child)
 * REMOVES it from source.children, so mutating while walking the live
 * array silently skips every second node and eventually reads undefined.
 *
 * Snapshot + exact ID resolution is mandatory; NEVER identify a physical
 * Part by mutable scene-child position.
 */
export function transferGlbParts(source,target,manifestParts,register=()=>{}){
  if(!source?.children||!target?.add||!Array.isArray(manifestParts))
    throw new TypeError("GLB Part binding requires a Three scene, target and manifest");
  const snapshot=source.children.slice();
  const names=new Map();
  for(const node of snapshot){
    if(!node||typeof node.name!=="string"||!node.name)
      throw new Error("GLB contains an unnamed top-level Part node");
    if(names.has(node.name))throw new Error("Duplicate GLB node name: "+node.name);
    names.set(node.name,node);
  }
  if(snapshot.length!==manifestParts.length)throw new Error(
    "GLB scene / manifest count mismatch: "+snapshot.length+" vs "+manifestParts.length
  );
  const matched=new Set(),mapped=[];
  const normalizedNames=new Map();
  for(const node of snapshot){
    const alias=PropertyBinding.sanitizeNodeName(node.name);
    if(normalizedNames.has(alias))throw new Error("Ambiguous sanitized GLB Part name: "+alias);
    normalizedNames.set(alias,node);
  }
  for(const record of manifestParts){
    const id=record?.id;
    if(typeof id!=="string"||!id||matched.has(id))throw new Error("Duplicate/invalid catalog Part ID "+id);
    // Three's GLTFLoader sanitizes periods and other tokens in Object3D.name
    // (e.g., wheel.fl.rim -> wheelflrim). Match the exact source-catalog ID
    // through the same upstream function, and reject alias collisions.
    const key=PropertyBinding.sanitizeNodeName(id);
    const node=names.get(id)??names.get(key)??normalizedNames.get(key);
    if(!node)throw new Error("GLB missing catalog Part name/alias: "+id);
    if(mapped.some(entry=>entry.node===node))throw new Error("Sanitized Part ID collision: "+id);
    matched.add(id);mapped.push({id,node});
  }
  // Validate ALL Parts before touching the source scene.
  for(const {id,node} of mapped){
    node.name=id;
    node.userData.partId=id;
    node.traverse(child=>{child.userData.partId=id;});
    target.add(node); // Moves the node out of glTF's original scene.
    register(id,node);
  }
  return mapped.length;
}
