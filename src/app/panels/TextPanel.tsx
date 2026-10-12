import { AlignCenter, AlignLeft, AlignRight, Eye, EyeOff, FileType, Image as ImageIcon, LayoutPanelLeft, Palette, Plus, Sparkles, Trash2, Type, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { useT, type I18nKey } from '@/i18n';
import { applyBrandArt, paletteRoles } from '@/lib/brandArt';
import { BUILTIN_FONTS, fontLabel, fontStack, importFontFile, pickFontFile } from '@/lib/brandFonts';
import { importAsset, pickImageFile } from '@/lib/importImage';
import { newLogoOverlay, newPaletteOverlay, newTextOverlay, newTypeOverlay } from '@/lib/overlays';
import { useAssets } from '@/store/assets';
import { useProject, type Brand, type BrandFont, type Overlay, type OverlayFont } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { Button, ColorField, Field, Section, Segmented, Slider, Spinner, Switch, cx } from '@/ui/primitives';

type TextOverlay = Extract<Overlay, { kind: 'text' }>;
type LogoOverlay = Extract<Overlay, { kind: 'logo' }>;

/** 3 × 3 grid of anchor positions with comfortable margins. */
const ANCHORS: [number, number][] = [0.1, 0.5, 0.9].flatMap((y) => [0.1, 0.5, 0.9].map((x) => [x, y] as [number, number]));

function PositionGrid({ x, y, onChange }: { x: number; y: number; onChange: (x: number, y: number, align: 'left' | 'center' | 'right') => void }) {
  return (
    <div className="grid w-[84px] grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1.5 shadow-[0_0_0_1px_var(--line)_inset]">
      {ANCHORS.map(([ax, ay]) => {
        const active = Math.abs(ax - x) < 0.02 && Math.abs(ay - y) < 0.02;
        return (
          <button
            key={`${ax}${ay}`}
            type="button"
            aria-label={`${Math.round(ax * 100)} / ${Math.round(ay * 100)}`}
            onClick={() => onChange(ax, ay, ax < 0.3 ? 'left' : ax > 0.7 ? 'right' : 'center')}
            className={cx('grid h-5 place-items-center rounded', active ? 'bg-accent' : 'hover:bg-surface-4')}
          >
            <span className={cx('size-1.5 rounded-full', active ? 'bg-white' : 'bg-fg-subtle')} />
          </button>
        );
      })}
    </div>
  );
}

function TextEditor({ o }: { o: TextOverlay }) {
  const { t } = useT();
  const update = useProject((s) => s.updateOverlay);
  const set = (patch: Partial<TextOverlay>) => update(o.id, patch);
  return (
    <>
      <Field label={t('text.content')}>
        <textarea
          value={o.text}
          rows={2}
          onChange={(e) => set({ text: e.target.value })}
          className="min-h-[56px] resize-y rounded-lg bg-surface-2 px-2.5 py-2 text-[13px] text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1px_var(--accent)_inset]"
          style={{ fontFamily: fontStack(o.font), fontStyle: o.font === 'serif' ? 'italic' : 'normal' }}
        />
      </Field>
      <Field label={t('text.font')}>
        <Segmented
          size="sm"
          value={o.font}
          onChange={(font: OverlayFont) => set({ font })}
          options={(['heading', 'body', 'sans', 'serif'] as OverlayFont[]).map((f) => ({
            value: f,
            label: <span style={{ fontFamily: fontStack(f), fontStyle: f === 'serif' ? 'italic' : 'normal' }}>{t(`text.font.${f}` as I18nKey)}</span>,
          }))}
        />
      </Field>
      {o.font !== 'serif' && (
        <Field label={t('text.weight')}>
          <Segmented
            size="sm"
            value={String(o.weight)}
            onChange={(w) => set({ weight: Number(w) as TextOverlay['weight'] })}
            options={[400, 500, 700, 800].map((w) => ({ value: String(w), label: <span style={{ fontWeight: w }}>Aa</span> }))}
          />
        </Field>
      )}
      <Field label={t('text.size')} value={`${Math.round(o.size * 1000) / 10} %`}>
        <Slider label={t('text.size')} min={0.015} max={0.2} step={0.001} value={o.size} onChange={(size) => set({ size })} />
      </Field>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label={t('text.color')}>
          <ColorField label={t('text.color')} value={o.color} onChange={(color) => set({ color })} />
        </Field>
        <Segmented
          size="sm"
          value={o.align}
          onChange={(align) => set({ align })}
          options={[
            { value: 'left', label: <AlignLeft size={13} />, title: 'left' },
            { value: 'center', label: <AlignCenter size={13} />, title: 'center' },
            { value: 'right', label: <AlignRight size={13} />, title: 'right' },
          ]}
        />
      </div>
      <div className="grid grid-cols-[auto_1fr] items-start gap-3">
        <Field label={t('text.position')}>
          <PositionGrid x={o.x} y={o.y} onChange={(x, y, align) => set({ x, y, align })} />
        </Field>
        <Field label={t('text.tracking')} value={`${Math.round(o.tracking * 100)}`}>
          <Slider label={t('text.tracking')} min={-0.08} max={0.3} step={0.005} value={o.tracking} onChange={(tracking) => set({ tracking })} />
        </Field>
      </div>
    </>
  );
}

function LogoEditor({ o }: { o: LogoOverlay }) {
  const { t } = useT();
  const update = useProject((s) => s.updateOverlay);
  const set = (patch: Partial<LogoOverlay>) => update(o.id, patch);
  return (
    <>
      <Field label={t('text.size')} value={`${Math.round(o.size * 100)} %`}>
        <Slider label={t('text.size')} min={0.02} max={0.4} step={0.002} value={o.size} onChange={(size) => set({ size })} />
      </Field>
      <Field label={t('text.opacity')} value={`${Math.round(o.opacity * 100)} %`}>
        <Slider label={t('text.opacity')} value={o.opacity} onChange={(opacity) => set({ opacity })} />
      </Field>
      <Field label={t('text.position')}>
        <PositionGrid x={o.x} y={o.y} onChange={(x, y) => set({ x, y })} />
      </Field>
    </>
  );
}

type PaletteOverlay = Extract<Overlay, { kind: 'palette' }>;
type TypeOverlay = Extract<Overlay, { kind: 'type' }>;

function PaletteEditor({ o }: { o: PaletteOverlay }) {
  const { t } = useT();
  const update = useProject((s) => s.updateOverlay);
  const set = (patch: Partial<PaletteOverlay>) => update(o.id, patch);
  return (
    <>
      <Field label={t('text.size')} value={`${Math.round(o.size * 100)} %`}>
        <Slider label={t('text.size')} min={0.03} max={0.16} step={0.002} value={o.size} onChange={(size) => set({ size })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Segmented size="sm" value={o.layout} onChange={(layout) => set({ layout })} options={[{ value: 'row', label: t('brand.row') }, { value: 'column', label: t('brand.column') }]} />
        <Segmented size="sm" value={o.shape} onChange={(shape) => set({ shape })} options={[{ value: 'circle', label: '●' }, { value: 'square', label: '■' }]} />
      </div>
      <label className="flex cursor-pointer items-center justify-between text-[12px]">
        <span className="text-fg-muted">{t('brand.labels')}</span>
        <Switch checked={o.labels} onChange={(labels) => set({ labels })} label={t('brand.labels')} />
      </label>
      {o.labels && (
        <Field label={t('text.color')}>
          <ColorField label={t('text.color')} value={o.color} onChange={(color) => set({ color })} />
        </Field>
      )}
      <Field label={t('text.position')}>
        <PositionGrid x={o.x} y={o.y} onChange={(x, y) => set({ x, y })} />
      </Field>
    </>
  );
}

function TypeEditor({ o }: { o: TypeOverlay }) {
  const { t } = useT();
  const update = useProject((s) => s.updateOverlay);
  const set = (patch: Partial<TypeOverlay>) => update(o.id, patch);
  return (
    <>
      <Field label={t('text.size')} value={`${Math.round(o.size * 100)} %`}>
        <Slider label={t('text.size')} min={0.025} max={0.14} step={0.002} value={o.size} onChange={(size) => set({ size })} />
      </Field>
      <Field label={t('text.color')}>
        <ColorField label={t('text.color')} value={o.color} onChange={(color) => set({ color })} />
      </Field>
      <Field label={t('text.position')}>
        <PositionGrid x={o.x} y={o.y} onChange={(x, y) => set({ x, y })} />
      </Field>
    </>
  );
}

/* ------------------------------------------------------------ brand kit */

function FontPicker({ role, value, onChange }: { role: 'heading' | 'body'; value: BrandFont; onChange: (f: BrandFont) => void }) {
  const { t } = useT();
  const brand = useProject((s) => s.brand);
  // imported faces of the kit, so both roles can reuse them
  const imported = [brand.heading, brand.body].filter((f, i, a) => f.assetId && a.findIndex((x) => x.assetId === f.assetId) === i);
  const options = [...BUILTIN_FONTS.map((f) => ({ family: f.family, assetId: null as string | null, label: f.label })), ...imported.map((f) => ({ family: f.family, assetId: f.assetId, label: fontLabel(f) }))];
  return (
    <Field label={role === 'heading' ? t('brand.heading') : t('brand.body')}>
      <div className="flex gap-1.5">
        <select
          value={value.family}
          onChange={(e) => {
            const o = options.find((x) => x.family === e.target.value);
            if (o) onChange({ family: o.family, assetId: o.assetId });
          }}
          className="h-8 min-w-0 flex-1 rounded-lg bg-surface-2 px-2 text-[12.5px] text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1px_var(--accent)_inset]"
          style={{ fontFamily: `"${value.family}", system-ui`, fontStyle: value.family === 'Instrument Serif' ? 'italic' : 'normal' }}
        >
          {options.map((o) => (
            <option key={o.family} value={o.family}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="h-8"
          title={t('brand.importFont')}
          onClick={async () => {
            const file = await pickFontFile();
            if (!file) return;
            const f = await importFontFile(file);
            if (f) onChange(f);
          }}
        >
          <FileType size={13} />
        </Button>
      </div>
    </Field>
  );
}

function BrandKit() {
  const { t } = useT();
  const brand = useProject((s) => s.brand);
  const setBrand = useProject((s) => s.setBrand);
  const logo = useAssets((s) => (brand.logoAssetId ? s.assets[brand.logoAssetId] : undefined));
  const setColor = (i: number, patch: Partial<Brand['colors'][number]>) => setBrand({ colors: brand.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <Section title={t('brand.kit')}>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={async () => {
            const file = await pickImageFile();
            if (!file) return;
            const asset = await importAsset(file);
            if (asset) setBrand({ logoAssetId: asset.id });
          }}
          className="grid size-[64px] shrink-0 place-items-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#8882_0_25%,transparent_0_50%)] bg-[length:10px_10px] shadow-[0_0_0_1px_var(--line-strong)_inset]"
          title={t('brand.logo')}
        >
          {logo ? <img src={logo.url} alt="" className="max-h-[52px] max-w-[52px] object-contain" /> : <ImageIcon size={18} className="text-fg-subtle" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            value={brand.name}
            placeholder={t('brand.name')}
            onChange={(e) => setBrand({ name: e.target.value })}
            className="h-8 rounded-lg bg-surface-2 px-2.5 text-[13px] font-semibold text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1px_var(--accent)_inset]"
            style={{ fontFamily: `"${brand.heading.family}", system-ui` }}
          />
          <input
            value={brand.tagline}
            placeholder={t('brand.tagline')}
            onChange={(e) => setBrand({ tagline: e.target.value })}
            className="h-7 rounded-lg bg-surface-2 px-2.5 text-[12px] text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1px_var(--accent)_inset]"
          />
        </div>
      </div>
      {logo ? (
        <button type="button" className="-mt-1 self-start text-[11px] text-fg-subtle hover:text-fg" onClick={() => setBrand({ logoAssetId: null })}>
          {t('brand.removeLogo')}
        </button>
      ) : (
        <button
          type="button"
          className="-mt-1 self-start text-[11px] text-fg-subtle underline decoration-dotted underline-offset-2 hover:text-fg"
          onClick={async () => {
            const blob = await (await fetch(`${import.meta.env.BASE_URL}samples/sample-logo.png`)).blob();
            const asset = await importAsset(new File([blob], 'logo-exemple.png', { type: 'image/png' }));
            if (asset) setBrand({ logoAssetId: asset.id });
          }}
        >
          {t('brand.sampleLogo')}
        </button>
      )}
      <Field label={t('brand.palette')}>
        <div className="flex flex-col gap-1">
          {brand.colors.map((c, i) => (
            <div key={i} className="group flex items-center gap-2">
              <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: c.hex }}>
                <input type="color" aria-label={c.name} value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <input
                value={c.name}
                onChange={(e) => setColor(i, { name: e.target.value })}
                aria-label={t('brand.colorName')}
                className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[12.5px] text-fg outline-none hover:bg-surface-2 focus:bg-surface-2"
              />
              <span className="font-mono text-[11px] uppercase text-fg-subtle">{c.hex}</span>
              <button
                type="button"
                aria-label={t('text.delete')}
                disabled={brand.colors.length <= 1}
                onClick={() => setBrand({ colors: brand.colors.filter((_, j) => j !== i) })}
                className="grid size-6 place-items-center rounded-md text-fg-subtle opacity-0 hover:bg-surface-3 hover:text-fg group-hover:opacity-100 disabled:hidden"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {brand.colors.length < 6 && (
            <button
              type="button"
              onClick={() => setBrand({ colors: [...brand.colors, { hex: '#888888', name: `${t('brand.color')} ${brand.colors.length + 1}` }] })}
              className="flex h-7 items-center gap-1.5 self-start rounded-md px-1.5 text-[12px] text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Plus size={13} />
              {t('brand.addColor')}
            </button>
          )}
        </div>
      </Field>
      <FontPicker role="heading" value={brand.heading} onChange={(heading) => setBrand({ heading })} />
      <FontPicker role="body" value={brand.body} onChange={(body) => setBrand({ body })} />
    </Section>
  );
}

/* ------------------------------------------------------------ showcase */

function BrandShowcase({ add }: { add: (o: Overlay) => void }) {
  const { t } = useT();
  const brand = useProject((s) => s.brand);
  const ink = useProject((s) => inkFor(s));
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, job: () => Promise<void>) => {
    setBusy(key);
    try {
      await job();
    } finally {
      setBusy(null);
    }
  };

  /** One-click brand board: identity on the left, the mockup shifted right. */
  const board = async () => {
    const s = useProject.getState();
    // nothing on the screens yet: dress them with the brand first
    if (s.items.every((it) => Object.values(it.surfaces).every((b) => !b.assetId))) await applyBrandArt(s.items.map((i) => i.id));
    for (const o of s.overlays) s.removeOverlay(o.id);
    const r = paletteRoles(brand);
    if (brand.logoAssetId) add(newLogoOverlay(brand.logoAssetId, { size: 0.075, x: 0.1, y: 0.12 }));
    add(newTextOverlay({ text: brand.name, font: 'heading', size: 0.075, color: ink, align: 'left', x: 0.06, y: brand.logoAssetId ? 0.26 : 0.14 }));
    add(newTextOverlay({ text: brand.tagline, font: 'body', weight: 400, size: 0.026, color: ink, align: 'left', x: 0.061, y: brand.logoAssetId ? 0.33 : 0.21, tracking: 0 }));
    add(newTypeOverlay({ size: 0.045, x: 0.06, y: 0.56, color: ink }));
    add(newPaletteOverlay({ size: 0.055, x: 0.06 + (brand.colors.length * 0.055 * 1.78 * (1080 / 1920)) / 2, y: 0.86, color: ink }));
    s.setCamera({ shift: 0.16 });
    void r;
    toast.success(t('brand.boardDone'));
  };

  return (
    <Section title={t('brand.showcase')}>
      <Button variant="primary" disabled={!!busy} onClick={() => run('board', board)}>
        {busy === 'board' ? <Spinner size={13} /> : <LayoutPanelLeft size={14} />}
        {t('brand.board')}
      </Button>
      <div className="grid grid-cols-3 gap-1.5">
        <Button size="sm" onClick={() => add(newPaletteOverlay({ color: ink }))}>
          <Palette size={13} />
          {t('brand.paletteShort')}
        </Button>
        <Button size="sm" onClick={() => add(newTypeOverlay({ color: ink }))}>
          <Type size={13} />
          {t('brand.typeShort')}
        </Button>
        <Button size="sm" disabled={!brand.logoAssetId} onClick={() => brand.logoAssetId && add(newLogoOverlay(brand.logoAssetId))}>
          <ImageIcon size={13} />
          {t('text.addLogo')}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" disabled={!!busy} onClick={() => run('one', () => applyBrandArt())}>
          {busy === 'one' ? <Spinner size={12} /> : <Wand2 size={13} />}
          {t('brand.generate')}
        </Button>
        <Button size="sm" disabled={!!busy} onClick={() => run('all', () => applyBrandArt(useProject.getState().items.map((i) => i.id)))}>
          {busy === 'all' ? <Spinner size={12} /> : <Sparkles size={13} />}
          {t('brand.generateAll')}
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-fg-subtle">{t('brand.generateHint')}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" onClick={() => addBrandObject('swatch-fan')}>
          <Plus size={13} />
          {t('brand.addFan')}
        </Button>
        <Button size="sm" onClick={() => addBrandObject('specimen')}>
          <Plus size={13} />
          {t('brand.addSpecimen')}
        </Button>
      </div>
    </Section>
  );
}

function addBrandObject(modelId: string) {
  useProject.getState().addItem(modelId);
  useUi.getState().resetView();
}

/** Readable ink on the current background (white on dark scenes, the darkest brand colour on light ones). */
function inkFor(s: ReturnType<typeof useProject.getState>) {
  const r = paletteRoles(s.brand);
  const b = s.background;
  const dark =
    s.decor.kind === 'table'
      ? false
      : b.kind === 'solid'
        ? isDark(b.color)
        : b.kind === 'gradient'
          ? isDark(b.stops[0].color)
          : b.kind === 'pattern'
            ? isDark(b.colors[0])
            : true;
  return dark ? '#ffffff' : r.dark;
}

/* ------------------------------------------------------------ panel */

function useAddOverlay() {
  const addOverlay = useProject((s) => s.addOverlay);
  const selectOverlay = useUi((s) => s.selectOverlay);
  return (o: Overlay) => {
    addOverlay(o);
    selectOverlay(o.id);
  };
}

/** Brand kit and everything generated from it. */
export function BrandPage() {
  const add = useAddOverlay();
  return (
    <>
      <BrandKit />
      <BrandShowcase add={add} />
    </>
  );
}

/** Titles, captions and logos laid over the image. */
export function TextPage() {
  const { t } = useT();
  const overlays = useProject((s) => s.overlays);
  const updateOverlay = useProject((s) => s.updateOverlay);
  const removeOverlay = useProject((s) => s.removeOverlay);
  const selectedId = useUi((s) => s.selectedOverlayId);
  const selectOverlay = useUi((s) => s.selectOverlay);
  const assets = useAssets((s) => s.assets);
  const ink = useProject((s) => inkFor(s));
  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  const add = useAddOverlay();
  const labelOf = (o: Overlay) =>
    o.kind === 'text'
      ? o.text.split('\n')[0] || '…'
      : o.kind === 'logo'
        ? (o.assetId && assets[o.assetId]?.name) || t('text.addLogo')
        : o.kind === 'palette'
          ? t('brand.paletteShort')
          : t('brand.typeShort');
  const iconOf = (o: Overlay) => (o.kind === 'text' ? <Type size={13} /> : o.kind === 'logo' ? <ImageIcon size={13} /> : o.kind === 'palette' ? <Palette size={13} /> : <FileType size={13} />);

  return (
    <>
      <Section title={t('text.title')}>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" onClick={() => add(newTextOverlay({ text: useProject.getState().brand.name || t('text.defaultTitle'), color: ink }))}>
            <Type size={13} />
            {t('text.addTitle')}
          </Button>
          <Button size="sm" onClick={() => add(newTextOverlay({ text: t('text.defaultCaption'), font: 'body', size: 0.028, weight: 500, y: 0.9, tracking: 0, color: ink }))}>
            <Type size={11} />
            {t('text.addCaption')}
          </Button>
        </div>
        {overlays.length === 0 ? (
          <p className="text-[11.5px] leading-relaxed text-fg-subtle">{t('text.empty')}</p>
        ) : (
          <ul className="-mx-1 flex flex-col gap-0.5">
            {overlays.map((o) => {
              const active = o.id === selectedId;
              return (
                <li key={o.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectOverlay(o.id)}
                    onKeyDown={(e) => e.key === 'Enter' && selectOverlay(o.id)}
                    className={cx(
                      'group flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-[12.5px] transition-colors',
                      active ? 'bg-surface-3 text-fg shadow-[0_0_0_1px_var(--line-strong)_inset]' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                      !o.visible && 'opacity-50',
                    )}
                  >
                    <span className={active ? 'text-accent' : 'text-fg-subtle'}>{iconOf(o)}</span>
                    <span className="flex-1 truncate">{labelOf(o)}</span>
                    <button
                      type="button"
                      aria-label={o.visible ? 'hide' : 'show'}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateOverlay(o.id, { visible: !o.visible });
                      }}
                      className="grid size-6 place-items-center rounded-md text-fg-subtle hover:bg-surface-4 hover:text-fg"
                    >
                      {o.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      type="button"
                      aria-label={t('text.delete')}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOverlay(o.id);
                        if (active) selectOverlay(null);
                      }}
                      className="grid size-6 place-items-center rounded-md text-fg-subtle hover:bg-surface-4 hover:text-fg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      {selected && (
        <Section title={labelOf(selected)}>
          {selected.kind === 'text' && <TextEditor o={selected} />}
          {selected.kind === 'logo' && <LogoEditor o={selected} />}
          {selected.kind === 'palette' && <PaletteEditor o={selected} />}
          {selected.kind === 'type' && <TypeEditor o={selected} />}
          <p className="text-[12px] leading-snug text-fg-subtle">{t('text.dragHint')}</p>
        </Section>
      )}
    </>
  );
}

function isDark(hex: string) {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}
