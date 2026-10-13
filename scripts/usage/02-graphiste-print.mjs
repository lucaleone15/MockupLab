// Print designer: a poster, a flyer and a business card for a client, on a matching wall, exported in 4K.
import { journey } from './lib.mjs';
await journey('graphiste-print', 'Affiche A1 + flyer + carte de visite sur un mur assorti, export 4K', async (u) => {
  const p = u.page;
  const T = { timeout: 8000 };
  await u.step('Ouvrir le Studio', () => u.choose('Ouvrir le Studio'));
  await u.step('Ajouter une affiche', async () => {
    if (!(await p.getByRole('button', { name: 'Print', exact: true }).isVisible())) {
      u.friction('surprenant', 'le Studio s’ouvre sur « Réglages » (le téléphone par défaut), pas sur la liste des appareils');
      await p.getByRole('tab', { name: 'Appareils' }).click(T);
    }
    await p.getByRole('button', { name: 'Print', exact: true }).click(T);
    await p.getByRole('button', { name: 'Affiche', exact: true }).click(T);
  });
  await u.step('Mettre son visuel sur l’affiche', () => u.upload(p.getByRole('button', { name: 'parcourir' }), 'public/samples/sample-poster.png'));
  await u.step('Choisir le format A1 (adapté à l’image)', async () => {
    if (!(await p.getByRole('switch', { name: 'Adapter à mon image' }).isVisible().catch(() => false))) u.friction('surprenant', 'pas d’option « Adapter à mon image » à côté du format');
    if (!(await p.getByRole('radio', { name: 'A1', exact: true }).isVisible())) {
      u.friction('surprenant', 'le format de l’affiche n’est pas à côté de la liste des appareils : il faut chercher dans « Réglages »');
      await p.getByRole('tab', { name: 'Réglages' }).click(T);
    }
    await u.choose('A1');
    if (!(await p.getByText(/≈ \d+ × \d+ cm/).first().isVisible().catch(() => false))) u.friction('surprenant', 'la taille réelle de l’affiche n’est pas affichée');
  });
  await u.step('Changer la couleur du fond (le mur suit)', async () => {
    if (await p.getByText('Couleur du mur').count()) u.friction('surprenant', 'une couleur de mur séparée du fond existe encore');
    await p.getByRole('tab', { name: 'Décor' }).click(T);
    if (await p.getByRole('button', { name: /^Ambiances \d+$/ }).count()) u.friction('surprenant', 'les fonds proposés n’ont pas de nom (« Ambiances 1, 2, 3… »)');
    await u.choose('Papier');
  });
  await u.step('Ajouter un flyer et une carte de visite', async () => {
    await p.getByRole('tab', { name: 'Appareils' }).click(T);
    await p.getByRole('button', { name: 'Print', exact: true }).click(T);
    await u.choose('Flyer');
    await u.choose('Carte de visite');
    if (await p.getByText('Phone Pro', { exact: true }).first().isVisible()) u.friction('surprenant', 'le téléphone d’exemple reste dans la scène à côté des prints');
  });
  await u.step('Disposer', () => p.getByRole('button', { name: 'Disposer' }).click(T));
  await u.step('Exporter en 4K', async () => {
    await p.getByRole('button', { name: 'Exporter' }).first().click(T);
    await u.choose('4K');
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.getByRole('button', { name: 'Télécharger', exact: true }).click(T)]);
    if (!/\.(png|jpe?g|webp)$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier : ${d.suggestedFilename()}`);
  }, { slowMs: 20000 });
});
