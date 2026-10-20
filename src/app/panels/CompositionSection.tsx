import { useMemo, type ReactNode } from 'react';
import { AppWindow, Copy, Eye, EyeOff, LayoutGrid, Laptop, Lock, LockOpen, Monitor, Smartphone, Tablet, Trash2 } from 'lucide-react';
import * as THREE from 'three';
import { useT, type I18nKey } from '@/i18n';
import { LAYOUTS, footprint, layoutItems, type Layout } from '@/lib/arrange';
import { COMPOSITIONS, type Composition } from '@/lib/compositions';
import { carouselOf } from '@/export/settings';
import { getModel } from '@/models/registry';
import type { DeviceCategory } from '@/models/types';
import { cameraState } from '@/scene/camera';
import { makeItem, useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Field, Section, Segmented, Slider, Tooltip, cx } from '@/ui/primitives';

const ICONS: Partial<Record<DeviceCategory, ReactNode>> = {
  phone: <Smartphone size={14} />,
  tablet: <Tablet size={14} />,
  laptop: <Laptop size={14} />,
  desktop: <Monitor size={14} />,
  browser: <AppWindow size={14} />,
};

function RowButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cx('grid size-6 place-items-center rounded-md transition-colors hover:bg-surface-4 hover:text-fg', active ? 'text-accent' : 'text-fg-subtle')}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Moves a device away from (positive) or towards (negative) the camera, along the floor. */
function pushAlongView(id: string, distance: number) {
  const s = useProject.getState();
  const it = s.items.find((x) => x.id === id);
  if (!it) return;
  const f = cameraState.forward.clone().setY(0);
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
  f.normalize();
  s.updateItem(id, { position: [it.position[0] + f.x * distance, it.position[1], it.position[2] + f.z * distance] });
}

function useComposition() {
  const { tr } = useT();
  const items = useProject((s) => s.items);
  const selectedId = useProject((s) => s.selectedId);
  const selected = items.find((it) => it.id === selectedId) ?? items[0];
  // "Phone Pro", "Phone Pro 2"… when the same model appears several times.
  const seen = new Map<string, number>();
  const labels = items.map((it) => {
    const n = (seen.get(it.modelId) ?? 0) + 1;
    seen.set(it.modelId, n);
    return n > 1 ? `${tr(getModel(it.modelId).name)} ${n}` : tr(getModel(it.modelId).name);
  });
  return { items, selected, labels };
}

