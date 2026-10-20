import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, MODE_ORDER, navigate } from '@/shell/route';
import { ProjectCard } from '@/library/ProjectCard';
import { useLibrary } from '@/library/store';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

const shot = (name: string) => `${import.meta.env.BASE_URL}showcase/${name}.webp`;

/** Real mock-ups rendered by MockupLab from the sample designs (scripts/make-showcase.mjs). */
const HERO = ['hero-table-black-marble', 'laptop-marble', 'phone-aurora', 'hero-table-oak-white'];
const STRIP = ['phone-oak', 'hero-studio-light', 'laptop-concrete', 'phone-terrazzo', 'phone-aurora', 'hero-table-oak-white', 'laptop-marble'];
const MODE_SHOTS: Record<Screen, string> = { home: '', quick: 'phone-oak', project: 'hero-studio-light', studio: 'laptop-concrete' };

/** Full-bleed slideshow of real mock-ups (still under reduced motion). */
function HeroSlides() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % HERO.length), 5200);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      {HERO.map((name, i) => (
        <img
          key={name}
          src={shot(name)}
          alt=""
          aria-hidden={i !== index}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={cx('absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ease-[var(--ease-out-quart)]', i === index ? 'scale-100 opacity-100' : 'scale-[1.03] opacity-0')}
          draggable={false}
        />
      ))}
      <div className="absolute bottom-6 left-[max(24px,calc((100%-1180px)/2+24px))] flex gap-1.5">
        {HERO.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-label={`${i + 1} / ${HERO.length}`}
            onClick={() => setIndex(i)}
            className={cx('h-1 rounded-full transition-[width,background-color] duration-300', i === index ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/70')}
          />
        ))}
      </div>
    </>
  );
}

function Recents() {
  const { t } = useT();
  const list = useLibrary((s) => s.list);
  if (!list.length) return null;
  return (
    <section className="flex flex-col gap-3" data-testid="recents">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium text-fg-muted">{t('library.recent')}</h2>
        {list.length > 4 && (
          <button type="button" className="text-[13px] font-medium text-accent hover:underline" onClick={() => useUi.getState().setAllProjectsOpen(true)}>
            {t('library.seeAll')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.slice(0, 4).map((m) => (
          <ProjectCard key={m.id} meta={m} />
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const { t } = useT();
  return (
    <div data-testid="home" className="scroll-thin h-full overflow-y-auto">
      <section data-testid="home-hero" className="relative isolate h-[min(64vh,700px)] min-h-[440px] overflow-hidden bg-[#0e0f13] text-white">
        <HeroSlides />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_8_10/0.86)_0%,rgb(8_8_10/0.55)_42%,rgb(8_8_10/0)_74%)]" />
        <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgb(8_8_10/0.55),transparent)]" />
        <header className="relative z-10 mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6">
          <Logo asLink={false} tone="light" />
          <MoreMenu tone="light" />
        </header>
        <div className="relative z-10 mx-auto flex h-[calc(100%-64px)] max-w-[1180px] flex-col justify-center px-6 pb-16">
          <h1 className="font-display max-w-[640px] text-balance text-[clamp(44px,6vw,80px)] font-bold leading-[0.98] tracking-[-0.035em]">{t('home.title')}</h1>
          <p className="mt-5 max-w-[500px] text-[16.5px] leading-relaxed text-white/78">{t(window.mockuplabDesktop ? 'home.leadDesktop' : 'home.lead')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => navigate('studio')}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#1d1d1f] transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.98]"
            >
              {t('home.openStudio')}
              <ArrowRight size={17} />
            </button>
            <a href="#modes" className="flex items-center gap-1 text-[14px] font-medium text-white/80 transition-colors hover:text-white">
              {t('home.otherModes')}
              <ChevronDown size={15} />
            </a>
          </div>
        </div>
      </section>


      <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 pb-6 pt-8">
        <section id="modes" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="font-display text-[26px] font-bold">{t('home.modes')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODE_ORDER.map((m) => {
              const main = m === 'studio';
              return (
                <button
                  key={m}
                  type="button"
                  data-testid={`mode-card-${m}`}
                  disabled={!AVAILABLE[m]}
                  onClick={() => navigate(m)}
                  className={cx(
                    'glass group flex overflow-hidden rounded-[18px] text-left transition-transform duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 active:scale-[0.99]',
                    main ? 'flex-col md:col-span-3 md:flex-row' : 'flex-col',
                  )}
                >
                  <span className={cx('block overflow-hidden bg-surface-2', main ? 'aspect-[16/10] md:aspect-auto md:w-[58%]' : 'aspect-[16/10]')}>
                    <img src={shot(MODE_SHOTS[m])} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]" draggable={false} />
                  </span>
                  <span className={cx('flex flex-col gap-1.5', main ? 'justify-center px-7 py-6' : 'px-4 pb-4 pt-3')}>
                    {main && <span className="w-fit rounded-full bg-accent/12 px-2.5 py-0.5 text-[12px] font-semibold text-accent">{t('home.main')}</span>}
                    <span className={cx('font-display font-bold', main ? 'text-[30px]' : 'text-[20px]')}>{t(`screen.${m}` as I18nKey)}</span>
                    <span className={cx('leading-snug text-fg-muted', main ? 'text-[15px]' : 'text-[13px]')}>{t(`mode.${m}.role` as I18nKey)}</span>
                    {main && (
                      <span className="mt-3 flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
                        {t('home.openStudio')}
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <Recents />
      </main>
      <section className="pb-14 pt-2" aria-label={t('home.made')}>
        <h2 className="mx-auto mb-4 max-w-[1180px] px-6 text-[13px] font-medium text-fg-muted">{t('home.made')}</h2>
        <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]" data-testid="showcase-strip">
          <div className="flex w-max gap-4 animate-[strip_70s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...STRIP, ...STRIP].map((name, i) => (
              <img key={i} src={shot(name)} alt="" loading="lazy" aria-hidden={i >= STRIP.length} className="h-[210px] w-[374px] shrink-0 rounded-[16px] object-cover" draggable={false} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
