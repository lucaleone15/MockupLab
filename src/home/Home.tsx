import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { Code, Download, FolderOpen } from 'lucide-react';
import { hasWebGL2 } from '@/app/ErrorBoundary';
import { useT, type I18nKey } from '@/i18n';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, MODE_ORDER, navigate } from '@/shell/route';
import { openProject } from '@/library/actions';
import { useLibrary } from '@/library/store';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';
import type { ChapterId } from './HeroStage';

/*
 * The home page is the studio. A split hero, then the story: the chapters
 * scroll on the left while the 3D stage stays on the right and changes with
 * each one, and the page's paper slides to the chapter's colour, like a
 * photographer rolling out another backdrop. Then the three modes and the end.
 * The chapter is found with an IntersectionObserver (no scroll listener).
 * On a phone: one column, a still under each chapter.
 */

const HeroStage = lazy(() => import('./HeroStage'));
const webgl = hasWebGL2();
const BASE = import.meta.env.BASE_URL;
const shot = (name: string) => `${BASE}showcase/${name}`;
const REPO = 'https://github.com/lucaleone15/MockupLab';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const CHAPTERS: Exclude<ChapterId, 'intro'>[] = ['why', 'devices', 'studio', 'motion', 'social', 'clients'];

/** The page's paper per chapter, taken from the renders: studio grey, pale lilac, sand, sage… */
const PAPER: Record<'light' | 'dark', Record<ChapterId, string>> = {
  light: { intro: '#e4e5e9', why: '#e7e4ee', devices: '#e2e6eb', studio: '#e9e5de', motion: '#e1e4ec', social: '#e9e3ec', clients: '#e2e8e3' },
  dark: { intro: '#1c1d22', why: '#1f1c26', devices: '#1a1d23', studio: '#211f1c', motion: '#191c25', social: '#221c25', clients: '#1b201d' },
};

/** What a phone shows under each chapter (no 3D on small screens). */
const STILL: Record<Exclude<ChapterId, 'intro'>, string> = {
  why: 'studio-ui.jpg',
  devices: 'devices-phones.webp',
  studio: 'studio-podium.webp',
  motion: 'motion-still.webp',
  social: 'social-post.webp',
  clients: 'clients-pack.webp',
};

const MODE_SHOTS: Record<Screen, string> = { home: '', studio: 'studio-marble.webp', quick: 'studio-podium.webp', project: 'clients-pack.webp' };

function useWide() {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** The one main button of the page: blue, a pill, no arrow. */
function OpenStudio({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => navigate('studio')}
      className={cx(
        'rounded-full bg-[#2f6bff] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(20_40_120/0.7)] transition-[background-color,transform] duration-150 ease-out hover:bg-[#245ff2] active:scale-[0.97]',
        size === 'lg' ? 'h-12 px-7 text-[15px]' : 'h-11 px-6 text-[14px]',
      )}
    >
      {t('home.openStudio')}
    </button>
  );
}

/** A chapter of the story: its title and sentence on the left; on a phone, its still below. */
function Chapter({ id, children }: { id: Exclude<ChapterId, 'intro'>; children?: ReactNode }) {
  const { t } = useT();
  return (
    <section data-testid={`home-${id}`} data-chapter-id={id} className="flex min-h-[86dvh] flex-col justify-center gap-6 py-16 lg:min-h-[100dvh]">
      <h2 className="font-display max-w-[520px] text-balance text-[clamp(32px,3.6vw,48px)] font-extrabold leading-[1.02]">{t(`home.${id}.title` as I18nKey)}</h2>
      <p className="max-w-[440px] text-pretty text-[17px] leading-[1.55] text-fg-muted">{t(`home.${id}.lead` as I18nKey)}</p>
      {children}
      <img src={shot(STILL[id])} alt="" loading="lazy" className="mt-2 w-full rounded-[20px] object-cover shadow-[0_24px_60px_-24px_rgb(16_22_60/0.45)] lg:hidden" draggable={false} />
    </section>
  );
}

