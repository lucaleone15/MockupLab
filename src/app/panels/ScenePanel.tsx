import type { ReactNode } from 'react';
import { Box, Cylinder } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { CAMERA_PRESETS, fNumber } from '@/scene/camera';
import { LIGHT_PRESETS, LIGHT_PRESET_ORDER } from '@/scene/lighting/presets';
import { AMBIENCES, AMBIENCE_ORDER } from '@/scene/ambiences';
import { MATERIAL_ORDER, REAL_MATERIALS, materialUrl } from '@/scene/realMaterials';
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

/* ------------------------------------------------------------ set */

/** What the device stands on: the studio sweep, a podium, a real table (a "surface" is a table without its room). */
type Support = 'sweep' | 'podium' | 'table';
const SUPPORTS: Support[] = ['sweep', 'podium', 'table'];
const supportOf = (kind: Decor['kind']): Support => (kind === 'surface' ? 'table' : kind === 'none' ? 'sweep' : kind);

/** Little drawing of each support. */
function SupportArt({ id }: { id: Support }) {
  const device = <rect x="44" y="9" width="12" height="25" rx="2.5" className="fill-fg-subtle" />;
  return (
    <svg viewBox="0 0 100 50" className="h-[42px] w-[84px] shrink-0" aria-hidden>
      <rect width="100" height="50" rx="7" className={id === 'table' ? 'fill-[#5a4a3a]' : 'fill-surface-4'} />
      {id === 'sweep' && <path d="M0 26 Q0 38 14 38 L100 38 L100 50 L0 50Z" className="fill-fg-subtle/25" />}
      {id === 'podium' && <rect x="33" y="34" width="34" height="11" rx="2" className="fill-fg-subtle/45" />}
      {id === 'table' && <rect y="34" width="100" height="16" className="fill-[#8a6a4a]" />}
      {device}
    </svg>
  );
}