/** The devices in the scene: select, hide, lock, duplicate, delete; and arrange them all. */
export function SceneItems() {
  const { t } = useT();
  const { items, selected, labels } = useComposition();
  const selectItem = useProject((s) => s.selectItem);
  const updateItem = useProject((s) => s.updateItem);
  const duplicateItem = useProject((s) => s.duplicateItem);
  const removeItem = useProject((s) => s.removeItem);
  const arrange = useProject((s) => s.arrange);
  const arrangement = useProject((s) => s.arrangement);
  const carousel = useProject((s) => !!carouselOf(s.export.ratio));
  const resetView = useUi((s) => s.resetView);
  const lay = (layout?: Layout) => {
    arrange(layout);
    resetView();
  };

  return (
    <Section title={t('devices.inScene')} aside={<span className="text-[12px] tabular-nums text-fg-subtle">{items.length}</span>}>
      {!items.length && <p className="text-[12.5px] leading-snug text-fg-muted">{t('devices.empty')}</p>}
      <ul className="-mx-1 flex flex-col gap-0.5">
        {items.map((it, i) => {
          const model = getModel(it.modelId);
          const active = it.id === selected?.id;
          return (
            <li key={it.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => selectItem(it.id)}
                onKeyDown={(e) => e.key === 'Enter' && selectItem(it.id)}
                className={cx(
                  'group flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-[12.5px] transition-colors',
                  active ? 'bg-surface-3 text-fg shadow-[0_0_0_1px_var(--line-strong)_inset]' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  !it.visible && 'opacity-50',
                )}
              >
                <span className={active ? 'text-accent' : 'text-fg-subtle'}>{ICONS[model.category]}</span>
                <span className="flex-1 truncate">{labels[i]}</span>
                <span className={cx('flex items-center', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                  <RowButton label={it.visible ? t('comp.hide') : t('comp.show')} onClick={() => updateItem(it.id, { visible: !it.visible })}>
                    {it.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </RowButton>
                  <RowButton label={it.locked ? t('comp.unlock') : t('comp.lock')} active={it.locked} onClick={() => updateItem(it.id, { locked: !it.locked })}>
                    {it.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  </RowButton>
                  <RowButton label={t('comp.duplicate')} onClick={() => duplicateItem(it.id)}>
                    <Copy size={13} />
                  </RowButton>
                  <RowButton label={t('comp.delete')} onClick={() => removeItem(it.id)}>
                    <Trash2 size={13} />
                  </RowButton>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 1 &&
        (carousel ? (
          <Button size="sm" onClick={() => lay()}>
            <LayoutGrid size={13} />
            {t('comp.arrange')}
          </Button>
        ) : (
          <Field label={t('comp.layout')}>
            <Segmented
              size="sm"
              value={arrangement}
              onChange={(layout: Layout) => lay(layout)}
              options={LAYOUTS.map((l) => ({ value: l, label: t(`comp.layout.${l}` as I18nKey) }))}
            />
          </Field>
        ))}
    </Section>
  );
}

/** Rotation and depth of the selected device. */
export function Placement() {
  const { t } = useT();
  const { items, selected } = useComposition();
  const updateItem = useProject((s) => s.updateItem);
  if (!selected) return null;
  return (
    <Section title={t('settings.placement')}>
          <Field label={t('comp.rotation')} value={`${Math.round(THREE.MathUtils.radToDeg(selected.rotation[1]))}°`}>
            <Slider
              label={t('comp.rotation')}
              min={-180}
              max={180}
              step={1}
              value={((THREE.MathUtils.radToDeg(selected.rotation[1]) + 540) % 360) - 180}
              onChange={(v) => updateItem(selected.id, (it) => ({ rotation: [it.rotation[0], THREE.MathUtils.degToRad(v), it.rotation[2]] }))}
            />
          </Field>
          {items.length > 1 && (
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => pushAlongView(selected.id, -6)}>
                {t('comp.forward')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => pushAlongView(selected.id, 6)}>
                {t('comp.backward')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => updateItem(selected.id, { position: [0, 0, 0] })}>
                {t('comp.center')}
              </Button>
            </div>
          )}
          <p className="text-[11px] leading-snug text-fg-subtle">{t('comp.dragHint')}</p>
    </Section>
  );
}

/* ------------------------------------------------------------ ready-made scenes */

/** A small drawing of a composition: its devices seen from the front and a little above, back ones first. */
function CompositionThumb({ composition }: { composition: Composition }) {
  const shapes = useMemo(() => {
    const items = layoutItems(composition.models.map((id) => makeItem(getModel(id))), composition.layout);
    const boxes = items
      .map((it) => {
        const f = footprint(it);
        const w = Math.max(f.w * Math.abs(Math.cos(it.rotation[1])), f.w * 0.35);
        return { x: it.position[0] - it.position[2] * 0.2, base: -it.position[2] * 0.3, w, h: f.h, z: it.position[2] };
      })
      .sort((a, b) => a.z - b.z);
    const minX = Math.min(...boxes.map((b) => b.x - b.w / 2));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w / 2));
    const top = Math.max(...boxes.map((b) => b.base + b.h));
    const bottom = Math.min(...boxes.map((b) => b.base));
    return { boxes, view: `${minX - 4} ${-top - 4} ${maxX - minX + 8} ${top - bottom + 8}` };
  }, [composition]);
  return (
    <svg viewBox={shapes.view} className="h-[54px] w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {shapes.boxes.map((b, i) => (
        <rect
          key={i}
          x={b.x - b.w / 2}
          y={-(b.base + b.h)}
          width={b.w}
          height={b.h}
          rx={Math.min(b.w, b.h) * 0.12}
          className="fill-surface-4 stroke-fg-muted"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Scenes with several devices already laid out: pick one, then change the images. */
export function Compositions() {
  const { t, tr } = useT();
  const setComposition = useProject((s) => s.setComposition);
  const resetView = useUi((s) => s.resetView);
  return (
    <Section title={t('devices.compositions')}>
      <div className="grid grid-cols-2 gap-2" data-testid="compositions">
        {COMPOSITIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid={`composition-${c.id}`}
            onClick={() => {
              setComposition(c.models, c.layout);
              resetView();
            }}
            className="flex flex-col items-center gap-1.5 rounded-[12px] bg-surface-2 px-2 pb-2 pt-2.5 text-[12px] leading-tight text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] transition-[box-shadow,background-color,color,transform] duration-150 hover:bg-surface-3 hover:text-fg active:scale-[0.97]"
          >
            <CompositionThumb composition={c} />
            <span className="text-center">{tr(c.name)}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] leading-snug text-fg-muted">{t('devices.compositionsHint')}</p>
    </Section>
  );
}
