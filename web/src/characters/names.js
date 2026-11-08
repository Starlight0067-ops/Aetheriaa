// Shared (browser + Node) naming tables for the character pipeline. No imports: safe everywhere.

/** Public action names understood by character.play(). */
export const ACTIONS = ['idle', 'walk', 'run', 'sprint', 'jump', 'fall', 'land', 'dodge', 'attack1', 'attack2', 'attack3',
  'cast', 'hit', 'death', 'talk', 'wave', 'interact', 'sit'];

/** The Mixamo file names we ask the user for (assets_src/mixamo/<name>.fbx). Matching is loose. */
export const ACTION_FILES = ['idle', 'walk', 'run', 'sprint', 'jump', 'fall', 'land', 'dodge_roll', 'attack_1', 'attack_2',
  'attack_3', 'cast', 'hit', 'death', 'talk', 'wave', 'sit_idle', 'interact'];

const ALIASES = {
  idle: ['idle', 'breathingidle', 'standingidle', 'happyidle', 'neutralidle', 'idle1', 'idle01', 'swordidle', 'standing'],
  walk: ['walk', 'walking', 'walkinplace', 'standardwalk', 'femalewalk', 'walkforward', 'swordwalk', 'casualwalk'],
  run: ['run', 'running', 'standardrun', 'jog', 'jogging', 'runforward', 'swordrun', 'slowrun', 'runinplace'],
  sprint: ['sprint', 'sprinting', 'fastrun', 'runfast', 'sprintforward'],
  jump: ['jump', 'jumping', 'jumpup', 'jumpingup', 'standingjump', 'jumpstart'],
  fall: ['fall', 'falling', 'fallingidle', 'fallloop', 'freefall', 'fallidle', 'inair', 'airloop'],
  land: ['land', 'landing', 'hardlanding', 'fallingtolanding', 'falltoland', 'jumpland', 'softlanding'],
  dodge: ['dodge', 'dodgeroll', 'roll', 'standtoroll', 'forwardroll', 'sprintingforwardroll', 'dodging', 'quickroll', 'diveroll'],
  attack1: ['attack1', 'attack01', 'slash1', 'slash01', 'combo1', 'attack', 'slash', 'swordslash', 'standingmeleeattackhorizontal'],
  attack2: ['attack2', 'attack02', 'slash2', 'slash02', 'combo2', 'standingmeleeattackbackhand'],
  attack3: ['attack3', 'attack03', 'slash3', 'slash03', 'combo3', 'standingmeleeattack360high', 'standingmeleeattackdownward'],
  cast: ['cast', 'casting', 'spellcast', 'castspell', 'magic', 'magicspell', 'magicattack', 'standing1hmagicattack01', 'standing2hmagicattack01'],
  hit: ['hit', 'hitreaction', 'reaction', 'impact', 'takehit', 'gethit', 'hurt', 'standingreacttothefront', 'bigsidehit'],
  death: ['death', 'dying', 'die', 'dead', 'fallingbackdeath', 'standingdeathbackward01', 'swordanddeath'],
  talk: ['talk', 'talking', 'conversation', 'speaking', 'explaining', 'standingtalking'],
  wave: ['wave', 'waving', 'wavehello', 'greeting', 'standinggreeting'],
  sit: ['sitidle', 'sitting', 'sittingidle', 'sit', 'sitidle01', 'sittingtalking'],
  interact: ['interact', 'interaction', 'pickup', 'pickingup', 'buttonpushing', 'openinglid', 'opening', 'pressbutton', 'pickupitem'],
};
const EXACT = new Map();
for (const [a, list] of Object.entries(ALIASES)) for (const n of list) if (!EXACT.has(n)) EXACT.set(n, a);

/** Normalise a file name: "Standard Run (1)@mixamo.FBX" -> "standardrun". */
export function normName(file) {
  let s = String(file).split(/[\\/]/).pop();
  s = s.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  s = s.replace(/mixamo(\.com)?/g, '').replace(/\(\d+\)/g, '').replace(/[@]/g, ' ');
  s = s.replace(/without\s*skin|in\s*place|inplace|_?30fps/g, '');
  return s.replace(/[^a-z0-9]/g, '');
}

