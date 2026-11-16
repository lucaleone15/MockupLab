// scripts/deploy.mjs — publishes MockupLab on Netlify, only when asked (Netlify never builds on a push).
//   npm run deploy:preview   → a private test address (free), to check before going live
//   npm run deploy           → https://mockuplab3d.netlify.app (15 Netlify credits)
// Steps: refuse uncommitted changes → build (app + prerendered landings) → SEO and speed checks on the
// build → upload dist/ with the Netlify CLI. One-time setup: `npx netlify-cli login`, then
// `npx netlify-cli sites:create --name mockuplab3d`.
import { execSync, spawn } from 'node:child_process';

const prod = process.argv.includes('--prod');
const SITE = 'mockuplab3d';
const NETLIFY = 'npx -y netlify-cli@27.20.0';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const quiet = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

if (quiet('git status --porcelain')) {
  console.error('✗ Uncommitted changes: commit first, so the deployed version is a known commit.');
  process.exit(1);
}
const commit = quiet('git rev-parse --short HEAD');
console.log(`→ ${prod ? 'PRODUCTION' : 'preview'} deploy of ${commit}`);

run('npm run build');
run('node scripts/check-seo.mjs');
// speed and loading checks against the build itself
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 2500));
  run('node scripts/check-perf.mjs http://localhost:4173/');
} finally {
  server.kill();
}

run(`${NETLIFY} deploy --dir dist --site ${SITE} --message "${commit}"${prod ? ' --prod' : ''}`);
console.log(prod ? '✓ Live on https://mockuplab3d.netlify.app' : '✓ Preview deployed: the address is printed above (Website draft URL).');
