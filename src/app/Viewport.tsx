import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { ratioValue } from '@/export/settings';
import { paintBackground, prepareBackground } from '@/lib/background';
import { useAssets } from '@/store/assets';
import { pickImages } from '@/lib/importImage';
import { loadSamples } from '@/lib/samples';
import { Stage } from '@/scene/Stage';
import { useProject, selectSelectedItem } from '@/store/project';
import { useUi } from '@/store/ui';
import { Spinner, cx } from '@/ui/primitives';
import { FloatingBar } from '@/shell/FloatingBar';
import { MOD } from './shortcuts';
import { OverlayLayer } from './OverlayLayer';

/** While an animation preview plays: the app is frozen (the scene is a temporary copy), with a stop button. */
export function PreviewOverlay() {
  const { t } = useT();
  const previewing = useUi((s) => s.previewing);
  if (!previewing) return null;
  return (
    <div className="fixed inset-0 z-40" onPointerDown={(e) => e.preventDefault()}>
      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <button
          type="button"
          onClick={() => void import('@/animation/actions').then((m) => m.togglePreview())}
          className="flex items-center gap-2 rounded-full bg-black/75 py-2 pl-3 pr-4 text-[13px] font-medium text-white shadow-2xl backdrop-blur-xl hover:bg-black/85"
          data-testid="preview-stop"
        >
          <span className="size-2.5 rounded-sm bg-accent" />
          {t('video.stopPreview')}
        </button>
      </div>
    </div>
  );
}

/** Size of the largest rectangle of the given aspect fitting in the container (minus padding). */
export function useFrameSize(ratio: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padX = 56;
  const padY = 84;
  const aw = Math.max(0, box.w - padX * 2);
  const ah = Math.max(0, box.h - padY * 2);
  const w = Math.min(aw, ah * ratio);
  return { ref, width: Math.floor(w), height: Math.floor(w / ratio) };
}

function BackgroundCanvas({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const background = useProject((s) => s.background);
  const theme = useUi((s) => s.theme);
  const assets = useAssets((s) => s.assets);
  useEffect(() => {
    const c = ref.current;
    if (!c || !width || !height) return;
    let alive = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    prepareBackground(background).then(() => {
      if (!alive) return;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      paintBackground(c.getContext('2d')!, background, c.width, c.height, { checker: 10 * dpr });
    });
    return () => {
      alive = false;
    };
  }, [background, width, height, theme, assets]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function EmptyHint() {
  const { t } = useT();
  const item = useProject(selectSelectedItem);
  const [loading, setLoading] = useState(false);
  const [before, after] = t('stage.emptyHint').split('{paste}');
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center animate-[fade-in_300ms_ease-out]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 py-2 pl-3 pr-2 text-[12.5px] text-white/85 shadow-2xl backdrop-blur-xl">
        <ImagePlus size={16} className="text-white/60" />
        <span>
          {before}
          <kbd className="mx-1 rounded bg-white/15 px-1 font-mono text-[10.5px] leading-[16px] text-white/85">{MOD}V</kbd>
          {after}{' '}
          <button type="button" onClick={() => pickImages()} className="font-medium text-white underline decoration-white/30 underline-offset-[3px] hover:decoration-white">
            {t('stage.browse')}
          </button>
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              if (item) await loadSamples(item.id);
            } finally {
              setLoading(false);
            }
          }}
          className="flex h-7 items-center gap-1.5 rounded-lg bg-white/12 px-2.5 font-medium text-white transition-colors hover:bg-white/20"
        >
          {loading ? <Spinner size={12} /> : <Sparkles size={13} />}
          {t('stage.sample')}
        </button>
      </div>
    </div>
  );
}

export function DropOverlay() {
  const { t } = useT();
  const dragging = useUi((s) => s.dragging);
  return (
    <div
      className={cx(
        'pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft backdrop-blur-[2px] transition-opacity duration-150',
        dragging ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className={cx('flex flex-col items-center gap-2 transition-transform duration-200 ease-[var(--ease-spring)]', dragging ? 'scale-100' : 'scale-95')}>
        <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-fg shadow-xl">
          <ImagePlus size={22} />
        </div>
        <div className="text-[15px] font-semibold">{t('stage.dropTitle')}</div>
        <div className="text-[12px] text-fg-muted">{t('stage.dropHint')}</div>
      </div>
    </div>
  );
}

export function ExportOverlay() {
  const { t } = useT();
  const label = useUi((s) => s.exporting);
  const cancel = useUi((s) => s.cancelExport);
  if (!label) return null;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/35 backdrop-blur-[3px] animate-[fade-in_150ms_ease-out]">
      <div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-[13px] font-medium shadow-2xl ring-1 ring-line">
        <Spinner />
        <span className="tabular-nums">{label}</span>
        {cancel && (
          <button type="button" onClick={cancel} className="ml-1 rounded-md px-2 py-1 text-[12px] text-fg-muted hover:bg-surface-3 hover:text-fg">
            {t('cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

export function Viewport() {
  const ratio = useProject((s) => s.export.ratio);
  const hasImage = useProject((s) => {
    const it = selectSelectedItem(s);
    // objects without faces (brand objects) never need an image
    return !it || Object.keys(it.surfaces).length === 0 || Object.values(it.surfaces).some((b) => b.assetId);
  });
  const { ref, width, height } = useFrameSize(ratioValue(ratio));
  const frame = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useAssets((s) => s.assets);

  return (
    <div ref={root} className="relative flex min-w-0 flex-1">
    <main ref={ref} className="stage-bg relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
      <div
        className="relative overflow-hidden rounded-[3px] transition-[width,height] duration-300 ease-[var(--ease-out-quart)]"
        style={{ width, height, boxShadow: 'var(--frame-shadow)' }}
        data-testid="frame"
        ref={frame}
      >
        <BackgroundCanvas width={width} height={height} />
        {width > 0 && <Stage />}
        <OverlayLayer width={width} height={height} frame={frame} />
        {!hasImage && <EmptyHint />}
      </div>

      <DropOverlay />
      <ExportOverlay />
    </main>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <FloatingBar onFullscreen={() => void root.current?.requestFullscreen?.()} />
      </div>
    </div>
  );
}
