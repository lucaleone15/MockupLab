import type { ReactNode } from 'react';
import { ImagePlus } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { importImages, pickImages } from '@/lib/importImage';
import { MOD } from '@/app/shortcuts';
import { templateUrl } from '@/photo/templates';
import { Logo } from '@/shell/Logo';
import { MoreMenu } from '@/shell/MoreMenu';
import { AVAILABLE, navigate } from '@/shell/route';
import { useProject } from '@/store/project';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

const sample = (name: string) => `${import.meta.env.BASE_URL}samples/${name}`;

/** A small phone drawn in CSS around a real design. */
function MiniPhone({ src, className }: { src: string; className?: string }) {
  return (
    <span className={cx('block aspect-[9/19] overflow-hidden rounded-[9px] border-[3px] border-[#1d1d1f] bg-[#1d1d1f] shadow-[0_10px_24px_rgb(0_0_0/0.25)]', className)}>
      <img src={src} alt="" className="h-full w-full rounded-[6px] object-cover object-top" draggable={false} />
    </span>
  );
}

function MiniLaptop({ src, className }: { src: string; className?: string }) {
  return (
    <span className={cx('flex flex-col items-center', className)}>
      <span className="block aspect-[16/10] w-full overflow-hidden rounded-t-[5px] border-[3px] border-b-0 border-[#1d1d1f] bg-[#1d1d1f]">
        <img src={src} alt="" className="h-full w-full object-cover object-top" draggable={false} />
      </span>
      <span className="block h-[5px] w-[116%] rounded-b-[4px] bg-[#c9c9ce] shadow-[0_8px_18px_rgb(0_0_0/0.2)]" />
    </span>
  );
}

/** What each mode makes, shown with real designs rather than icons. */
const PREVIEWS: Record<Screen, ReactNode> = {
  home: null,
  quick: (
    <span className="grid h-full grid-cols-3 gap-1.5 p-3">
      {['#e9e4dc', '#1c1d22', '#cfd8e3'].map((bg) => (
        <span key={bg} className="grid place-items-center rounded-[7px]" style={{ background: bg }}>
          <MiniPhone src={sample('sample-app.png')} className="w-[38%]" />
        </span>
      ))}
    </span>
  ),
  project: (
    <span className="flex h-full items-end justify-center gap-2 pb-4">
      <MiniLaptop src={sample('sample-web.png')} className="w-[46%]" />
      <MiniPhone src={sample('sample-app.png')} className="w-[13%]" />
      <span className="block aspect-[1/1.414] w-[15%] overflow-hidden rounded-[2px] shadow-[0_8px_18px_rgb(0_0_0/0.22)]">
        <img src={sample('sample-poster.png')} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>
    </span>
  ),
  studio: (
    <span className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,#ffffff,#dedee3)] dark:bg-[radial-gradient(circle_at_50%_40%,#34353c,#15161a)]">
      <MiniPhone src={sample('sample-app.png')} className="w-[17%] -rotate-[8deg]" />
    </span>
  ),
  photo: <img src={templateUrl('marble-duo-thumb.jpg')} alt="" className="h-full w-full object-cover" draggable={false} />,
};

const MODES: Screen[] = ['quick', 'project', 'studio', 'photo'];

/** Opens the studio, then puts the files on the selected device (same path as a drop in the studio). */
export function importFromHome(files: Iterable<File>) {
  const list = [...files];
  // navigate sets the project to 3D synchronously, so the image lands on the device
  navigate('studio');
  void importImages(list);
}

function Resume() {
  const { t } = useT();
  const has = useUi((s) => s.hasSavedProject);
  const name = useProject((s) => s.name);
  const mode = useProject((s) => s.mode);
  if (!has) return null;
  const target: Screen = mode === 'photo' ? 'photo' : 'studio';
  return (
    <button
      type="button"
      data-testid="home-resume"
      onClick={() => navigate(target)}
      className="glass flex w-full items-center gap-4 rounded-[14px] px-5 py-3.5 text-left transition-transform duration-150 active:scale-[0.99]"
    >
      <span className="flex-1">
        <span className="block text-[14px] font-semibold">{t('home.resume', { name: name === 'Untitled' ? t('project.untitled') : name })}</span>
        <span className="block text-[12.5px] text-fg-muted">{t('home.resumeMode', { mode: t(target === 'photo' ? 'screen.photo' : 'screen.studio') })}</span>
      </span>
      <span className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-accent-fg">{t('home.open')}</span>
    </button>
  );
}

export function Home() {
  const { t } = useT();
  const [before, after] = t('home.drop').split('{paste}');
  return (
    <div data-testid="home" className="scroll-thin flex h-full flex-col overflow-y-auto">
      <header className="flex h-14 shrink-0 items-center justify-between px-6">
        <Logo asLink={false} />
        <MoreMenu />
      </header>
      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col justify-center gap-9 px-6 pb-10">
        <section className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-balance text-[clamp(40px,5.4vw,68px)] font-bold leading-[1.02] tracking-[-0.035em]">{t('home.title')}</h1>
          <p className="max-w-[600px] text-[16px] leading-relaxed text-fg-muted">{t('home.lead')}</p>
          <button
            type="button"
            data-testid="home-drop"
            onClick={() => pickImages(importFromHome)}
            className="mt-3 flex w-full max-w-[600px] flex-col items-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface px-6 py-6 text-fg-muted transition-[border-color,color,transform] duration-150 hover:border-accent hover:text-fg active:scale-[0.99]"
          >
            <ImagePlus size={24} className="text-accent" />
            <span className="text-[14.5px] font-medium">
              {before}
              <kbd className="mx-0.5 rounded-md bg-surface-3 px-1.5 font-mono text-[12px]">{MOD}V</kbd>
              {after}
            </span>
            <span className="text-[12.5px] text-fg-muted">{t('home.dropHint')}</span>
          </button>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-medium text-fg-muted">{t('home.modes')}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {MODES.map((m) => {
              const available = AVAILABLE[m];
              return (
                <button
                  key={m}
                  type="button"
                  data-testid={`mode-card-${m}`}
                  disabled={!available}
                  onClick={() => navigate(m)}
                  className={cx(
                    'glass flex flex-col gap-2.5 rounded-[18px] p-3 text-left transition-transform duration-200 ease-[var(--ease-out-quart)]',
                    available ? 'hover:-translate-y-0.5 active:scale-[0.99]' : 'cursor-default',
                  )}
                >
                  <span className={cx('block h-[118px] overflow-hidden rounded-[12px] bg-surface-2', !available && 'opacity-55 saturate-50')}>{PREVIEWS[m]}</span>
                  <span className="flex items-center gap-2 px-1">
                    <span className="font-display text-[19px] font-bold">{t(`screen.${m}` as I18nKey)}</span>
                    {!available && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] font-medium text-fg-muted">{t('screen.soon')}</span>}
                  </span>
                  <span className="px-1 pb-1 text-[13px] leading-snug text-fg-muted">{t(`home.${m}` as I18nKey)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <Resume />
      </main>
    </div>
  );
}
