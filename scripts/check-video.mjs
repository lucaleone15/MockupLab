// Videos: every animation renders, MP4 / WebM / GIF are valid (ffprobe), frames look right,
// the scene is untouched afterwards, the preview starts and stops.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
mkdirSync('out/video', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  localStorage.setItem('mockuplab:lang', 'fr');
  localStorage.setItem('mockuplab:tab', 'export');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/studio');
await p.waitForFunction(() => window.__mockuplab?.renderVideo);
// a tall capture on the phone, so that the scroll has something to show
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => {
  const i = document.createElement('input');
  i.type = 'file';
  i.onchange = () => window.__mockuplab.importAsset(i.files[0]).then((a) => window.__mockuplab.project.getState().setSurface(window.__mockuplab.project.getState().items[0].id, 'screen', { assetId: a.id, align: 0 }));
  i.click();
})]);
await chooser.setFiles('out/tall-app.png');
await p.waitForTimeout(1200);
const scene = () => p.evaluate(() => { const s = window.__mockuplab.project.getState(); return JSON.stringify([s.items, s.camera, s.decor]); });
const before = await scene();
const render = async (name, video) => {
  const t0 = Date.now();
  const r = await p.evaluate(async (video) => {
    const api = window.__mockuplab;
    api.project.getState().setExport({ kind: 'video', video: { ...api.project.getState().export.video, ...video } });
    const res = await api.renderVideo();
    const buf = new Uint8Array(await res.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), name: res.filename };
  }, video);
  const file = `out/video/${name}-${r.name}`;
  writeFileSync(file, Buffer.from(r.b64, 'base64'));
  const probe = execSync(`ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=codec_name,width,height,nb_read_frames,r_frame_rate -show_entries format=duration -of csv=p=0 "${file}"`).toString().trim().replace(/\n/g, ' | ');
  // three frames: start, middle, end
  execSync(`ffmpeg -v error -y -i "${file}" -vf "select='eq(n\\,0)+eq(n\\,${Math.floor(video.duration * (video.format === 'gif' ? 10 : video.fps) / 2)})+eq(n\\,${Math.floor(video.duration * (video.format === 'gif' ? 20 : video.fps)) - 1})',scale=480:-2,tile=3x1" -frames:v 1 "out/video/${name}-strip.png"`);
  console.log(name.padEnd(10), `${Date.now() - t0} ms`, probe);
};
await render('turntable', { animation: 'turntable', format: 'mp4', resolution: '720', fps: 24, duration: 3 });
console.log('scene untouched:', (await scene()) === before);
await render('scroll', { animation: 'scroll', format: 'webm', resolution: '720', fps: 24, duration: 3 });
await render('orbit', { animation: 'orbit', format: 'gif', resolution: '720', fps: 24, duration: 3 });
await render('swing', { animation: 'swing', format: 'mp4', resolution: '1080', fps: 30, duration: 2 });
await render('float', { animation: 'float', format: 'mp4', resolution: '720', fps: 24, duration: 2 });
// preview: starts, the UI is frozen, Escape stops it and the scene is back
const before2 = await scene();
await p.evaluate(() => window.__mockuplab.project.getState().setExport({ kind: 'video', video: { ...window.__mockuplab.project.getState().export.video, animation: 'turntable' } }));
await p.getByTestId('studio-rail').getByRole('tab', { name: 'Vidéo', exact: true }).click();
await p.getByTestId('video-preview').click();
await p.waitForTimeout(1200);
await p.screenshot({ path: 'out/video/preview.png' });
const moving = (await scene()) !== before2;
await p.keyboard.press('Escape');
await p.waitForTimeout(800);
console.log('preview moves the scene:', moving, '· restored after stop:', (await scene()) === before2);
await p.screenshot({ path: 'out/video/panel.png' });
console.log('errors:', errors.join('\n') || 'none');
await b.close();
