import type { ReactNode } from 'react';
import { Box, Cylinder, Home, Layers, Square } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { CAMERA_PRESETS, fNumber } from '@/scene/camera';
import { LIGHT_PRESETS, LIGHT_PRESET_ORDER } from '@/scene/lighting/presets';
import { AMBIENCES, AMBIENCE_ORDER, WALL_COLORS } from '@/scene/ambiences';
import { MATERIAL_ORDER, REAL_MATERIALS, materialUrl } from '@/scene/realMaterials';
import { SCENE_PRESETS, applyScenePreset, type ScenePreset } from '@/scene/scenePresets';
import { useProject, type AmbienceId, type CameraPresetId, type Decor, type GoboId, type MaterialId } from '@/store/project';
import { Advanced, ColorField, Field, Section, Segmented, Slider, Switch, Tooltip, cx } from '@/ui/primitives';
import { BackgroundEditor } from './BackgroundEditor';

const ring = (active: boolean) =>
  active ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-150',
        active ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--accent)_inset]' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function MaterialPicker({ value, onChange }: { value: MaterialId; onChange: (m: MaterialId) => void }) {
  const { tr } = useT();
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {MATERIAL_ORDER.map((id) => (
        <Tooltip key={id} label={tr(REAL_MATERIALS[id].name)}>
          <button
            type="button"
            aria-label={tr(REAL_MATERIALS[id].name)}
            onClick={() => onChange(id)}
            className={cx('aspect-square rounded-lg bg-cover bg-center transition-[transform,box-shadow] duration-150 hover:scale-105', ring(value === id))}
            style={{ backgroundImage: `url(${materialUrl(id, 'thumb')})` }}
          />
        </Tooltip>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ looks */

function presetActive(p: ScenePreset, s: ReturnType<typeof useProject.getState>) {
  if (p.decor.kind === 'table')
    return s.decor.kind === 'table' && s.decor.material === p.decor.material && s.decor.wall === p.decor.wall && s.decor.gobo === p.decor.gobo;
  return (
    s.decor.kind === p.decor.kind &&
    (!p.decor.material || s.decor.material === p.decor.material) &&
    JSON.stringify(s.background) === JSON.stringify(p.background) &&
    (!p.light || s.lighting.preset === p.light)
  );
}

export function Looks() {
  const { tr } = useT();
  const state = useProject();
  return (
    <div className="px-5 pt-3">
      <div className="grid grid-cols-2 gap-2">
        {SCENE_PRESETS.map((p) => {
          const active = presetActive(p, state);
          const thumb = p.thumb;
          const style = { background: thumb.css };
          return (
            <button key={p.id} type="button" onClick={() => applyScenePreset(p)} className="group flex flex-col gap-1.5 text-left">
              <span className={cx('relative block aspect-[16/10] w-full overflow-hidden rounded-lg transition-[box-shadow,transform] duration-150 group-hover:scale-[1.02]', ring(active))} style={style}>
                {thumb.material && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[38%] bg-cover bg-center shadow-[0_-1px_0_rgb(255_255_255/0.25)]"
                    style={{ backgroundImage: `url(${materialUrl(thumb.material, 'thumb')})` }}
                  />
                )}
              </span>
              <span className={cx('truncate text-[11.5px]', active ? 'text-fg' : 'text-fg-muted group-hover:text-fg')}>{tr(p.name)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ set */

/** "Fond" covers the plain backdrop and the studio cyclo (an option of a plain colour). */
type DecorChoice = 'backdrop' | 'podium' | 'surface' | 'table';
const DECOR_ICONS: Record<DecorChoice, ReactNode> = {
  backdrop: <Layers size={15} />,
  podium: <Cylinder size={15} />,
  surface: <Square size={15} />,
  table: <Home size={15} />,
};
const DECOR_LABEL: Record<DecorChoice, I18nKey> = {
  backdrop: 'decor.backdrop',
  podium: 'decor.podium',
  surface: 'decor.surface',
  table: 'decor.table',
};
const choiceOf = (kind: Decor['kind']): DecorChoice => (kind === 'none' || kind === 'sweep' ? 'backdrop' : kind);

export function DecorSection() {
  const { t, tr } = useT();
  const decor = useProject((s) => s.decor);
  const setDecor = useProject((s) => s.setDecor);
  const setLighting = useProject((s) => s.setLighting);
  const setCamera = useProject((s) => s.setCamera);
  const background = useProject((s) => s.background);
  const solid = background.kind === 'solid';
  const more = { more: t('ui.more'), less: t('ui.less') };
  const chooseAmbience = (id: AmbienceId) => {
    setDecor({ ambience: id });
    setLighting({ exposure: AMBIENCES[id].exposure, environment: AMBIENCES[id].environment });
  };
  return (
    <Section title={t('decor.title')} defaultOpen={false}>
      <div className="grid grid-cols-4 gap-1.5" data-testid="decor-kinds">
        {(Object.keys(DECOR_ICONS) as DecorChoice[]).map((k) => (
          <Chip
            key={k}
            active={choiceOf(decor.kind) === k}
            onClick={() => {
              if (k === 'backdrop') return choiceOf(decor.kind) !== 'backdrop' && setDecor({ kind: 'none' });
              if (k !== 'table') return setDecor({ kind: k });
              setDecor({ kind: k });
              chooseAmbience(decor.ambience);
              setCamera({ dof: true });
            }}
          >
            {DECOR_ICONS[k]}
            {t(DECOR_LABEL[k])}
          </Chip>
        ))}
      </div>

      {decor.kind === 'table' && (
        <>
          <Field label={t('decor.matter')} value={<span className="font-sans text-[11.5px]">{tr(REAL_MATERIALS[decor.material].name)}</span>}>
            <MaterialPicker value={decor.material} onChange={(material) => setDecor({ material })} />
          </Field>
          <Field label={t('decor.wall')}>
            <div className="flex gap-1.5">
              {WALL_COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setDecor({ wall: c })} className={cx('size-7 rounded-full transition-[transform,box-shadow] hover:scale-110', ring(decor.wall === c))} style={{ background: c }} />
              ))}
            </div>
          </Field>
          <Field label={t('decor.shadows')}>
            <Segmented
              size="sm"
              value={decor.gobo}
              onChange={(gobo: GoboId) => setDecor({ gobo })}
              options={(['none', 'window', 'blinds', 'leaves'] as GoboId[]).map((g) => ({ value: g, label: t(`gobo.${g}` as I18nKey) }))}
            />
          </Field>
          <Field label={t('decor.ambience')}>
            <div className="grid grid-cols-3 gap-1.5">
              {AMBIENCE_ORDER.map((id) => (
                <button key={id} type="button" onClick={() => chooseAmbience(id)} className="flex flex-col items-center gap-1">
                  <span className={cx('h-7 w-full rounded-md', ring(decor.ambience === id))} style={{ background: AMBIENCES[id].swatch }} />
                  <span className={cx('text-[10.5px]', decor.ambience === id ? 'text-fg' : 'text-fg-subtle')}>{tr(AMBIENCES[id].name)}</span>
                </button>
              ))}
            </div>
          </Field>
          <Advanced {...more}>
            <ColorField label={t('decor.wall')} value={decor.wall} onChange={(wall) => setDecor({ wall })} />
          </Advanced>
        </>
      )}

      {decor.kind === 'surface' && (
        <Field label={t('decor.matter')} value={<span className="font-sans text-[11.5px]">{tr(REAL_MATERIALS[decor.material].name)}</span>}>
          <MaterialPicker value={decor.material} onChange={(material) => setDecor({ material })} />
        </Field>
      )}

      {choiceOf(decor.kind) === 'backdrop' && (
        <div className="flex flex-col gap-1.5">
          <label className={cx('flex items-center justify-between gap-3 text-[12.5px]', solid ? 'cursor-pointer' : 'opacity-50')}>
            <span className="text-fg-muted">{t('decor.cyclo')}</span>
            <Switch
              checked={decor.kind === 'sweep'}
              label={t('decor.cyclo')}
              onChange={(on) => {
                if (!solid) return;
                setDecor(on ? { kind: 'sweep', color: background.kind === 'solid' ? background.color : decor.color } : { kind: 'none' });
              }}
            />
          </label>
          <p className="text-[12px] leading-snug text-fg-muted">{t(solid ? 'decor.cycloHint' : 'decor.cycloSolidOnly')}</p>
        </div>
      )}

      {decor.kind === 'podium' && (
        <>
          <Segmented
            value={decor.podiumFinish}
            onChange={(podiumFinish) => setDecor({ podiumFinish })}
            options={[
              { value: 'paint', label: t('decor.paint') },
              { value: 'material', label: t('decor.matter') },
            ]}
          />
          {decor.podiumFinish === 'paint' ? (
            <ColorField label={t('decor.color')} value={decor.color} onChange={(color) => setDecor({ color })} />
          ) : (
            <MaterialPicker value={decor.material} onChange={(material) => setDecor({ material })} />
          )}
          <Advanced {...more}>
            <Segmented
              value={decor.shape}
              onChange={(shape) => setDecor({ shape })}
              options={[
                { value: 'cylinder', label: <span className="inline-flex items-center gap-1.5"><Cylinder size={13} />{t('decor.cylinder')}</span> },
                { value: 'block', label: <span className="inline-flex items-center gap-1.5"><Box size={13} />{t('decor.block')}</span> },
              ]}
            />
            <label className="flex cursor-pointer items-center justify-between text-[12px]">
              <span className="text-fg-muted">{t('decor.arch')}</span>
              <Switch checked={decor.arch} onChange={(arch) => setDecor({ arch })} label={t('decor.arch')} />
            </label>
          </Advanced>
        </>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ background */

export function BackgroundSection() {
  const { t } = useT();
  const inPlace = useProject((s) => s.decor.kind === 'table');
  return (
    <Section title={t('bg.title')} defaultOpen={false}>
      {inPlace ? (
        <p className="text-[11.5px] leading-snug text-fg-subtle">{t('bg.placeNote')}</p>
      ) : (
        <>
          <BackgroundEditor part="basic" />
          <Advanced more={t('ui.more')} less={t('ui.less')}>
            <BackgroundEditor part="details" />
          </Advanced>
        </>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ light */

export function LightSection() {
  const { t, tr } = useT();
  const light = useProject((s) => s.lighting);
  const inPlace = useProject((s) => s.decor.kind === 'table');
  const setLighting = useProject((s) => s.setLighting);
  const applyLightPreset = useProject((s) => s.applyLightPreset);
  const intensity = (
    <Field label={t('light.intensity')} value={light.intensity.toFixed(2)}>
      <Slider label={t('light.intensity')} min={0} max={3} value={light.intensity} onChange={(intensity) => setLighting({ intensity })} />
    </Field>
  );
  const exposure = (
    <Field label={t('light.exposure')} value={light.exposure.toFixed(2)}>
      <Slider label={t('light.exposure')} min={0.5} max={1.8} value={light.exposure} onChange={(exposure) => setLighting({ exposure })} />
    </Field>
  );
  const environment = (
    <Field label={t('light.environment')} value={light.environment.toFixed(2)}>
      <Slider label={t('light.environment')} min={0} max={2} value={light.environment} onChange={(environment) => setLighting({ environment })} />
    </Field>
  );
  return (
    <Section title={t('light.presets')}>
      {inPlace ? (
        <>
          <p className="text-[11.5px] leading-snug text-fg-subtle">{t('light.placeNote')}</p>
          {exposure}
          <Advanced more={t('ui.more')} less={t('ui.less')}>
            {intensity}
            {environment}
          </Advanced>
        </>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {LIGHT_PRESET_ORDER.map((id) => (
              <Tooltip key={id} label={tr(LIGHT_PRESETS[id].name)}>
                <button type="button" onClick={() => applyLightPreset(id)} className="flex flex-col items-center gap-1">
                  <span className={cx('aspect-square w-full rounded-lg transition-[transform,box-shadow] duration-150 hover:scale-[1.05]', ring(light.preset === id))} style={{ background: LIGHT_PRESETS[id].swatch }} />
                  <span className={cx('w-full truncate text-center text-[10.5px]', light.preset === id ? 'text-fg' : 'text-fg-subtle')}>{tr(LIGHT_PRESETS[id].name)}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          <Advanced more={t('ui.more')} less={t('ui.less')}>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              {intensity}
              <label className="relative size-8 cursor-pointer overflow-hidden rounded-lg shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: light.color }} title={t('light.color')}>
                <input type="color" aria-label={t('light.color')} value={light.color} onChange={(e) => setLighting({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
            </div>
            <Field label={t('light.azimuth')} value={`${Math.round(light.azimuth)}°`}>
              <Slider label={t('light.azimuth')} min={-180} max={180} step={1} value={light.azimuth} onChange={(azimuth) => setLighting({ azimuth })} />
            </Field>
            <Field label={t('light.elevation')} value={`${Math.round(light.elevation)}°`}>
              <Slider label={t('light.elevation')} min={5} max={89} step={1} value={light.elevation} onChange={(elevation) => setLighting({ elevation })} />
            </Field>
            <Field label={t('light.softness')} value={`${Math.round(light.softness * 100)} %`}>
              <Slider label={t('light.softness')} value={light.softness} onChange={(softness) => setLighting({ softness })} />
            </Field>
            {environment}
            {exposure}
          </Advanced>
        </>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ camera */

const PRESET_ICONS: Record<Exclude<CameraPresetId, 'custom'>, ReactNode> = {
  front: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="8" y="3" width="8" height="18" rx="2" /></svg>,
  threeQuarter: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M8 4l8 2v14l-8-2z" /></svg>,
  isometric: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5" /></svg>,
  top: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="5" y="7" width="14" height="10" rx="2" /><path d="M12 2v3" /></svg>,
  high: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M5 18h14 M7 18l3-9h4l3 9" /><circle cx="18" cy="5" r="2" /></svg>,
  low: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M8 3h8v14H8z M3 21h18" /><circle cx="4" cy="17" r="1.6" /></svg>,
};

// Focal slider on a log scale: 14 mm → 600 mm.
const F_MIN = Math.log(14);
const F_MAX = Math.log(600);

export function CameraSection() {
  const { t } = useT();
  const cam = useProject((s) => s.camera);
  const setCamera = useProject((s) => s.setCamera);
  const setPose = useProject((s) => s.setPose);
  return (
    <Section title={t('camera.angles')} aside={cam.preset === 'custom' ? <span className="text-[11.5px] text-fg-subtle">{t('camera.custom')}</span> : undefined}>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(CAMERA_PRESETS) as Exclude<CameraPresetId, 'custom'>[]).map((id) => (
          <Chip
            key={id}
            active={cam.preset === id}
            onClick={() => {
              const def = CAMERA_PRESETS[id];
              if (def.flat) setPose('flat');
              else if (cam.preset === 'top') setPose('standing');
              setCamera({ preset: id, focal: def.focal ?? (cam.focal > 300 ? 52 : cam.focal) });
            }}
          >
            {PRESET_ICONS[id]}
            {t(`camera.${id}` as I18nKey)}
          </Chip>
        ))}
      </div>
      <label className="flex cursor-pointer items-center justify-between text-[12px]">
        <span className="text-fg-muted">{t('camera.dof')}</span>
        <Switch checked={cam.dof} onChange={(dof) => setCamera({ dof })} label={t('camera.dof')} />
      </label>
      <Advanced more={t('ui.more')} less={t('ui.less')}>
        <Field label={t('camera.shift')} value={`${Math.round((cam.shift ?? 0) * 100)} %`}>
          <Slider label={t('camera.shift')} min={-0.35} max={0.35} step={0.005} value={cam.shift ?? 0} onChange={(shift) => setCamera({ shift })} />
        </Field>
        <Field label={t('camera.focal')} value={`${Math.round(cam.focal)} mm`}>
          <Slider label={t('camera.focal')} min={F_MIN} max={F_MAX} step={0.001} value={Math.log(cam.focal)} onChange={(v) => setCamera({ focal: Math.round(Math.exp(v)) })} />
        </Field>
        {cam.dof && (
          <>
            <Field label={t('camera.aperture')} value={`f/${fNumber(cam.aperture).toFixed(1)}`}>
              <Slider label={t('camera.aperture')} value={cam.aperture} onChange={(aperture) => setCamera({ aperture })} />
            </Field>
            <Field
              label={t('camera.focus')}
              value={cam.focus === 0 ? '·' : cam.focus < 0 ? `${t('camera.near')} ${Math.round(-cam.focus * 100)}` : `${t('camera.far')} ${Math.round(cam.focus * 100)}`}
            >
              <Slider label={t('camera.focus')} min={-1} max={1} value={cam.focus} onChange={(focus) => setCamera({ focus })} />
            </Field>
          </>
        )}
      </Advanced>
    </Section>
  );
}

/* ------------------------------------------------------------ floor */

export function GroundSection() {
  const { t } = useT();
  const ground = useProject((s) => s.ground);
  const setGround = useProject((s) => s.setGround);
  return (
    <Section title={t('ground.title')} defaultOpen={false}>
      <Segmented
        value={ground.shadow}
        onChange={(shadow) => setGround({ shadow })}
        options={[
          { value: 'soft', label: t('ground.soft') },
          { value: 'contact', label: t('ground.contact') },
          { value: 'none', label: t('ground.none') },
        ]}
      />
      <label className="flex cursor-pointer items-center justify-between text-[12px]">
        <span className="text-fg-muted">{t('ground.reflection')}</span>
        <Switch checked={ground.reflection} onChange={(reflection) => setGround({ reflection })} label={t('ground.reflection')} />
      </label>
      <Advanced more={t('ui.more')} less={t('ui.less')}>
        {ground.shadow !== 'none' && (
          <Field label={t('ground.opacity')} value={`${Math.round(ground.shadowOpacity * 100)} %`}>
            <Slider label={t('ground.opacity')} value={ground.shadowOpacity} onChange={(shadowOpacity) => setGround({ shadowOpacity })} />
          </Field>
        )}
        {ground.reflection && (
          <Field label={t('ground.reflectivity')} value={`${Math.round(ground.reflectivity * 100)} %`}>
            <Slider label={t('ground.reflectivity')} value={ground.reflectivity} onChange={(reflectivity) => setGround({ reflectivity })} />
          </Field>
        )}
      </Advanced>
    </Section>
  );
}
