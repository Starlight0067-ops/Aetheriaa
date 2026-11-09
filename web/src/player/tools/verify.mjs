// One-shot verification for the player owner (run under the heavy lock):
//   node tools/lock.mjs node src/player/tools/verify.mjs [--round r1] [--skip-autotest] [--skip-shots]
// 1) probe the fullbody follow view, 2) movement/camera autotest, 3) portrait/fullbody/plaza screenshots.
import { spawnSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const round = arg('round', 'r1'), url = arg('url', 'http://127.0.0.1:5173');
const run = (label, args) => {
  console.log(`\n===== ${label} =====`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  console.log(`===== ${label}: exit ${r.status} =====`);
  return r.status;
};
const codes = {};
codes.probe = run('probe fullbody', ['src/player/tools/probe.mjs', '--view', 'fullbody', '--quality', 'low', '--url', url, '--shot', `shots/player/${round}/probe_fullbody_low.png`]);
if (!has('skip-autotest')) codes.autotest = run('autotest', ['src/player/tools/autotest.mjs', '--quality', 'low', '--url', url, '--out', `shots/player/${round}/autotest`]);
if (!has('skip-shots')) codes.shots = run('shots', ['tools/shoot.mjs', '--views', 'portrait,fullbody,plaza', '--quality', 'high', '--url', url, '--out', `shots/player/${round}`]);
console.log('\nVERIFY', JSON.stringify(codes));
