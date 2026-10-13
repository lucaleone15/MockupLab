// scripts/usage/lib.mjs — a user journey, played only through what is visible on screen.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { openApp } from '../lib/app.mjs';

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function journey(name, goal, run, opts = {}) {
  const dir = `out/usage/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { browser, page, errors } = await openApp({ colorScheme: 'light', ...opts });
  // every real (trusted) click counts, wherever it lands
  await page.evaluate(() => {
    window.__usageClicks = 0;
    addEventListener('click', (e) => e.isTrusted && window.__usageClicks++, true);
  });
  const clicks = () => page.evaluate(() => window.__usageClicks ?? 0);
  const steps = [];
  const frictions = [];
  let current = '';
  const t0 = Date.now();
  let ok = true;
  const u = {
    page,
    friction: (kind, text) => frictions.push({ kind, text, step: current }),
    async step(label, fn, { slowMs = 4000 } = {}) {
      current = label;
      const s = Date.now();
      const c = await clicks();
      try {
        await fn();
      } catch (e) {
        frictions.push({ kind: 'bloquant', text: `${label} : ${e.message.split('\n')[0]}`, step: label });
        await page.screenshot({ path: `${dir}/${String(steps.length + 1).padStart(2, '0')}-ECHEC-${slug(label)}.png` });
        throw e;
      }
      const ms = Date.now() - s;
      if (ms > slowMs) frictions.push({ kind: 'lent', text: `${label} : ${(ms / 1000).toFixed(1)} s`, step: label });
      steps.push({ label, ms, clicks: (await clicks()) - c });
      await page.screenshot({ path: `${dir}/${String(steps.length).padStart(2, '0')}-${slug(label)}.png` });
    },
    /** Clicks the visible control a person would read as `name` (button, tab, radio, switch…). */
    async choose(name, { exact = true, timeout = 8000 } = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        for (const role of ['button', 'radio', 'tab', 'option', 'switch', 'checkbox', 'menuitem', 'link']) {
          const l = page.getByRole(role, { name, exact });
          const n = await l.count();
          for (let i = 0; i < n; i++) if (await l.nth(i).isVisible()) return l.nth(i).click();
        }
        await page.waitForTimeout(200);
      }
      throw new Error(`aucun contrôle visible nommé « ${name} »`);
    },
    async upload(trigger, file) {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), trigger.click()]);
      await chooser.setFiles(file);
    },
  };
  try {
    await run(u);
  } catch {
    ok = false;
  }
  for (const e of errors) frictions.push({ kind: 'bloquant', text: `erreur console : ${e}`, step: '' });
  const summary = { name, goal, ok, ms: Date.now() - t0, clicks: await clicks().catch(() => -1), steps, frictions };
  writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`${ok ? '✓' : '✗'} ${name} — ${(summary.ms / 1000).toFixed(1)} s, ${summary.clicks} clics, ${frictions.length} friction(s)`);
  for (const f of frictions) console.log(`   [${f.kind}] ${f.text}`);
  await browser.close();
  if (!ok) process.exitCode = 1;
  return summary;
}
