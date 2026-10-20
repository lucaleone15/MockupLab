import { navigate } from '@/shell/route';
import { library } from '@/store/persistence';
import { useUi } from '@/store/ui';
import { useLibrary, type ProjectMeta } from './store';

/** Opens a project from the library and shows its screen. */
export async function openProject(meta: ProjectMeta) {
  if (useLibrary.getState().currentId !== meta.id) await library.open(meta.id);
  useUi.getState().setAllProjectsOpen(false);
  navigate('studio');
}

/** "3 h ago" in the interface language. */
export function relativeTime(ms: number, lang: string) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const s = Math.round((ms - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
  ];
  let v = s;
  for (const [unit, size] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return rtf.format(Math.round(v), 'year');
}
