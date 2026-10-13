// Carousel creator: three app screens on an Instagram carousel of three slides, exported as a ZIP.
import { journey } from './lib.mjs';
await journey('createur-carrousel', 'Trois écrans d’appli → un carrousel Insta de 3 slides en ZIP', async (u) => {
  const p = u.page;
  const T = { timeout: 8000 };
  await u.step('Ouvrir le Studio', () => u.choose('Ouvrir le Studio'));
  await u.step('Mettre sa capture', () => u.upload(p.getByRole('button', { name: 'parcourir' }), 'public/samples/sample-app.png'));
  await u.step('Ajouter deux téléphones', async () => {
    await u.choose('Phone Pro');
    await u.choose('Phone Pro');
  });
  await u.step('Choisir « Carrousel Insta »', async () => {
    await p.getByRole('button', { name: /Réseaux/ }).click(T);
    await p.getByRole('menuitemradio', { name: /Carrousel Insta/ }).click(T);
  });
  await u.step('Disposer sur les slides', () => u.choose('Disposer'));
  await u.step('Exporter les slides', async () => {
    await p.getByRole('button', { name: 'Exporter' }).first().click(T);
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.getByRole('button', { name: 'Télécharger', exact: true }).click(T)]);
    if (!/\.zip$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier : ${d.suggestedFilename()}`);
  }, { slowMs: 20000 });
});
