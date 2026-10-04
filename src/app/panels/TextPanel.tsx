import { AlignCenter, AlignLeft, AlignRight, Eye, EyeOff, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { importAsset, pickImageFile } from '@/lib/importImage';
import { FONT_FAMILIES, newLogoOverlay, newTextOverlay } from '@/lib/overlays';
import { useAssets } from '@/store/assets';
import { useProject, type Overlay, type OverlayFont } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, ColorField, Field, Section, Segmented, Slider, cx } from '@/ui/primitives';

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
          style={{ fontFamily: FONT_FAMILIES[o.font], fontStyle: o.font === 'serif' ? 'italic' : 'normal' }}
        />
      </Field>
      <Field label={t('text.font')}>
        <Segmented
          size="sm"
          value={o.font}
          onChange={(font: OverlayFont) => set({ font })}
          options={(['sans', 'serif', 'mono'] as OverlayFont[]).map((f) => ({
            value: f,
            label: <span style={{ fontFamily: FONT_FAMILIES[f], fontStyle: f === 'serif' ? 'italic' : 'normal' }}>{t(`text.font.${f}` as I18nKey)}</span>,
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

export function TextPanel() {
  const { t } = useT();
  const overlays = useProject((s) => s.overlays);
  const addOverlay = useProject((s) => s.addOverlay);
  const updateOverlay = useProject((s) => s.updateOverlay);
  const removeOverlay = useProject((s) => s.removeOverlay);
  const selectedId = useUi((s) => s.selectedOverlayId);
  const selectOverlay = useUi((s) => s.selectOverlay);
  const assets = useAssets((s) => s.assets);
  const bgDark = useProject((s) => {
    const b = s.background;
    return s.decor.kind === 'table' ? false : b.kind === 'solid' ? isDark(b.color) : b.kind === 'gradient' ? isDark(b.stops[0].color) : true;
  });
  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  const add = (o: Overlay) => {
    addOverlay(o);
    selectOverlay(o.id);
  };

  return (
    <>
      <Section title={t('text.title')}>
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" onClick={() => add(newTextOverlay({ text: t('text.defaultTitle'), color: bgDark ? '#ffffff' : '#141416' }))}>
            <Type size={13} />
            {t('text.addTitle')}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              add(newTextOverlay({ text: t('text.defaultCaption'), size: 0.028, weight: 500, y: 0.9, tracking: 0, color: bgDark ? '#d4d4d8' : '#4b4b52' }))
            }
          >
            <Type size={11} />
            {t('text.addCaption')}
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              const file = await pickImageFile();
              if (!file) return;
              const asset = await importAsset(file);
              if (asset) add(newLogoOverlay(asset.id));
            }}
          >
            <ImageIcon size={13} />
            {t('text.addLogo')}
          </Button>
        </div>
        {overlays.length === 0 ? (
          <p className="text-[11.5px] leading-relaxed text-fg-subtle">{t('text.empty')}</p>
        ) : (
          <ul className="-mx-1 flex flex-col gap-0.5">
            {overlays.map((o) => {
              const active = o.id === selectedId;
              const label = o.kind === 'text' ? o.text.split('\n')[0] || '…' : (o.assetId && assets[o.assetId]?.name) || t('text.addLogo');
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
                    <span className={active ? 'text-accent' : 'text-fg-subtle'}>{o.kind === 'text' ? <Type size={13} /> : <ImageIcon size={13} />}</span>
                    <span className="flex-1 truncate">{label}</span>
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
        <Section title={selected.kind === 'text' ? t('text.content') : t('text.addLogo')}>
          {selected.kind === 'text' ? <TextEditor o={selected} /> : <LogoEditor o={selected} />}
          <p className="text-[11px] leading-snug text-fg-subtle">{t('text.dragHint')}</p>
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
