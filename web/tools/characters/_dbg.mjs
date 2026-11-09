import * as THREE from 'three';
import { loadFBX } from './fbx_node.mjs';
const a = loadFBX('assets_src/mixamo/idle.fbx');
a.position.set(0,0,0); a.quaternion.identity(); a.updateMatrixWorld(true);
const P = (n) => a.worldToLocal(a.getObjectByName(n).getWorldPosition(new THREE.Vector3()));
const f = (v) => '(' + v.toArray().map(x => x.toFixed(2)).join(',') + ')';
for (const n of ['pelvis','thigh_l','calf_l','foot_l','ball_l','thigh_r','calf_r','foot_r','upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r','neck_01','Head','head_leaf']) console.log(n.padEnd(11), f(P(n)));
