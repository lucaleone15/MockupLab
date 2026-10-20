import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageUp, Shuffle, X } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { paintBackground, prepareBackground } from '@/lib/background';
import { BG_PRESETS, BG_PRESET_NAMES, PATTERN_DEFAULTS } from '@/lib/backgroundPresets';
import { importAsset, pickImageFile } from '@/lib/importImage';
import { PATTERN_IDS } from '@/lib/patterns';
import { useAssets } from '@/store/assets';
import { DEFAULT_BRAND, useProject, type Background, type GradientStop } from '@/store/project';
import { Button, ColorField, Field, Segmented, Slider, Tooltip, cx } from '@/ui/primitives';

/* ------------------------------------------------------------ thumbnails */

const thumbs = new Map<string, string>();

/** Small rendering of a background, painted by the real painter (cached). */
function useThumb(bg: Background, w = 96, h = 60) {
  const key = JSON.stringify(bg) + w + h;
  const [url, setUrl] = useState(() => thumbs.get(key) ?? '');
  useEffect(() => {
    if (thumbs.has(key)) return setUrl(thumbs.get(key)!);
    let alive = true;
    prepareBackground(bg).then(() => {
      const c = document.createElement('canvas');
      c.width = w * 2;
      c.height = h * 2;
      paintBackground(c.getContext('2d')!, bg, c.width, c.height);
      const data = c.toDataURL('image/png');
      thumbs.set(key, data);
      if (alive) setUrl(data);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

function Thumb({ bg, active, onClick, label, className }: { bg: Background; active: boolean; onClick: () => void; label: string; className?: string }) {
  const url = useThumb(bg);
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cx(
          'aspect-[8/5] overflow-hidden rounded-md bg-cover bg-center transition-[transform,box-shadow] duration-150 hover:scale-[1.06] active:scale-95',
          active ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]',
          className,
        )}
        style={{ backgroundImage: url ? `url(${url})` : 'none' }}
      />
    </Tooltip>
  );
}

/* ------------------------------------------------------------ gradient editor */

function GradientEditor({ stops, onChange }: { stops: GradientStop[]; onChange: (stops: GradientStop[]) => void }) {
  const { t } = useT();
  const bar = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const sel = Math.min(selected, stops.length - 1);
  const sorted = useMemo(() => [...stops].sort((a, b) => a.at - b.at), [stops]);
  const css = `linear-gradient(90deg, ${sorted.map((s) => `${s.color} ${s.at * 100}%`).join(',')})`;

  const posFromEvent = (e: { clientX: number }) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };

  const startDrag = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelected(i);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onChange(stops.map((s, j) => (j === i ? { ...s, at: posFromEvent(ev) } : s)));
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={bar}
        style={{ background: css }}
        className="relative mx-2 h-7 cursor-copy rounded-md shadow-[0_0_0_1px_var(--line-strong)_inset]"
        title={t('bg.addStop')}
        onPointerDown={(e) => {
          const at = posFromEvent(e);
          onChange([...stops, { color: stops[sel]?.color ?? '#888888', at }]);
          setSelected(stops.length);
        }}
      >
        {stops.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${t('bg.stops')} ${i + 1}`}
            onPointerDown={(e) => startDrag(i, e)}
            className={cx(
              'absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow-md transition-transform active:cursor-grabbing',
              i === sel ? 'scale-115 border-white ring-2 ring-accent' : 'border-white/90',
            )}
            style={{ left: `${s.at * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ColorField label={t('bg.stops')} value={stops[sel].color} onChange={(color) => onChange(stops.map((s, j) => (j === sel ? { ...s, color } : s)))} />
        </div>
        <span className="w-10 text-right text-[11px] tabular-nums text-fg-subtle">{Math.round(stops[sel].at * 100)}%</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={stops.length <= 2}
          onClick={() => {
            onChange(stops.filter((_, j) => j !== sel));
            setSelected(0);
          }}
          aria-label={t('bg.removeStop')}
        >
          <X size={13} />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ editor */

/** Quick plain colours of the colour row (the brand's colours are added when a brand is filled in). */
const QUICK_COLORS = ['#0d0d10', '#f2f0ec', '#ffffff', '#1e3a2f', '#0b2a5b', '#ffd8c2', '#e6e1f7', '#3d7bff'];
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The main colour a background shows (the plain colour, the first stop or colour of a gradient or pattern). */
export function mainColor(bg: Background) {
  return bg.kind === 'solid' ? bg.color : bg.kind === 'gradient' ? bg.stops[0].color : bg.kind === 'pattern' ? bg.colors[0] : '#1b1b1f';
}

/**
 * `main`: the background colour first (a big swatch, its code, quick colours),
 * the kind of background, and what that kind needs; `details`: its fine-tuning.
 */
export function BackgroundEditor({ part }: { part: 'main' | 'details' }) {
  const { t, tr } = useT();
  const bg = useProject((s) => s.background);
  const setBackground = useProject((s) => s.setBackground);
  const brand = useProject((s) => s.brand);
  const imageAsset = useAssets((s) => (bg.kind === 'image' && bg.assetId ? s.assets[bg.assetId] : undefined));
  const color = mainColor(bg);
  const [hex, setHex] = useState(color);
  useEffect(() => setHex(color), [color]);
  // a colour picked here is the background: a plain colour
  const setColor = (c: string) => {
    if (useProject.getState().decor.kind === 'none') useProject.getState().setDecor({ kind: 'sweep' });
    setBackground({ kind: 'solid', color: c.toLowerCase() });
  };
  const commitHex = () => {
    const m = HEX.exec(hex.trim());
    if (!m) return setHex(color);
    const h =
      m[1].length === 3
        ? m[1]
            .split('')
            .map((x) => x + x)
            .join('')
        : m[1];
    setColor(`#${h}`);
  };
  const quick = [...new Set([...QUICK_COLORS, ...(brand.name && brand.name !== DEFAULT_BRAND.name ? brand.colors.map((c) => c.hex.toLowerCase()) : [])])];

  const chooseImage = async () => {
    const file = await pickImageFile();
    if (!file) return;
    const asset = await importAsset(file);
    if (asset)
      setBackground({
        kind: 'image',
        assetId: asset.id,
        blur: bg.kind === 'image' ? bg.blur : 0,
        dim: bg.kind === 'image' ? bg.dim : 0,
      });
  };

  const switchKind = (k: Background['kind']) => {
    if (k === bg.kind) return;
    // a transparent background shows the device alone: no studio, podium or table behind it
    const decor = useProject.getState().decor;
    if (k === 'transparent') useProject.getState().setDecor({ kind: 'none' });
    else if (decor.kind === 'none') useProject.getState().setDecor({ kind: 'sweep' });
    const firstColor = bg.kind === 'solid' ? bg.color : bg.kind === 'gradient' ? bg.stops[0].color : bg.kind === 'pattern' ? bg.colors[0] : '#1b1b1f';
    if (k === 'solid') setBackground({ kind: 'solid', color: firstColor });
    else if (k === 'gradient')
      setBackground({
        kind: 'gradient',
        type: 'linear',
        angle: 160,
        stops: [
          { color: firstColor, at: 0 },
          { color: '#0d0d10', at: 1 },
        ],
      });
    else if (k === 'pattern')
      setBackground({
        kind: 'pattern',
        pattern: 'aurora',
        colors: PATTERN_DEFAULTS.aurora,
        scale: 1,
        grain: 0.3,
        seed: 4,
      });
    else if (k === 'image') void chooseImage();
    else setBackground({ kind: 'transparent' });
  };

  if (part === 'main') {
    const presets = BG_PRESETS.map((p, i) => ({ p, i })).filter(({ p }) => p.kind === bg.kind);
    return (
      <>
        {bg.kind !== 'transparent' && (
          <div className="flex items-center gap-3">
            <label
              data-testid="bg-swatch"
              title={t('bg.pick')}
              className="relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-[14px] shadow-[0_0_0_1px_var(--line-strong)_inset] transition-transform hover:scale-[1.03]"
              style={{ background: color }}
            >
              <input type="color" aria-label={t('bg.pick')} value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                type="text"
                aria-label={t('bg.hex')}
                value={hex.toUpperCase()}
                spellCheck={false}
                onChange={(e) => setHex(e.target.value)}
                onBlur={commitHex}
                onKeyDown={(e) => e.key === 'Enter' && commitHex()}
                className="h-8 w-full rounded-[10px] bg-surface-2 px-2.5 text-[12.5px] tabular-nums text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1.5px_var(--accent)_inset]"
              />
              <div className="flex flex-wrap gap-1.5" data-testid="quick-colors">
                {quick.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={cx(
                      'size-5 rounded-md transition-transform hover:scale-110',
                      bg.kind === 'solid' && bg.color === c ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <Segmented
          size="sm"
          fit
          value={bg.kind}
          onChange={switchKind}
          options={(['solid', 'gradient', 'pattern', 'image', 'transparent'] as const).map((k) => ({ value: k, label: t(`bg.kind.${k}` as I18nKey) }))}
        />
        {bg.kind === 'gradient' && (
          <>
            <Field label={t('bg.gradientPresets')}>
              <div className="grid grid-cols-6 gap-1.5">
                {presets.map(({ p, i }) => (
                  <Thumb
                    key={i}
                    bg={p}
                    label={BG_PRESET_NAMES[i] ? tr(BG_PRESET_NAMES[i]) : `${t('bg.presets')} ${i + 1}`}
                    active={JSON.stringify(p) === JSON.stringify(bg)}
                    onClick={() => setBackground(p)}
                  />
                ))}
              </div>
            </Field>
            <Field label={t('bg.gradientColors')}>
              <GradientEditor stops={bg.stops} onChange={(stops) => setBackground({ ...bg, stops })} />
            </Field>
          </>
        )}
        {bg.kind === 'pattern' && <PatternPicker />}
        {bg.kind === 'image' && (
          <button
            type="button"
            onClick={chooseImage}
            className="group relative flex h-20 items-center justify-center overflow-hidden rounded-lg bg-surface-2 bg-cover bg-center text-[12px] text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:shadow-[0_0_0_1px_var(--line-strong)_inset]"
            style={{
              backgroundImage: imageAsset ? `url(${imageAsset.url})` : undefined,
            }}
          >
            <span className="flex items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1 text-white backdrop-blur">
              <ImageUp size={13} />
              {t('bg.image.choose')}
            </span>
          </button>
        )}
      </>
    );
  }

  // fine-tuning of the chosen kind
  return (
    <>
      {bg.kind === 'gradient' && (
        <>
          <Segmented
            size="sm"
            value={bg.type}
            onChange={(type) => setBackground({ ...bg, type })}
            options={[
              { value: 'linear', label: t('props.bg.linear') },
              { value: 'radial', label: t('props.bg.radial') },
              { value: 'conic', label: t('bg.conic') },
            ]}
          />
          {bg.type !== 'radial' && (
            <Field label={t('props.bg.angle')} value={`${Math.round(bg.angle)}°`}>
              <Slider label={t('props.bg.angle')} min={0} max={360} step={1} value={bg.angle} onChange={(angle) => setBackground({ ...bg, angle })} />
            </Field>
          )}
        </>
      )}
      {bg.kind === 'pattern' && (
        <>
          <Field label={t('bg.scale')} value={bg.scale.toFixed(2)}>
            <Slider label={t('bg.scale')} min={0.3} max={4} step={0.01} value={bg.scale} onChange={(scale) => setBackground({ ...bg, scale })} />
          </Field>
          <Field label={t('bg.grain')} value={`${Math.round(bg.grain * 100)} %`}>
            <Slider label={t('bg.grain')} value={bg.grain} onChange={(grain) => setBackground({ ...bg, grain })} />
          </Field>
          <Button size="sm" onClick={() => setBackground({ ...bg, seed: Math.round(Math.random() * 1000) })}>
            <Shuffle size={13} />
            {t('bg.shuffle')}
          </Button>
        </>
      )}
      {bg.kind === 'image' && (
        <>
          <Field label={t('bg.blur')} value={`${Math.round(bg.blur * 100)} %`}>
            <Slider label={t('bg.blur')} value={bg.blur} onChange={(blur) => setBackground({ ...bg, blur })} />
          </Field>
          <Field label={t('bg.dim')} value={`${Math.round(bg.dim * 100)} %`}>
            <Slider label={t('bg.dim')} value={bg.dim} onChange={(dim) => setBackground({ ...bg, dim })} />
          </Field>
        </>
      )}
    </>
  );
}

/** Which pattern, and its three colours. */
function PatternPicker() {
  const { t } = useT();
  const bg = useProject((s) => s.background);
  const setBackground = useProject((s) => s.setBackground);
  if (bg.kind !== 'pattern') return null;
  return (
    <>
      <Field label={t('bg.pattern')}>
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERN_IDS.map((id) => {
            const preview: Background = {
              ...bg,
              pattern: id,
              colors: PATTERN_DEFAULTS[id],
              scale: 1,
            };
            return (
              <div key={id} className="flex flex-col items-center gap-1">
                <Thumb
                  bg={preview}
                  label={t(`pattern.${id}` as I18nKey)}
                  active={bg.pattern === id}
                  className="w-full"
                  onClick={() =>
                    setBackground({
                      ...bg,
                      pattern: id,
                      colors: PATTERN_DEFAULTS[id],
                    })
                  }
                />
                <span className={cx('text-[10.5px]', bg.pattern === id ? 'text-fg' : 'text-fg-subtle')}>{t(`pattern.${id}` as I18nKey)}</span>
              </div>
            );
          })}
        </div>
      </Field>
      <Field label={t('bg.patternColors')}>
        <div className="flex gap-1.5">
          {bg.colors.map((c, i) => (
            <label key={i} className="relative size-8 cursor-pointer overflow-hidden rounded-lg shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: c }}>
              <input
                type="color"
                aria-label={`${t('bg.colors')} ${i + 1}`}
                value={c}
                onChange={(e) =>
                  setBackground({
                    ...bg,
                    colors: bg.colors.map((x, j) => (j === i ? e.target.value : x)) as [string, string, string],
                  })
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          ))}
        </div>
      </Field>
    </>
  );
}
