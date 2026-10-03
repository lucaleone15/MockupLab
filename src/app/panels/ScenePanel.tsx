import type { ReactNode } from 'react';
import { Armchair, Ban, Box, Cylinder, Layers, Square } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { CAMERA_PRESETS } from '@/scene/camera';
import { SURFACES } from '@/scene/Decor';
import { LIGHT_PRESETS, LIGHT_PRESET_ORDER } from '@/scene/lighting/presets';
import { patternCanvas } from '@/lib/patterns';
import { useProject, type CameraPresetId, type Decor, type SurfaceMaterialId } from '@/store/project';
import { ColorField, Field, Section, Segmented, Slider, Switch, Tooltip, cx } from '@/ui/primitives';
import { BackgroundEditor } from './BackgroundEditor';

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        'flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-150',
        active
          ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--accent)_inset]'
          : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ décor */

const surfaceThumbs = new Map<SurfaceMaterialId, string>();
function surfaceThumb(id: SurfaceMaterialId) {
  let url = surfaceThumbs.get(id);
  if (!url) {
    url = patternCanvas({ ...SURFACES[id].spec, scale: SURFACES[id].spec.scale * 0.6 }, 96, 64).toDataURL();
    surfaceThumbs.set(id, url);
  }
  return url;
}

const DECOR_ICONS: Record<Decor['kind'], ReactNode> = {
  none: <Ban size={15} />,
  sweep: <Layers size={15} />,
  podium: <Cylinder size={15} />,
  surface: <Square size={15} />,
  desk: <Armchair size={15} />,
};

function DecorSection() {
  const { t } = useT();
  const decor = useProject((s) => s.decor);
  const setDecor = useProject((s) => s.setDecor);
  return (
    <Section title={t('decor.title')}>
      <div className="grid grid-cols-5 gap-1.5">
        {(Object.keys(DECOR_ICONS) as Decor['kind'][]).map((k) => (
          <Chip key={k} active={decor.kind === k} onClick={() => setDecor({ kind: k })}>
            {DECOR_ICONS[k]}
            {t(`decor.${k}` as I18nKey)}
          </Chip>
        ))}
      </div>
      {(decor.kind === 'sweep' || decor.kind === 'podium' || decor.kind === 'desk') && (
        <Field label={decor.kind === 'desk' ? t('decor.wall') : t('decor.color')}>
          <ColorField label={t('decor.color')} value={decor.color} onChange={(color) => setDecor({ color })} />
        </Field>
      )}
      {decor.kind === 'podium' && (
        <>
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
        </>
      )}
      {(decor.kind === 'surface' || decor.kind === 'desk') && (
        <Field label={t('decor.material')}>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(SURFACES) as SurfaceMaterialId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setDecor({ material: id })}
                className={cx(
                  'flex h-12 items-end overflow-hidden rounded-lg bg-cover bg-center p-1.5 text-[10.5px] font-medium text-white transition-shadow',
                  decor.material === id ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]',
                )}
                style={{ backgroundImage: `linear-gradient(transparent 40%, rgb(0 0 0 / 0.45)), url(${surfaceThumb(id)})` }}
              >
                {t(`pattern.${id}` as I18nKey)}
              </button>
            ))}
          </div>
        </Field>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ light */

