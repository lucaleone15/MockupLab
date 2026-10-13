// Freelance: a client's site, app, poster and card → a matching pack with the brand colours and a board.
import { journey } from './lib.mjs';
await journey('freelance-pack', 'Site + appli + affiche + carte d’un client → pack ZIP assorti, couleurs de marque, planche', async (u) => {
  const p = u.page;
  const T = { timeout: 8000 };
  await u.step('Ouvrir Projet', () => u.choose(/^Projet/, { exact: false }));
  await u.step('Ajouter les visuels du client', async () => {
    const [chooser] = await Promise.all([p.waitForEvent('filechooser', T), p.getByRole('button', { name: /Ajoute les images|Ajouter des images/ }).first().click(T)]);
    await chooser.setFiles(['public/samples/sample-web.png', 'public/samples/sample-app.png', 'public/samples/sample-poster.png', 'public/samples/sample-card-front.png']);
    await p.getByText('sample-card-front.png').first().waitFor(T);
  });
  await u.step('Vérifier le support de chaque visuel', async () => {
    const expected = { 'sample-web.png': 'Ordinateur|Navigateur', 'sample-app.png': 'Téléphone', 'sample-poster.png': 'Print', 'sample-card-front.png': 'Print' };
    for (const [file, want] of Object.entries(expected)) {
      const got = await p.getByRole('combobox', { name: `Support de « ${file} »` }).evaluate((e) => e.options[e.selectedIndex].text);
      if (!new RegExp(want).test(got)) u.friction('surprenant', `« ${file} » détecté comme ${got} (attendu : ${want.replace('|', ' ou ')})`);
    }
  });
  await u.step('Choisir un style', () => u.choose(/Marbre · mur sable/, { exact: false }));
  await u.step('Mettre les couleurs de la marque au pack', async () => {
    if (!(await p.getByText(/Couleurs du pack/).first().isVisible().catch(() => false)))
      u.friction('bloquant', 'impossible de choisir les couleurs de fond du pack : la palette de marque n’habille que la planche, les 6 styles ont des couleurs figées');
  });
  await u.step('Voir le pack et la planche', () => p.getByText('Planche de présentation').first().waitFor({ timeout: 60000 }), { slowMs: 15000 });
  await u.step('Attendre les aperçus du pack', () => p.waitForFunction(() => !document.querySelector('[class*="animate-[spin"]'), null, { timeout: 120000 }), { slowMs: 20000 });
  await u.step('Télécharger le pack', async () => {
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), p.getByRole('button', { name: /Télécharger le pack/ }).click(T)]);
    if (!/\.zip$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier : ${d.suggestedFilename()}`);
  }, { slowMs: 45000 });
});
