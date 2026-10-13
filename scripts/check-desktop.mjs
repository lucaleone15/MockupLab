// scripts/check-desktop.mjs — the Electron app: opens on the home page, exposes the desktop bridge,
// keeps projects between two launches (stable app:// origin). Uses a throwaway user-data folder.
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from 'playwright';
import { check } from './lib/app.mjs';
execSync('npm run -s desktop:web', { stdio: 'pipe' });
const userData = mkdtempSync(join(tmpdir(), 'mockuplab-desktop-'));
// editors built on Electron (VS Code) export ELECTRON_RUN_AS_NODE, which would start Electron as plain Node
const env = { ...process.env, MOCKUPLAB_USER_DATA: userData, MOCKUPLAB_NO_UPDATES: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const launch = () => electron.launch({ args: ['desktop'], env });
let app = await launch();
let win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(e.message));
await win.waitForSelector('[data-testid=home]', { timeout: 20000 });
check(true, 'desktop app opens on the home page');
check((await win.title()) === 'MockupLab', `window title (${await win.title()})`);
const bridge = await win.evaluate(() => ({ platform: window.mockuplabDesktop?.platform, origin: location.origin }));
check(!!bridge.platform && bridge.origin === 'app://mockuplab', `desktop bridge and stable origin (${JSON.stringify(bridge)})`);
// a project made in the first launch is there in the second
await win.evaluate(() => (location.hash = '#/studio'));
await win.waitForSelector('[data-testid=studio-rail]');
await win.getByRole('textbox', { name: /Nom du projet|Project name/ }).fill('Projet bureau');
await win.waitForTimeout(2000);
await app.close();
app = await launch();
win = await app.firstWindow();
await win.waitForSelector('[data-testid=home]', { timeout: 20000 });
await win.waitForSelector('[data-testid=project-card]', { timeout: 10000 }).catch(() => {});
check((await win.getByTestId('project-card').filter({ hasText: 'Projet bureau' }).count()) === 1, 'project kept between launches');
await app.close();
// an update found before the page subscribed is still offered
const env2 = { ...env, MOCKUPLAB_FAKE_UPDATE: '9.9.9' };
delete env2.MOCKUPLAB_NO_UPDATES;
app = await electron.launch({ args: ['desktop'], env: env2 });
win = await app.firstWindow();
await win.waitForSelector('[data-testid=update-banner]', { timeout: 20000 }).catch(() => {});
check(await win.getByTestId('update-banner').isVisible(), 'desktop update offered even when found before the page loaded');
check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await app.close();

