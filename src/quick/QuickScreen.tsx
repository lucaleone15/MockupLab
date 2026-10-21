import { useEffect, useRef, useState } from 'react';
import { Check, Download, ImagePlus, SlidersHorizontal } from 'lucide-react';
import { useT, type I18nKey, type I18nString } from '@/i18n';
import { RATIOS, SOCIAL, ratioValue } from '@/export/settings';
import { pickImages } from '@/lib/importImage';
import { navigate } from '@/shell/route';
import { useAssets } from '@/store/assets';
import { useProject, type RatioPreset } from '@/store/project';
import { Button, Chip, GroupTitle, Spinner, cx } from '@/ui/primitives';
import { SUPPORTS } from './detect';
import { QUICK_COLORS } from './templates';
import { labelOf, quick, useQuick, type QuickTile } from './store';
import { ModeRole } from '@/shell/ModeRole';

const FORMATS: { id: RatioPreset; label: string | I18nString }[] = [
  ...RATIOS.filter((r) => ['16:9', '4:3', '1:1', '4:5', '9:16'].includes(r.id)),
  ...SOCIAL.filter((s) => s.id === 'ig-post' || s.id === 'story').map((s) => ({ id: s.id, label: s.label })),
];

function Tile({ tile }: { tile: QuickTile }) {
  const { t } = useT();
  const url = useQuick((s) => s.thumbs[tile.id]);
  const selected = useQuick((s) => s.selected.includes(tile.id));
  const busy = useQuick((s) => s.busy === tile.id);
  const ratio = ratioValue(useProject((s) => s.export.ratio));
  const label = labelOf(tile);
  return (
    <div data-testid="quick-tile" className="group flex flex-col gap-1.5">
      <div className={cx('relative overflow-hidden rounded-[14px] bg-surface-2 transition-shadow', selected && 'shadow-[0_0_0_2.5px_var(--accent)]')} style={{ aspectRatio: String(ratio) }}>
        {url ? (
          <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover animate-[fade-in_250ms_ease-out]" draggable={false} />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-fg-subtle">
            <Spinner />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="primary" size="sm" disabled={!url || !!busy} onClick={() => void quick.download([tile.id])}>
            {busy ? <Spinner size={12} /> : <Download size={13} />}
            {t('quick.download')}
          </Button>
          <Button size="sm" className="bg-white text-[#1d1d1f] hover:bg-white/90" onClick={() => void quick.customize(tile.id, () => navigate('studio'))}>
            <SlidersHorizontal size={13} />
            {t('quick.customize')}
          </Button>
        </span>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t('quick.select', { name: label })}
          onClick={() => quick.toggle(tile.id)}
          className={cx(
            'absolute left-2.5 top-2.5 grid size-6 place-items-center rounded-full transition-[opacity,background-color]',
            selected ? 'bg-accent text-accent-fg opacity-100' : 'bg-black/40 text-white opacity-0 ring-1 ring-white/70 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Check size={13} strokeWidth={3} />
        </button>
      </div>
      <span className="truncate px-0.5 text-[12.5px] text-fg-muted">{label}</span>
    </div>
  );
}

/** The studio's colour: nine tints, or any colour. */
function ColorPicker() {
  const { t, tr } = useT();
  const color = useQuick((s) => s.color);
  const preset = QUICK_COLORS.some((c) => c.hex === color);
  // the picker fires while dragging: the photos are redone once the colour settles
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef(0);
  const pick = (hex: string) => {
    setPicked(hex);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPicked(null);
      quick.setColor(hex);
    }, 350);
  };
  const ring = 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--accent)]';
  return (
    <div className="flex flex-col gap-2.5">
      <GroupTitle>{t('quick.color')}</GroupTitle>
      <div role="radiogroup" aria-label={t('quick.color')} data-testid="quick-color" className="flex flex-wrap gap-2">
        {QUICK_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={c.hex === color}
            aria-label={tr(c.name)}
            title={tr(c.name)}
            onClick={() => quick.setColor(c.hex)}
            className={cx('size-7 rounded-full transition-shadow', c.hex === color ? ring : 'shadow-[0_0_0_1px_var(--line-strong)_inset] hover:shadow-[0_0_0_1px_var(--line-strong)_inset,0_0_0_3px_var(--line)]')}
            style={{ background: c.hex }}
          />
        ))}
        <label
          title={t('quick.colorOther')}
          className={cx('relative size-7 cursor-pointer overflow-hidden rounded-full', !preset ? ring : 'shadow-[0_0_0_1px_var(--line-strong)_inset]')}
          style={{ background: !preset ? (picked ?? color) : 'conic-gradient(#ff5f5f, #ffd25f, #6fe08a, #5fd4ff, #6f7bff, #e36fff, #ff5f5f)' }}
        >
          <input type="color" aria-label={t('quick.colorOther')} value={picked ?? color} onChange={(e) => pick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

/** The device the design is shown on: detected, and changed on demand. */
function DevicePicker() {
  const { t } = useT();
  const { support, confident, assetId, byHand } = useQuick();
  const [open, setOpen] = useState(false);
  const name = t(`support.${support}` as I18nKey);
  return (
    <div className="flex flex-col gap-2.5" data-testid="quick-device">
      <GroupTitle aside={!confident ? <span className="text-[12px] text-fg-muted">{t('quick.toConfirm')}</span> : undefined}>{t('quick.device')}</GroupTitle>
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="truncate">{assetId && !byHand ? t('quick.detected', { name }) : name}</span>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="shrink-0 rounded-md text-[12.5px] font-medium text-accent hover:underline">
          {t('quick.change')}
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 animate-[fade-in_150ms_ease-out]" data-testid="quick-support">
          {SUPPORTS.map((sp) => (
            <Chip key={sp} active={sp === support} onClick={() => quick.setSupport(sp)}>
              {t(`support.${sp}` as I18nKey)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickScreen() {
  const { t, tr } = useT();
  const s = useQuick();
  const asset = useAssets((a) => (s.assetId ? a.assets[s.assetId] : undefined));
  const ratio = useProject((p) => p.export.ratio);
  useEffect(() => {
    quick.start();
    return () => quick.stop();
  }, []);
  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2" data-testid="quick-screen">
      <aside className="glass flex w-[280px] shrink-0 flex-col gap-6 overflow-y-auto rounded-[14px] p-5">
        <div className="flex flex-col gap-3">
          {!asset && <ModeRole screen="quick" className="text-fg" />}
          <GroupTitle>{t('quick.design')}</GroupTitle>
          <button
            type="button"
            data-testid="quick-pick"
            onClick={() => pickImages((files) => files[0] && void quick.setImage(files[0]))}
            className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[12px] border-[1.5px] border-dashed border-line-strong bg-surface-2 text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            {asset ? (
              <img src={asset.url} alt={asset.name} className="h-full w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-center text-[13px]">
                <ImagePlus size={22} className="text-accent" />
                {t('quick.pick')}
              </span>
            )}
          </button>
          {asset ? <span className="truncate text-[12.5px] text-fg-muted">{asset.name}</span> : <span className="text-[12.5px] leading-snug text-fg-muted">{t('quick.sampleNote')}</span>}
        </div>
        <ColorPicker />
        <DevicePicker />
        <div className="flex flex-col gap-2.5">
          <GroupTitle>{t('quick.format')}</GroupTitle>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((r) => (
              <Chip
                key={r.id}
                active={r.id === ratio}
                onClick={() => {
                  useProject.getState().setExport({ ratio: r.id });
                  quick.refresh();
                }}
              >
                {typeof r.label === 'string' ? r.label : tr(r.label)}
              </Chip>
            ))}
          </div>
        </div>
      </aside>
      <main className="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px]">
        <div className="px-5 pb-3 pt-5">
          <h1 className="font-display text-[22px] font-bold">{t('screen.quick')}</h1>
        </div>
        <div className="scroll-thin grid flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-4 gap-y-5 overflow-y-auto overscroll-contain px-5 pb-6">
          {s.tiles.map((tile) => (
            <Tile key={tile.id} tile={tile} />
          ))}
        </div>
        {s.selected.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-[13px] text-fg-muted">{t('quick.selected', { n: s.selected.length })}</span>
            <Button variant="primary" disabled={!!s.busy} onClick={() => void quick.download(s.selected)}>
              <Download size={15} />
              {t('quick.downloadSelection')}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