function LightSection() {
  const { t, tr } = useT();
  const light = useProject((s) => s.lighting);
  const setLighting = useProject((s) => s.setLighting);
  const applyLightPreset = useProject((s) => s.applyLightPreset);
  return (
    <Section title={t('light.title')}>
      <div className="grid grid-cols-4 gap-1.5">
        {LIGHT_PRESET_ORDER.map((id) => (
          <Tooltip key={id} label={tr(LIGHT_PRESETS[id].name)}>
            <button type="button" onClick={() => applyLightPreset(id)} className="flex flex-col items-center gap-1">
              <span
                className={cx(
                  'aspect-square w-full rounded-lg transition-[transform,box-shadow] duration-150 hover:scale-[1.05]',
                  light.preset === id ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]',
                )}
                style={{ background: LIGHT_PRESETS[id].swatch }}
              />
              <span className={cx('w-full truncate text-center text-[10.5px]', light.preset === id ? 'text-fg' : 'text-fg-subtle')}>
                {tr(LIGHT_PRESETS[id].name)}
              </span>
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label={t('light.intensity')} value={light.intensity.toFixed(2)}>
          <Slider label={t('light.intensity')} min={0} max={3} value={light.intensity} onChange={(intensity) => setLighting({ intensity })} />
        </Field>
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
      <Field label={t('light.environment')} value={light.environment.toFixed(2)}>
        <Slider label={t('light.environment')} min={0} max={2} value={light.environment} onChange={(environment) => setLighting({ environment })} />
      </Field>
      <Field label={t('light.exposure')} value={light.exposure.toFixed(2)}>
        <Slider label={t('light.exposure')} min={0.5} max={1.8} value={light.exposure} onChange={(exposure) => setLighting({ exposure })} />
      </Field>
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

function CameraSection() {
  const { t } = useT();
  const cam = useProject((s) => s.camera);
  const setCamera = useProject((s) => s.setCamera);
  const setPose = useProject((s) => s.setPose);
  return (
    <Section title={t('camera.title')} aside={cam.preset === 'custom' ? <span className="text-[11.5px] text-fg-subtle">{t('camera.custom')}</span> : undefined}>
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
      <Field label={t('camera.focal')} value={`${Math.round(cam.focal)} mm`}>
        <Slider
          label={t('camera.focal')}
          min={F_MIN}
          max={F_MAX}
          step={0.001}
          value={Math.log(cam.focal)}
          onChange={(v) => setCamera({ focal: Math.round(Math.exp(v)) })}
        />
      </Field>
      <label className="flex cursor-pointer items-center justify-between text-[12px]">
        <span className="text-fg-muted">{t('camera.dof')}</span>
        <Switch checked={cam.dof} onChange={(dof) => setCamera({ dof })} label={t('camera.dof')} />
      </label>
      {cam.dof && (
        <>
          <Field label={t('camera.aperture')} value={`${Math.round(cam.aperture * 100)} %`}>
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
    </Section>
  );
}

/* ------------------------------------------------------------ ground */

function GroundSection() {
  const { t } = useT();
  const ground = useProject((s) => s.ground);
  const setGround = useProject((s) => s.setGround);
  return (
    <Section title={t('ground.title')}>
      <Field label={t('ground.shadow')}>
        <Segmented
          value={ground.shadow}
          onChange={(shadow) => setGround({ shadow })}
          options={[
            { value: 'soft', label: t('ground.soft') },
            { value: 'contact', label: t('ground.contact') },
            { value: 'none', label: t('ground.none') },
          ]}
        />
      </Field>
      {ground.shadow !== 'none' && (
        <Field label={t('ground.opacity')} value={`${Math.round(ground.shadowOpacity * 100)} %`}>
          <Slider label={t('ground.opacity')} min={0} max={1} value={ground.shadowOpacity} onChange={(shadowOpacity) => setGround({ shadowOpacity })} />
        </Field>
      )}
      <label className="flex cursor-pointer items-center justify-between text-[12px]">
        <span className="text-fg-muted">{t('ground.reflection')}</span>
        <Switch checked={ground.reflection} onChange={(reflection) => setGround({ reflection })} label={t('ground.reflection')} />
      </label>
      {ground.reflection && (
        <Field label={t('ground.reflectivity')} value={`${Math.round(ground.reflectivity * 100)} %`}>
          <Slider label={t('ground.reflectivity')} value={ground.reflectivity} onChange={(reflectivity) => setGround({ reflectivity })} />
        </Field>
      )}
    </Section>
  );
}

export function ScenePanel() {
  const { t } = useT();
  return (
    <>
      <Section title={t('props.background')}>
        <BackgroundEditor />
      </Section>
      <DecorSection />
      <LightSection />
      <CameraSection />
      <GroundSection />
    </>
  );
}
