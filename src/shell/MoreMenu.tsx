import { useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Check, Compass, Ellipsis, Keyboard, Languages, RotateCcw, SunMoon } from 'lucide-react';
import { useLang, useT } from '@/i18n';
import { ResetDialog } from '@/app/ResetDialog';
import { navigate } from './route';
import { useUi, type ThemePref } from '@/store/ui';
import { Kbd } from '@/ui/primitives';

const row = 'flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg';
const label = 'flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11.5px] font-medium text-fg-subtle';

/** Language, theme, shortcuts and "start over", out of the top bar. */
export function MoreMenu({ tone }: { tone?: 'light' } = {}) {
  const { t } = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const themePref = useUi((s) => s.themePref);
  const setThemePref = useUi((s) => s.setThemePref);
  const [reset, setReset] = useState(false);
  const tick = (on: boolean) => <Check size={14} className={on ? 'ml-auto' : 'ml-auto opacity-0'} />;
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={t('more.open')} data-testid="more-menu" className={tone === 'light' ? 'grid size-8 place-items-center rounded-[10px] text-white/85 hover:bg-white/15 hover:text-white' : 'grid size-8 place-items-center rounded-[10px] text-fg-muted hover:bg-surface-3 hover:text-fg'}>
            <Ellipsis size={18} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={8} align="end" className="menu-surface z-50 min-w-[240px] rounded-[14px] p-1.5 menu-pop">
            <DropdownMenu.Label className={label}>
              <Languages size={12} />
              {t('more.language')}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={lang} onValueChange={(v) => setLang(v as 'fr' | 'en')}>
              <DropdownMenu.RadioItem value="fr" className={row}>
                Français{tick(lang === 'fr')}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="en" className={row}>
                English{tick(lang === 'en')}
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
            <DropdownMenu.Label className={label}>
              <SunMoon size={12} />
              {t('more.theme')}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={themePref} onValueChange={(v) => setThemePref(v as ThemePref)}>
              {(['auto', 'light', 'dark'] as const).map((p) => (
                <DropdownMenu.RadioItem key={p} value={p} className={row}>
                  {t(`more.theme.${p}`)}
                  {tick(themePref === p)}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
            <DropdownMenu.Item
              className={row}
              data-testid="start-tour"
              onSelect={() => {
                navigate('studio');
                useUi.getState().setTourStep(0);
              }}
            >
              <Compass size={15} />
              {t('more.tour')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={row} onSelect={() => useUi.getState().setHelpOpen(true)}>
              <Keyboard size={15} />
              <span className="flex-1">{t('more.shortcuts')}</span>
              <Kbd>?</Kbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={row} onSelect={() => setReset(true)}>
              <RotateCcw size={15} />
              {t('more.reset')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ResetDialog open={reset} onOpenChange={setReset} />
    </>
  );
}
