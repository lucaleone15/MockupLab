// Beginner in a hurry: from the home page to an Instagram post exported, under 2 minutes.
import { journey } from './lib.mjs';
const s = await journey('debutant', 'Une capture d’appli → un post Insta 4:5 téléchargé, < 2 min', async (u) => {
  const p = u.page;
  await u.step('Accueil', () => p.getByRole('heading', { level: 1 }).waitFor());
  await u.step('Importer sa capture', () => u.upload(p.getByRole('button', { name: /Dépose tes images|Ouvrir le Studio/ }).first(), 'public/samples/sample-app.png'));
  await u.step('Choisir le format Insta 4:5', () => p.getByRole('button', { name: '4:5', exact: true }).first().click({ timeout: 8000 }));
  // a mock-up is there when its download button can be used
  const ready = p.locator('button:has-text("Télécharger"):not([disabled])');
  await u.step('Voir un premier mock-up', () => ready.first().waitFor({ state: 'attached', timeout: 30000 }), { slowMs: 5000 });
  await u.step('Voir la première rangée', () => p.waitForFunction(() => document.querySelectorAll('[data-testid="quick-tile"] img').length >= 4, null, { timeout: 60000 }), { slowMs: 8000 });
  await u.step('Télécharger', async () => {
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), ready.first().click({ force: true })]);
    if (!/\.(png|jpe?g|webp)$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier téléchargé : ${d.suggestedFilename()}`);
  });
});
if (s.ms > 120000) console.log('   [lent] plus de 2 minutes');
