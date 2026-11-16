// scripts/check-all.mjs — every check in one command: typecheck, each scripts/check-*.mjs in turn, then the
// user journeys. Starts the dev server (:5173) when none answers. `--quick` runs a short subset.
// Usage: node scripts/check-all.mjs [--quick]
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const quick = process.argv.includes('--quick');
// not part of the suite: production URL, packaged desktop app, and a check that needs a font file
const SKIP = new Set(['check-all.mjs', 'check-prod.mjs', 'check-desktop.mjs', 'check-brand.mjs', 'check-seo.mjs', 'check-perf.mjs', 'check-pages-redirect.mjs']);
const QUICK = ['check-home.mjs', 'check-nav.mjs', 'check-urls.mjs', 'check-studio.mjs', 'check-export.mjs', 'check-lang-urls.mjs'];

const up = async () => {
  try {
    return (await fetch('http://localhost:5173/')).ok;
  } catch {
    return false;
  }
};

let server = null;
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
}

mkdirSync('out/check-all', { recursive: true });
const all = readdirSync('scripts').filter((f) => /^check-.*\.mjs$/.test(f) && !SKIP.has(f)).sort();
const checks = quick ? QUICK.filter((f) => all.includes(f)) : all;
const runs = [['typecheck', 'npm', ['run', '-s', 'typecheck']], ...checks.map((f) => [f, 'node', [`scripts/${f}`]])];
if (!quick) runs.push(['usage/run-all.mjs', 'node', ['scripts/usage/run-all.mjs']]);

const results = [];
for (const [name, cmd, args] of runs) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  writeFileSync(`out/check-all/${name.replace(/\//g, '_')}.log`, `${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  results.push({ name, ok, s: Math.round((Date.now() - t0) / 1000) });
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${name} (${results.at(-1).s} s)`);
}

if (server) process.kill(-server.pid);
const failed = results.filter((r) => !r.ok);
const summary = results.map((r) => `${r.ok ? 'OK' : 'ÉCHEC'}\t${r.name}`).join('\n');
writeFileSync('out/check-all.txt', summary + '\n');
console.log(`\n${results.length - failed.length}/${results.length} OK${failed.length ? ` — échecs : ${failed.map((r) => r.name).join(', ')} (logs dans out/check-all/)` : ''}`);
process.exit(failed.length ? 1 : 0);
