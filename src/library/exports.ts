import { del, get, set } from 'idb-keyval';
import { t } from '@/i18n';
import { toast } from '@/store/toasts';
import { db } from './db';
import { readIndex, useLibrary, writeIndex } from './store';
import { library, loadAssets, migrateProject, referencedAssets, snapshot } from '@/store/persistence';
import { useProject, type AnimationId, type Project, type RatioPreset } from '@/store/project';
import { useUi } from '@/store/ui';
import { navigate } from '@/shell/route';

/*
 * Every image, video or ZIP the user downloads is kept with its project:
 * the file (at most PER_PROJECT per project and MAX_BYTES in all, the oldest
 * go first), its settings and a snapshot of the scene. An entry whose file
 * went stays, so its scene can still be resumed and exported again.
 */

/** What an export was made with. */
export interface ExportSettingsRecord {
  kind: 'image' | 'video';
  format: string;
  width: number;
  height: number;
  ratio: RatioPreset;
  duration?: number;
  animation?: AnimationId;
}

export interface ExportMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: number;
  /** The file is still stored (it can be downloaded again). */
  hasFile?: boolean;
  settings?: ExportSettingsRecord;
  /** The scene at the time of the export (its images are assets of the project). */
  snapshot?: Project;
}

export const PER_PROJECT = 30;
export const MAX_BYTES = 500 * 1024 * 1024;

const listKey = (projectId: string) => `exports:${projectId}`;
const blobKey = (projectId: string, id: string) => `export:${projectId}:${id}`;
const KEPT = /\.(png|jpe?g|webp|mp4|webm|gif|zip)$/i;

export async function listExports(projectId: string): Promise<ExportMeta[]> {
  const list = ((await get(listKey(projectId), db)) as ExportMeta[] | undefined) ?? [];
  // entries saved before snapshots existed all had their file
  return list.map((e) => ({ ...e, hasFile: e.hasFile ?? true }));
}

export async function getExport(projectId: string, id: string): Promise<Blob | undefined> {
  return (await get(blobKey(projectId, id), db)) as Blob | undefined;
}

/** Keeps the export count and the images the snapshots use in the project's index entry. */
async function syncIndex(projectId: string, list: ExportMeta[]) {
  const exportAssets = [...new Set(list.flatMap((e) => (e.snapshot ? [...referencedAssets(e.snapshot)] : [])))];
  const index = await readIndex();
  if (index.some((p) => p.id === projectId)) await writeIndex(index.map((p) => (p.id === projectId ? { ...p, exportCount: list.length, exportAssets } : p)));
}

/** Deletes an export (its entry and its file). */
export async function deleteExport(projectId: string, id: string) {
  const list = (await listExports(projectId)).filter((e) => e.id !== id);
  await del(blobKey(projectId, id), db);
  await set(listKey(projectId), list, db);
  await syncIndex(projectId, list);
}

/** Frees an export's file; its entry, settings and scene stay. */
async function dropFile(projectId: string, id: string) {
  await del(blobKey(projectId, id), db);
  const list = (await listExports(projectId)).map((e) => (e.id === id ? { ...e, hasFile: false } : e));
  await set(listKey(projectId), list, db);
}

export async function deleteAllExports(projectId: string) {
  for (const e of await listExports(projectId)) await del(blobKey(projectId, e.id), db);
  await del(listKey(projectId), db);
}

/** The stored export files, oldest first with their project. */
async function allExports() {
  const out: (ExportMeta & { projectId: string })[] = [];
  for (const p of await readIndex()) for (const e of await listExports(p.id)) if (e.hasFile) out.push({ ...e, projectId: p.id });
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

/** Keeps a downloaded file with the current project, its settings and the scene (called by download()). */
export async function recordExport(blob: Blob, name: string, settings?: ExportSettingsRecord) {
  const projectId = useLibrary.getState().currentId;
  if (!projectId || !KEPT.test(name)) return;
  try {
    const meta: ExportMeta = { id: Math.random().toString(36).slice(2, 10), name, size: blob.size, type: blob.type, createdAt: Date.now(), hasFile: true, settings, snapshot: snapshot() };
    await set(blobKey(projectId, meta.id), blob, db);
    const list = [meta, ...(await listExports(projectId))];
    // past the limit, the oldest files go; their entries stay
    let kept = 0;
    for (const e of list) {
      if (!e.hasFile) continue;
      if (++kept <= PER_PROJECT) continue;
      await del(blobKey(projectId, e.id), db);
      e.hasFile = false;
    }
    await set(listKey(projectId), list, db);
    await syncIndex(projectId, list);
    // global ceiling: free the oldest files of any project
    const all = await allExports();
    let total = all.reduce((s, e) => s + e.size, 0);
    let purged = false;
    for (const e of all) {
      if (total <= MAX_BYTES) break;
      if (e.id === meta.id) continue;
      await dropFile(e.projectId, e.id);
      total -= e.size;
      purged = true;
    }
    if (purged) toast.info(t('library.storageFull'));
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    toast.info(t('library.storageFull'));
  }
}

/** Opens the Studio on the scene of an export, as one undoable step. */
export async function resumeExport(projectId: string, id: string) {
  const entry = (await listExports(projectId)).find((e) => e.id === id);
  if (!entry?.snapshot) return;
  if (useLibrary.getState().currentId !== projectId) await library.open(projectId);
  const project = migrateProject(entry.snapshot);
  await loadAssets(project);
  // keep the project's own name: resuming an old export does not rename it
  const { name } = useProject.getState();
  useProject.setState({ ...project, name });
  useUi.getState().resetView();
  navigate('studio');
}
