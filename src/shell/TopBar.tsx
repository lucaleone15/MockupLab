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

/** Logo / project · modes · undo, redo, more, export. */
export function TopBar() {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  const exporting = useUi((s) => s.exporting);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);
  const editor = screen === 'studio' || screen === 'photo';
  return (
    <header className="relative z-20 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-[var(--menu-bg)] px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <span className="text-fg-subtle">/</span>
        <ProjectMenu />
      </div>
      <ModeSwitch />
      <div className="flex items-center justify-end gap-1">
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
          <Button variant="primary" className="ml-2" onClick={() => useUi.getState().setExportOpen(true)} disabled={!!exporting} data-testid="top-export">
            <Download size={15} strokeWidth={2.2} />
            {t('top.export')}
          </Button>
        )}
      </div>
    </header>
  );
}
