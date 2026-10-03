import { create } from 'zustand';
import { fr } from './fr';
import { en } from './en';

export type Lang = 'fr' | 'en';
export type I18nKey = keyof typeof fr;
export type Dict = Record<I18nKey, string>;
/** A string available in every UI language (used by model modules). */
export type I18nString = Record<Lang, string>;

const dicts: Record<Lang, Dict> = { fr, en };
const STORAGE_KEY = 'mockuplab:lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLang = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Non-reactive translation, for use outside React (toasts, exports). */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  return format(dicts[useLang.getState().lang][key], vars);
}

/** Reactive translation hook. */
export function useT() {
  const lang = useLang((s) => s.lang);
  return {
    lang,
    t: (key: I18nKey, vars?: Record<string, string | number>) => format(dicts[lang][key], vars),
    tr: (s: I18nString) => s[lang],
  };
}
