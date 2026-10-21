import { useStore } from 'zustand';
import { Download, Redo2, Undo2 } from 'lucide-react';
import { useT } from '@/i18n';
import { MOD } from '@/app/shortcuts';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, IconButton } from '@/ui/primitives';
import { Logo } from './Logo';
import { ModeSwitch } from './ModeSwitch';
import { MoreMenu } from './MoreMenu';
import { ProjectMenu } from './ProjectMenu';

/** Height of the band the top bar's capsules float in (screens without a scene start below it). */
export const TOP_BAR = 60;

/** Logo / project · modes · undo, redo, more, export: three glass capsules floating over the screen. */
export function TopBar() {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  const exporting = useUi((s) => s.exporting);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);
  const editor = screen === 'studio';
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3" style={{ height: TOP_BAR }}>
      <div data-testid="topbar-left" className="glass-float pointer-events-auto flex h-11 min-w-0 items-center gap-3 justify-self-start rounded-full pl-3.5 pr-1.5">
        <Logo />
        <span className="text-fg-subtle">/</span>
        <ProjectMenu />
      </div>
      <div className="glass-float pointer-events-auto rounded-full p-1">
        <ModeSwitch />
      </div>
      <div data-testid="topbar-right" className="glass-float pointer-events-auto flex h-11 items-center justify-end gap-1 justify-self-end rounded-full px-1.5">
        {editor && (
          <>
            <IconButton label={t('top.undo')} shortcut={`${MOD}Z`} disabled={!canUndo} onClick={() => useProject.temporal.getState().undo()}>
              <Undo2 size={17} />
            </IconButton>
            <IconButton label={t('top.redo')} shortcut={`⇧${MOD}Z`} disabled={!canRedo} onClick={() => useProject.temporal.getState().redo()}>
              <Redo2 size={17} />
            </IconButton>
          </>
        )}
        <MoreMenu />
        {editor && (
          <Button variant="primary" className="ml-1 rounded-full" onClick={() => useUi.getState().setExportOpen(true)} disabled={!!exporting} data-testid="top-export">
            <Download size={15} strokeWidth={2.2} />
            {t('top.export')}
          </Button>
        )}
      </div>
    </header>
  );
}
