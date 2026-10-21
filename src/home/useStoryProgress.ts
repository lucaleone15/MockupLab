import { useEffect, useState, type RefObject } from 'react';

export type StoryChapter = 'open' | 'drop' | 'devices' | 'print' | 'studio' | 'motion' | 'social' | 'clients' | 'modes';
export const STORY: StoryChapter[] = ['open', 'drop', 'devices', 'print', 'studio', 'motion', 'social', 'clients', 'modes'];

/** Slices per chapter: the progress moves in steps of 2 %, eased by the 3D. */
export const SLICES = 50;

/**
 * Where the reader is in the story: the chapter and the progress through it
 * (0 → 1). Each chapter's track is cut into contiguous slices; an
 * IntersectionObserver watches a thin band across the middle of the screen,
 * so exactly one slice crosses it at a time, even when scrolling fast. No
 * scroll listener.
 */
export function useStoryProgress(root: RefObject<HTMLElement | null>, enabled = true) {
  const [state, setState] = useState<{ chapter: StoryChapter; progress: number }>({ chapter: 'open', progress: 0 });
  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).at(-1);
        if (!hit) return;
        const d = (hit.target as HTMLElement).dataset;
        const next = { chapter: d.chapter as StoryChapter, progress: (Number(d.slice) + 0.5) / SLICES };
        setState((s) => (s.chapter === next.chapter && s.progress === next.progress ? s : next));
      },
      { root: el, rootMargin: '-49.5% 0px -49.5% 0px', threshold: 0 },
    );
    el.querySelectorAll('[data-slice]').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [root, enabled]);
  return state;
}
