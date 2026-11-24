// scripts/deploy.mjs — puts MockupLab online by hand. Usually not needed: every push to main deploys on its own
// (.github/workflows/deploy-infomaniak.yml).
//   npm run deploy                   → https://mockuplab.luca-leone.ch (Infomaniak, over SSH)
//   npm run deploy:netlify-redirect  → the old https://mockuplab3d.netlify.app, which only redirects (15 Netlify credits)
// Steps for the site: refuse uncommitted changes → build (app + prerendered landings) → SEO check → upload dist/
// (.htaccess included) with rsync. Asks for the Infomaniak password unless an SSH key is set up.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const quiet = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

if (process.argv.includes('--netlify-redirect')) {
  run('npx -y netlify-cli@27.20.0 deploy --no-build --dir scripts/netlify-redirect --site mockuplab3d --prod');
  console.log('✓ https://mockuplab3d.netlify.app now redirects to https://mockuplab.luca-leone.ch');
  process.exit(0);
}

if (quiet('git status --porcelain')) {
  console.error('✗ Uncommitted changes: commit first, so the deployed version is a known commit.');
  process.exit(1);
}
console.log(`→ deploy of ${quiet('git rev-parse --short HEAD')}`);

run('npm run build');
run('node scripts/check-seo.mjs');
run('rsync -az --delete --stats dist/ 0l4vhm_LucaLeone2004@0l4vhm.ftp.infomaniak.com:sites/mockuplab.luca-leone.ch/');
console.log('✓ Live: https://mockuplab.luca-leone.ch/');
console.log('  Check it: node scripts/check-prod.mjs https://mockuplab.luca-leone.ch/ && node scripts/check-perf.mjs https://mockuplab.luca-leone.ch/');
