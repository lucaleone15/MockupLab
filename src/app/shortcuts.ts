import { useEffect } from 'react';
import { exportImage } from '@/export/exportImage';
import { importImages, pickImages } from '@/lib/importImage';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl ';

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Global keyboard shortcuts, clipboard paste and file drag & drop. */
export function useGlobalInput() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
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
        exportImage();
      } else if (mod && key === 'o') {
        e.preventDefault();
        pickImages();
      } else if (!mod && !e.altKey && key === 'f') {
        useUi.getState().resetView();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        importImages(files);
      }
    };

    // Drag & drop anywhere in the window. A depth counter avoids flicker when
    // the pointer crosses child elements.
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      useUi.getState().setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) useUi.getState().setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      useUi.getState().setDragging(false);
      if (e.dataTransfer?.files.length) importImages(e.dataTransfer.files);
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
