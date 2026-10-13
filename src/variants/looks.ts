import { getModel } from '@/models/registry';
import { BG_PRESETS } from '@/lib/backgroundPresets';
import { AMBIENCES, AMBIENCE_ORDER, WALL_COLORS } from '@/scene/ambiences';
import { LIGHT_PRESETS } from '@/scene/lighting/presets';
import { SCENE_PRESETS, type ScenePreset } from '@/scene/scenePresets';
import { useLang, t } from '@/i18n';
import {
  DEFAULT_CAMERA,
  DEFAULT_DECOR,
  DEFAULT_GROUND,
  useProject,
  type Background,
  type CameraPresetId,
  type CameraSettings,
  type Decor,
  type GoboId,
  type Ground,
  type LightPresetId,
  type Lighting,
  type Project,
  type SceneItem,
  type MaterialId,
} from '@/store/project';

/*
 * A variant is a "look": background, set, light, camera and floor, plus each
 * device's angle, finish and pose. Looks are generated from a seed (the same
 * seed gives the same look), varying only the axes the user picked, and can
 * be refined: small changes around one look the user liked.
 */

export type Axis = 'set' | 'background' | 'light' | 'angle' | 'finish';
export const AXES: Axis[] = ['set', 'background', 'light', 'angle', 'finish'];

export interface Look {
  id: string;
  label: string;
  /** Name of the set the look comes from (for the labels of its refinements). */
  setName?: string;
  background: Background;
  decor: Decor;
  lighting: Lighting;
  camera: CameraSettings;
  ground: Ground;
  items: Record<string, { rotation: SceneItem['rotation']; finishId: string; pose: SceneItem['pose'] }>;
}

