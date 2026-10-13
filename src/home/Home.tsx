import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { pickImages } from '@/lib/importImage';
import { MOD } from '@/app/shortcuts';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, navigate } from '@/shell/route';
import { ProjectCard } from '@/library/ProjectCard';
import { useLibrary } from '@/library/store';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

const shot = (name: string) => `${import.meta.env.BASE_URL}showcase/${name}.webp`;

/** Real mock-ups rendered by MockupLab from the sample designs (scripts/make-showcase.mjs). */
const HERO = ['hero-table-black-marble', 'laptop-marble', 'phone-aurora', 'hero-table-oak-white', 'photo-desk'];
const STRIP = ['phone-oak', 'hero-studio-light', 'laptop-concrete', 'phone-terrazzo', 'photo-desk', 'phone-aurora', 'hero-table-oak-white', 'laptop-marble'];
const MODE_SHOTS: Record<Screen, string> = { home: '', quick: 'phone-oak', project: 'hero-studio-light', studio: 'laptop-concrete', photo: 'photo-desk' };

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

const MODES: Screen[] = ['quick', 'project', 'studio', 'photo'];

/** One file opens Quick with it; several open Project with all of them. */
export function importFromHome(files: Iterable<File>) {
  const list = [...files];
  if (!list.length) return;
  if (list.length > 1) {
    navigate('project');
    void import('@/project/store').then((m) => m.pack.add(list));
  } else {
    navigate('quick');
    void import('@/quick/store').then((m) => m.quick.setImage(list[0]));
  }
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
  const [before, after] = t('home.drop').split('{paste}');
  return (
    <div data-testid="home" className="scroll-thin h-full overflow-y-auto">
      <section data-testid="home-hero" className="relative isolate h-[min(78vh,760px)] min-h-[560px] overflow-hidden bg-[#0e0f13] text-white">
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
          <button
            type="button"
            data-testid="home-drop"
            onClick={() => pickImages(importFromHome)}
            className="mt-8 flex w-full max-w-[500px] items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-white/45 bg-white/12 px-5 py-4 text-left backdrop-blur-xl transition-[background-color,border-color,transform] duration-150 hover:border-white/80 hover:bg-white/18 active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-white text-[#1d1d1f]">
              <ImagePlus size={20} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14.5px] font-semibold">
                {before}
                <kbd className="mx-0.5 rounded-md bg-white/20 px-1.5 text-[12px]">{MOD}V</kbd>
                {after}
              </span>
              <span className="text-[12.5px] text-white/70">{t('home.dropHint')}</span>
            </span>
          </button>
        </div>
      </section>

      <section className="py-8" aria-label={t('home.made')}>
        <h2 className="mx-auto mb-4 max-w-[1180px] px-6 text-[13px] font-medium text-fg-muted">{t('home.made')}</h2>
        <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]" data-testid="showcase-strip">
          <div className="flex w-max gap-4 animate-[strip_70s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...STRIP, ...STRIP].map((name, i) => (
              <img key={i} src={shot(name)} alt="" loading="lazy" aria-hidden={i >= STRIP.length} className="h-[210px] w-[374px] shrink-0 rounded-[16px] object-cover" draggable={false} />
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 pb-14">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[26px] font-bold">{t('home.modes')}</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                data-testid={`mode-card-${m}`}
                disabled={!AVAILABLE[m]}
                onClick={() => navigate(m)}
                className="glass group flex flex-col overflow-hidden rounded-[18px] text-left transition-transform duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="block aspect-[16/10] overflow-hidden bg-surface-2">
                  <img src={shot(MODE_SHOTS[m])} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]" draggable={false} />
                </span>
                <span className="flex flex-col gap-1 px-4 pb-4 pt-3">
                  <span className="font-display text-[20px] font-bold">{t(`screen.${m}` as I18nKey)}</span>
                  <span className="text-[13px] leading-snug text-fg-muted">{t(`home.${m}` as I18nKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <Recents />
      </main>
    </div>
  );
}
