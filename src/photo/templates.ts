import { createStore, del, get, keys, set } from 'idb-keyval';
import { create } from 'zustand';
import { t, useLang, type I18nString } from '@/i18n';
import { fileToAsset } from '@/lib/importImage';
import { useAssets } from '@/store/assets';
import { makeZone, useProject, type PhotoZone } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import type { Quad } from './homography';

/*
 * Photo templates: a photo plus its zones (corners, ratio, blend settings).
 * Bundled ones ship in public/assets/photo (CC0 photos); the user's own are
 * kept in IndexedDB and can be exported / imported as a JSON file with the
 * photo embedded.
 */

/** A zone without its design: what a template stores. */
export type TemplateZone = Omit<PhotoZone, 'id' | 'surface' | 'name' | 'visible'> & { name: string | I18nString };

export interface PhotoTemplate {
  id: string;
  name: I18nString;
  file: string;
  thumb: string;
  credit: string;
  source: string;
  zones: TemplateZone[];
}

const screen = { aspectAuto: false, radius: 0, shading: 0, reflection: 0.7, brightness: 1, sharpness: 0, noise: 0.15, feather: 0.6, match: 0.1, occlusion: 0 };
const print = { aspectAuto: false, radius: 0, shading: 0.85, reflection: 0.2, brightness: 1, sharpness: 0, noise: 0.25, feather: 0.6, match: 0.35, occlusion: 0 };

export const PHOTO_TEMPLATES: PhotoTemplate[] = [
  {
    id: 'laptop-desk',
    name: { fr: 'Portable au bureau', en: 'Laptop at a desk' },
    file: 'laptop-desk.jpg',
    thumb: 'laptop-desk-thumb.jpg',
    credit: 'Simon Hattinga Verschure (CC0)',
    source: 'https://commons.wikimedia.org/wiki/File:Typing_on_a_laptop_(Unsplash).jpg',
    zones: [
      {
        name: { fr: 'Écran', en: 'Screen' },
        kind: 'screen',
        corners: [
          [0.3592, 0.1019],
          [0.8258, 0.1606],
          [0.7917, 0.6988],
          [0.3317, 0.5788],
        ],
        aspect: 1.6,
        ...screen,
        // the typing fingers overlap the bottom of the screen
        occlusion: 0.7,
      },
    ],
  },
  {
    id: 'marble-duo',
    name: { fr: 'Tablette et téléphone', en: 'Tablet and phone' },
    file: 'marble-duo.jpg',
    thumb: 'marble-duo-thumb.jpg',
    credit: 'Lauren Mancke (CC0)',
    source: 'https://commons.wikimedia.org/wiki/File:Lauren_Mancke_2016-05-27_(Unsplash).jpg',
    zones: [
      {
        name: { fr: 'Tablette', en: 'Tablet' },
        kind: 'screen',
        corners: [
          [0.1699, 0.5692],
          [0.5458, 0.3004],
          [0.6833, 0.7231],
          [0.3031, 0.9963],
        ],
        aspect: 4 / 3,
        ...screen,
        reflection: 0.5,
      },
      {
        name: { fr: 'Téléphone', en: 'Phone' },
        kind: 'screen',
        corners: [
          [0.64, 0.2798],
          [0.7685, 0.1845],
          [0.8862, 0.5264],
          [0.7565, 0.6234],
        ],
        aspect: 9 / 16,
        ...screen,
        reflection: 0.5,
      },
    ],
  },
  {
    id: 'phone-hand',
    name: { fr: 'Téléphone en main', en: 'Phone in hand' },
    file: 'phone-hand.jpg',
    thumb: 'phone-hand-thumb.jpg',
    credit: 'Jef Pawlikowski (CC0)',
    source: 'https://commons.wikimedia.org/wiki/File:Phone_overseas._(Unsplash).jpg',
    zones: [
      {
        name: { fr: 'Écran', en: 'Screen' },
        kind: 'screen',
        corners: [
          [0.4296, 0.2881],
          [0.5954, 0.2881],
          [0.5954, 0.7325],
          [0.4296, 0.7325],
        ],
        aspect: 9 / 16,
        ...screen,
        // the photo's screen shows a camera view: nothing of it should read as a reflection
        reflection: 0,
      },
    ],
  },
  {
    id: 'frames-wall',
    name: { fr: 'Cadres au mur', en: 'Frames on a wall' },
    file: 'frames-wall.jpg',
    thumb: 'frames-wall-thumb.jpg',
    credit: 'Crew (CC0)',
    source: 'https://commons.wikimedia.org/wiki/File:Framed_wall_art_(Unsplash).jpg',
    zones: [
      {
        name: { fr: 'Cadre gauche', en: 'Left frame' },
        kind: 'print',
        corners: [
          [0.1416, 0.1362],
          [0.3981, 0.1362],
          [0.3981, 0.5741],
          [0.1403, 0.5741],
        ],
        aspect: 4 / 5,
        ...print,
        // the frames hold artwork: none of it must show through
        shading: 0,
        reflection: 0,
      },
      {
        name: { fr: 'Cadre droit', en: 'Right frame' },
        kind: 'print',
        corners: [
          [0.5213, 0.3118],
          [0.8398, 0.3193],
          [0.8379, 0.9158],
          [0.515, 0.9111],
        ],
        aspect: 3 / 4,
        ...print,
        shading: 0,
        reflection: 0,
      },
    ],
  },
  {
    id: 'card-concrete',
    name: { fr: 'Carte sur béton', en: 'Card on concrete' },
    file: 'card-concrete.jpg',
    thumb: 'card-concrete-thumb.jpg',
    credit: 'Aaron Burden (CC0)',
    source: 'https://commons.wikimedia.org/wiki/File:Thank_you!_(Unsplash).jpg',
    zones: [
      {
        name: { fr: 'Carte', en: 'Card' },
        kind: 'print',
        corners: [
          [-0.0179, 0.5847],
          [0.4904, 0.0941],
          [0.8083, 0.4915],
          [0.2919, 1.0306],
        ],
        aspect: Math.SQRT2,
        ...print,
        // the card already carries an embossed border and text: only its lighting is kept
        shading: 0.45,
        reflection: 0,
      },
    ],
  },
];

