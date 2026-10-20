// Cinematic shots: each one renders (cinema quality: motion blur + depth of field),
// is a valid video, and a 5-frame strip shows the move. SHOTS='reveal,dive' to pick.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
mkdirSync('out/cinema', { recursive: true });
const shots = (process.env.SHOTS ?? 'reveal,dive,dutch,flip,drop,crane,vertigo,trailer').split(',');
const quality = process.env.QUALITY ?? 'cinema';
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  localStorage.setItem('mockuplab:lang', 'fr');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/studio');
await p.waitForFunction(() => window.__mockuplab?.renderVideo);
await p.evaluate(async (scene) => {
  const api = window.__mockuplab;
  await api.loadSamples(api.project.getState().items[0].id);
  if (scene === 'table') {
    const { SCENE_PRESETS, applyScenePreset } = await import('/src/scene/scenePresets.ts');
    applyScenePreset(SCENE_PRESETS.find((x) => x.id === 'table-oak-white'));
  }
}, process.env.SCENE ?? 'studio');
await p.waitForTimeout(1500);
for (const id of shots) {
  const duration = id === 'trailer' ? 6 : 3;
  const t0 = Date.now();
  const r = await p.evaluate(async ({ id, duration, quality }) => {
    const api = window.__mockuplab;
    api.project.getState().setExport({ video: { ...api.project.getState().export.video, animation: id, format: 'mp4', resolution: '720', fps: 24, duration, quality } });
    const res = await api.renderVideo();
    const buf = new Uint8Array(await res.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { id, duration, quality });
  const file = `out/cinema/${id}.mp4`;
  writeFileSync(file, Buffer.from(r, 'base64'));
  const n = duration * 24;
  const probe = execSync(`ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 ${file}`).toString().trim();
  const pick = [0, 0.25, 0.5, 0.75, 1].map((f) => `eq(n\\,${Math.min(n - 1, Math.round(f * (n - 1)))})`).join('+');
  execSync(`ffmpeg -v error -y -i ${file} -vf "select='${pick}',scale=384:-2,tile=5x1" -frames:v 1 out/cinema/${id}-strip.png`);
  console.log(id.padEnd(9), `${((Date.now() - t0) / 1000).toFixed(1)} s`, `${probe} frames`);
}
console.log('errors:', errors.join('\n') || 'none');
await b.close();
