import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FolderOpen, ImagePlus } from 'lucide-react';
import { hasWebGL2 } from '@/app/ErrorBoundary';
import { useT, type I18nKey } from '@/i18n';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, MODE_ORDER, navigate } from '@/shell/route';
import { openProject } from '@/library/actions';
import { useLibrary } from '@/library/store';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';
import { SLICES, STORY, useStoryProgress, type StoryChapter } from './useStoryProgress';
import { WordReveal } from './WordReveal';
import { startWithFiles } from './start';
import { IMAGE_OR_PDF } from '@/lib/pdf';
import { anchorTo } from './labelAnchors';

/*
 * The home page, told like an Apple product page. Each chapter is a tall
 * track: while it scrolls by, its words stay pinned and light up one by one,
 * and the 3D stage behind (one, shared, sticky) plays the chapter at the
 * reader's pace, both ways. Sections alternate deep black and pure white,
 * whatever the app's theme. The progress comes from an IntersectionObserver
 * (no scroll listener; the page scrolls normally). Phones and reduced motion
 * get plain chapters with a still each.
 */

const HeroStage = lazy(() => import('./HeroStage'));
const webgl = hasWebGL2();
const BASE = import.meta.env.BASE_URL;
const shot = (name: string) => `${BASE}showcase/${name}`;
const PORTFOLIO = 'https://luca-leone.ch';
const LINKEDIN = 'https://www.linkedin.com/in/leone-luca';
const FAQ = [1, 2, 3, 4, 5, 6] as const;

/** Track heights (vh): the longer the chapter's motion, the longer the scroll. */
const HEIGHT: Record<StoryChapter, number> = { open: 230, drop: 220, devices: 240, print: 260, studio: 260, motion: 240, social: 240, clients: 220, modes: 300 };
/** White sections; the others are deep black. */
const LIGHT = new Set<StoryChapter>(['studio', 'modes']);
/** What phones and reduced motion show under each chapter. */
const STILL: Record<StoryChapter, string> = {
  open: 'hero-still.webp',
  drop: 'studio-ui.jpg',
  devices: 'devices-phones.webp',
  print: 'devices-print.webp',
  studio: 'studio-podium.webp',
  motion: 'motion-still.webp',
  social: 'social-post.webp',
  clients: 'clients-pack.webp',
  modes: 'studio-ui.jpg',
};
/** Pixel size of the stills that are not 2560×1440: the page keeps their room before they arrive. */
const STILL_SIZE: Record<string, [number, number]> = { 'studio-ui.jpg': [1600, 1000], 'social-post.webp': [1440, 1800] };
/** Each still also exists smaller for phones (…-1280.webp, …-720.webp for the portrait one). */
const stillSrcSet = (name: string) => {
  const [w] = STILL_SIZE[name] ?? [2560];
  const small = name === 'social-post.webp' ? 720 : 1280;
  return `${shot(name.replace(/\.\w+$/, `-${small}.webp`))} ${small}w, ${shot(name)} ${w}w`;
};
/** The glass labels pointing at the 3D: where they sit on the stage, and when they show. */
const LABELS: Partial<Record<StoryChapter, { key: I18nKey; style?: CSSProperties; anchor?: string; from: number; to: number }[]>> = {
  studio: [
    { key: 'home.label.backdrop', style: { left: '66%', top: '44%' }, from: 0.32, to: 0.72 },
    { key: 'home.label.light', style: { left: '14%', top: '46%' }, from: 0.36, to: 0.72 },
    { key: 'home.label.device', style: { left: '57%', top: '64%' }, from: 0.4, to: 0.72 },
    { key: 'home.label.podium', style: { left: '30%', top: '86%' }, from: 0.44, to: 0.72 },
  ],
  print: [
    // pinned above their object (the stage moves them with the camera)
    { key: 'home.label.posters', anchor: 'poster', from: 0.55, to: 0.76 },
    { key: 'home.label.magazines', anchor: 'magazine', from: 0.57, to: 0.76 },
    { key: 'home.label.flyers', anchor: 'flyer', from: 0.59, to: 0.76 },
    { key: 'home.label.cards', anchor: 'cards', from: 0.61, to: 0.76 },
    { key: 'home.label.swatches', anchor: 'fan', from: 0.63, to: 0.76 },
  ],
  social: [{ key: 'home.label.account', anchor: 'phone', from: 0.5, to: 0.75 }],
  motion: [{ key: 'home.label.video', style: { left: '70%', top: '86%' }, from: 0.4, to: 0.75 }],
};
const TITLE: Record<StoryChapter, I18nKey> = {
  open: 'home.title',
  drop: 'home.drop.title',
  devices: 'home.devices.title',
  print: 'home.print.title',
  studio: 'home.studio.title',
  motion: 'home.motion.title',
  social: 'home.social.title',
  clients: 'home.clients.title',
  modes: 'home.modes',
};
const LEAD: Record<StoryChapter, I18nKey> = {
  open: 'home.lead',
  drop: 'home.drop.lead',
  devices: 'home.devices.lead',
  print: 'home.print.lead',
  studio: 'home.studio.lead',
  motion: 'home.motion.lead',
  social: 'home.social.lead',
  clients: 'home.clients.lead',
  modes: 'home.modes.lead',
};
const MODE_SHOTS: Record<Screen, string> = { home: '', studio: 'studio-marble.webp', quick: 'studio-podium.webp', project: 'clients-pack.webp' };
/** The modes at work (the « modes » chapter). */
const MODE_SCREENS: Record<Exclude<Screen, 'home'>, string> = { studio: 'studio-ui.jpg', quick: 'mode-quick.jpg', project: 'mode-project.jpg' };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** The empty project autosaved on a first visit is not worth listing. */
const worth = (m: { name: string; exportCount: number; assets: string[] }) => (m.name && m.name !== 'Untitled') || m.exportCount > 0 || m.assets.length > 0;

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const update = () => setOn(m.matches);
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return on;
}

