import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ImagePlus, MousePointerClick, Sparkles, Wand2 } from 'lucide-react';
import { useT } from '@/i18n';
import { DropOverlay, ExportOverlay, useFrameSize } from '@/app/Viewport';
import { OverlayLayer } from '@/app/OverlayLayer';
import { loadImage, useAssets } from '@/store/assets';
import { useProject, type PhotoZone } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Spinner, cx } from '@/ui/primitives';
import { aspectOf, createZone, detectZoneAt, pickSuggestion } from './editing';
import { isConvex, type Quad, type Vec2 } from './homography';
import { loadPhotoSamples, pickPhoto } from './importPhoto';
import { PhotoRenderer, type ZoneDraw } from './renderer';
import { statsFor } from './source';
import { PHOTO_TEMPLATES, applyTemplate, templateUrl } from './templates';

/** Lets global handlers (drop) find the zone under the pointer. */
export const photoPicking: { zoneAt?: (clientX: number, clientY: number) => string | undefined } = {};

function inside(p: Vec2, q: Vec2[]) {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if (q[i][1] > p[1] !== q[j][1] > p[1] && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  }
  return c;
}

/* ------------------------------------------------------------ canvas */

function PhotoCanvas({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const renderer = useRef<PhotoRenderer | null>(null);
  const photo = useProject((s) => s.photo);
  const assets = useAssets((s) => s.assets);
  const [ready, setReady] = useState(0);

  // A fresh canvas per mount: a disposed renderer loses its context for good.
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    canvas.dataset.testid = 'photo-canvas';
    host.appendChild(canvas);
    renderer.current = new PhotoRenderer(canvas);
    setReady((n) => n + 1);
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    const r = renderer.current;
    const pa = photo.assetId ? assets[photo.assetId] : undefined;
    if (!r || !pa || !width || !height) return;
    let alive = true;
    (async () => {
      const img = await loadImage(pa.url);
      const zones: ZoneDraw[] = await Promise.all(
        photo.zones.map(async (zone) => {
          const da = zone.surface.assetId ? assets[zone.surface.assetId] : undefined;
          return {
            zone,
            stats: await statsFor(pa.id, zone),
            design: da ? { source: await loadImage(da.url), key: da.id, width: da.width, height: da.height } : null,
          };
        }),
      );
      if (!alive || renderer.current !== r) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      r.render({ source: img, key: pa.id, width: pa.width, height: pa.height }, zones, { width: Math.round(width * dpr), height: Math.round(height * dpr), preview: true });
      r.prune(new Set(zones.flatMap((z) => (z.design ? [z.design.key] : []))));
    })();
    return () => {
      alive = false;
    };
  }, [photo, assets, width, height, ready]);

  return <div ref={ref} className="absolute inset-0" />;
}

/* ------------------------------------------------------------ loupe */

const LOUPE = 150;
const ZOOM = 3; // screen px per photo px

