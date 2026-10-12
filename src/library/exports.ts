import { del, get, set } from 'idb-keyval';
import { t } from '@/i18n';
import { toast } from '@/store/toasts';
import { db } from './db';
import { readIndex, useLibrary, writeIndex } from './store';

/*
 * Every image, video or ZIP the user downloads is kept with its project, so
 * it can be downloaded again without rendering it again. At most PER_PROJECT
 * per project and MAX_BYTES in all: the oldest go first.
 */

export interface ExportMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: number;
}

export const PER_PROJECT = 10;
export const MAX_BYTES = 500 * 1024 * 1024;

const listKey = (projectId: string) => `exports:${projectId}`;
const blobKey = (projectId: string, id: string) => `export:${projectId}:${id}`;
const KEPT = /\.(png|jpe?g|webp|mp4|webm|gif|zip)$/i;

export async function listExports(projectId: string): Promise<ExportMeta[]> {
  return ((await get(listKey(projectId), db)) as ExportMeta[] | undefined) ?? [];
}

export async function getExport(projectId: string, id: string): Promise<Blob | undefined> {
  return (await get(blobKey(projectId, id), db)) as Blob | undefined;
}

async function setCount(projectId: string, count: number) {
  const list = await readIndex();
  if (list.some((p) => p.id === projectId)) await writeIndex(list.map((p) => (p.id === projectId ? { ...p, exportCount: count } : p)));
}

export async function deleteExport(projectId: string, id: string) {
  const list = (await listExports(projectId)).filter((e) => e.id !== id);
  await del(blobKey(projectId, id), db);
  await set(listKey(projectId), list, db);
  await setCount(projectId, list.length);
}

export async function deleteAllExports(projectId: string) {
  for (const e of await listExports(projectId)) await del(blobKey(projectId, e.id), db);
  await del(listKey(projectId), db);
}

/** Total size of the kept exports, oldest first with their project. */
async function allExports() {
  const out: (ExportMeta & { projectId: string })[] = [];
  for (const p of await readIndex()) for (const e of await listExports(p.id)) out.push({ ...e, projectId: p.id });
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/** Keeps a downloaded file with the current project (called by download()). */
export async function recordExport(blob: Blob, name: string) {
  const projectId = useLibrary.getState().currentId;
  if (!projectId || !KEPT.test(name)) return;
  try {
    const meta: ExportMeta = { id: Math.random().toString(36).slice(2, 10), name, size: blob.size, type: blob.type, createdAt: Date.now() };
    await set(blobKey(projectId, meta.id), blob, db);
    let list = [meta, ...(await listExports(projectId))];
    for (const old of list.slice(PER_PROJECT)) await del(blobKey(projectId, old.id), db);
    list = list.slice(0, PER_PROJECT);
    await set(listKey(projectId), list, db);
    await setCount(projectId, list.length);
    // global ceiling: drop the oldest exports of any project
    const all = await allExports();
    let total = all.reduce((s, e) => s + e.size, 0);
    let purged = false;
    for (const e of all) {
      if (total <= MAX_BYTES) break;
      if (e.id === meta.id) continue;
      await deleteExport(e.projectId, e.id);
      total -= e.size;
      purged = true;
    }
    if (purged) toast.info(t('library.storageFull'));
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    toast.info(t('library.storageFull'));
  }
}
