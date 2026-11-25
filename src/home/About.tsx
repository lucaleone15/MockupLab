import { useEffect } from 'react';
import { CodeXml, Globe, UserRound } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { SiteHeader } from '@/shell/SiteHeader';
import { Credit, GITHUB, LINKEDIN, PORTFOLIO, SwissFlag } from './Credit';

/*
 * The about page (/a-propos, /en/about): who makes MockupLab, why, and how it
 * was built. Prerendered like the landing, so search engines read it.
 */

const BASE = import.meta.env.BASE_URL;

const HOW = ['web', 'models', 'ai', 'local'] as const;
const STATS = ['time', 'versions', 'local', 'account'] as const;
const STACK = ['React', 'Three.js', 'React Three Fiber', 'WebGL', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand', 'IndexedDB', 'PWA', 'Claude Code'];

const pill = 'inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-[15px] font-medium text-white/85 transition-colors hover:border-white/30 hover:text-white';

export function About() {
  const { t } = useT();
  // the prerendered page carries its own title; a visit from inside the app sets it, and gives it back on leaving
  const title = t('about.meta.title');
  useEffect(() => {
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);
  return (
    <div data-testid="about" data-theme="dark" className="scroll-thin h-full overflow-y-auto overflow-x-hidden bg-black text-white">
      <SiteHeader />

      <main className="studio-grain studio-night relative">
        <section className="mx-auto max-w-[980px] px-6 pb-16 pt-32 sm:pt-40">
          <p className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.12em] text-white/50">
            <SwissFlag size={16} />
            {t('about.eyebrow')}
          </p>
          <h1 className="font-display mt-5 max-w-[820px] text-balance text-[clamp(38px,6.5vw,76px)] font-extrabold leading-[1.0]">{t('about.title')}</h1>
          <p className="mt-6 max-w-[680px] text-pretty text-[19px] leading-[1.55] text-white/70">{t('about.lead')}</p>
          <img
            src={`${BASE}showcase/hero-still.webp`}
            srcSet={`${BASE}showcase/hero-still-1280.webp 1280w, ${BASE}showcase/hero-still.webp 2560w`}
            sizes="(min-width: 1030px) 932px, 100vw"
            width={2560}
            height={1440}
            alt=""
            className="mt-12 aspect-video w-full rounded-[26px] border border-white/10 object-cover"
          />
        </section>

        <section className="mx-auto grid max-w-[980px] gap-6 px-6 py-16 md:grid-cols-[1fr_1.6fr]">
          <h2 className="font-display text-[clamp(26px,3.6vw,38px)] font-extrabold leading-[1.08]">{t('about.why.title')}</h2>
          <p className="text-pretty text-[18px] leading-[1.6] text-white/70">{t('about.why.body')}</p>
        </section>

        <section className="mx-auto max-w-[980px] px-6 py-16">
          <h2 className="font-display text-[clamp(26px,3.6vw,38px)] font-extrabold leading-[1.08]">{t('about.how.title')}</h2>
          <ol className="mt-10 border-t border-white/12">
            {HOW.map((key, i) => (
              <li key={key} className="grid gap-3 border-b border-white/12 py-9 md:grid-cols-[88px_1fr_1.25fr] md:gap-10">
                <span aria-hidden className="font-display text-[15px] font-bold tabular-nums text-brand">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-display text-[clamp(22px,2.6vw,28px)] font-extrabold leading-[1.12]">{t(`about.how.${key}.title` as I18nKey)}</h3>
                <p className="text-pretty text-[17px] leading-[1.6] text-white/62">{t(`about.how.${key}.body` as I18nKey)}</p>
              </li>
            ))}
          </ol>
          <dl className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s} className="flex flex-col-reverse gap-2">
                <dt className="text-[15px] text-white/50">{t(`about.stat.${s}Label` as I18nKey)}</dt>
                <dd className="font-display text-[clamp(44px,6vw,72px)] font-extrabold leading-none tracking-[-0.02em]">{t(`about.stat.${s}` as I18nKey)}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-12 text-[14px] font-semibold uppercase tracking-[0.12em] text-white/50">{t('about.stack')}</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {STACK.map((s) => (
              <li key={s} className="rounded-full border border-white/12 px-3.5 py-1.5 text-[14px] text-white/75">
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto flex max-w-[980px] flex-col items-center px-6 pb-16 pt-20 text-center">
          <h2 className="font-display text-balance text-[clamp(30px,5vw,52px)] font-extrabold leading-[1.04]">{t('about.contact.title')}</h2>
          <p className="mt-4 max-w-[560px] text-pretty text-[18px] leading-[1.55] text-white/70">{t('about.contact.body')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={LINKEDIN} target="_blank" rel="noreferrer" className={pill}>
              <UserRound size={17} aria-hidden />
              LinkedIn
            </a>
            <a href={PORTFOLIO} target="_blank" rel="noreferrer" className={pill}>
              <Globe size={17} aria-hidden />
              {t('home.credit.portfolio')}
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className={pill}>
              <CodeXml size={17} aria-hidden />
              {t('about.source')}
            </a>
          </div>
          <Credit about={false} links={false} />
        </section>
      </main>
    </div>
  );
}
