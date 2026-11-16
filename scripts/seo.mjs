// scripts/seo.mjs — the public address and each language's page head (used by prerender.mjs and check-seo.mjs).
export const SITE_URL = 'https://mockuplab3d.netlify.app';

export const HEAD = {
  fr: {
    title: 'MockupLab — mockups 3D gratuits dans ton navigateur',
    description:
      'Mets tes designs en scène sur de vrais appareils et supports print en 3D, puis exporte en 4K, MP4 ou GIF. Gratuit, open source, rien ne quitte ton ordinateur.',
    ogImage: '/og/og-fr.png',
    ogAlt: 'Un ordinateur portable et un téléphone affichant des designs, rendus en 3D par MockupLab',
    locale: 'fr_FR',
  },
  en: {
    title: 'MockupLab — free 3D mockups in your browser',
    description:
      'Stage your designs on real 3D devices and print items, then export in 4K, MP4 or GIF. Free and open source, and nothing ever leaves your computer.',
    ogImage: '/og/og-en.png',
    ogAlt: 'A laptop and a phone showing designs, rendered in 3D by MockupLab',
    locale: 'en_US',
  },
};

export const AUTHOR = { name: 'Luca Leone', url: 'https://luca-leone.ch', sameAs: ['https://www.linkedin.com/in/leone-luca', 'https://github.com/lucaleone15'] };
export const REPO = 'https://github.com/lucaleone15/MockupLab';
