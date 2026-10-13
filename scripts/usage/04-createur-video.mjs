// Video creator: a vertical Reel / TikTok of their app, exported as MP4.
import { journey } from './lib.mjs';
await journey('createur-video', 'Une capture d’appli → un Reel vertical animé en MP4', async (u) => {
  const p = u.page;
  const T = { timeout: 8000 };
  await u.step('Ouvrir le Studio', () => u.choose('Ouvrir le Studio'));
  await u.step('Mettre sa capture', () => u.upload(p.getByRole('button', { name: 'parcourir' }), 'public/samples/sample-app.png'));
  await u.step('Ouvrir l’onglet Vidéo', () => p.getByRole('tab', { name: 'Vidéo' }).click(T));
  await u.step('Préréglage Reel / TikTok', () => u.choose('Reel / TikTok'));
  await u.step('Choisir un plan cinéma', () => u.choose(/Révélation/, { exact: false }));
  await u.step('Boucle parfaite', () => u.choose('Boucle parfaite'));
  await u.step('Exporter la vidéo MP4', async () => {
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), u.choose('Exporter la vidéo')]);
    if (!/\.mp4$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier : ${d.suggestedFilename()}`);
  }, { slowMs: 60000 });
});
