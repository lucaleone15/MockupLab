import { create } from 'zustand';
import { t } from '@/i18n';
import { download, formatBytes, slugify } from '@/export/exportImage';
import { ZipWriter } from '@/lib/zip';
import { useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { AXES, applyLook, generateLooks, refineLook, type Axis, type Look } from './looks';
import { inSandbox, renderFull, renderThumb, showLook, whenIdle } from './render';

/*
 * Variants gallery: generated looks, their thumbnails (rendered one after the
 * other in a sandbox), the selection, and the actions on it.
 */

interface VariantsState {
  open: boolean;
  looks: Look[];
  thumbs: Record<string, string>;
  selected: string[];
  axes: Axis[];
  count: number;
  /** What is running: thumbnails or an export, with progress. */
  job: { kind: 'thumbs' | 'export'; done: number; total: number } | null;
}

export const useVariants = create<VariantsState>(() => ({
  open: false,
  looks: [],
  thumbs: {},
  selected: [],
  axes: [...AXES],
  count: 9,
  job: null,
}));

let run = 0;
const set = useVariants.setState;
const get = useVariants.getState;

/** Renders the thumbnails still missing, in order (a newer request cancels this one). */
async function renderMissing() {
  const token = ++run;
  const todo = () => get().looks.filter((l) => !get().thumbs[l.id]);
  if (!todo().length) return;
  set({ job: { kind: 'thumbs', done: 0, total: todo().length } });
  try {
    await inSandbox(async () => {
      let done = 0;
      for (let next = todo()[0]; next && token === run; next = todo()[0]) {
        await showLook(next);
        if (token !== run) break;
        const url = await renderThumb();
        set((s) => ({ thumbs: { ...s.thumbs, [next.id]: url }, job: s.job && { ...s.job, done: ++done, total: done + todo().length - 1 } }));
      }
    });
  } finally {
    if (token === run) set({ job: null });
  }
}

function drop(ids: string[]) {
  const { thumbs } = get();
  for (const id of ids) if (thumbs[id]) URL.revokeObjectURL(thumbs[id]);
}

export const variants = {
  open() {
    set({ open: true });
    if (!get().looks.length) variants.generate();
    else void renderMissing();
  },
  close() {
    run++;
    set({ open: false, job: null });
  },
  setAxes(axes: Axis[]) {
    set({ axes });
  },
  setCount(count: number) {
    set({ count });
  },
  /** New looks; the selected ones are kept. */
  generate() {
    const { looks, selected, count, axes } = get();
    const keep = looks.filter((l) => selected.includes(l.id));
    drop(looks.filter((l) => !selected.includes(l.id)).map((l) => l.id));
    const fresh = generateLooks(Math.max(0, count - keep.length), axes.length ? axes : AXES, Math.floor(Math.random() * 1e9), useProject.getState());
    set((s) => ({ looks: [...keep, ...fresh], thumbs: Object.fromEntries(Object.entries(s.thumbs).filter(([id]) => keep.some((l) => l.id === id))) }));
    void renderMissing();
  },
  /** Variations around one look, in place of the unselected ones. */
  refine(id: string) {
    const { looks, selected, count } = get();
    const base = looks.find((l) => l.id === id);
    if (!base) return;
    const keep = looks.filter((l) => l.id === id || selected.includes(l.id));
    drop(looks.filter((l) => !keep.includes(l)).map((l) => l.id));
    const fresh = refineLook(base, Math.max(3, count - keep.length), Math.floor(Math.random() * 1e9), useProject.getState());
    set((s) => ({ looks: [...keep, ...fresh], selected: s.selected.includes(id) ? s.selected : [...s.selected, id], thumbs: Object.fromEntries(Object.entries(s.thumbs).filter(([k]) => keep.some((l) => l.id === k))) }));
    void renderMissing();
  },
  toggle(id: string) {
    set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] }));
  },
  selectAll(all: boolean) {
    set((s) => ({ selected: all ? s.looks.map((l) => l.id) : [] }));
  },
  /** Makes a look the current scene (one undo step) and closes the gallery. */
  async apply(id: string) {
    const look = get().looks.find((l) => l.id === id);
    if (!look) return;
    variants.close();
    // a running thumbnail puts the project back first
    await whenIdle();
    applyLook(look);
    useUi.getState().resetView();
    toast.success(t('variants.applied'));
  },
  /** Exports the selected looks at the export settings: one image, or a ZIP. */
  async exportSelected() {
    const { looks, selected } = get();
    const chosen = looks.filter((l) => selected.includes(l.id));
    if (!chosen.length) return;
    const token = ++run;
    set({ job: { kind: 'export', done: 0, total: chosen.length } });
    try {
      const files = await inSandbox(async () => {
        const out: { name: string; blob: Blob }[] = [];
        for (const [i, look] of chosen.entries()) {
          if (token !== run) break;
          await showLook(look);
          const r = await renderFull();
          out.push({ name: `mockuplab-${String(i + 1).padStart(2, '0')}-${slugify(look.label) || 'variante'}-${r.width}x${r.height}.${r.ext}`, blob: r.blob });
          set({ job: { kind: 'export', done: i + 1, total: chosen.length } });
        }
        return out;
      });
      if (token !== run || !files.length) return;
      if (files.length === 1) {
        download(files[0].blob, files[0].name);
        toast.success(t('variants.exported1', { size: formatBytes(files[0].blob.size) }));
      } else {
        const zip = new ZipWriter();
        for (const f of files) await zip.add(f.name, f.blob);
        const blob = zip.finish();
        download(blob, `mockuplab-variantes-${files.length}.zip`);
        toast.success(t('variants.exported', { n: files.length, size: formatBytes(blob.size) }));
      }
    } catch (e) {
      toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (token === run) set({ job: null });
      void renderMissing();
    }
  },
  cancel() {
    run++;
    set({ job: null });
  },
};
