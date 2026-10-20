import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, Code, Download } from 'lucide-react';
import { hasWebGL2 } from '@/app/ErrorBoundary';
import { useT, type I18nKey } from '@/i18n';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, MODE_ORDER, navigate } from '@/shell/route';
import { ProjectCard } from '@/library/ProjectCard';
import { useLibrary } from '@/library/store';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

/*
 * The home page tells MockupLab like a product page: the real devices turning
 * in 3D, why it exists, then what it does — devices, the studio, motion, the
 * social networks, clients — and the end. Every visual is rendered by
 * MockupLab itself (scripts/make-showcase.mjs).
 */

const HeroStage = lazy(() => import('./HeroStage'));
const webgl = hasWebGL2();
const BASE = import.meta.env.BASE_URL;
const shot = (name: string) => `${BASE}showcase/${name}.webp`;
const REPO = 'https://github.com/lucaleone15/MockupLab';

const STRIP = ['devices-phones', 'studio-podium', 'devices-desk', 'studio-marble', 'devices-print', 'studio-travertine', 'clients-pack'];
const MODE_SHOTS: Record<Screen, string> = { home: '', studio: 'studio-marble', quick: 'studio-podium', project: 'clients-pack' };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fades its content in the first time it scrolls into view (still under reduced motion). */
function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reducedMotion);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <div ref={ref} className={cx('transition-[opacity,transform] duration-[900ms] ease-[var(--ease-out-quart)]', shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0', className)}>
      {children}
    </div>
  );
}

/** A chapter of the story: a big title, one sentence, then its visuals. */
function Chapter({ id, title, lead, children }: { id: string; title: I18nKey; lead: I18nKey; children: ReactNode }) {
  const { t } = useT();
  return (
    <section data-testid={id} className="mx-auto flex max-w-[1180px] flex-col gap-10 px-6 py-24">
      <Reveal className="mx-auto flex max-w-[760px] flex-col items-center gap-4 text-center">
        <h2 className="font-display text-balance text-[clamp(30px,4.2vw,52px)] font-extrabold leading-[1.02]">{t(title)}</h2>
        <p className="max-w-[620px] text-pretty text-[17px] leading-relaxed text-white/68">{t(lead)}</p>
      </Reveal>
      <Reveal>{children}</Reveal>
    </section>
  );
}

/** A render, large, with a soft shadow. */
function Render({ name, className, alt = '' }: { name: string; className?: string; alt?: string }) {
  return <img src={shot(name)} alt={alt} loading="lazy" className={cx('w-full rounded-[22px] object-cover shadow-[0_30px_80px_rgb(0_0_0/0.5),0_0_0_1px_rgb(255_255_255/0.06)]', className)} draggable={false} />;
}

