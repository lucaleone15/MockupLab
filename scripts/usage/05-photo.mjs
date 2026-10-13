// Photo mode: a website design placed on a provided photo, exported.
import { journey } from './lib.mjs';
await journey('photo', 'Un design web posé sur une photo fournie, exporté', async (u) => {
  const p = u.page;
  const T = { timeout: 8000 };
  await u.step('Ouvrir Photo', () => u.choose(/^Photo/, { exact: false }));
  await u.step('Voir les photos fournies', () => u.choose('Voir les photos fournies'));
  await u.step('Prendre la première photo', async () => {
    const first = p.getByRole('button', { name: /bureau|Portable|portable/ }).first();
    await first.click(T);
    await p.waitForTimeout(2500);
  });
  await u.step('Poser son design', async () => {
    const browse = p.getByRole('button', { name: /parcourir|Importer ton design|Choisir/ }).first();
    let target = browse;
    if (!(await browse.isVisible().catch(() => false))) {
      u.friction('surprenant', 'après le choix de la photo, le bandeau dit « glisse ton design » mais n’offre pas de bouton pour parcourir ses fichiers : il faut deviner l’onglet « Design »');
      await p.getByRole('tab', { name: 'Design' }).click(T);
      target = p.getByRole('button', { name: /Importer|Choisir|parcourir|Remplacer|Ajouter/ }).first();
    }
    await u.upload(target, 'public/samples/sample-web.png');
    await p.waitForTimeout(1500);
  });
  await u.step('Exporter', async () => {
    await p.getByRole('button', { name: 'Exporter' }).first().click(T);
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.getByRole('button', { name: 'Télécharger', exact: true }).click(T)]);
    if (!/\.(png|jpe?g|webp)$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier : ${d.suggestedFilename()}`);
  }, { slowMs: 15000 });
});
