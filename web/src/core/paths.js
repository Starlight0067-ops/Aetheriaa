// Base-aware URLs for files in public/ (draco, basis, assets). Vite's BASE_URL follows vite.config `base`,
// so the build works from any subpath; never hard-code a leading "/" for these.
export const BASE = import.meta.env.BASE_URL;
export const asset = (p) => BASE + String(p).replace(/^\/+/, '');