export const templateUrl = (file: string) => `${import.meta.env.BASE_URL}assets/photo/${file}`;

const zoneName = (n: string | I18nString) => (typeof n === 'string' ? n : n[useLang.getState().lang]);

/** Builds the zones of a template. */
export const zonesFrom = (zones: TemplateZone[]) => zones.map((z) => makeZone({ ...z, name: zoneName(z.name), corners: z.corners.map((c) => [...c]) as Quad }));

const assetCache = new Map<string, Promise<string>>();

async function blobAsset(key: string, load: () => Promise<Blob>, name: string) {
  let p = assetCache.get(key);
  if (!p) {
    p = (async () => {
      const asset = await fileToAsset(await load(), name);
      useAssets.getState().add(asset);
      return asset.id;
    })();
    assetCache.set(key, p);
    p.catch(() => assetCache.delete(key));
  }
  return p;
}

function enterPhoto() {
  const s = useProject.getState();
  if (s.mode !== 'photo') s.setMode('photo');
  useUi.getState().setPhotoTool('select');
}

export async function applyTemplate(tpl: PhotoTemplate) {
  const assetId = await blobAsset(`builtin:${tpl.id}`, async () => (await fetch(templateUrl(tpl.file))).blob(), `template-${tpl.file}`);
  enterPhoto();
  useProject.getState().setPhoto(assetId, tpl.id, zonesFrom(tpl.zones));
}

/** Uses an imported photo with no zone yet, and starts placing the first one. */
export function startWithPhoto(assetId: string) {
  enterPhoto();
  useProject.getState().setPhoto(assetId, null, []);
  useUi.getState().setPhotoTool('place');
}

