// Minimal stamina wheel that floats beside the character while stamina is not full (hidden in screenshot mode).
// Self-contained DOM in #ui; a future UI module can replace it (disable with ?nohud).
import * as THREE from 'three';

export function createStaminaHud(ctx, controller) {
  const host = document.getElementById('ui') || document.body;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;pointer-events:none;opacity:0;transition:opacity .35s;will-change:transform';
  el.innerHTML = `<svg viewBox="0 0 44 44" width="44" height="44">
    <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(10,20,40,.45)" stroke-width="6"/>
    <circle class="arc" cx="22" cy="22" r="17" fill="none" stroke="#e2b95b" stroke-width="4" stroke-linecap="round"
      transform="rotate(-90 22 22)" stroke-dasharray="106.8" stroke-dashoffset="0"/></svg>`;
  host.appendChild(el);
  const arc = el.querySelector('.arc');
  const v = new THREE.Vector3();
  let fullT = 0;
  return {
    el,
    update(dt) {
      const s = controller.stamina, r = s.value / s.max;
      fullT = r >= 0.999 ? fullT + dt : 0;
      el.style.opacity = fullT > 0.8 ? '0' : '1';
      arc.setAttribute('stroke-dashoffset', String(106.8 * (1 - r)));
      arc.setAttribute('stroke', s.exhausted ? '#e0604a' : r < 0.3 ? '#f0a040' : '#7ff5ff');
      v.copy(controller.position); v.y += 1.25;
      const right = new THREE.Vector3().setFromMatrixColumn(ctx.camera.matrixWorld, 0);
      v.addScaledVector(right, 0.7).project(ctx.camera);
      const x = (v.x * 0.5 + 0.5) * innerWidth - 22, y = (-v.y * 0.5 + 0.5) * innerHeight - 22;
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      el.style.display = v.z < 1 ? 'block' : 'none';
    },
  };
}