/** The one main button of the page: blue, a pill, no arrow. */
/** Eases in once it is reached by scrolling. */
function Reveal({ children, delay = 0, className, instant = false }: { children: ReactNode; delay?: number; className?: string; instant?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(instant);
  useEffect(() => {
    const el = ref.current;
    if (!el || instant) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [instant]);
  return (
    <div ref={ref} data-shown={shown || undefined} className={cx('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function OpenStudio({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => navigate('studio')}
      className={cx(
        'pointer-events-auto rounded-full bg-brand-solid font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-brand-solid-hover active:scale-[0.97]',
        size === 'lg' ? 'h-12 px-7 text-[16px]' : 'h-11 px-6 text-[15px]',
      )}
    >
      {t('home.openStudio')}
    </button>
  );
}

/** « Drop your capture here »: a file dropped, pasted or picked opens the Studio with the mock-up already made. */
function TryHere({ light }: { light: boolean }) {
  const { t } = useT();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = (files: FileList | null | undefined) => void startWithFiles([...(files ?? [])]);
  return (
    <div
      data-testid="home-try"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        // handled here, not by the page-wide drop
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        take(e.dataTransfer?.files);
      }}
      className={cx(
        'pointer-events-auto mt-1 flex w-full max-w-[460px] items-center justify-center gap-3 rounded-[18px] border border-dashed px-5 py-3.5 text-[14.5px] backdrop-blur-md transition-colors duration-150',
        light ? 'border-black/20 bg-white/50 text-[#1d1d1f]/75' : 'border-white/25 bg-white/[0.06] text-white/75',
        over && (light ? 'border-brand-solid bg-white/80' : 'border-brand-solid bg-brand-solid/15'),
      )}
    >
      <ImagePlus size={18} className="shrink-0 text-brand" />
      {/* a touch screen can't drag a file: it gets the picker alone (CSS, so the static page and the app agree) */}
      <span className="touch:hidden">
        {t('home.try')}{' '}
        <button type="button" onClick={() => input.current?.click()} className={cx('font-semibold underline underline-offset-[3px]', light ? 'decoration-black/25' : 'decoration-white/35')}>
          {t('home.tryBrowse')}
        </button>
      </span>
      <button type="button" onClick={() => input.current?.click()} className="hidden font-semibold touch:inline">
        {t('stage.pickImage')}
      </button>
      <input ref={input} type="file" accept={IMAGE_OR_PDF} multiple hidden onChange={(e) => take(e.target.files)} />
    </div>
  );
}

/** The opening's words: the title, one sentence, the main button, the way back into a project. */
function Opening({ light, reveal }: { light: boolean; reveal: number }) {
  const { t } = useT();
  const last = useLibrary((s) => s.list).find(worth);
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="font-display max-w-[980px] text-balance text-[clamp(46px,7vw,104px)] font-extrabold leading-[0.96]">{t('home.title')}</h1>
      <WordReveal text={t('home.lead')} reveal={reveal} light={light} className="max-w-[620px] text-pretty text-[19px] leading-[1.5]" />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <OpenStudio />
      </div>
      <TryHere light={light} />
      {last && (
        <button type="button" onClick={() => void openProject(last)} className="pointer-events-auto text-[14px] font-medium underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100">
          {t('home.resume', { name: last.name })}
        </button>
      )}
    </div>
  );
}

/** A chapter's track: its slices (the progress), and its words pinned while it scrolls by. */
function Track({ id, current, progress }: { id: StoryChapter; current: StoryChapter; progress: number }) {
  const { t } = useT();
  const light = LIGHT.has(id);
  const here = id === current;
  const passed = STORY.indexOf(id) < STORY.indexOf(current);
  // the words come in as they rise to their place, stay while pinned, and go before they leave the screen;
  // the next chapter's words wait hidden (they would cross the picture)
  const pinnedFrom = 50 / HEIGHT[id];
  const opacity = here ? Math.min(id === 'open' ? 1 : clamp(progress / (pinnedFrom * 0.8)), clamp((1 - pinnedFrom + 0.02 - progress) / 0.08)) : 0;
  const reveal = here ? clamp((progress - 0.08) / 0.42) : passed ? 1 : 0;
  return (
    <section id={id === 'modes' ? 'home-modes' : undefined} data-chapter-id={id} data-testid={id === 'open' ? 'home-hero' : `home-${id}`} className="pointer-events-none relative" style={{ height: `${HEIGHT[id]}vh` }}>
      {Array.from({ length: SLICES }, (_, i) => (
        <div key={i} data-slice={i} data-chapter={id} aria-hidden className="pointer-events-none absolute inset-x-0" style={{ top: `${(i * 100) / SLICES}%`, height: `${100 / SLICES}%` }} />
      ))}
      <div className={cx('pointer-events-none sticky top-0 flex h-[100dvh] flex-col items-center px-6 transition-opacity duration-200', light ? 'text-[#1d1d1f]' : 'text-white')} style={{ opacity }}>
        {id === 'modes' ? (
          <ModesStory progress={here ? progress : passed ? 1 : 0} />
        ) : (
        <div className={id === 'open' ? 'pt-[17vh]' : 'pt-[11vh]'}>
          {id === 'open' ? (
            <Opening light={light} reveal={Math.max(reveal, 0.25)} />
          ) : (
            <div className="flex max-w-[860px] flex-col items-center gap-5 text-center">
              <h2 className="font-display text-balance text-[clamp(38px,5vw,72px)] font-extrabold leading-[1]">{t(TITLE[id])}</h2>
              <WordReveal text={t(LEAD[id])} reveal={reveal} light={light} className="max-w-[640px] text-pretty text-[19px] leading-[1.5]" />
              {id === 'drop' && (
                <dl className="mt-2 flex flex-wrap justify-center gap-x-10 gap-y-3" style={{ opacity: here ? clamp((progress - 0.45) / 0.15) : passed ? 1 : 0 }}>
                  {(['time', 'price', 'private'] as const).map((k) => (
                    <div key={k} className="flex flex-col items-center">
                      <dt className="font-display text-[34px] font-extrabold leading-none">{t(`home.why.${k}` as I18nKey)}</dt>
                      <dd className="mt-1 text-[14px] opacity-70">{t(`home.why.${k}.label` as I18nKey)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
        )}
        {/* glass labels pointing at the 3D */}
        {here &&
          LABELS[id]?.map((l) => (
            <span
              key={l.key}
              className={cx(
                'absolute whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium backdrop-blur-xl duration-300 ease-out',
                // pinned labels move every frame with the camera: only their fade is a transition
                l.anchor ? 'transition-opacity' : 'transition-[opacity,transform]',
                // labels placed for a wide screen would leave a phone's: only those that follow a device stay
                !l.anchor && 'max-sm:hidden',
                light ? 'bg-white/70 text-[#1d1d1f] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.9),0_10px_30px_-10px_rgb(20_30_80/0.3)]' : 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22),0_10px_30px_-10px_rgb(0_0_0/0.6)]',
              )}
              ref={l.anchor ? anchorTo(l.anchor) : undefined}
              style={l.anchor ? { left: 0, top: 0, marginTop: -10, opacity: progress >= l.from && progress <= l.to ? 1 : 0 } : { ...l.style, opacity: progress >= l.from && progress <= l.to ? 1 : 0, transform: `translateY(${progress >= l.from ? 0 : 8}px)` }}
            >
              {t(l.key)}
            </span>
          ))}
      </div>
    </section>
  );
}

/**
 * « Trois façons de créer », told one after the other: Studio, Rapide, Projet
 * light up with the scroll, and the picture of the lit one slides in.
 */
function ModesStory({ progress }: { progress: number }) {
  const { t } = useT();
  const pinned = 50 / HEIGHT.modes;
  const k = clamp((progress - pinned) / (1 - 2 * pinned));
  const lit = Math.min(2, Math.floor(k * 3));
  return (
    <div className="flex h-full w-full max-w-[1160px] flex-col items-center gap-10 pt-[10vh]">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="font-display text-balance text-[clamp(38px,5vw,72px)] font-extrabold leading-[1]">{t('home.modes')}</h2>
        <p className="max-w-[560px] text-pretty text-[19px] leading-[1.5] text-[#1d1d1f]/70">{t('home.modes.lead')}</p>
      </div>
      <div className="grid w-full flex-1 grid-cols-1 items-start gap-6 pb-[8vh] md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] md:gap-12">
        <ol className="flex flex-col gap-2">
          {(['studio', 'quick', 'project'] as const).map((m, i) => (
            <li key={m}>
              <button
                type="button"
                data-testid={`mode-card-${m}`}
                data-lit={i === lit}
                disabled={!AVAILABLE[m]}
                onClick={() => navigate(m)}
                className={cx('pointer-events-auto flex w-full flex-col gap-1.5 rounded-[18px] px-5 py-4 text-left transition-[opacity,background-color] duration-500 ease-out hover:bg-black/[0.04]', i === lit ? 'opacity-100' : 'opacity-35')}
              >
                <span className="flex items-center gap-2.5">
                  <span className={cx('h-6 w-1 rounded-full transition-colors duration-500', i === lit ? 'bg-brand-solid' : 'bg-black/15')} />
                  <span className="font-display text-[24px] font-extrabold leading-none md:text-[30px]">{t(`screen.${m}` as I18nKey)}</span>
                </span>
                <span className="pl-[18px] text-[15px] leading-snug text-[#55565e] md:text-[16px]">{t(`mode.${m}.role` as I18nKey)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="relative aspect-[16/10] w-full max-md:order-first">
          {(['studio', 'quick', 'project'] as const).map((m, i) => (
            <img
              key={m}
              data-testid="mode-picture"
              src={shot(MODE_SCREENS[m])}
              alt={t(`screen.${m}` as I18nKey)}
              className="absolute inset-0 h-full w-full rounded-[22px] object-cover shadow-[0_1px_2px_rgb(20_30_70/0.08),0_40px_90px_-30px_rgb(20_30_70/0.45)] transition-[opacity,transform] duration-700 ease-out"
              style={{ opacity: i === lit ? 1 : 0, transform: `translateY(${i === lit ? 0 : i < lit ? -24 : 24}px) scale(${i === lit ? 1 : 0.98})` }}
              draggable={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The labelled dots: where you are in the story, and a way to jump. */
function Dots({ chapter, light, onPick }: { chapter: StoryChapter; light: boolean; onPick: (id: StoryChapter) => void }) {
  const { t } = useT();
  return (
    <nav aria-label={t('home.chapters')} className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-end gap-1 sm:flex">
      {STORY.map((id) => {
        const on = id === chapter;
        const label = t(`home.dot.${id}` as I18nKey);
        return (
          <button key={id} type="button" aria-label={label} aria-current={on ? 'step' : undefined} onClick={() => onPick(id)} className="group flex h-7 items-center gap-2.5 rounded-full pl-3 pr-1 text-[12.5px] font-medium">
            <span className={cx('transition-opacity duration-200 ease-out', light ? 'text-[#1d1d1f]' : 'text-white', on ? 'opacity-90' : 'opacity-0 group-hover:opacity-70 group-focus-visible:opacity-70')}>{label}</span>
            <span className={cx('block h-2 rounded-full transition-[width,background-color] duration-300 ease-out', on ? 'w-5 bg-brand-solid' : light ? 'w-2 bg-black/25' : 'w-2 bg-white/30')} />
          </button>
        );
      })}
    </nav>
  );
}

/** Phones and reduced motion: each chapter plain, its words whole, a still under them. */
function PlainStory() {
  const { t } = useT();
  return (
    <>
      {STORY.map((id) => {
        const light = LIGHT.has(id);
        return (
          <section key={id} data-chapter-id={id} data-testid={id === 'open' ? 'home-hero' : `home-${id}`} className={cx('studio-grain relative flex flex-col items-center gap-8 px-6 py-20 text-center', light ? 'studio-light text-[#1d1d1f]' : 'studio-night text-white')}>
            {id === 'modes' ? (
              <div id="home-modes" className="flex w-full max-w-[1240px] flex-col gap-8">
                <h2 className="font-display text-balance text-[clamp(34px,8vw,56px)] font-extrabold leading-[1.02]">{t('home.modes')}</h2>
                <Modes />
              </div>
            ) : id === 'open' ? (
              <Opening light={light} reveal={1} />
            ) : (
              <>
                <h2 className="font-display text-balance text-[clamp(34px,8vw,56px)] font-extrabold leading-[1.02]">{t(TITLE[id])}</h2>
                <WordReveal text={t(LEAD[id])} reveal={1} light={light} className="max-w-[560px] text-pretty text-[17px] leading-[1.55]" />
              </>
            )}
            {id !== 'modes' && (
              // the opening's picture is the first thing a phone shows: no fade-in, fetched at once
              <Reveal className="w-full max-w-[880px]" instant={id === 'open'}>
                <img
                  src={shot(STILL[id])}
                  srcSet={stillSrcSet(STILL[id])}
                  sizes="(max-width: 920px) 100vw, 880px"
                  alt=""
                  loading={id === 'open' || id === 'drop' ? 'eager' : 'lazy'}
                  fetchPriority={id === 'open' ? 'high' : 'auto'}
                  width={STILL_SIZE[STILL[id]]?.[0] ?? 2560}
                  height={STILL_SIZE[STILL[id]]?.[1] ?? 1440}
                  className="h-auto max-h-[52vh] w-full rounded-[22px] object-cover"
                  draggable={false}
                />
              </Reveal>
            )}
          </section>
        );
      })}
    </>
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
            className="group flex flex-col overflow-hidden rounded-[22px] bg-white text-left shadow-[0_1px_2px_rgb(20_30_70/0.06),0_24px_60px_-28px_rgb(20_30_70/0.35)] transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <span className="block aspect-[16/9] overflow-hidden md:aspect-auto md:h-[260px]">
              <img src={shot(MODE_SHOTS[m])} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" draggable={false} />
            </span>
            <span className="flex flex-1 flex-col gap-1.5 px-6 pb-6 pt-5">
              <span className="flex items-center gap-2">
                <span className={cx('font-display font-bold text-[#1d1d1f]', main ? 'text-[26px]' : 'text-[20px]')}>{t(`screen.${m}` as I18nKey)}</span>
              </span>
              <span className={cx('leading-snug text-[#55565e]', main ? 'text-[15.5px]' : 'text-[14px]')}>{t(`mode.${m}.role` as I18nKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Renders made with MockupLab, floating around a title (phones: a small tilted grid). */
const GALLERY: { file: string; x: number; y: number; w: number; r: number; d: number }[] = [
  { file: 'hero-still-1280.webp', x: 4, y: 8, w: 22, r: -6, d: 0 },
  { file: 'devices-phones-1280.webp', x: 74, y: 4, w: 22, r: 5, d: 1.2 },
  { file: 'studio-podium-1280.webp', x: 0, y: 46, w: 18, r: 4, d: 2.1 },
  { file: 'social-post-720.webp', x: 82, y: 40, w: 13, r: -5, d: 0.6 },
  { file: 'devices-print-1280.webp', x: 10, y: 78, w: 20, r: -3, d: 1.7 },
  { file: 'motion-still-1280.webp', x: 70, y: 76, w: 21, r: 6, d: 0.3 },
  { file: 'clients-pack-1280.webp', x: 36, y: 84, w: 19, r: 2, d: 2.6 },
  { file: 'studio-marble.webp', x: 44, y: 0, w: 15, r: -4, d: 1.4 },
];
function Gallery() {
  const { t } = useT();
  const card = 'rounded-[14px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.08)]';
  return (
    <section data-testid="home-gallery" className="studio-grain studio-night relative overflow-hidden px-6 py-24 text-white sm:min-h-[100dvh] sm:py-0">
      {/* big screens: the renders drift gently around the words */}
      <div aria-hidden className="absolute inset-0 hidden sm:block">
        {GALLERY.map((g) => (
          <img
            key={g.file}
            src={shot(g.file)}
            alt=""
            loading="lazy"
            draggable={false}
            className={cx('absolute animate-[drift_9s_ease-in-out_infinite]', card)}
            style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, rotate: `${g.r}deg`, animationDelay: `-${g.d * 2}s` }}
          />
        ))}
      </div>
      <div className="relative z-[1] flex flex-col items-center gap-4 text-center sm:min-h-[100dvh] sm:justify-center">
        <h2 className="font-display max-w-[640px] text-balance text-[clamp(34px,6vw,64px)] leading-[1]">{t('home.gallery.title')}</h2>
        <p className="max-w-[440px] text-pretty text-[17px] leading-[1.55] text-white/70">{t('home.gallery.lead')}</p>
      </div>
      {/* phones: four of them, slightly tilted, in two columns */}
      <div className="relative z-[1] mt-10 grid grid-cols-2 gap-4 sm:hidden">
        {GALLERY.slice(0, 4).map((g, i) => (
          <img key={g.file} src={shot(g.file)} alt="" loading="lazy" draggable={false} className={cx('w-full', card)} style={{ rotate: `${i % 2 ? 3 : -3}deg` }} />
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const { t } = useT();
  const root = useRef<HTMLDivElement>(null);
  const still = useMedia('(prefers-reduced-motion: reduce)');
  // the 3D starts once the page is shown and idle: the words and the first paint never wait for it
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const go = () => setMounted(true);
    const ric = typeof requestIdleCallback === 'function';
    const id = ric ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 300);
    return () => (ric ? cancelIdleCallback(id as number) : clearTimeout(id));
  }, []);
  // the 3D story plays on every screen size; still motion gets plain chapters with pictures
  const animated = !still && webgl;
  const { chapter, progress } = useStoryProgress(root, animated);
  const light = animated && LIGHT.has(chapter);
  const hasProjects = useLibrary((s) => s.list.some(worth));
  const pick = (id: StoryChapter) => {
    const el = root.current;
    const track = el?.querySelector<HTMLElement>(`[data-chapter-id=${id}]`);
    // to where the chapter's title sits mid-screen
    if (el && track) el.scrollTo({ top: track.offsetTop + track.offsetHeight * 0.3 - el.clientHeight / 2, behavior: still ? 'auto' : 'smooth' });
  };

  return (
    <div ref={root} data-testid="home" data-theme="dark" className="scroll-thin h-full overflow-y-auto overflow-x-hidden bg-black text-white">
      {/* the header floats over the story, in its section's tone */}
      <div className={cx('sticky top-0 z-30 h-0', light ? 'text-[#1d1d1f]' : 'text-white')} data-theme={light ? 'light' : 'dark'}>
        <header className="flex h-16 items-center justify-between px-5">
          <div className="glass-float flex h-11 items-center rounded-full px-4">
            <Logo asLink={false} tone={light ? undefined : 'light'} />
          </div>
          <div className="glass-float flex h-11 items-center gap-1 rounded-full px-1.5">
            {hasProjects && (
              <button type="button" onClick={() => useUi.getState().setAllProjectsOpen(true)} className="flex h-8 items-center gap-2 rounded-full px-3 text-[13.5px] font-medium text-fg transition-colors hover:bg-surface-3">
                <FolderOpen size={16} />
                {t('home.myProjects')}
              </button>
            )}
            <MoreMenu tone={light ? undefined : 'light'} />
          </div>
        </header>
      </div>

      {animated ? (
        <div className="relative">
          <div data-testid="story-stage" className="studio-grain sticky top-0 h-[100dvh] bg-black">
            {/* the set, lit from above: the white studio fades in over the night one */}
            <div aria-hidden className="studio-night absolute inset-0" />
            <div aria-hidden className="studio-light absolute inset-0 transition-opacity duration-700 ease-in-out" style={{ opacity: light ? 1 : 0 }} />
            {/* the 3D comes in once the page is live (the static HTML and its hydration have no canvas) */}
            {mounted && (
              <Suspense fallback={null}>
                <HeroStage className="absolute inset-0" chapter={chapter} progress={progress} light={light} eventSource={root} />
              </Suspense>
            )}
            <Dots chapter={chapter} light={light} onPick={pick} />
          </div>
          <div className="pointer-events-none relative -mt-[100dvh]">
            {STORY.map((id) => (
              <Track key={id} id={id} current={chapter} progress={progress} />
            ))}
          </div>
        </div>
      ) : (
        <PlainStory />
      )}

      <Gallery />
      {/* the questions people ask before trying (also read by search engines) */}
      <section data-testid="home-faq" className="studio-grain studio-light relative flex flex-col items-center gap-10 px-6 py-24 text-[#1d1d1f]">
        <h2 className="font-display text-balance text-center text-[clamp(30px,6vw,48px)] font-extrabold leading-[1.04]">{t('home.faq.title')}</h2>
        <div className="flex w-full max-w-[760px] flex-col">
          {FAQ.map((n) => (
            <details key={n} className="group border-b border-black/10 py-5 first:border-t">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                {t(`home.faq.q${n}`)}
                <span aria-hidden className="text-[22px] font-normal text-black/40 transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[660px] text-pretty text-[16px] leading-[1.6] text-black/65">{t(`home.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>
      {/* the end, on black */}
      <section data-testid="home-end" className="studio-grain studio-night relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 py-28 text-center text-white">
        <Reveal>
          <h2 className="font-display text-balance text-[clamp(40px,6vw,88px)] font-extrabold leading-[0.98]">{t('home.end.title')}</h2>
        </Reveal>
        <Reveal delay={90}>
          <p className="max-w-[560px] text-pretty text-[19px] leading-[1.5] text-white/70">{t('home.end.lead')}</p>
        </Reveal>
        <Reveal delay={180} className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <OpenStudio size="md" />
        </Reveal>
        <p data-testid="home-credit" className="mt-16 flex flex-wrap items-center justify-center gap-y-1 text-[13.5px] text-white/45">
          <span className="whitespace-nowrap">{t('home.credit.by')} <span className="text-white/75">Luca Leone</span></span>
          {[
            [PORTFOLIO, t('home.credit.portfolio')],
            [LINKEDIN, 'LinkedIn'],
          ].map(([href, label]) => (
            <span key={href}>
              <span aria-hidden className="mx-2">·</span>
              <a href={href} target="_blank" rel="noreferrer" className="underline-offset-4 transition-colors hover:text-white hover:underline">
                {label}
              </a>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