/* ------------------------------------------------------------ random */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = ReturnType<typeof rng>;
const pick = <T,>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length)];
function weighted<T>(r: Rand, list: [T, number][]): T {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of list) if ((x -= w) <= 0) return v;
  return list[list.length - 1][0];
}
function shuffle<T>(r: Rand, list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------ capture / apply */

export function lookFrom(p: Pick<Project, 'background' | 'decor' | 'lighting' | 'camera' | 'ground' | 'items'>, label = ''): Look {
  return {
    id: uid(),
    label,
    background: structuredClone(p.background),
    decor: { ...p.decor },
    lighting: { ...p.lighting },
    camera: { ...p.camera },
    ground: { ...p.ground },
    items: Object.fromEntries(p.items.map((it) => [it.id, { rotation: [...it.rotation] as SceneItem['rotation'], finishId: it.finishId, pose: it.pose }])),
  };
}

/** Puts a look on the current project (callers decide whether it is recorded in the history). */
export function applyLook(look: Look) {
  const s = useProject.getState();
  useProject.setState({
    background: look.background,
    lighting: look.lighting,
    camera: look.camera,
    ground: look.ground,
    items: s.items.map((it) => (look.items[it.id] ? { ...it, ...look.items[it.id] } : it)),
  });
  // through the action: wall constraints follow the set
  useProject.getState().setDecor(look.decor);
}

/* ------------------------------------------------------------ labels */

const lightName = (id: LightPresetId) => LIGHT_PRESETS[id].name[useLang.getState().lang];

function describe(look: Look, preset: ScenePreset | null) {
  const lang = useLang.getState().lang;
  const parts: string[] = [];
  if (preset) parts.push(preset.name[lang]);
  if (look.decor.kind === 'table') parts.push(AMBIENCES[look.decor.ambience].name[lang]);
  else parts.push(lightName(look.lighting.preset));
  parts.push(look.camera.preset === 'custom' ? t('camera.custom') : t(`camera.${look.camera.preset}` as 'camera.front'));
  return parts.join(' · ');
}

/* ------------------------------------------------------------ generation */

const isDark = (bg: Background) => {
  const hex = bg.kind === 'solid' ? bg.color : bg.kind === 'gradient' ? bg.stops[bg.stops.length - 1].color : bg.kind === 'pattern' ? bg.colors[0] : '#808080';
  const n = parseInt(hex.slice(1, 7), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.45;
};

/** Backgrounds made from the brand palette, next to the curated ones. */
function brandBackgrounds(p: Project): Background[] {
  const c = p.brand.colors.map((x) => x.hex);
  if (c.length < 2) return [];
  const light = [...c].sort((a, b) => lum(b) - lum(a))[0];
  const dark = [...c].sort((a, b) => lum(a) - lum(b))[0];
  return [
    { kind: 'solid', color: light },
    { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: c[0], at: 0 }, { color: dark, at: 1 }] },
    { kind: 'pattern', pattern: 'aurora', colors: [dark, c[0], c[Math.min(3, c.length - 1)]], scale: 1, grain: 0.3, seed: 5 },
  ];
}
function lum(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

const ANGLES: [CameraPresetId, number][] = [
  ['threeQuarter', 4],
  ['high', 2],
  ['front', 1.5],
  ['low', 1.2],
  ['isometric', 0.8],
];

function lightFor(r: Rand, bg: Background, decor: Decor): LightPresetId {
  if (decor.kind === 'table') return 'studio';
  return isDark(bg) ? weighted(r, [['studio', 3], ['dramatic', 2], ['noir', 1.5], ['neon', 0.7]]) : weighted(r, [['highkey', 3], ['daylight', 2], ['golden', 1.5], ['studio', 1]]);
}

function withLight(id: LightPresetId, r: Rand | null, base?: Lighting): Lighting {
  const l = { ...LIGHT_PRESETS[id].manual, preset: id } as Lighting;
  if (base) Object.assign(l, { exposure: base.exposure, environment: base.environment });
  if (r) {
    l.azimuth = Math.round(l.azimuth + (r() - 0.5) * 50);
    l.elevation = Math.round(Math.min(75, Math.max(15, l.elevation + (r() - 0.5) * 16)));
  }
  return l;
}

/** Generates `count` distinct looks varying the given axes of the current project. */
export function generateLooks(count: number, axes: Axis[], seed: number, p: Project = useProject.getState()): Look[] {
  const r = rng(seed);
  const on = (a: Axis) => axes.includes(a);
  const presets = shuffle(r, SCENE_PRESETS);
  const backgrounds = shuffle(r, [...BG_PRESETS, ...brandBackgrounds(p)]);
  const angles = shuffle(r, ANGLES.flatMap(([a, w]) => Array(Math.round(w * 2)).fill(a) as CameraPresetId[]));
  const single = p.items.filter((it) => it.visible).length === 1;
  const looks: Look[] = [];
  const seen = new Set<string>();
  for (let i = 0; looks.length < count && i < count * 6; i++) {
    const look = lookFrom(p);
    let preset: ScenePreset | null = null;
    // set (and the background that goes with it)
    if (on('set')) {
      preset = presets[i % presets.length];
      look.decor = { ...DEFAULT_DECOR, ...preset.decor };
      if (preset.background) look.background = structuredClone(preset.background);
      look.ground = { ...DEFAULT_GROUND, ...preset.ground };
      look.lighting = withLight(preset.light ?? 'studio', null);
      if (preset.exposure) look.lighting.exposure = preset.exposure;
      if (preset.environment) look.lighting.environment = preset.environment;
      look.camera = { ...DEFAULT_CAMERA, ...preset.camera };
    }
    // looks with a strong mood (neon, aurora, dramatic black) keep their own background and light
    const moody = !!preset && ['neon', 'aurora', 'noir'].includes(preset.id);
    // the background shows on its own only without a set or around a podium (a surface blends into it)
    const freeBackground = look.decor.kind === 'none' || look.decor.kind === 'podium';
    if (on('background') && freeBackground && !moody && (!on('set') || r() < 0.45)) look.background = structuredClone(backgrounds[i % backgrounds.length]);
    // light
    if (on('light')) {
      if (look.decor.kind === 'table') {
        look.decor.ambience = pick(r, AMBIENCE_ORDER);
        look.decor.gobo = pick(r, ['window', 'blinds', 'leaves', 'none'] as GoboId[]);
        // the table's wall is the background: it only changes when the background is one of the things that vary
        if (on('background') && !on('set')) look.background = { kind: 'solid', color: pick(r, WALL_COLORS) };
        look.lighting.exposure = AMBIENCES[look.decor.ambience].exposure;
        look.lighting.environment = AMBIENCES[look.decor.ambience].environment;
      } else look.lighting = withLight(moody ? look.lighting.preset : lightFor(r, look.background, look.decor), r, look.lighting);
    }
    // angle (a flat lay keeps its top view)
    const flatLay = look.camera.preset === 'top' && on('set');
    if (on('angle') && !flatLay) {
      look.camera.preset = angles[i % angles.length];
      look.camera.focal = weighted(r, [[35, 1], [50, 3], [70, 2], [85, 1.5]]);
      if (look.camera.preset === 'isometric') look.camera.focal = 600;
    }
    look.camera.dof = look.decor.kind === 'table' ? true : look.camera.dof && on('angle') ? r() < 0.5 : look.camera.dof;
    const pose: SceneItem['pose'] = look.camera.preset === 'top' ? 'flat' : 'standing';
    for (const it of p.items) {
      const v = look.items[it.id];
      v.pose = pose;
      if (on('angle') && single && pose === 'standing') v.rotation = [0, (getModel(it.modelId).yaw ?? -0.32) + (r() - 0.5) * 0.7, 0];
      if (on('finish')) {
        const finishes = getModel(it.modelId).finishes;
        v.finishId = pick(r, finishes).id;
      }
    }
    look.label = describe(look, preset);
    look.setName = preset?.name[useLang.getState().lang] ?? look.label.split(' · ')[0];
    const key = JSON.stringify([look.background, look.decor, look.lighting.preset, look.camera.preset, Object.values(look.items).map((x) => x.finishId)]);
    if (seen.has(key)) continue;
    seen.add(key);
    looks.push(look);
  }
  return looks;
}

/** Table tops a refined table look can switch to. */
const TABLE_MATERIALS: MaterialId[] = ['oak', 'walnut', 'marble-white', 'marble-black', 'travertine', 'concrete'];

/** Small changes around a look: angle, light direction, wall, shadows — one or two at a time. */
export function refineLook(base: Look, count: number, seed: number, p: Project = useProject.getState()): Look[] {
  const r = rng(seed);
  const single = p.items.filter((it) => it.visible).length === 1;
  const out: Look[] = [];
  for (let i = 0; i < count; i++) {
    const look: Look = { ...structuredClone(base), id: uid() };
    const changes = shuffle(r, ['angle', 'focal', 'light', 'set'] as const).slice(0, 1 + Math.floor(r() * 2));
    for (const c of changes) {
      if (c === 'angle') {
        if (single)
          for (const v of Object.values(look.items)) if (v.pose === 'standing') v.rotation = [v.rotation[0], v.rotation[1] + (r() - 0.5) * 0.6, v.rotation[2]];
        if (look.camera.preset !== 'top' && r() < 0.4) look.camera.preset = weighted(r, ANGLES);
      } else if (c === 'focal' && look.camera.preset !== 'isometric') look.camera.focal = weighted(r, [[35, 1], [50, 2], [70, 2], [85, 2], [105, 1]]);
      else if (c === 'light') {
        if (look.decor.kind === 'table') look.decor.gobo = pick(r, ['window', 'blinds', 'leaves', 'none'] as GoboId[]);
        else look.lighting = withLight(look.lighting.preset, r, look.lighting);
      } else if (c === 'set') {
        if (look.decor.kind === 'table') look.decor.material = pick(r, TABLE_MATERIALS);
        else if (look.background.kind === 'pattern') look.background = { ...look.background, seed: Math.floor(r() * 100) };
        else look.lighting = withLight(look.lighting.preset, r, look.lighting);
      }
    }
    const pose: SceneItem['pose'] = look.camera.preset === 'top' ? 'flat' : 'standing';
    for (const v of Object.values(look.items)) v.pose = pose;
    look.label = `${base.setName ?? base.label.split(' · ')[0]} · ${t('variants.refined', { n: i + 1 })}`;
    out.push(look);
  }
  return out;
}
