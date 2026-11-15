// Synthesised SFX (WebAudio). The AudioContext is created/resumed on the first user gesture.
import { S } from './state.js';

let ac = null, master = null, noiseBuf = null;
function ensure() {
  if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return true; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch { return false; }
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, ensure, { passive: true });

function tone(type, f0, f1, dur, vol = 0.25, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(f0, f1, dur, vol = 0.25, q = 1.2, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
const SFX = {
  swing: () => noise(500, 2400, 0.16, 0.22, 0.8),
  hit: () => { noise(1800, 300, 0.12, 0.4, 0.6); tone('square', 180, 60, 0.14, 0.25); },
  hurt: () => { tone('sawtooth', 220, 70, 0.25, 0.3); noise(600, 150, 0.2, 0.25); },
  dodge: () => noise(300, 1800, 0.22, 0.25, 0.7),
  pyra: () => { noise(400, 1600, 0.4, 0.3, 0.5); tone('sawtooth', 300, 700, 0.3, 0.12); },
  aqua: () => { tone('sine', 400, 900, 0.4, 0.25); tone('sine', 600, 300, 0.4, 0.15, 0.1); },
  terra: () => { tone('square', 90, 40, 0.4, 0.35); noise(200, 60, 0.35, 0.4, 0.5); },
  volt: () => { tone('sawtooth', 1200, 200, 0.25, 0.2); noise(3000, 800, 0.18, 0.25, 2); },
  zephyr: () => noise(800, 3000, 0.3, 0.28, 0.6),
  crya: () => { tone('triangle', 1400, 2200, 0.35, 0.2); tone('sine', 2100, 1500, 0.5, 0.12, 0.08); },
  heal: () => [523, 659, 784].forEach((f, i) => tone('sine', f, f * 1.01, 0.25, 0.2, i * 0.08)),
  pickup: () => { tone('sine', 880, 1320, 0.15, 0.2); tone('sine', 1320, 1760, 0.2, 0.15, 0.08); },
  ui: () => tone('triangle', 660, 880, 0.07, 0.15),
  uiBack: () => tone('triangle', 520, 340, 0.08, 0.15),
  levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.3, 0.2, i * 0.1)),
  die: () => tone('sawtooth', 300, 40, 0.9, 0.3),
  talk: () => tone('triangle', 420 + Math.random() * 80, 400, 0.04, 0.08),
  reaction: () => { tone('square', 700, 1400, 0.12, 0.15); tone('square', 1400, 700, 0.2, 0.12, 0.1); },
};
export function sfx(name) {
  if (!ensure() || !master) return;
  master.gain.value = Math.max(0, Math.min(1, S.settings.volume));
  try { SFX[name]?.(); } catch { /* ignore */ }
}
export const audioState = () => ac?.state || 'none';
