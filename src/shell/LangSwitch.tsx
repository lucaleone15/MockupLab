import { useLang, useT, type Lang } from '@/i18n';
import { cx } from '@/ui/primitives';

const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'fr', label: 'FR', name: 'Français' },
  { id: 'en', label: 'EN', name: 'English' },
];

/** FR · EN, always in sight (in Switzerland the language is the first thing people look for). */
export function LangSwitch({ tone }: { tone?: 'light' } = {}) {
  const { t } = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const light = tone === 'light';
  return (
    <div role="group" aria-label={t('more.language')} data-testid="lang-switch" className="flex items-center gap-0.5">
      {LANGS.map((l) => {
        const on = lang === l.id;
        return (
          <button
            key={l.id}
            type="button"
            lang={l.id}
            aria-label={l.name}
            aria-pressed={on}
            onClick={() => !on && setLang(l.id)}
            className={cx(
              'h-7 rounded-full px-2 text-[12px] font-semibold tracking-[0.04em] transition-colors',
              on
                ? light
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-3 text-fg'
                : light
                  ? 'text-white/55 hover:text-white'
                  : 'text-fg-subtle hover:text-fg',
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