function Loupe({ at, frame, quad }: { at: Vec2 | null; frame: { w: number; h: number }; quad: Vec2[] | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const assetId = useProject((s) => s.photo.assetId);
  const asset = useAssets((s) => (assetId ? s.assets[assetId] : undefined));
  useEffect(() => {
    const c = ref.current;
    if (!c || !at || !asset) return;
    let alive = true;
    loadImage(asset.url).then((img) => {
      if (!alive) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = c.height = LOUPE * dpr;
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true;
      const span = LOUPE / ZOOM; // photo px across
      const cx = at[0] * asset.width;
      const cy = at[1] * asset.height;
      g.fillStyle = '#111';
      g.fillRect(0, 0, LOUPE, LOUPE);
      g.drawImage(img, cx - span / 2, cy - span / 2, span, span, 0, 0, LOUPE, LOUPE);
      // zone edges near the point
      if (quad && quad.length > 1) {
        g.strokeStyle = 'rgba(255,92,53,0.95)';
        g.lineWidth = 1.25;
        g.beginPath();
        quad.forEach(([x, y], i) => {
          const X = (x * asset.width - cx) * ZOOM + LOUPE / 2;
          const Y = (y * asset.height - cy) * ZOOM + LOUPE / 2;
          if (i === 0) g.moveTo(X, Y);
          else g.lineTo(X, Y);
        });
        if (quad.length === 4) g.closePath();
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(LOUPE / 2, LOUPE / 2 - 12);
      g.lineTo(LOUPE / 2, LOUPE / 2 + 12);
      g.moveTo(LOUPE / 2 - 12, LOUPE / 2);
      g.lineTo(LOUPE / 2 + 12, LOUPE / 2);
      g.stroke();
    });
    return () => {
      alive = false;
    };
  }, [at, asset, quad]);
  if (!at || !asset) return null;
  const px = at[0] * frame.w;
  const py = at[1] * frame.h;
  // up-left of the pointer, flipped near the edges
  const left = px - LOUPE - 28 < 0 ? px + 28 : px - LOUPE - 28;
  const top = py - LOUPE - 28 < 0 ? py + 28 : py - LOUPE - 28;
  return (
    <div className="pointer-events-none absolute z-20 overflow-hidden rounded-full shadow-2xl ring-2 ring-white/85" style={{ left, top, width: LOUPE, height: LOUPE }}>
      <canvas ref={ref} className="h-full w-full" />
      <div className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] text-white/85 [text-shadow:0_1px_2px_#000]">
        {Math.round(at[0] * asset.width)}, {Math.round(at[1] * asset.height)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ editor */

type Drag = { kind: 'corner'; zone: string; i: number } | { kind: 'edge'; zone: string; i: number; start: Vec2; corners: Quad } | { kind: 'move'; zone: string; start: Vec2; corners: Quad };

function ZoneEditor({ width, height }: { width: number; height: number }) {
  const { t } = useT();
  const zones = useProject((s) => s.photo.zones);
  const selectedId = useProject((s) => s.photo.selectedZoneId);
  const tool = useUi((s) => s.photoTool);
  const activeCorner = useUi((s) => s.activeCorner);
  const suggestions = useUi((s) => s.suggestions);
  const svg = useRef<SVGSVGElement>(null);
  const [placing, setPlacing] = useState<Vec2[]>([]);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tool !== 'place') setPlacing([]);
  }, [tool]);
  // suggestions belong to a zone of this photo
  useEffect(() => {
    if (suggestions && !zones.some((z) => z.id === suggestions.zoneId)) useUi.getState().setSuggestions(null);
  }, [zones, suggestions]);

  const norm = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = svg.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const toPx = ([x, y]: Vec2): Vec2 => [x * width, y * height];
  const zoneAt = (p: Vec2) => [...zones].reverse().find((z) => z.visible && inside(toPx(p), z.corners.map(toPx)));

  useEffect(() => {
    photoPicking.zoneAt = (cx, cy) => (svg.current ? zoneAt(norm({ clientX: cx, clientY: cy }))?.id : undefined);
    return () => {
      photoPicking.zoneAt = undefined;
    };
  });

  const update = (id: string, corners: Quad, withAspect: boolean) => {
    if (!isConvex(corners)) return;
    const z = useProject.getState().photo.zones.find((zz) => zz.id === id);
    useProject.getState().updateZone(id, { corners, ...(withAspect && z?.aspectAuto && { aspect: aspectOf(corners) }) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = norm(e);
    if (tool === 'place') {
      if (e.detail > 1) return; // second click of a double-click
      const next = [...placing, p];
      if (next.length === 4) {
        setPlacing([]);
        void createZone(next);
      } else setPlacing(next);
      return;
    }
    const target = (e.target as Element).closest('[data-handle]') as HTMLElement | null;
    const project = useProject.getState();
    if (target && target.dataset.handle === 'suggestion') {
      pickSuggestion(Number(target.dataset.index));
      return;
    }
    if (target) {
      useUi.getState().setSuggestions(null);
      const zone = target.dataset.zone!;
      const i = Number(target.dataset.index);
      project.selectZone(zone);
      if (target.dataset.handle === 'corner') {
        useUi.getState().setActiveCorner(i);
        setDrag({ kind: 'corner', zone, i });
      } else {
        const z = project.photo.zones.find((zz) => zz.id === zone)!;
        setDrag({ kind: 'edge', zone, i, start: p, corners: z.corners });
      }
    } else {
      const z = zoneAt(p);
      useUi.getState().setActiveCorner(null);
      if (z) {
        project.selectZone(z.id);
        setDrag({ kind: 'move', zone: z.id, start: p, corners: z.corners });
      } else project.selectZone(null);
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = norm(e);
    setHover(p);
    if (!drag) return;
    const z = useProject.getState().photo.zones.find((zz) => zz.id === drag.zone);
    if (!z) return;
    if (drag.kind === 'corner') {
      const corners = z.corners.map((c, i) => (i === drag.i ? p : c)) as Quad;
      update(z.id, corners, true);
    } else {
      const dx = p[0] - drag.start[0];
      const dy = p[1] - drag.start[1];
      if (useUi.getState().suggestions && Math.hypot(dx, dy) > 0.002) useUi.getState().setSuggestions(null);
      const moved = drag.corners.map((c, i) => (drag.kind === 'move' || i === drag.i || i === (drag.i + 1) % 4 ? [c[0] + dx, c[1] + dy] : c)) as Quad;
      update(z.id, moved, drag.kind === 'edge');
    }
  };

  const onDoubleClick = async (e: React.MouseEvent) => {
    const p = norm(e);
    setPlacing([]);
    setBusy(true);
    try {
      await detectZoneAt(p[0], p[1]);
    } finally {
      setBusy(false);
    }
  };

  const selected = zones.find((z) => z.id === selectedId);
  const loupeAt = drag?.kind === 'corner' ? (selected?.corners[drag.i] ?? null) : tool === 'place' ? hover : null;
  const loupeQuad = tool === 'place' ? (hover ? [...placing, hover] : placing) : (selected?.corners ?? null);
  const pts = (q: Vec2[]) => q.map((c) => toPx(c).join(',')).join(' ');

  return (
    <>
      <svg
        ref={svg}
        className={cx('absolute inset-0 z-10 h-full w-full touch-none select-none', tool === 'place' ? 'cursor-crosshair' : 'cursor-default')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => !drag && setHover(null)}
        onDoubleClick={onDoubleClick}
        data-testid="zone-editor"
      >
        {suggestions &&
          suggestions.zoneId === selectedId &&
          suggestions.candidates.map((c, i) =>
            i === suggestions.index ? null : (
              <g key={`s${i}`} data-handle="suggestion" data-index={i} className="cursor-pointer">
                <polygon points={pts(c as Vec2[])} fill="none" stroke="transparent" strokeWidth={12} pointerEvents="stroke" />
                <polygon points={pts(c as Vec2[])} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={2.5} pointerEvents="none" />
                <polygon points={pts(c as Vec2[])} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1} strokeDasharray="3 4" pointerEvents="none" />
              </g>
            ),
          )}
        {zones.map((z: PhotoZone) => {
          const sel = z.id === selectedId;
          if (!z.visible) return null;
          return (
            <g key={z.id}>
              <polygon points={pts(z.corners)} fill="transparent" className="cursor-move" />
              <polygon points={pts(z.corners)} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={sel ? 3.5 : 2.5} pointerEvents="none" />
              <polygon
                points={pts(z.corners)}
                fill="none"
                stroke={sel ? 'var(--accent)' : 'rgba(255,255,255,0.75)'}
                strokeWidth={sel ? 1.5 : 1}
                strokeDasharray={sel ? undefined : '5 4'}
                pointerEvents="none"
              />
              {sel &&
                z.corners.map((c, i) => {
                  const a = toPx(c);
                  const b = toPx(z.corners[(i + 1) % 4]);
                  return (
                    <rect
                      key={`e${i}`}
                      data-handle="edge"
                      data-zone={z.id}
                      data-index={i}
                      x={(a[0] + b[0]) / 2 - 4}
                      y={(a[1] + b[1]) / 2 - 4}
                      width={8}
                      height={8}
                      rx={2}
                      fill="white"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      className="cursor-grab"
                    />
                  );
                })}
              {sel &&
                z.corners.map((c, i) => {
                  const [x, y] = toPx(c);
                  const active = activeCorner === i;
                  return (
                    <g key={`c${i}`} data-handle="corner" data-zone={z.id} data-index={i} className="cursor-grab">
                      <circle cx={x} cy={y} r={12} fill="transparent" />
                      <circle cx={x} cy={y} r={6.5} fill={active ? 'var(--accent)' : 'white'} stroke={active ? 'white' : 'var(--accent)'} strokeWidth={1.75} />
                    </g>
                  );
                })}
            </g>
          );
        })}
        {tool === 'place' && placing.length > 0 && (
          <g pointerEvents="none">
            <polyline points={pts(hover ? [...placing, hover, ...(placing.length === 3 ? [placing[0]] : [])] : placing)} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3" />
            {placing.map((c, i) => {
              const [x, y] = toPx(c);
              return <circle key={i} cx={x} cy={y} r={5} fill="var(--accent)" stroke="white" strokeWidth={1.5} />;
            })}
          </g>
        )}
      </svg>
      <Loupe at={loupeAt} frame={{ w: width, h: height }} quad={loupeQuad} />
      {suggestions && suggestions.zoneId === selectedId && suggestions.candidates.length > 1 && tool !== 'place' && (
        <div className="absolute inset-x-0 top-3 z-20 flex justify-center" data-testid="suggestions">
          <div className="flex items-center gap-1 rounded-full bg-black/70 py-1 pl-3.5 pr-1 text-[12px] text-white/90 shadow-xl backdrop-blur-xl">
            <Wand2 size={13} className="mr-1 text-accent" />
            {t('photo.suggest', { i: suggestions.index + 1, n: suggestions.candidates.length })}
            <button type="button" aria-label={t('photo.suggest.prev')} onClick={() => pickSuggestion(suggestions.index - 1)} className="ml-1 grid size-7 place-items-center rounded-full hover:bg-white/15">
              <ChevronLeft size={15} />
            </button>
            <button type="button" aria-label={t('photo.suggest.next')} onClick={() => pickSuggestion(suggestions.index + 1)} className="grid size-7 place-items-center rounded-full hover:bg-white/15">
              <ChevronRight size={15} />
            </button>
            <button type="button" onClick={() => useUi.getState().setSuggestions(null)} className="ml-1 flex h-7 items-center gap-1 rounded-full bg-white/15 px-2.5 font-medium hover:bg-white/25">
              <Check size={13} />
              {t('photo.suggest.ok')}
            </button>
          </div>
        </div>
      )}
      {tool === 'place' && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-black/65 px-3.5 py-1.5 text-[12px] text-white/90 shadow-xl backdrop-blur-xl">
            <MousePointerClick size={14} className="text-accent" />
            {t('photo.place.hint', { n: placing.length + 1 })}
          </div>
        </div>
      )}
      {busy && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="flex items-center gap-2 rounded-xl bg-black/65 px-3 py-2 text-[12px] text-white">
            <Spinner size={13} />
            {t('photo.detecting')}
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ empty states */

function PhotoEmpty() {
  const { t, tr } = useT();
  const [loading, setLoading] = useState<string | null>(null);
  return (
    <div className="flex max-w-[640px] flex-col items-center gap-6 px-6 text-center animate-[fade-in_250ms_ease-out]">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-xl">
        <ImagePlus size={24} />
      </div>
      <div>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{t('photo.empty.title')}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{t('photo.empty.body')}</p>
      </div>
      <Button variant="primary" size="lg" onClick={pickPhoto}>
        <ImagePlus size={16} />
        {t('photo.import')}
      </Button>
      <div className="w-full">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">{t('photo.empty.templates')}</div>
        <div className="grid grid-cols-4 gap-2">
          {PHOTO_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              disabled={!!loading}
              onClick={async () => {
                setLoading(tpl.id);
                try {
                  await applyTemplate(tpl);
                } finally {
                  setLoading(null);
                }
              }}
              className="group relative overflow-hidden rounded-lg bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset] transition-transform hover:scale-[1.03]"
            >
              <img src={templateUrl(tpl.thumb)} alt="" className="aspect-[3/2] w-full object-cover" />
              <div className="truncate px-2 py-1.5 text-left text-[11.5px] font-medium">{tr(tpl.name)}</div>
              {loading === tpl.id && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Spinner />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesignHint() {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center animate-[fade-in_300ms_ease-out]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 py-2 pl-3 pr-2 text-[12.5px] text-white/85 shadow-2xl backdrop-blur-xl">
        <ImagePlus size={16} className="text-white/60" />
        <span>{t('photo.designHint')}</span>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await loadPhotoSamples();
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

function ZoneHint() {
  const { t } = useT();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/55 px-3.5 py-2 text-[12.5px] text-white/85 shadow-2xl backdrop-blur-xl">
        <Wand2 size={15} className="text-accent" />
        {t('photo.zoneHint')}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ view */

export function PhotoView() {
  const { t } = useT();
  const assetId = useProject((s) => s.photo.assetId);
  const asset = useAssets((s) => (assetId ? s.assets[assetId] : undefined));
  const zones = useProject((s) => s.photo.zones);
  const tool = useUi((s) => s.photoTool);
  const ratio = asset ? asset.width / asset.height : 1.5;
  const { ref, width, height } = useFrameSize(ratio);
  const frame = useRef<HTMLDivElement>(null);
  const noDesign = zones.length > 0 && zones.every((z) => !z.surface.assetId);
  const previewZoom = useUi((s) => s.previewZoom);
  const selected = zones.find((z) => z.id === useProject.getState().photo.selectedZoneId) ?? zones[0];
  const origin = selected ? `${(selected.corners.reduce((a, c) => a + c[0], 0) / 4) * 100}% ${(selected.corners.reduce((a, c) => a + c[1], 0) / 4) * 100}%` : '50% 50%';

  return (
    <main ref={ref} className="stage-dots relative flex min-w-0 flex-1 items-center justify-center overflow-hidden" data-testid="photo-view">
      {asset ? (
        <div className="relative overflow-hidden rounded-[3px]" style={{ width, height, boxShadow: 'var(--frame-shadow)' }} data-testid="frame" ref={frame}>
          <div className="absolute inset-0" style={previewZoom !== 1 ? { transform: `scale(${previewZoom})`, transformOrigin: origin } : undefined}>
            <PhotoCanvas width={width} height={height} />
          </div>
          <OverlayLayer width={width} height={height} frame={frame} />
          <ZoneEditor width={width} height={height} />
          {tool !== 'place' && zones.length === 0 && <ZoneHint />}
          {tool !== 'place' && noDesign && <DesignHint />}
        </div>
      ) : (
        <PhotoEmpty />
      )}
      {asset && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-[72px] items-center justify-center gap-3 text-[11.5px] text-fg-subtle">
          <span className="font-mono tabular-nums">
            {asset.width} × {asset.height}
          </span>
          <span className="size-1 rounded-full bg-fg-subtle/50" />
          <span>{t('photo.viewHint')}</span>
        </div>
      )}
      <DropOverlay />
      <ExportOverlay />
    </main>
  );
}
