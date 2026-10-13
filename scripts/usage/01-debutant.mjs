// Beginner in a hurry: from the home page to an Instagram post exported, under 2 minutes.
import { readFileSync } from 'node:fs';
import { journey } from './lib.mjs';
const s = await journey('debutant', 'Une capture d’appli → un post Insta 4:5 téléchargé, < 2 min', async (u) => {
  const p = u.page;
  await u.step('Accueil', () => p.getByRole('heading', { level: 1 }).waitFor());
  await u.step('Ouvrir le Studio', () => u.choose('Ouvrir le Studio'));
  await u.step('Importer sa capture', () => u.upload(p.getByRole('button', { name: 'parcourir' }), 'public/samples/sample-app.png'));
  await u.step('Choisir le format Insta 4:5', () => u.choose('4:5'));
  await u.step('Exporter', async () => {
    await p.getByRole('button', { name: 'Exporter' }).first().click({ timeout: 8000 });
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.getByRole('button', { name: 'Télécharger', exact: true }).click({ timeout: 8000 })]);
    if (!/\.(png|jpe?g|webp)$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier téléchargé : ${d.suggestedFilename()}`);
    const buf = readFileSync(await d.path());
    if (buf.toString('ascii', 1, 4) === 'PNG') {
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      if (Math.abs(w / h - 0.8) > 0.01) u.friction('bloquant', `l’image exportée fait ${w} × ${h}, pas du 4:5`);
    }
  }, { slowMs: 15000 });
});
if (s.ms > 120000) console.log('   [lent] plus de 2 minutes');
