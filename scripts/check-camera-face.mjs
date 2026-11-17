// scripts/check-camera-face.mjs — the « Face » view faces the selected device, even when others are turned
// (it followed the device with the largest footprint: a turned phone beat the straight one in the middle).
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const look = (select) =>
  page.evaluate(async (select) => {
    const api = window.__mockuplab;
    const s = api.project.getState();
    s.setComposition([], 'auto');
    s.setComposition(['phone-pro', 'phone-pro', 'phone-pro'], 'row');
    const byX = [...api.project.getState().items].sort((a, b) => a.position[0] - b.position[0]);
    byX.forEach((it, i) => s.updateItem(it.id, { rotation: [0, [0.5, 0, -0.5][i], 0], position: [(i - 1) * 9, it.position[1], 0] }));
    s.selectItem(byX[select].id);
    s.setCamera({ preset: 'front' });
    api.ui.getState().resetView();
    await new Promise((r) => setTimeout(r, 1200));
    const cam = api.bridge().camera;
    const dir = new cam.position.constructor();
    cam.getWorldDirection(dir);
    // the camera's heading, in degrees around the vertical (0 = looking straight down -z)
    return (Math.atan2(-dir.x, -dir.z) * 180) / Math.PI;
  }, select);
const mid = await look(1);
check(Math.abs(mid) < 2, `« Face » with the middle phone selected looks straight at it (heading ${mid.toFixed(1)}°)`);
const left = await look(0);
check(Math.abs(left - 28.6) < 3, `« Face » with the left phone selected faces that phone (heading ${left.toFixed(1)}°, its yaw is 28.6°)`);
await done(browser, errors);
