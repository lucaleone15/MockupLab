import { useEffect, useState } from 'react';
import { Eye, EyeOff, ImageOff, ImageUp, Layers, Plus, RotateCcw, Save, Trash2, Wand2 } from 'lucide-react';
import { batch } from '@/variants/batch';
import { useT } from '@/i18n';
import { useAssets } from '@/store/assets';
import { useProject, zoneDefaults, type PhotoZone } from '@/store/project';
import { useUi } from '@/store/ui';
import { Advanced, Button, Field, IconButton, Section, Segmented, Slider, cx } from '@/ui/primitives';
import { aspectOf, photoSize } from './editing';
import type { Quad } from './homography';
import { pickPhoto, pickZoneImage } from './importPhoto';
import { saveCurrentAsTemplate } from './templates';
import { statsFor } from './source';
import { blankness } from './stats';

/** How blank the photo's surface under the zone is (0..1), null while measuring. */
function useBlankness(zone: PhotoZone) {
  const photoId = useProject((s) => s.photo.assetId);
  const [value, setValue] = useState<number | null>(null);
  const key = zone.corners.flat().join(',');
  useEffect(() => {
    let alive = true;
    if (photoId) void statsFor(photoId, zone).then((st) => alive && setValue(blankness(st, zone.kind)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId, key, zone.kind]);
  return value;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function PhotoSection() {
  const { t } = useT();
  const assetId = useProject((s) => s.photo.assetId);
  const hasZones = useProject((s) => s.photo.zones.length > 0);
  const asset = useAssets((s) => (assetId ? s.assets[assetId] : undefined));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  if (!asset) return null;
  return (
    <Section title={t('photo.photo')}>
      <div className="flex gap-3">
        <img src={asset.url} alt="" className="h-[52px] w-[78px] shrink-0 rounded-md object-cover shadow-[0_0_0_1px_var(--line)_inset]" />
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="truncate text-[12.5px] font-medium">{asset.name.replace(/^template-/, '')}</div>
          <div className="font-mono text-[11px] tabular-nums text-fg-subtle">
            {asset.width} × {asset.height}
          </div>
          <div>
            <Button size="sm" onClick={pickPhoto}>
              <ImageUp size={13} />
              {t('photo.change')}
            </Button>
          </div>
        </div>
      </div>
      {naming ? (
        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            await saveCurrentAsTemplate(name);
            setNaming(false);
            setName('');
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
            placeholder={t('photo.template.name')}
            className="h-8 min-w-0 flex-1 rounded-lg bg-surface-2 px-2.5 text-[12.5px] text-fg shadow-[0_0_0_1px_var(--accent)_inset] outline-none placeholder:text-fg-subtle"
          />
          <Button type="submit" variant="primary">
            {t('photo.template.save')}
          </Button>
        </form>
      ) : (
        <Button disabled={!hasZones} onClick={() => setNaming(true)}>
          <Save size={14} />
          {t('photo.template.saveAs')}
        </Button>
      )}
    </Section>
  );
}

export function ZonesSection() {
  const { t } = useT();
  const zones = useProject((s) => s.photo.zones);
  const selectedId = useProject((s) => s.photo.selectedZoneId);
  const tool = useUi((s) => s.photoTool);
  const { selectZone, updateZone, removeZone } = useProject.getState();
  return (
    <Section title={t('photo.zones')} aside={<span className="font-mono text-[11px] text-fg-subtle">{zones.length}</span>}>
      {zones.length > 0 && (
        <div className="-mx-1 flex flex-col gap-0.5">
          {zones.map((z) => (
            <div
              key={z.id}
              role="button"
              tabIndex={0}
              onClick={() => selectZone(z.id)}
              onKeyDown={(e) => e.key === 'Enter' && selectZone(z.id)}
              className={cx(
                'group flex h-9 cursor-pointer items-center gap-2 rounded-lg pl-2.5 pr-1 text-[12.5px] transition-colors',
                z.id === selectedId ? 'bg-surface-3 text-fg shadow-[0_0_0_1px_var(--line-strong)_inset]' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <ZoneThumb zone={z} />
              <input
                value={z.name}
                onChange={(e) => updateZone(z.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => selectZone(z.id)}
                aria-label={t('photo.zone.name')}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
              <IconButton label={z.visible ? t('comp.hide') : t('comp.show')} className="size-7" onClick={(e) => (e.stopPropagation(), updateZone(z.id, { visible: !z.visible }))}>
                {z.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </IconButton>
              <IconButton label={t('photo.zone.delete')} className="size-7" onClick={(e) => (e.stopPropagation(), removeZone(z.id))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <Button variant={zones.length ? 'secondary' : 'primary'} onClick={() => useUi.getState().setPhotoTool(tool === 'place' ? 'select' : 'place')}>
        <Plus size={14} />
        {tool === 'place' ? t('cancel') : t('photo.zone.add')}
      </Button>
      <p className="flex gap-1.5 text-[11px] leading-snug text-fg-subtle">
        <Wand2 size={13} className="mt-px shrink-0 text-accent" />
        {t('photo.zone.addHint')}
      </p>
    </Section>
  );
}

function ZoneThumb({ zone }: { zone: PhotoZone }) {
  const asset = useAssets((s) => (zone.surface.assetId ? s.assets[zone.surface.assetId] : undefined));
  return (
    <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded bg-surface-4 shadow-[0_0_0_1px_var(--line)_inset]">
      {asset ? <img src={asset.url} alt="" className="h-full w-full object-cover object-top" /> : <ImageOff size={11} className="text-fg-subtle" />}
    </span>
  );
}

export function DesignSection({ zone }: { zone: PhotoZone }) {
  const { t } = useT();
  const asset = useAssets((s) => (zone.surface.assetId ? s.assets[zone.surface.assetId] : undefined));
  const setZoneSurface = useProject((s) => s.setZoneSurface);
  return (
    <Section title={t('photo.design')}>
      <div className="flex gap-3">
        <button
          type="button"
          aria-label={t('props.replace')}
          onClick={() => pickZoneImage(zone.id)}
          className={cx(
            'grid shrink-0 place-items-center self-start overflow-hidden rounded-md bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset]',
            zone.aspect >= 1 ? 'h-[46px] w-[72px]' : 'h-[72px] w-[46px]',
          )}
        >
          {asset ? <img src={asset.url} alt="" className="h-full w-full object-cover object-top" /> : <ImageOff size={16} className="text-fg-subtle" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium">{asset?.name ?? t('props.noImage')}</div>
            <div className="font-mono text-[11px] tabular-nums text-fg-subtle">{asset ? `${asset.width} × ${asset.height}` : t('photo.design.drop')}</div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => pickZoneImage(zone.id)}>
              <ImageUp size={13} />
              {t('props.replace')}
            </Button>
            {asset && (
              <Button size="sm" variant="ghost" onClick={() => setZoneSurface(zone.id, { assetId: null })}>
                {t('props.remove')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Field label={t('props.fit')}>
        <Segmented
          value={zone.surface.fit}
          onChange={(fit) => setZoneSurface(zone.id, { fit })}
          options={[
            { value: 'cover', label: t('props.fit.cover') },
            { value: 'contain', label: t('props.fit.contain') },
          ]}
        />
      </Field>
      {zone.surface.fit === 'cover' && asset && asset.width / asset.height < zone.aspect && (
        <Field label={t('props.align')} value={pct(zone.surface.align)}>
          <Slider label={t('props.align')} value={zone.surface.align} onChange={(align) => setZoneSurface(zone.id, { align })} />
        </Field>
      )}
      <Button size="sm" className="self-start" onClick={() => batch.open()} data-testid="open-batch">
        <Layers size={13} />
        {t('batch.apply')}
      </Button>
    </Section>
  );
}

export function BlendSection({ zone }: { zone: PhotoZone }) {
  const { t } = useT();
  const updateZone = useProject((s) => s.updateZone);
  const blank = useBlankness(zone);
  const set = (patch: Partial<PhotoZone>) => updateZone(zone.id, patch);
  const slider = (key: 'reflection' | 'shading' | 'match' | 'noise' | 'occlusion', label: string) => (
    <Field label={label} value={pct(zone[key])}>
      <Slider label={label} value={zone[key]} onChange={(v) => set({ [key]: v })} />
    </Field>
  );
  return (
    <Section title={t('photo.blend')}>
      <Field label={t('photo.kind')}>
        <Segmented
          value={zone.kind}
          onChange={(kind) => set({ kind, ...zoneDefaults(kind), radius: zone.radius, occlusion: zone.occlusion, original: zone.original, bleed: zone.bleed })}
          options={[
            { value: 'screen', label: t('photo.kind.screen') },
            { value: 'print', label: t('photo.kind.print') },
          ]}
        />
      </Field>
      <Field label={t('photo.original')}>
        <Segmented
          value={zone.original}
          onChange={(original) => set({ original })}
          options={[
            { value: 'auto', label: t('photo.original.auto') },
            { value: 'hide', label: t('photo.original.hide') },
            { value: 'keep', label: t('photo.original.keep') },
          ]}
        />
      </Field>
      <p className="-mt-2 text-[11px] leading-snug text-fg-subtle">
        {zone.original === 'auto'
          ? blank === null
            ? '…'
            : blank > 0.5
              ? t('photo.original.autoBlank')
              : t('photo.original.autoContent')
          : zone.original === 'hide'
            ? t('photo.original.hideHint')
            : t('photo.original.keepHint')}
      </p>
      {slider('reflection', t('photo.reflection'))}
      {slider('shading', t('photo.shading'))}
      <Field label={t('photo.brightness')} value={pct(zone.brightness)}>
        <Slider label={t('photo.brightness')} min={0.5} max={1.5} value={zone.brightness} onChange={(brightness) => set({ brightness })} />
      </Field>
      <Field label={t('photo.occlusion')} value={zone.occlusion === 0 ? t('photo.off') : pct(zone.occlusion)}>
        <Slider label={t('photo.occlusion')} value={zone.occlusion} onChange={(occlusion) => set({ occlusion: occlusion < 0.03 ? 0 : occlusion })} />
      </Field>
      <p className="-mt-2 text-[11px] leading-snug text-fg-subtle">{t('photo.occlusion.hint')}</p>
      <Advanced more={t('ui.more')} less={t('ui.less')}>
        <Field label={t('photo.sharpness')} value={zone.sharpness === 0 ? '0' : `${zone.sharpness > 0 ? '+' : ''}${Math.round(zone.sharpness * 100)}`}>
          <Slider label={t('photo.sharpness')} min={-1} max={1} value={zone.sharpness} onChange={(sharpness) => set({ sharpness: Math.abs(sharpness) < 0.04 ? 0 : sharpness })} />
        </Field>
        {slider('noise', t('photo.noise'))}
        {slider('match', t('photo.match'))}
        <Field label={t('photo.feather')} value={`${zone.feather.toFixed(1)} px`}>
          <Slider label={t('photo.feather')} min={0} max={6} step={0.1} value={zone.feather} onChange={(feather) => set({ feather })} />
        </Field>
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => set({ ...zoneDefaults(zone.kind), radius: zone.radius, occlusion: zone.occlusion, bleed: zone.bleed })}
        >
          <RotateCcw size={13} />
          {t('photo.blend.reset')}
        </Button>
      </Advanced>
    </Section>
  );
}

const RATIOS: { label: string; value: number }[] = [
  { label: '16:10', value: 16 / 10 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: 'A4', value: 1 / Math.SQRT2 },
  { label: '9:16', value: 9 / 16 },
  { label: '9:19.5', value: 9 / 19.5 },
];

function CornerInput({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="flex h-7 items-center gap-1 rounded-md bg-surface-2 px-2 shadow-[0_0_0_1px_var(--line)_inset] focus-within:shadow-[0_0_0_1px_var(--accent)_inset]">
      <span className="text-[10.5px] text-fg-subtle">{label}</span>
      <input
        type="number"
        value={Math.round(value * max * 10) / 10}
        step={1}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v / max);
        }}
        className="w-full min-w-0 bg-transparent text-right font-mono text-[11.5px] tabular-nums text-fg outline-none"
      />
    </label>
  );
}

export function GeometrySection({ zone }: { zone: PhotoZone }) {
  const { t } = useT();
  const updateZone = useProject((s) => s.updateZone);
  const activeCorner = useUi((s) => s.activeCorner);
  const { w, h } = photoSize();
  const estimate = aspectOf(zone.corners);
  const names = [t('photo.corner.tl'), t('photo.corner.tr'), t('photo.corner.br'), t('photo.corner.bl')];
  const setCorner = (i: number, axis: 0 | 1, v: number) => {
    const corners = zone.corners.map((c, j) => (j === i ? (axis === 0 ? [v, c[1]] : [c[0], v]) : c)) as Quad;
    updateZone(zone.id, { corners, ...(zone.aspectAuto && { aspect: aspectOf(corners) }) });
  };
  return (
    <Section title={t('photo.geometry')} defaultOpen={false}>
      <Field label={t('photo.ratio')} value={`${zone.aspect.toFixed(3)}${zone.aspectAuto ? ' · auto' : ''}`}>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => updateZone(zone.id, { aspect: estimate, aspectAuto: true })}
            className={cx(
              'h-7 rounded-md text-[11px] font-medium transition-colors',
              zone.aspectAuto ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--line-strong)_inset]' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
            )}
          >
            Auto
          </button>
          {RATIOS.map((r) => {
            const on = !zone.aspectAuto && Math.abs(zone.aspect - r.value) < 0.005;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => updateZone(zone.id, { aspect: r.value, aspectAuto: false })}
                className={cx(
                  'h-7 rounded-md text-[11px] font-medium transition-colors',
                  on ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--line-strong)_inset]' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-snug text-fg-subtle">{t('photo.ratio.hint', { r: estimate.toFixed(2) })}</p>
      </Field>
      <Field label={t('photo.bleed')} value={`${zone.bleed.toFixed(1)} px`}>
        <Slider label={t('photo.bleed')} min={0} max={8} step={0.5} value={zone.bleed} onChange={(bleed) => updateZone(zone.id, { bleed })} />
      </Field>
      <Field label={t('photo.radius')} value={pct(zone.radius)}>
        <Slider label={t('photo.radius')} max={0.25} step={0.002} value={zone.radius} onChange={(radius) => updateZone(zone.id, { radius })} />
      </Field>
      <Field label={t('photo.corners')}>
        <div className="flex flex-col gap-1">
          {zone.corners.map((c, i) => (
            <div key={i} className="grid grid-cols-[64px_1fr_1fr] items-center gap-1">
              <button
                type="button"
                onClick={() => useUi.getState().setActiveCorner(activeCorner === i ? null : i)}
                className={cx('truncate text-left text-[11px]', activeCorner === i ? 'font-medium text-accent' : 'text-fg-muted hover:text-fg')}
              >
                {names[i]}
              </button>
              <CornerInput label="x" value={c[0]} max={w} onChange={(v) => setCorner(i, 0, v)} />
              <CornerInput label="y" value={c[1]} max={h} onChange={(v) => setCorner(i, 1, v)} />
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-fg-subtle">{t('photo.corners.hint')}</p>
      </Field>
    </Section>
  );
}
