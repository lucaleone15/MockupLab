import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, Scan, Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { outputSize, ratioValue } from '@/export/settings';
import { paintBackground } from '@/lib/background';
import { importFromUrl, pickImages } from '@/lib/importImage';
import { getModel } from '@/models/registry';
import { isLandscape } from '@/models/types';
import { Stage } from '@/scene/Stage';
import { useProject, selectSelectedItem } from '@/store/project';
import { useUi } from '@/store/ui';
import { IconButton, Kbd, Spinner, cx } from '@/ui/primitives';
import { MOD } from './shortcuts';

/** Bundled sample matching the device: a phone app for tall screens, a web page otherwise. */
function sampleFor(aspect: number, landscape: boolean) {
  const tall = landscape ? 1 / aspect < 1 : aspect < 1;
  const name = tall ? 'sample-app.png' : 'sample-web.png';
  return { url: `${import.meta.env.BASE_URL}samples/${name}`, name };
}

/** Size of the largest rectangle of the given aspect fitting in the container (minus padding). */
function useFrameSize(ratio: number) {
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
  const padY = 72;
  const aw = Math.max(0, box.w - padX * 2);
  const ah = Math.max(0, box.h - padY * 2);
  const w = Math.min(aw, ah * ratio);
  return { ref, width: Math.floor(w), height: Math.floor(w / ratio) };
}

function BackgroundCanvas({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const background = useProject((s) => s.background);
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    const c = ref.current;
    if (!c || !width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    paintBackground(c.getContext('2d')!, background, c.width, c.height, { checker: 10 * dpr });
  }, [background, width, height, theme]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function EmptyHint() {
  const { t } = useT();
  const item = useProject(selectSelectedItem);
  const model = getModel(item?.modelId ?? '');
  const sample = sampleFor(model.surfaces[0]?.aspect ?? 1, item ? isLandscape(item.params) : false);
  const [loading, setLoading] = useState(false);
  const [before, after] = t('stage.emptyHint').split('{paste}');
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center animate-[fade-in_300ms_ease-out]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 py-2 pl-3 pr-2 text-[12.5px] text-white/85 shadow-2xl backdrop-blur-xl">
        <ImagePlus size={16} className="text-white/60" />
        <span>
          {before}
          <Kbd inverted>{MOD}V</Kbd>
          {after}{' '}
          <button type="button" onClick={pickImages} className="font-medium text-white underline decoration-white/30 underline-offset-[3px] hover:decoration-white">
            {t('stage.browse')}
          </button>
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await importFromUrl(sample.url, sample.name);
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

function DropOverlay() {
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

function ExportOverlay() {
  const label = useUi((s) => s.exporting);
  if (!label) return null;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/35 backdrop-blur-[3px] animate-[fade-in_150ms_ease-out]">
      <div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-[13px] font-medium shadow-2xl ring-1 ring-line">
        <Spinner />
        {label}
      </div>
    </div>
  );
}

export function Viewport() {
  const { t } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const exportSettings = useProject((s) => s.export);
  const hasImage = useProject((s) => Object.values(selectSelectedItem(s)?.surfaces ?? {}).some((b) => b.assetId));
  const resetView = useUi((s) => s.resetView);
  const { ref, width, height } = useFrameSize(ratioValue(ratio));
  const out = outputSize(exportSettings);

  return (
    <main ref={ref} className="stage-dots relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
      <div
        className="relative overflow-hidden rounded-[3px] transition-[width,height] duration-300 ease-[var(--ease-out-quart)]"
        style={{ width, height, boxShadow: 'var(--frame-shadow)' }}
        data-testid="frame"
      >
        <BackgroundCanvas width={width} height={height} />
        {width > 0 && <Stage />}
        {!hasImage && <EmptyHint />}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-[72px] items-center justify-center gap-3 text-[11.5px] text-fg-subtle">
        <span className="font-mono tabular-nums">
          {out.width} × {out.height}
        </span>
        <span className="size-1 rounded-full bg-fg-subtle/50" />
        <span>{t('stage.orbitHint')}</span>
      </div>
      <div className="absolute right-3 top-3">
        <IconButton label={t('stage.resetView')} shortcut="F" onClick={resetView}>
          <Scan size={16} />
        </IconButton>
      </div>
      <DropOverlay />
      <ExportOverlay />
    </main>
  );
}
