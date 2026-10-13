// scripts/usage/run-all.mjs — every user journey, one after the other (dev server on :5173).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const only = process.argv[2];
const files = readdirSync('scripts/usage').filter((f) => /^\d\d-.*\.mjs$/.test(f) && (!only || f.includes(only))).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync('node', [`scripts/usage/${f}`], { stdio: 'inherit' });
  if (r.status) failed++;
}
console.log(`\n${files.length - failed}/${files.length} parcours aboutis — captures et summary.json dans out/usage/`);
process.exitCode = failed ? 1 : 0;
