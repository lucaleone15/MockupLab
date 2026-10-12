import { Download, ImageOff, ImageUp } from 'lucide-react';
import { useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { FORMATS, RATIOS, RESOLUTIONS, outputSize } from '@/export/settings';
import { getModel } from '@/models/registry';
import type { ParamDef, ParamValue } from '@/models/types';
import { pickImages } from '@/lib/importImage';
import { useAssets } from '@/store/assets';
import { selectSelectedItem, useProject } from '@/store/project';
import { ModelSwitcher } from './ModelSwitcher';
import { photoOutputSize } from '@/photo/exportPhoto';
import { useUi } from '@/store/ui';
import { Button, Field, Section, Segmented, Slider, Switch, Tooltip, cx } from '@/ui/primitives';

function SlotCard({ itemId, slotId, label, nativeSize, active, onActivate }: { itemId: string; slotId: string; label?: string; nativeSize?: [number, number]; active: boolean; onActivate: () => void }) {
  const { t } = useT();
  const binding = useProject((s) => s.items.find((it) => it.id === itemId)?.surfaces[slotId]);
  const setSurface = useProject((s) => s.setSurface);
  const asset = useAssets((s) => (binding?.assetId ? s.assets[binding.assetId] : undefined));
  const choose = () => {
    onActivate();
    pickImages();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => e.key === 'Enter' && onActivate()}
      className={cx(
        'flex cursor-pointer gap-3 rounded-lg p-1.5 transition-shadow',
        label && (active ? 'shadow-[0_0_0_1.5px_var(--accent)_inset]' : 'hover:shadow-[0_0_0_1px_var(--line-strong)_inset]'),
      )}
    >
      <button
        type="button"
        aria-label={t('props.replace')}
        onClick={(e) => {
          e.stopPropagation();
          choose();
        }}
        className={cx(
          'grid shrink-0 place-items-center self-start overflow-hidden rounded-md bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset]',
          asset && asset.width > asset.height ? 'h-[46px] w-[72px]' : 'h-[72px] w-[46px]',
        )}
      >
        {asset ? <img src={asset.url} alt="" className="h-full w-full object-cover object-top" /> : <ImageOff size={16} className="text-fg-subtle" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
        <div className="min-w-0">
          {label && <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">{label}</div>}
          <div className="truncate text-[12.5px] font-medium">{asset?.name ?? t('props.noImage')}</div>
          <div className="font-mono text-[11px] tabular-nums text-fg-subtle">
            {asset ? `${asset.width} × ${asset.height}` : nativeSize ? `${nativeSize[0]} × ${nativeSize[1]}` : ''}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              choose();
            }}
          >
            <ImageUp size={13} />
            {t('props.replace')}
          </Button>
          {asset && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setSurface(itemId, slotId, { assetId: null });
              }}
            >
              {t('props.remove')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImageSection() {
  const { t, tr } = useT();
  const item = useProject(selectSelectedItem);
  const setSurface = useProject((s) => s.setSurface);
  const activeSlot = useUi((s) => s.activeSlot);
  const setActiveSlot = useUi((s) => s.setActiveSlot);
  if (!item) return null;
  const model = getModel(item.modelId);
  const slots = model.surfaces;
  // brand objects draw themselves from the brand kit
  if (!slots.length) return null;
  const multi = slots.length > 1;
  const current = slots.find((sl) => sl.id === activeSlot) ?? slots[0];
  const binding = item.surfaces[current.id];
  const asset = binding?.assetId ? useAssets.getState().assets[binding.assetId] : undefined;

  return (
    <Section title={multi ? t('settings.designs') : t('settings.design')}>
      <div className="-mx-1.5 flex flex-col gap-1">
        {slots.map((sl) => (
          <SlotCard
            key={sl.id}
            itemId={item.id}
            slotId={sl.id}
            label={multi ? tr(sl.label) : undefined}
            nativeSize={sl.nativeSize}
            active={multi && sl.id === current.id}
            onActivate={() => setActiveSlot(sl.id)}
          />
        ))}
      </div>
      {multi && <p className="text-[11px] leading-snug text-fg-subtle">{t('props.slotHint')}</p>}
      {binding && (
        <>
          <Field label={multi ? `${t('props.fit')} · ${tr(current.label)}` : t('props.fit')}>
            <Segmented
              value={binding.fit}
              onChange={(fit) => setSurface(item.id, current.id, { fit })}
              options={[
                { value: 'cover', label: t('props.fit.cover') },
                { value: 'contain', label: t('props.fit.contain') },
              ]}
            />
          </Field>
          {binding.fit === 'cover' && asset && (
            <Field label={t('props.align')} value={`${Math.round(binding.align * 100)} %`}>
              <Slider label={t('props.align')} value={binding.align} onChange={(align) => setSurface(item.id, current.id, { align })} />
            </Field>
          )}
        </>
      )}
    </Section>
  );
}

/** Controls generated from the model's parameter definitions. */
function ParamControl({ def, value, onChange }: { def: ParamDef; value: ParamValue | undefined; onChange: (v: ParamValue) => void }) {
  const { tr } = useT();
  switch (def.kind) {
    case 'slider': {
      const v = typeof value === 'number' ? value : def.default;
      return (
        <Field label={tr(def.label)} value={`${Math.round(v)}${def.unit ?? ''}`}>
          <Slider label={tr(def.label)} min={def.min} max={def.max} step={def.step} value={v} onChange={onChange} />
        </Field>
      );
    }
    case 'choice':
      return (
        <Field label={tr(def.label)}>
          <Segmented
            size={def.options.length > 2 ? 'sm' : 'md'}
            value={String(value ?? def.default)}
            onChange={onChange}
            options={def.options.map((o) => ({ value: o.value, label: tr(o.label) }))}
          />
        </Field>
      );
    case 'toggle':
      return (
        <label className="flex cursor-pointer items-center justify-between text-[12px]">
          <span className="text-fg-muted">{tr(def.label)}</span>
          <Switch checked={value === true} onChange={onChange} label={tr(def.label)} />
        </label>
      );
    case 'swatch':
      return (
        <Field label={tr(def.label)} value={<span className="font-sans text-[11.5px]">{tr(def.options.find((o) => o.value === value)?.label ?? def.options[0].label)}</span>}>
          <div className="flex flex-wrap gap-1.5">
            {def.options.map((o) => (
              <Tooltip key={o.value} label={tr(o.label)}>
                <button
                  type="button"
                  aria-label={tr(o.label)}
                  onClick={() => onChange(o.value)}
                  className={cx(
                    'size-7 rounded-full transition-[transform,box-shadow] duration-150 hover:scale-110',
                    (value ?? def.default) === o.value ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]',
                  )}
                  style={{ background: o.value }}
                />
              </Tooltip>
            ))}
          </div>
        </Field>
      );
    case 'text':
      return (
        <Field label={tr(def.label)}>
          <input
            type="text"
            value={String(value ?? def.default)}
            placeholder={def.placeholder}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 rounded-lg bg-surface-2 px-2.5 font-mono text-[12px] text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none placeholder:text-fg-subtle focus:shadow-[0_0_0_1px_var(--accent)_inset]"
          />
        </Field>
      );
  }
}

export function DeviceSection() {
  const { t, tr } = useT();
  const item = useProject(selectSelectedItem);
  const updateItem = useProject((s) => s.updateItem);
  const setParam = useProject((s) => s.setParam);
  const setPose = useProject((s) => s.setPose);
  if (!item) return null;
  const model = getModel(item.modelId);
  const finish = model.finishes.find((f) => f.id === item.finishId) ?? model.finishes[0];

  return (
    <Section title={tr(model.name)}>
      <ModelSwitcher />
      {model.anchor !== 'bottom' && (
        <Field label={t('props.pose')}>
          <Segmented
            value={item.pose}
            onChange={(pose) => setPose(pose, item.id)}
            options={[
              { value: 'standing', label: t('props.pose.standing') },
              { value: 'flat', label: t('props.pose.flat') },
            ]}
          />
        </Field>
      )}
      {model.params?.map((def) => (
        <ParamControl key={def.id} def={def} value={item.params[def.id]} onChange={(v) => setParam(item.id, def.id, v)} />
      ))}
      {model.finishes.length > 1 && (
      <Field label={t('props.finish')} value={<span className="font-sans text-[11.5px]">{tr(finish.name)}</span>}>
        <div className="flex gap-2">
          {model.finishes.map((f) => (
            <Tooltip key={f.id} label={tr(f.name)}>
              <button
                type="button"
                aria-label={tr(f.name)}
                onClick={() => updateItem(item.id, { finishId: f.id })}
                className={cx(
                  'size-7 rounded-full transition-[transform,box-shadow] duration-150 hover:scale-110 active:scale-95',
                  f.id === finish.id
                    ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]'
                    : 'shadow-[0_0_0_1px_var(--line-strong)_inset]',
                )}
                style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${f.swatch}, white 35%), ${f.swatch} 55%, color-mix(in srgb, ${f.swatch}, black 25%))` }}
              />
            </Tooltip>
          ))}
        </div>
      </Field>
      )}
      {model.surfaceKind !== 'print' && (
      <>
      <Field label={t('props.brightness')} value={`${Math.round(item.screen.brightness * 100)} %`}>
        <Slider
          label={t('props.brightness')}
          min={0.5}
          max={1.3}
          value={item.screen.brightness}
          onChange={(brightness) => updateItem(item.id, (it) => ({ screen: { ...it.screen, brightness } }))}
        />
      </Field>
      <Field label={t('props.reflection')} value={`${Math.round(item.screen.reflection * 100)} %`}>
        <Slider
          label={t('props.reflection')}
          value={item.screen.reflection}
          onChange={(reflection) => updateItem(item.id, (it) => ({ screen: { ...it.screen, reflection } }))}
        />
      </Field>
      </>
      )}
    </Section>
  );
}

/** The ratio of the output (images and videos). */
export function RatioPicker() {
  const { t } = useT();
  const settings = useProject((s) => s.export);
  const setExport = useProject((s) => s.setExport);
  return (
    <Field label={t('props.ratio')}>
        <div className="grid grid-cols-4 gap-1.5">
          {RATIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              title={r.hint}
              onClick={() => setExport({ ratio: r.id })}
              className={cx(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-[background-color,color,box-shadow] duration-150',
                settings.ratio === r.id
                  ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--line-strong)_inset]'
                  : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
              )}
            >
              <span
                className={cx('rounded-[2px] border-[1.5px]', settings.ratio === r.id ? 'border-accent' : 'border-current opacity-70')}
                style={r.value >= 1 ? { width: 20, height: 20 / r.value } : { width: 18 * r.value, height: 18 }}
              />
              {r.label}
            </button>
          ))}
        </div>
      </Field>
  );
}

/** Image export settings (format, quality, size); the ratio is set in the floating bar. */
export function ExportForm() {
  const { t } = useT();
  const settings = useProject((s) => s.export);
  const setExport = useProject((s) => s.setExport);
  const transparent = useProject((s) => s.background.kind === 'transparent');
  const dof = useProject((s) => s.camera.dof);
  const exporting = useUi((s) => s.exporting);
  const photoMode = useProject((s) => s.mode === 'photo');
  useProject((s) => s.photo.assetId);
  const { width, height } = photoMode ? photoOutputSize() : outputSize(settings);

  return (
    <div className="flex flex-col gap-3.5">
      <Field label={t('props.format')}>
        <Segmented value={settings.format} onChange={(format) => setExport({ format })} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
      </Field>
      {settings.format === 'jpeg' && transparent && <p className="text-[11.5px] leading-snug text-fg-subtle">{t('props.transparentJpg')}</p>}
      {settings.format !== 'png' && (
        <Field label={t('props.quality')} value={`${Math.round(settings.quality * 100)}`}>
          <Slider label={t('props.quality')} min={0.6} max={1} value={settings.quality} onChange={(quality) => setExport({ quality })} />
        </Field>
      )}
      {photoMode ? (
        <p className="text-[11.5px] leading-snug text-fg-subtle">{t('photo.export.native')}</p>
      ) : (
      <>
      <Field label={t('props.size')}>
        <Segmented value={settings.resolution} onChange={(resolution) => setExport({ resolution })} options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))} />
      </Field>
      </>
      )}
      <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[12px] shadow-[0_0_0_1px_var(--line)_inset]">
        <span className="text-fg-muted">{t('props.output')}</span>
        <span className="font-mono tabular-nums">
          {width} × {height}
          <span className="text-fg-subtle"> · {FORMATS.find((f) => f.id === settings.format)?.label}</span>
        </span>
      </div>
      {dof && <p className="text-[11.5px] leading-snug text-fg-subtle">{t('export.dofNote')}</p>}
      <Button variant="primary" size="lg" onClick={exportImage} disabled={!!exporting || (photoMode && !width)}>
        <Download size={16} strokeWidth={2.2} />
        {t('export.cta')}
      </Button>
    </div>
  );
}

