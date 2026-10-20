import { Suspense, lazy } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { hasWebGL2 } from '@/app/ErrorBoundary';
import { useT, type I18nKey } from '@/i18n';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, MODE_ORDER, navigate } from '@/shell/route';
import { ProjectCard } from '@/library/ProjectCard';
import { useLibrary } from '@/library/store';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

const HeroStage = lazy(() => import('./HeroStage'));
const webgl = hasWebGL2();

const shot = (name: string) => `${import.meta.env.BASE_URL}showcase/${name}.webp`;

/** Real mock-ups rendered by MockupLab from the sample designs, and the Studio at work (scripts/make-showcase.mjs). */
const STRIP = ['phone-oak', 'hero-studio-light', 'laptop-concrete', 'phone-terrazzo', 'phone-aurora', 'hero-table-oak-white', 'laptop-marble'];
const MODE_SHOTS: Record<Screen, string> = { home: '', quick: 'phone-oak', project: 'hero-studio-light', studio: 'laptop-concrete' };

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
    <div data-testid="home" data-theme="dark" className="scroll-thin h-full overflow-y-auto bg-[#0e0f13] text-white">
      <section data-testid="home-hero" className="relative isolate overflow-hidden">
        {/* a soft blue glow behind the title */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(61_123_255/0.28),transparent_70%)]" />
        <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6">
          <Logo asLink={false} tone="light" />
          <MoreMenu tone="light" />
        </header>
        <div className="mx-auto flex max-w-[1180px] flex-col items-center px-6 pb-10 pt-12 text-center">
          <h1 className="font-display max-w-[760px] text-balance text-[clamp(42px,6vw,76px)] font-bold leading-[0.98] tracking-[-0.035em]">{t('home.title')}</h1>
          <p className="mt-5 max-w-[540px] text-[16.5px] leading-relaxed text-white/72">{t(window.mockuplabDesktop ? 'home.leadDesktop' : 'home.lead')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => navigate('studio')}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#1d1d1f] transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.98]"
            >
              {t('home.openStudio')}
              <ArrowRight size={17} />
            </button>
            <a href="#modes" className="flex items-center gap-1 text-[14px] font-medium text-white/75 transition-colors hover:text-white">
              {t('home.otherModes')}
              <ChevronDown size={15} />
            </a>
          </div>
        </div>
        {/* the real devices, turning in a dark studio (loaded after the title; a still without WebGL 2) */}
        <div className="relative mx-auto -mt-6 h-[min(64vh,640px)] min-h-[380px] max-w-[1400px] [mask-image:linear-gradient(180deg,black_80%,transparent)]">
          {webgl ? (
            <Suspense fallback={null}>
              <HeroStage className="absolute inset-0" />
            </Suspense>
          ) : (
            <img src={shot('hero-still')} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          )}
        </div>
        <div className="mx-auto max-w-[1180px] px-6">
          <img
            data-testid="home-studio-shot"
            src={`${import.meta.env.BASE_URL}showcase/studio-ui.jpg`}
            alt={t('home.studioShot')}
            className="w-full rounded-[18px] shadow-[0_40px_120px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.08)]"
            draggable={false}
          />
        </div>
      </section>

      <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 pb-6 pt-14">
        <section id="modes" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="font-display text-[26px] font-bold">{t('home.modes')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]" data-testid="mode-row">
            {MODE_ORDER.map((m) => {
              const main = m === 'studio';
              return (
                <button
                  key={m}
                  type="button"
                  data-testid={`mode-card-${m}`}
                  disabled={!AVAILABLE[m]}
                  onClick={() => navigate(m)}
                  className="group flex flex-col overflow-hidden rounded-[18px] bg-white/[0.06] text-left shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset] transition-transform duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <span className="block aspect-[16/9] overflow-hidden bg-white/5">
                    <img src={shot(MODE_SHOTS[m])} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]" draggable={false} />
                  </span>
                  <span className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
                    <span className="flex items-center gap-2">
                      <span className={cx('font-display font-bold', main ? 'text-[26px]' : 'text-[20px]')}>{t(`screen.${m}` as I18nKey)}</span>
                      {main && <span className="rounded-full bg-[#3d7bff]/20 px-2.5 py-0.5 text-[12px] font-semibold text-[#8fb2ff]">{t('home.main')}</span>}
                    </span>
                    <span className={cx('leading-snug text-white/65', main ? 'text-[15px]' : 'text-[13px]')}>{t(`mode.${m}.role` as I18nKey)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <Recents />
      </main>
      <section className="pb-14 pt-2" aria-label={t('home.made')}>
        <h2 className="mx-auto mb-4 max-w-[1180px] px-6 text-[13px] font-medium text-white/60">{t('home.made')}</h2>
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
