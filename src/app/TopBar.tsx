import { useStore } from 'zustand';
import { Download, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import { useLang, useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, IconButton, Kbd, Segmented } from '@/ui/primitives';
import { MOD } from './shortcuts';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-7 place-items-center rounded-[9px] bg-fg text-bg">
        <span className="block h-[15px] w-[9px] rounded-[3px] border-[1.75px] border-current" />
        <span className="absolute right-[5px] top-[5px] size-[5px] rounded-full bg-accent" />
      </div>
      <div className="flex items-baseline gap-0.5 text-[17px] leading-none tracking-[-0.02em]">
        <span className="font-semibold">Mockup</span>
        <span className="font-display text-[20px] italic text-accent">Lab</span>
      </div>
    </div>
  );
}

export function TopBar() {
  const { t } = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const exporting = useUi((s) => s.exporting);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <Logo />
      <span className="ml-1 hidden text-[12px] text-fg-subtle md:inline">{t('app.tagline')}</span>

      <div className="ml-auto flex items-center gap-1">
        <IconButton label={t('top.undo')} shortcut={`${MOD}Z`} disabled={!canUndo} onClick={() => useProject.temporal.getState().undo()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label={t('top.redo')} shortcut={`⇧${MOD}Z`} disabled={!canRedo} onClick={() => useProject.temporal.getState().redo()}>
          <Redo2 size={16} />
        </IconButton>
        <div className="mx-2 h-5 w-px bg-line" />
        <div className="w-[84px]">
          <Segmented
            size="sm"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'fr', label: 'FR', title: 'Français' },
              { value: 'en', label: 'EN', title: 'English' },
            ]}
          />
        </div>
        <IconButton label={t('top.theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        <div className="mx-2 h-5 w-px bg-line" />
        <Button variant="primary" onClick={exportImage} disabled={!!exporting} className="gap-2 pr-2">
          <Download size={15} strokeWidth={2.2} />
          {t('top.export')}
          <Kbd inverted>{MOD}E</Kbd>
        </Button>
      </div>
    </header>
  );
}