/* ------------------------------------------------------------ user templates */

export interface UserTemplate {
  id: string;
  name: string;
  createdAt: number;
  width: number;
  height: number;
  image: Blob;
  zones: TemplateZone[];
}

const db = createStore('mockuplab-templates', 'kv');

interface TemplatesState {
  list: (UserTemplate & { url: string })[];
  loaded: boolean;
}
export const useTemplates = create<TemplatesState>(() => ({ list: [], loaded: false }));

export async function loadUserTemplates() {
  const ids = (await keys(db)).map(String);
  const items = (await Promise.all(ids.map((k) => get(k, db)))) as UserTemplate[];
  for (const old of useTemplates.getState().list) URL.revokeObjectURL(old.url);
  useTemplates.setState({
    loaded: true,
    list: items.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt).map((t) => ({ ...t, url: URL.createObjectURL(t.image) })),
  });
}

const toTemplateZone = ({ id: _id, surface: _s, visible: _v, ...rest }: PhotoZone): TemplateZone => rest;

/** Saves the current photo and its zones as a reusable template. */
export async function saveCurrentAsTemplate(name: string) {
  const { photo } = useProject.getState();
  const asset = photo.assetId ? useAssets.getState().assets[photo.assetId] : undefined;
  if (!asset || !photo.zones.length) return;
  const tpl: UserTemplate = {
    id: Math.random().toString(36).slice(2, 10),
    name: name.trim() || t('photo.template.untitled'),
    createdAt: Date.now(),
    width: asset.width,
    height: asset.height,
    image: asset.blob,
    zones: photo.zones.map(toTemplateZone),
  };
  await set(tpl.id, tpl, db);
  await loadUserTemplates();
  toast.success(t('photo.template.saved', { name: tpl.name }));
  return tpl;
}

export async function deleteUserTemplate(id: string) {
  await del(id, db);
  await loadUserTemplates();
}

export async function applyUserTemplate(tpl: UserTemplate) {
  const assetId = await blobAsset(`user:${tpl.id}`, async () => tpl.image, `${tpl.name}.jpg`);
  enterPhoto();
  useProject.getState().setPhoto(assetId, `user:${tpl.id}`, zonesFrom(tpl.zones));
}

/* ------------------------------------------------------------ template files */

interface TemplateFile {
  app: 'MockupLab';
  kind: 'photo-template';
  format: 1;
  name: string;
  image: string;
  zones: TemplateZone[];
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function templateFile(tpl: UserTemplate): Promise<{ blob: Blob; filename: string }> {
  const file: TemplateFile = { app: 'MockupLab', kind: 'photo-template', format: 1, name: tpl.name, image: await toDataUrl(tpl.image), zones: tpl.zones };
  const slug = tpl.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'template';
  return { blob: new Blob([JSON.stringify(file)], { type: 'application/json' }), filename: `${slug}.mockuplab-template.json` };
}

/** Imports a template file into the user's templates and applies it. */
export async function importTemplateFile(file: File) {
  try {
    const parsed = JSON.parse(await file.text()) as TemplateFile;
    if (parsed?.app !== 'MockupLab' || parsed.kind !== 'photo-template' || !parsed.image || !Array.isArray(parsed.zones)) throw new Error('format');
    const image = await (await fetch(parsed.image)).blob();
    const probe = await fileToAsset(image, parsed.name);
    URL.revokeObjectURL(probe.url);
    const tpl: UserTemplate = {
      id: Math.random().toString(36).slice(2, 10),
      name: parsed.name || file.name,
      createdAt: Date.now(),
      width: probe.width,
      height: probe.height,
      image: probe.blob,
      zones: parsed.zones.filter((z) => Array.isArray(z.corners) && z.corners.length === 4),
    };
    await set(tpl.id, tpl, db);
    await loadUserTemplates();
    await applyUserTemplate(tpl);
    toast.success(t('photo.template.imported', { name: tpl.name }));
  } catch {
    toast.error(t('photo.template.invalid'));
  }
}