/** Map a file name to one of ACTIONS (or null). */
export function matchAction(file) {
  const n = normName(file);
  if (!n) return null;
  if (EXACT.has(n)) return EXACT.get(n);
  const raw = String(file).split(/[\\/]/).pop().toLowerCase();
  const digit = (raw.match(/(\d)(?!.*\d)/) || n.match(/(\d)(?!.*\d)/) || [])[1];
  if (/attack|slash|combo|swing|strike/.test(n)) {
    if (digit === '2') return 'attack2';
    if (digit === '3') return 'attack3';
    return 'attack1';
  }
  const rules = [
    [/sprint|fastrun/, 'sprint'], [/dodge|roll/, 'dodge'], [/land/, 'land'], [/fall/, 'fall'], [/jump/, 'jump'],
    [/death|dying|dead|die/, 'death'], [/hit|react|hurt|impact/, 'hit'], [/cast|spell|magic/, 'cast'],
    [/wave|greet/, 'wave'], [/sit/, 'sit'], [/talk|speak|convers/, 'talk'], [/interact|pickup|picking|button|lid|open/, 'interact'],
    [/walk/, 'walk'], [/run|jog/, 'run'], [/idle|breath/, 'idle'],
  ];
  for (const [re, a] of rules) if (re.test(n)) return a;
  return null;
}

/** Mixamo bone -> VRM humanoid bone. */
export const MIXAMO_TO_VRM = {
  Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head',
  LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand',
  LeftHandThumb1: 'leftThumbMetacarpal', LeftHandThumb2: 'leftThumbProximal', LeftHandThumb3: 'leftThumbDistal',
  LeftHandIndex1: 'leftIndexProximal', LeftHandIndex2: 'leftIndexIntermediate', LeftHandIndex3: 'leftIndexDistal',
  LeftHandMiddle1: 'leftMiddleProximal', LeftHandMiddle2: 'leftMiddleIntermediate', LeftHandMiddle3: 'leftMiddleDistal',
  LeftHandRing1: 'leftRingProximal', LeftHandRing2: 'leftRingIntermediate', LeftHandRing3: 'leftRingDistal',
  LeftHandPinky1: 'leftLittleProximal', LeftHandPinky2: 'leftLittleIntermediate', LeftHandPinky3: 'leftLittleDistal',
  RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand',
  RightHandThumb1: 'rightThumbMetacarpal', RightHandThumb2: 'rightThumbProximal', RightHandThumb3: 'rightThumbDistal',
  RightHandIndex1: 'rightIndexProximal', RightHandIndex2: 'rightIndexIntermediate', RightHandIndex3: 'rightIndexDistal',
  RightHandMiddle1: 'rightMiddleProximal', RightHandMiddle2: 'rightMiddleIntermediate', RightHandMiddle3: 'rightMiddleDistal',
  RightHandRing1: 'rightRingProximal', RightHandRing2: 'rightRingIntermediate', RightHandRing3: 'rightRingDistal',
  RightHandPinky1: 'rightLittleProximal', RightHandPinky2: 'rightLittleIntermediate', RightHandPinky3: 'rightLittleDistal',
  LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes',
};

/** Strip the "mixamorig:" / "mixamorig1:" / "mixamorig_" prefixes FBX exports use. */
export function mixamoBoneKey(name) {
  return String(name).replace(/^.*?mixamorig\d*[:_]?/i, '').replace(/^.*:/, '');
}

/** VRM humanoid parent map (subset we animate), used to fold missing bones into ancestors. */
export const HUMAN_PARENT = {
  hips: null, spine: 'hips', chest: 'spine', upperChest: 'chest', neck: 'upperChest', head: 'neck',
  leftShoulder: 'upperChest', leftUpperArm: 'leftShoulder', leftLowerArm: 'leftUpperArm', leftHand: 'leftLowerArm',
  rightShoulder: 'upperChest', rightUpperArm: 'rightShoulder', rightLowerArm: 'rightUpperArm', rightHand: 'rightLowerArm',
  leftUpperLeg: 'hips', leftLowerLeg: 'leftUpperLeg', leftFoot: 'leftLowerLeg', leftToes: 'leftFoot',
  rightUpperLeg: 'hips', rightLowerLeg: 'rightUpperLeg', rightFoot: 'rightLowerLeg', rightToes: 'rightFoot',
};
for (const side of ['left', 'right']) {
  const S = side, H = side + 'Hand';
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
    const seg = f === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
    HUMAN_PARENT[S + f + seg[0]] = H;
    HUMAN_PARENT[S + f + seg[1]] = S + f + seg[0];
    HUMAN_PARENT[S + f + seg[2]] = S + f + seg[1];
  }
}
