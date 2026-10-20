import { useEffect } from 'react';
import { exportImage } from '@/export/exportImage';
import { importImages, pickImages } from '@/lib/importImage';
import { picking } from '@/scene/interaction';
import { selectSelectedItem, useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { toast } from '@/store/toasts';
import { t } from '@/i18n';
import { MODEL_DRAG_TYPE } from './LibraryPanel';
import { saveProjectFile } from './projectFiles';

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl ';

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** ⌘S, ⌘O and ⌘D belong to the browser (save page, open file, bookmark — Arc's sidebar…): the web app leaves
 * them alone; the desktop app has no such conflict and keeps them. */
const IN_DESKTOP = typeof window !== 'undefined' && !!window.mockuplabDesktop;
const BROWSER_KEYS = ['sc.save', 'sc.open', 'sc.duplicate'];

/** Shortcut list shown in the help dialog: [keys, i18n key]. */
export const SHORTCUTS: [string, string][] = ([
  [`${MOD}Z`, 'sc.undo'],
  [`⇧${MOD}Z`, 'sc.redo'],
  [`${MOD}E`, 'sc.export'],
  [`${MOD}S`, 'sc.save'],
  [`${MOD}O`, 'sc.open'],
  [`${MOD}V`, 'sc.paste'],
  [`${MOD}D`, 'sc.duplicate'],
  ['⌫', 'sc.delete'],
  ['← ↑ → ↓', 'sc.nudge'],
  ['R', 'sc.rotate'],
  ['F', 'sc.frame'],
  ['Esc', 'sc.deselect'],
  ['?', 'sc.help'],
] as [string, string][]).filter(([, label]) => IN_DESKTOP || !BROWSER_KEYS.includes(label));

function onKey(e: KeyboardEvent) {
  if (isEditable(e.target) || e.defaultPrevented) return;
  // the home page shows no project: only the help shortcut works there
  if (useUi.getState().screen === 'home' && e.key !== '?') return;
  // an animation preview: only Escape (or space) to stop it
  if (useUi.getState().previewing) {
    if (e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      void import('@/animation/actions').then((m) => m.togglePreview());
    }
    return;
  }
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  const project = useProject.getState();
  const ui = useUi.getState();
  const item = selectSelectedItem(project);

  if (mod && key === 'z') {
    e.preventDefault();
    const h = useProject.temporal.getState();
    if (e.shiftKey) h.redo();
    else h.undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    useProject.temporal.getState().redo();
  } else if (mod && key === 'e') {
    e.preventDefault();
    // on a Video page ⌘E exports the video; anywhere else it opens the image export sheet
    const onVideo = ui.screen === 'studio' && ui.studioPage === 'video';
    if (onVideo) void exportImage('video');
    else ui.setExportOpen(true);
  } else if (mod && (key === 's' || key === 'o' || key === 'd') && !IN_DESKTOP) {
    // the browser's own shortcut
    return;
  } else if (mod && key === 's') {
    e.preventDefault();
    void saveProjectFile();
  } else if (mod && key === 'o') {
    e.preventDefault();
    pickImages();
  } else if (mod && key === 'd') {
    e.preventDefault();
    if (item) project.duplicateItem(item.id);
  } else if (!mod && (key === 'delete' || key === 'backspace')) {
    e.preventDefault();
    if (ui.selectedOverlayId) {
      project.removeOverlay(ui.selectedOverlayId);
      ui.selectOverlay(null);
    } else if (item) project.removeItem(item.id);
  } else if (!mod && key.startsWith('arrow') && item && !item.locked) {
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    const [x, y, z] = item.position;
    const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[key] ?? [0, 0];
    project.updateItem(item.id, { position: [x + d[0], y, z + d[1]] });
  } else if (!mod && !e.altKey && key === 'r' && item) {
    const delta = (e.shiftKey ? -15 : 15) * (Math.PI / 180);
    project.updateItem(item.id, (it) => ({ rotation: [it.rotation[0], it.rotation[1] + delta, it.rotation[2]] }));
  } else if (!mod && !e.altKey && key === 'f') {
    ui.resetView();
  } else if (key === 'escape') {
    ui.selectOverlay(null);
    ui.setHelpOpen(false);
  } else if (e.key === '?') {
    ui.setHelpOpen(!ui.helpOpen);
  }
}

/** Pasted or dropped files go where the screen expects them. */
function routeFiles(files: File[]) {
  const screen = useUi.getState().screen;
  if (screen === 'home') toast.info(t('home.pickMode'));
  else if (screen === 'quick') void import('@/quick/store').then((m) => files[0] && m.quick.setImage(files[0]));
  else if (screen === 'project') void import('@/project/store').then((m) => m.pack.add(files));
  else void importImages(files);
}

/** Global keyboard shortcuts, clipboard paste and drag & drop (files and library models). */
export function useGlobalInput() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        routeFiles(files);
      }
    };

    // A depth counter avoids flicker when the pointer crosses child elements.
    let depth = 0;
    const types = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])];
    const hasFiles = (e: DragEvent) => types(e).includes('Files');
    const hasModel = (e: DragEvent) => types(e).includes(MODEL_DRAG_TYPE);
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      useUi.getState().setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e) && !hasModel(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) useUi.getState().setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      const modelId = e.dataTransfer?.getData(MODEL_DRAG_TYPE);
      if (modelId) {
        // Library model dropped on the scene: place it where it was dropped.
        e.preventDefault();
        const at = picking.floor?.(e.clientX, e.clientY) ?? undefined;
        useProject.getState().addItem(modelId, at ?? undefined);
        return;
      }
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      useUi.getState().setDragging(false);
      const glb = [...(e.dataTransfer?.files ?? [])].find((f) => /\.(glb|gltf)$/i.test(f.name));
      if (glb) {
        void import('@/models/glb/userModels').then((m) => m.importModelFile(glb));
        return;
      }
      const screen = useUi.getState().screen;
      if (screen === 'home' || screen === 'quick' || screen === 'project') {
        if (e.dataTransfer?.files.length) routeFiles([...e.dataTransfer.files]);
        return;
      }
      // An image dropped on a device goes on that device's screen.
      const target = picking.item?.(e.clientX, e.clientY) ?? undefined;
      if (e.dataTransfer?.files.length) importImages(e.dataTransfer.files, target);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);
}