function OpenStudio({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => navigate('studio')}
      className={cx(
        'flex items-center gap-2 rounded-full bg-white font-semibold text-[#1d1d1f] transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.98]',
        size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-11 px-5 text-[14px]',
      )}
    >
      {t('home.openStudio')}
      <ArrowRight size={17} />
    </button>
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

function Modes() {
  const { t } = useT();
  return (
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
                <span className={cx('font-display font-bold', main ? 'text-[24px]' : 'text-[19px]')}>{t(`screen.${m}` as I18nKey)}</span>
                {main && <span className="rounded-full bg-[#3d7bff]/20 px-2.5 py-0.5 text-[12px] font-semibold text-[#8fb2ff]">{t('home.main')}</span>}
              </span>
              <span className={cx('leading-snug text-white/65', main ? 'text-[15px]' : 'text-[13px]')}>{t(`mode.${m}.role` as I18nKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Home() {
  const { t } = useT();
  const desktop = !!window.mockuplabDesktop;
  const still = reducedMotion();
  return (
    <div data-testid="home" data-theme="dark" className="scroll-thin h-full overflow-y-auto bg-[#0e0f13] text-white">
      {/* 1. the real devices, turning */}
      <section data-testid="home-hero" className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(61_123_255/0.28),transparent_70%)]" />
        <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6">
          <Logo asLink={false} tone="light" />
          <MoreMenu tone="light" />
        </header>
        <div className="mx-auto flex max-w-[1180px] flex-col items-center px-6 pb-6 pt-10 text-center">
          <h1 className="font-display max-w-[860px] text-balance text-[clamp(40px,6vw,76px)] font-extrabold leading-[0.98]">{t('home.title')}</h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-white/72">{t(desktop ? 'home.leadDesktop' : 'home.lead')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <OpenStudio />
            <a href="#home-clients" className="flex items-center gap-1 text-[14px] font-medium text-white/75 transition-colors hover:text-white">
              {t('home.otherModes')}
              <ChevronDown size={15} />
            </a>
          </div>
        </div>
        {/* loaded after the title; a still without WebGL 2 */}
        <div className="relative mx-auto -mt-6 h-[min(64vh,640px)] min-h-[380px] max-w-[1400px] [mask-image:linear-gradient(180deg,black_80%,transparent)]">
          {webgl ? (
            <Suspense fallback={null}>
              <HeroStage className="absolute inset-0" />
            </Suspense>
          ) : (
            <img src={shot('hero-still')} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          )}
        </div>
      </section>

      {/* 2. why it exists */}
      <section data-testid="home-why" className="mx-auto flex max-w-[1180px] flex-col items-center gap-10 px-6 py-24 text-center">
        <Reveal className="flex max-w-[820px] flex-col items-center gap-5">
          <h2 className="font-display text-balance text-[clamp(30px,4.2vw,52px)] font-extrabold leading-[1.02]">{t('home.why.title')}</h2>
          <p className="max-w-[660px] text-pretty text-[18px] leading-relaxed text-white/70">{t('home.why.lead')}</p>
        </Reveal>
        <Reveal className="grid w-full max-w-[900px] grid-cols-1 gap-4 sm:grid-cols-3">
          {(['time', 'price', 'private'] as const).map((k) => (
            <div key={k} className="flex flex-col items-center gap-1 rounded-[20px] bg-white/[0.05] px-6 py-7 shadow-[0_0_0_1px_rgb(255_255_255/0.07)_inset]">
              <span className="font-display text-[44px] font-extrabold leading-none text-[#8fb2ff]">{t(`home.why.${k}` as I18nKey)}</span>
              <span className="text-[14px] text-white/65">{t(`home.why.${k}.label` as I18nKey)}</span>
            </div>
          ))}
        </Reveal>
      </section>

      {/* 3. devices */}
      <Chapter id="home-devices" title="home.devices.title" lead="home.devices.lead">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Render name="devices-phones" className="md:col-span-2" alt={t('home.devices.title')} />
          <Render name="devices-desk" />
          <Render name="devices-print" />
        </div>
      </Chapter>

      {/* 4. the studio */}
      <Chapter id="home-studio" title="home.studio.title" lead="home.studio.lead">
        <div className="flex flex-col gap-5">
          <img data-testid="home-studio-shot" src={`${BASE}showcase/studio-ui.jpg`} alt={t('home.studioShot')} loading="lazy" className="w-full rounded-[22px] shadow-[0_40px_120px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.08)]" draggable={false} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Render name="studio-marble" />
            <Render name="studio-podium" />
            <Render name="studio-travertine" />
          </div>
        </div>
      </Chapter>

      {/* 5. motion */}
      <Chapter id="home-motion" title="home.motion.title" lead="home.motion.lead">
        <div className="overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgb(0_0_0/0.5),0_0_0_1px_rgb(255_255_255/0.06)]">
          {still ? (
            <img src={shot('motion-still')} alt="" className="w-full" draggable={false} />
          ) : (
            <video className="w-full" autoPlay muted loop playsInline preload="auto" poster={shot('motion-still')} aria-label={t('home.motion.title')}>
              <source src={`${BASE}showcase/motion.webm`} type="video/webm" />
              <source src={`${BASE}showcase/motion.mp4`} type="video/mp4" />
            </video>
          )}
        </div>
      </Chapter>

      {/* 6. social networks */}
      <section data-testid="home-social" className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-12 px-6 py-24 md:grid-cols-[1fr_380px]">
        <Reveal className="flex flex-col gap-5">
          <h2 className="font-display text-balance text-[clamp(30px,4.2vw,52px)] font-extrabold leading-[1.02]">{t('home.social.title')}</h2>
          <p className="max-w-[520px] text-pretty text-[17px] leading-relaxed text-white/68">{t('home.social.lead')}</p>
        </Reveal>
        <Reveal>
          <img src={shot('social-story')} alt="" loading="lazy" className="w-full rounded-[34px] shadow-[0_30px_80px_rgb(0_0_0/0.55),0_0_0_8px_#1d1d22,0_0_0_9px_rgb(255_255_255/0.1)]" draggable={false} />
        </Reveal>
      </section>

      {/* 7. for clients: the modes, the pack, the recents */}
      <section id="home-clients" data-testid="home-clients" className="mx-auto flex max-w-[1180px] scroll-mt-6 flex-col gap-10 px-6 py-24">
        <Reveal className="mx-auto flex max-w-[760px] flex-col items-center gap-4 text-center">
          <h2 className="font-display text-balance text-[clamp(30px,4.2vw,52px)] font-extrabold leading-[1.02]">{t('home.clients.title')}</h2>
          <p className="max-w-[620px] text-pretty text-[17px] leading-relaxed text-white/68">{t('home.clients.lead')}</p>
        </Reveal>
        <Reveal>
          <Render name="clients-pack" />
        </Reveal>
        <h3 className="font-display text-[22px] font-bold">{t('home.modes')}</h3>
        <Modes />
        <Recents />
      </section>

      <section className="pb-6" aria-label={t('home.made')}>
        <h2 className="mx-auto mb-4 max-w-[1180px] px-6 text-[13px] font-medium text-white/60">{t('home.made')}</h2>
        <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]" data-testid="showcase-strip">
          <div className="flex w-max gap-4 animate-[strip_70s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...STRIP, ...STRIP].map((name, i) => (
              <img key={i} src={shot(name)} alt="" loading="lazy" aria-hidden={i >= STRIP.length} className="h-[210px] w-[374px] shrink-0 rounded-[16px] object-cover" draggable={false} />
            ))}
          </div>
        </div>
      </section>

      {/* 8. the end */}
      <section data-testid="home-end" className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 px-6 pb-28 pt-20 text-center">
        <Reveal className="flex flex-col items-center gap-5">
          <h2 className="font-display text-balance text-[clamp(32px,4.6vw,58px)] font-extrabold leading-[1.02]">{t('home.end.title')}</h2>
          <p className="max-w-[600px] text-pretty text-[17px] leading-relaxed text-white/68">{t(desktop ? 'home.end.leadDesktop' : 'home.end.lead')}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <OpenStudio size="md" />
            {!desktop && (
              <a href={`${REPO}/releases/latest`} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-[14px] font-medium text-white transition-colors hover:bg-white/15">
                <Download size={16} />
                {t('home.end.app')}
              </a>
            )}
            <a href={REPO} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white/75 transition-colors hover:text-white">
              <Code size={16} />
              {t('home.end.source')}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