/** The labelled dots: where you are in the story, and a way to jump. */
function Dots({ chapter, onPick }: { chapter: ChapterId; onPick: (id: ChapterId) => void }) {
  const { t } = useT();
  return (
    <nav aria-label={t('home.chapters')} className="absolute right-6 top-1/2 flex -translate-y-1/2 flex-col items-end gap-1">
      {(['intro', ...CHAPTERS] as ChapterId[]).map((id) => {
        const on = id === chapter;
        const label = t(`home.dot.${id}` as I18nKey);
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-current={on ? 'step' : undefined}
            onClick={() => onPick(id)}
            className="group flex h-7 items-center gap-2.5 rounded-full pl-3 pr-1 text-[12.5px] font-medium"
          >
            <span className={cx('text-fg-muted transition-opacity duration-200 ease-out', on ? 'opacity-100 text-fg' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')}>{label}</span>
            <span className={cx('block h-2 rounded-full transition-[width,background-color] duration-300 ease-out', on ? 'w-5 bg-[#2f6bff]' : 'w-2 bg-[color-mix(in_srgb,var(--fg)_28%,transparent)]')} />
          </button>
        );
      })}
    </nav>
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
            className="glass group flex flex-col overflow-hidden rounded-[20px] text-left transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <span className="block aspect-[16/9] overflow-hidden md:aspect-auto md:h-[260px]">
              <img src={shot(MODE_SHOTS[m])} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" draggable={false} />
            </span>
            <span className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
              <span className="flex items-center gap-2">
                <span className={cx('font-display font-bold', main ? 'text-[24px]' : 'text-[19px]')}>{t(`screen.${m}` as I18nKey)}</span>
                {main && <span className="rounded-full bg-[#2f6bff]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#2f6bff] dark:text-[#8fb2ff]">{t('home.main')}</span>}
              </span>
              <span className={cx('leading-snug text-fg-muted', main ? 'text-[15px]' : 'text-[13.5px]')}>{t(`mode.${m}.role` as I18nKey)}</span>
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
  const theme = useUi((s) => s.theme);
  const light = theme === 'light';
  // the empty project autosaved on a first visit is not worth listing
  const projects = useLibrary((s) => s.list).filter((m) => (m.name && m.name !== 'Untitled') || m.exportCount > 0 || m.assets.length > 0);
  const last = projects[0];
  const wide = useWide();
  const root = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState<ChapterId>('intro');

  // the chapter in the middle band of the screen is the current one
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setChapter((e.target as HTMLElement).dataset.chapterId as ChapterId);
      },
      { root: el, rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    el.querySelectorAll('[data-chapter-id]').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const pick = (id: ChapterId) => root.current?.querySelector(`[data-chapter-id=${id}]`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });

  return (
    <div
      ref={root}
      data-testid="home"
      className="scroll-thin h-full overflow-y-auto overflow-x-hidden text-fg transition-[background-color] duration-700 ease-in-out"
      style={{ backgroundColor: PAPER[light ? 'light' : 'dark'][chapter] }}
    >
      <header className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 lg:px-10">
        <Logo asLink={false} tone={light ? undefined : 'light'} />
        <div className="flex items-center gap-1">
          {projects.length > 0 && (
            <button type="button" onClick={() => useUi.getState().setAllProjectsOpen(true)} className="flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium text-fg transition-colors hover:bg-surface-3">
              <FolderOpen size={16} />
              {t('home.myProjects')}
            </button>
          )}
          <MoreMenu tone={light ? undefined : 'light'} />
        </div>
      </header>

      {/* the hero and the story, the 3D stage on the right */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-6 lg:px-10">
        <div>
          <section data-testid="home-hero" data-chapter-id="intro" className="flex min-h-[calc(100dvh-64px)] flex-col justify-center gap-6 pb-16 pt-6 lg:pb-24">
            <h1 className="font-display max-w-[600px] text-balance text-[clamp(44px,5.4vw,76px)] font-extrabold leading-[0.98]">{t('home.title')}</h1>
            <p className="max-w-[440px] text-pretty text-[17px] leading-[1.55] text-fg-muted">{t(desktop ? 'home.leadDesktop' : 'home.lead')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
              <OpenStudio />
              <a href="#home-modes" className="text-[14px] font-medium text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
                {t('home.otherModes')}
              </a>
            </div>
            {last && (
              <button type="button" onClick={() => void openProject(last)} className="self-start text-[13.5px] font-medium text-fg-muted underline decoration-[color-mix(in_srgb,var(--fg)_25%,transparent)] underline-offset-4 transition-colors hover:text-fg">
                {t('home.resume', { name: last.name })}
              </button>
            )}
            <img src={shot('hero-still.webp')} alt="" className="mt-4 w-full rounded-[20px] lg:hidden" draggable={false} />
          </section>

          <Chapter id="why">
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {(['time', 'price', 'private'] as const).map((k) => (
                <div key={k} className="flex flex-col">
                  <dt className="font-display text-[32px] font-extrabold leading-none">{t(`home.why.${k}` as I18nKey)}</dt>
                  <dd className="mt-1 text-[13.5px] text-fg-muted">{t(`home.why.${k}.label` as I18nKey)}</dd>
                </div>
              ))}
            </dl>
          </Chapter>
          <Chapter id="devices" />
          <Chapter id="studio" />
          <Chapter id="motion" />
          <Chapter id="social" />
          <Chapter id="clients" />
        </div>

        {/* the stage stays on screen while the chapters scroll */}
        {wide && (
          <div className="sticky top-0 hidden h-[100dvh] lg:block">
            {webgl ? (
              <Suspense fallback={null}>
                <HeroStage className="absolute inset-0" chapter={chapter} light={light} eventSource={root} />
              </Suspense>
            ) : (
              <img src={shot('hero-still.webp')} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
            )}
            <Dots chapter={chapter} onPick={pick} />
          </div>
        )}
      </div>

      {/* the three ways in */}
      <section id="home-modes" data-testid="home-modes" className="mx-auto flex max-w-[1440px] scroll-mt-6 flex-col gap-8 px-6 py-24 lg:px-10">
        <h2 className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-[1.05]">{t('home.modes')}</h2>
        <Modes />
      </section>

      {/* the end: the promise on the left, the Studio at work on the right */}
      <section data-testid="home-end" className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 px-6 pb-28 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:px-10">
        <div className="flex flex-col gap-5">
          <h2 className="font-display text-balance text-[clamp(34px,4.4vw,60px)] font-extrabold leading-[1.0]">{t('home.end.title')}</h2>
          <p className="max-w-[460px] text-pretty text-[17px] leading-[1.55] text-fg-muted">{t(desktop ? 'home.end.leadDesktop' : 'home.end.lead')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <OpenStudio size="md" />
            {!desktop && (
              <a href={`${REPO}/releases/latest`} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-full bg-surface-3 px-5 text-[14px] font-medium text-fg transition-colors hover:bg-surface-4">
                <Download size={16} />
                {t('home.end.app')}
              </a>
            )}
            <a href={REPO} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-fg-muted transition-colors hover:text-fg">
              <Code size={16} />
              {t('home.end.source')}
            </a>
          </div>
        </div>
        <img src={shot('studio-ui.jpg')} alt={t('home.studioShot')} loading="lazy" className="w-full rounded-[20px] shadow-[0_40px_100px_-30px_rgb(16_22_60/0.55),0_0_0_1px_var(--line)]" draggable={false} />
      </section>
    </div>
  );
}
