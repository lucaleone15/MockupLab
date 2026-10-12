import { create } from 'zustand';
import { del, get, keys, set } from 'idb-keyval';
import { db } from './db';

/*
 * Several projects, each autosaved under its own key. The index keeps what
 * the home page needs (name, mode, date, images used, number of exports) so
 * listing projects or cleaning unused images never loads every project.
 */

export interface ProjectMeta {
  id: string;
  name: string;
  mode: 'scene' | 'photo';
  updatedAt: number;
  /** Image ids the project uses (images are shared between projects). */
  assets: string[];
  exportCount: number;
  hasThumb: boolean;
}

export const INDEX_KEY = 'projects';
export const LEGACY_KEY = 'project';
export const projectKey = (id: string) => `project:${id}`;
export const thumbKey = (id: string) => `thumb:${id}`;
export const assetKey = (id: string) => `asset:${id}`;
const CURRENT = 'mockuplab:current';

interface LibraryState {
  list: ProjectMeta[];
  /** Project being edited (null: a fresh project not saved yet). */
  currentId: string | null;
  /** Object URLs of the thumbnails, by project id. */
  thumbs: Record<string, string>;
}

export const useLibrary = create<LibraryState>(() => ({ list: [], currentId: null, thumbs: {} }));

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function rememberCurrent(id: string | null) {
  useLibrary.setState({ currentId: id });
  try {
    if (id) localStorage.setItem(CURRENT, id);
    else localStorage.removeItem(CURRENT);
  } catch {
    /* storage unavailable */
  }
}

export function storedCurrent(): string | null {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}

const byDate = (a: ProjectMeta, b: ProjectMeta) => b.updatedAt - a.updatedAt;

export async function readIndex(): Promise<ProjectMeta[]> {
  const list = ((await get(INDEX_KEY, db)) as ProjectMeta[] | undefined) ?? [];
  return [...list].sort(byDate);
}

export async function writeIndex(list: ProjectMeta[]) {
  const sorted = [...list].sort(byDate);
  await set(INDEX_KEY, sorted, db);
  useLibrary.setState({ list: sorted });
}

export async function upsertMeta(meta: ProjectMeta) {
  const list = await readIndex();
  await writeIndex([meta, ...list.filter((p) => p.id !== meta.id)]);
}

/** Deletes stored images that no project of the index uses any more. */
export async function collectUnusedAssets(extraInUse: Iterable<string> = []) {
  const list = await readIndex();
  const used = new Set<string>(extraInUse);
  for (const p of list) for (const a of p.assets) used.add(a);
  for (const k of (await keys(db)).map(String)) if (k.startsWith('asset:') && !used.has(k.slice(6))) await del(k, db);
}

/** Loads the thumbnails of the listed projects as object URLs. */
export async function loadThumbs() {
  const thumbs: Record<string, string> = { ...useLibrary.getState().thumbs };
  for (const p of useLibrary.getState().list) {
    if (!p.hasThumb || thumbs[p.id]) continue;
    const blob = (await get(thumbKey(p.id), db)) as Blob | undefined;
    if (blob) thumbs[p.id] = URL.createObjectURL(blob);
  }
  useLibrary.setState({ thumbs });
}

export async function storeThumb(id: string, blob: Blob) {
  await set(thumbKey(id), blob, db);
  const old = useLibrary.getState().thumbs[id];
  if (old) URL.revokeObjectURL(old);
  useLibrary.setState((s) => ({ thumbs: { ...s.thumbs, [id]: URL.createObjectURL(blob) } }));
  const list = await readIndex();
  const meta = list.find((p) => p.id === id);
  if (meta && !meta.hasThumb) await writeIndex(list.map((p) => (p.id === id ? { ...p, hasThumb: true } : p)));
}
