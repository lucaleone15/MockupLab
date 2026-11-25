import { useStore } from 'zustand';
import { Download, Redo2, Undo2 } from 'lucide-react';
import { useT } from '@/i18n';
import { MOD } from '@/app/shortcuts';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, IconButton, cx } from '@/ui/primitives';
import { BAND, BAR, TOP_BAR } from './SiteHeader';
import { Logo } from './Logo';
import { ModeSwitch } from './ModeSwitch';
import { MoreMenu } from './MoreMenu';
import { LangSwitch } from './LangSwitch';
import { ProjectMenu } from './ProjectMenu';
import { useCompact } from '@/ui/useCompact';

export { TOP_BAR };

/** Logo / project · modes · undo, redo, language, more, export: the same single bar as the pages (SiteHeader). */
export function TopBar() {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  const exporting = useUi((s) => s.exporting);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);
  const editor = screen === 'studio';
  // on a phone: the mark alone, the mode as a menu, undo and an export icon
  const compact = useCompact();
  return (
    <header className={cx('pointer-events-none absolute inset-x-0 top-0 z-30', BAND)} style={{ height: TOP_BAR, viewTransitionName: 'top-bar' }}>
      <div data-testid="topbar" className={cx(BAR, 'grid grid-cols-[1fr_auto_1fr] gap-3 pl-4 pr-1.5 max-md:gap-1.5 max-md:pl-3')}>
        <div data-testid="topbar-left" className="flex min-w-0 items-center gap-3 justify-self-start max-md:gap-0.5">
          <Logo markOnly={compact} />
          {!compact && <span className="text-fg-subtle">/</span>}
          <ProjectMenu compact={compact} />
        </div>
        <ModeSwitch />
        <div data-testid="topbar-right" className="flex items-center justify-end gap-1 justify-self-end">
          {editor && (
            <>
              <IconButton label={t('top.undo')} shortcut={`${MOD}Z`} disabled={!canUndo} onClick={() => useProject.temporal.getState().undo()}>
                <Undo2 size={17} />
              </IconButton>
              {!compact && (
                <IconButton label={t('top.redo')} shortcut={`⇧${MOD}Z`} disabled={!canRedo} onClick={() => useProject.temporal.getState().redo()}>
                  <Redo2 size={17} />
                </IconButton>
              )}
            </>
          )}
          {!compact && <LangSwitch />}
          <MoreMenu />
          {editor && (
            <Button variant="primary" className={compact ? 'size-9 rounded-full !px-0' : 'ml-1 h-9 rounded-full'} aria-label={compact ? t('top.export') : undefined} onClick={() => useUi.getState().setExportOpen(true)} disabled={!!exporting} data-testid="top-export">
              <Download size={15} strokeWidth={2.2} />
              {!compact && t('top.export')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
