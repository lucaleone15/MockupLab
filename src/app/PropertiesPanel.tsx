import { Download, ImageOff, ImageUp } from 'lucide-react';
import { useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { FORMATS, RATIOS, RESOLUTIONS, outputSize } from '@/export/settings';
import { getModel } from '@/models/registry';
import type { ParamDef, ParamValue } from '@/models/types';
import { pickImages } from '@/lib/importImage';
import { useState } from 'react';
import { useAssets } from '@/store/assets';
import { selectSelectedItem, useProject } from '@/store/project';
import { CompositionSection } from './panels/CompositionSection';
import { ScenePanel } from './panels/ScenePanel';
import { TextPanel } from './panels/TextPanel';
import { useUi } from '@/store/ui';
import { Button, Field, Section, Segmented, Slider, Switch, Tooltip, cx } from '@/ui/primitives';

function ImageSection() {
  const { t } = useT();
  const item = useProject(selectSelectedItem);
  const setSurface = useProject((s) => s.setSurface);
  const binding = item?.surfaces.screen;
  const asset = useAssets((s) => (binding?.assetId ? s.assets[binding.assetId] : undefined));
  if (!item || !binding) return null;
  const model = getModel(item.modelId);
  const slot = model.surfaces.find((s) => s.id === 'screen');

  return (
    <Section title={t('props.image')}>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={pickImages}
          className={cx(
            'group relative grid shrink-0 place-items-center self-start overflow-hidden rounded-lg bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset] transition-shadow hover:shadow-[0_0_0_1px_var(--line-strong)_inset]',
            asset && asset.width > asset.height ? 'h-[58px] w-[92px]' : 'h-[92px] w-[58px]',
          )}
        >
          {asset ? (
            <img src={asset.url} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <ImageOff size={18} className="text-fg-subtle" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium">{asset?.name ?? t('props.noImage')}</div>
            <div className="font-mono text-[11px] tabular-nums text-fg-subtle">
              {asset ? `${asset.width} × ${asset.height}` : slot?.nativeSize ? `${slot.nativeSize[0]} × ${slot.nativeSize[1]}` : ''}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={pickImages}>
              <ImageUp size={13} />
              {t('props.replace')}
            </Button>
            {asset && (
              <Button size="sm" variant="ghost" onClick={() => setSurface(item.id, 'screen', { assetId: null })}>
                {t('props.remove')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Field label={t('props.fit')}>
        <Segmented
          value={binding.fit}
          onChange={(fit) => setSurface(item.id, 'screen', { fit })}
          options={[
            { value: 'cover', label: t('props.fit.cover') },
            { value: 'contain', label: t('props.fit.contain') },
          ]}
        />
      </Field>
      {binding.fit === 'cover' && asset && (
        <Field label={t('props.align')} value={`${Math.round(binding.align * 100)} %`}>
          <Slider label={t('props.align')} value={binding.align} onChange={(align) => setSurface(item.id, 'screen', { align })} />
        </Field>
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

function DeviceSection() {
  const { t, tr } = useT();
  const item = useProject(selectSelectedItem);
  const updateItem = useProject((s) => s.updateItem);
  const setParam = useProject((s) => s.setParam);
  const setPose = useProject((s) => s.setPose);
  if (!item) return null;
  const model = getModel(item.modelId);
  const finish = model.finishes.find((f) => f.id === item.finishId) ?? model.finishes[0];

  return (
    <Section title={t('props.device')} aside={<span className="text-[12px] text-fg-subtle">{tr(model.name)}</span>}>
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
    </Section>
  );
}

function ExportSection() {
  const { t } = useT();
  const settings = useProject((s) => s.export);
  const setExport = useProject((s) => s.setExport);
  const transparent = useProject((s) => s.background.kind === 'transparent');
  const dof = useProject((s) => s.camera.dof);
  const exporting = useUi((s) => s.exporting);
  const { width, height } = outputSize(settings);

  return (
    <Section title={t('props.export')}>
      <Field label={t('props.format')}>
        <Segmented value={settings.format} onChange={(format) => setExport({ format })} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
      </Field>
      {settings.format === 'jpeg' && transparent && <p className="text-[11.5px] leading-snug text-fg-subtle">{t('props.transparentJpg')}</p>}
      {settings.format !== 'png' && (
        <Field label={t('props.quality')} value={`${Math.round(settings.quality * 100)}`}>
          <Slider label={t('props.quality')} min={0.6} max={1} value={settings.quality} onChange={(quality) => setExport({ quality })} />
        </Field>
      )}
      <Field label={t('props.size')}>
        <Segmented value={settings.resolution} onChange={(resolution) => setExport({ resolution })} options={RESOLUTIONS.map((r) => ({ value: r.id, label: r.label }))} />
      </Field>
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
      <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[12px] shadow-[0_0_0_1px_var(--line)_inset]">
        <span className="text-fg-muted">{t('props.output')}</span>
        <span className="font-mono tabular-nums">
          {width} × {height}
          <span className="text-fg-subtle"> · {FORMATS.find((f) => f.id === settings.format)?.label}</span>
        </span>
      </div>
      {dof && <p className="text-[11.5px] leading-snug text-fg-subtle">{t('export.dofNote')}</p>}
      <Button variant="primary" size="lg" onClick={exportImage} disabled={!!exporting}>
        <Download size={16} strokeWidth={2.2} />
        {t('export.cta')}
      </Button>
    </Section>
  );
}

type Tab = 'device' | 'scene' | 'text' | 'export';

export function PropertiesPanel() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const v = localStorage.getItem('mockuplab:tab');
      return v === 'scene' || v === 'export' || v === 'text' ? v : 'device';
    } catch {
      return 'device';
    }
  });
  const choose = (v: Tab) => {
    setTab(v);
    try {
      localStorage.setItem('mockuplab:tab', v);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-surface">
      <div className="shrink-0 border-b border-line p-2">
        <Segmented
          value={tab}
          onChange={choose}
          options={[
            { value: 'device', label: t('tab.device') },
            { value: 'scene', label: t('tab.scene') },
            { value: 'text', label: t('tab.text') },
            { value: 'export', label: t('tab.export') },
          ]}
        />
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto" key={tab}>
        {tab === 'device' && (
          <>
            <CompositionSection />
            <ImageSection />
            <DeviceSection />
          </>
        )}
        {tab === 'scene' && <ScenePanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'export' && <ExportSection />}
      </div>
    </aside>
  );
}
