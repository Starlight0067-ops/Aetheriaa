// Small math helpers for gameplay code (frame-rate independent smoothing).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
/** Exponential approach: lambda = 1/time-constant. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const wrapAngle = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
export const angleDiff = (from, to) => wrapAngle(to - from);
export const dampAngle = (a, b, lambda, dt) => wrapAngle(a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt)));
export const moveTowards = (a, b, maxDelta) => (Math.abs(b - a) <= maxDelta ? b : a + Math.sign(b - a) * maxDelta);
/** Yaw of a horizontal direction for a model that faces -Z at yaw 0. */
export const yawOf = (x, z) => Math.atan2(-x, -z);

/** Critically damped spring (SmoothDamp). state = {v}. Returns the new value. */
export function smoothDamp(current, target, state, smoothTime, dt, maxSpeed = Infinity) {
  smoothTime = Math.max(1e-4, smoothTime);
  const omega = 2 / smoothTime, x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * smoothTime;
  const change = clamp(current - target, -maxChange, maxChange);
  const t = current - change;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * e;
  return t + (change + temp) * e;
}