export function DecorSection() {
  const { t, tr } = useT();
  const decor = useProject((s) => s.decor);
  const transparent = useProject((s) => s.background.kind === 'transparent');
  const setDecor = useProject((s) => s.setDecor);
  const setLighting = useProject((s) => s.setLighting);
  const setCamera = useProject((s) => s.setCamera);
  const chooseAmbience = (id: AmbienceId) => {
    setDecor({ ambience: id });
    setLighting({ exposure: AMBIENCES[id].exposure, environment: AMBIENCES[id].environment });
  };
  const support = supportOf(decor.kind);
  const choose = (k: Support) => {
    if (k === support) return;
    setDecor({ kind: k });
    if (k !== 'table') return;
    chooseAmbience(decor.ambience);
    setCamera({ dof: true });
  };
  // a transparent background shows the device alone
  if (transparent) return null;
  const matter = (
    <Field label={t('decor.matter')} value={<span className="font-sans text-[11.5px]">{tr(REAL_MATERIALS[decor.material].name)}</span>}>
      <MaterialPicker value={decor.material} onChange={(material) => setDecor({ material })} />
    </Field>
  );
  return (
    <Section title={t('support.title')}>
      <div className="flex flex-col gap-1.5" data-testid="supports">
        {SUPPORTS.map((k) => (
          <button
            key={k}
            type="button"
            data-testid={`support-${k}`}
            aria-pressed={support === k}
            onClick={() => choose(k)}
            className={cx(
              'flex items-center gap-3 rounded-[12px] p-1.5 pr-3 text-left transition-[background-color,box-shadow] duration-150',
              support === k ? 'bg-surface-3 shadow-[0_0_0_1.5px_var(--accent)_inset]' : 'bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-3',
            )}
          >
            <SupportArt id={k} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] font-semibold leading-tight text-fg">{t(`support.${k}` as I18nKey)}</span>
              <span className="text-[11.5px] leading-snug text-fg-muted">{t(`support.${k}.hint` as I18nKey)}</span>
            </span>
          </button>
        ))}
      </div>
      <Advanced more={t('ui.more')}>
        {support === 'table' && (
          <>
            <label className="flex cursor-pointer items-center justify-between text-[12px]">
              <span className="text-fg-muted">{t('support.noRoom')}</span>
              <Switch checked={decor.kind === 'surface'} onChange={(on) => setDecor({ kind: on ? 'surface' : 'table' })} label={t('support.noRoom')} />
            </label>
            {matter}
            {decor.kind === 'table' && (
              <>
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
              </>
            )}
          </>
        )}
        {support === 'podium' && (
          <>
            <Segmented
              value={decor.podiumFinish}
              onChange={(podiumFinish) => setDecor({ podiumFinish })}
              options={[
                { value: 'paint', label: t('decor.paint') },
                { value: 'material', label: t('decor.matter') },
              ]}
            />
            {decor.podiumFinish === 'paint' ? <ColorField label={t('decor.color')} value={decor.color} onChange={(color) => setDecor({ color })} /> : <MaterialPicker value={decor.material} onChange={(material) => setDecor({ material })} />}
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
        <GroundSettings />
      </Advanced>
    </Section>
  );
}

/* ------------------------------------------------------------ background */

export function BackgroundSection() {
  const { t } = useT();
  // a plain colour or no background has nothing more to tune
  const tunable = useProject((s) => s.background.kind !== 'solid' && s.background.kind !== 'transparent');
  return (
    <Section title={t('bg.colourTitle')}>
      <BackgroundEditor part="main" />
      {tunable && (
        <Advanced more={t('ui.more')}>
          <BackgroundEditor part="details" />
        </Advanced>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ light */

/** Where the key light comes from, in plain words: the azimuth and height it sets. */
const LIGHT_FROM = {
  top: { azimuth: -20, elevation: 78 },
  side: { azimuth: -78, elevation: 28 },
  front: { azimuth: -8, elevation: 38 },
} as const;
type LightFrom = keyof typeof LIGHT_FROM;

export function LightSection() {
  const { t, tr } = useT();
  const light = useProject((s) => s.lighting);
  const inPlace = useProject((s) => s.decor.kind === 'table');
  const setLighting = useProject((s) => s.setLighting);
  const applyLightPreset = useProject((s) => s.applyLightPreset);
  const more = t('ui.more');
  const from = (Object.keys(LIGHT_FROM) as LightFrom[]).find(
    (k) => Math.abs(LIGHT_FROM[k].azimuth - light.azimuth) < 4 && Math.abs(LIGHT_FROM[k].elevation - light.elevation) < 4,
  );
  const intensity = (
    <Field label={t('light.intensity')} value={light.intensity.toFixed(2)}>
      <Slider label={t('light.intensity')} min={0} max={3} value={light.intensity} onChange={(intensity) => setLighting({ intensity })} />
    </Field>
  );
  const brightness = (
    <Field label={t('light.brightness')} value={`${Math.round(light.exposure * 100)} %`}>
      <Slider label={t('light.brightness')} min={0.5} max={1.8} value={light.exposure} onChange={(exposure) => setLighting({ exposure })} />
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
          {brightness}
          <Advanced more={more}>
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
          <Field label={t('light.from')}>
            <Segmented
              value={from ?? ('' as LightFrom)}
              onChange={(k: LightFrom) => setLighting(LIGHT_FROM[k])}
              options={(Object.keys(LIGHT_FROM) as LightFrom[]).map((k) => ({ value: k, label: t(`light.from.${k}` as I18nKey) }))}
            />
          </Field>
          {brightness}
          <Advanced more={more}>
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
      <Advanced more={t('ui.more')}>
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

/** The floor under the device: its shadow and reflection (fine-tuning of the Décor). */
function GroundSettings() {
  const { t } = useT();
  const ground = useProject((s) => s.ground);
  const setGround = useProject((s) => s.setGround);
  return (
    <>
      <Field label={t('ground.title')}>
        <Segmented
          size="sm"
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
          <Slider label={t('ground.opacity')} value={ground.shadowOpacity} onChange={(shadowOpacity) => setGround({ shadowOpacity })} />
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
    </>
  );
}
