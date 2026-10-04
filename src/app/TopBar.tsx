import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { DropdownMenu } from 'radix-ui';
import { Check, ChevronDown, CircleHelp, Download, FilePlus2, FolderOpen, Moon, Redo2, Save, Sun, Undo2 } from 'lucide-react';
import { useLang, useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { newProject } from '@/store/persistence';
import { openProjectFile, saveProjectFile } from './projectFiles';
import { ResetButton } from './ResetDialog';
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

/** Editable project name + autosave status + project menu. */
function ProjectControls() {
  const { t } = useT();
  const name = useProject((s) => s.name);
  const savedAt = useUi((s) => s.savedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-fg outline-none data-[highlighted]:bg-surface-4';
  return (
    <div className="ml-2 flex min-w-0 items-center gap-1">
      <input
        aria-label={t('project.name')}
        value={name === 'Untitled' ? '' : name}
        placeholder={t('project.untitled')}
        onChange={(e) => useProject.setState({ name: e.target.value || 'Untitled' })}
        className="h-7 w-[180px] min-w-0 rounded-md bg-transparent px-2 text-[13px] font-medium text-fg outline-none placeholder:text-fg-subtle hover:bg-surface-3 focus:bg-surface-3"
      />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={t('project.menu')} className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg">
            <ChevronDown size={15} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={6} align="start" className="z-50 min-w-[230px] rounded-xl bg-surface-3 p-1 shadow-2xl ring-1 ring-line-strong animate-[fade-in_120ms_ease-out]">
            <DropdownMenu.Item
              className={item}
              onSelect={() => {
                if (window.confirm(t('project.newConfirm'))) newProject();
              }}
            >
              <FilePlus2 size={15} className="text-fg-muted" />
              {t('project.new')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={openProjectFile}>
              <FolderOpen size={15} className="text-fg-muted" />
              {t('project.open')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={() => void saveProjectFile()}>
              <Save size={15} className="text-fg-muted" />
              <span className="flex-1">{t('project.save')}</span>
              <Kbd>{MOD}S</Kbd>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {savedAt && (
        <span className="ml-1 hidden items-center gap-1 text-[11.5px] text-fg-subtle lg:flex" title={new Date(savedAt).toLocaleTimeString()}>
          <Check size={12} />
          {t('project.autosaved')}
        </span>
      )}
    </div>
  );
}

/** 3D scene ⟷ photo mock-up. */
function ModeSwitch() {
  const { t } = useT();
  const mode = useProject((s) => s.mode);
  return (
    <div className="ml-2 w-[168px]" data-testid="mode-switch">
      <Segmented
        size="sm"
        value={mode}
        onChange={(m) => {
          useProject.getState().setMode(m);
          useUi.getState().setPhotoTool('select');
        }}
        options={[
          { value: 'scene', label: t('mode.scene'), title: t('mode.sceneHint') },
          { value: 'photo', label: t('mode.photo'), title: t('mode.photoHint') },
        ]}
      />
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
      <div className="mx-1 h-5 w-px bg-line" />
      <ProjectControls />
      <ModeSwitch />

      <div className="ml-auto flex items-center gap-1">
        <IconButton label={t('top.undo')} shortcut={`${MOD}Z`} disabled={!canUndo} onClick={() => useProject.temporal.getState().undo()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label={t('top.redo')} shortcut={`⇧${MOD}Z`} disabled={!canRedo} onClick={() => useProject.temporal.getState().redo()}>
          <Redo2 size={16} />
        </IconButton>
        <ResetButton />
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
        <IconButton label={t('help.open')} shortcut="?" onClick={() => useUi.getState().setHelpOpen(true)}>
          <CircleHelp size={16} />
        </IconButton>
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
