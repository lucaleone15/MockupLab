import { useEffect, useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Check, ChevronDown, Copy, FilePlus2, FolderOpen, LayoutGrid, Save } from 'lucide-react';
import { useLibrary } from '@/library/store';
import { useT } from '@/i18n';
import { library, newProject } from '@/store/persistence';
import { openProjectFile, saveProjectFile } from '@/app/projectFiles';
import { MOD } from '@/app/shortcuts';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Kbd } from '@/ui/primitives';

/** Editable project name + autosave status + project menu. */
export function ProjectMenu() {
  const { t } = useT();
  const name = useProject((s) => s.name);
  const savedAt = useUi((s) => s.savedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg';
  return (
    <div className="flex min-w-0 items-center gap-1">
      <input
        aria-label={t('project.name')}
        name="project-name"
        autoComplete="off"
        spellCheck={false}
        value={name === 'Untitled' ? '' : name}
        placeholder={t('project.untitled')}
        onChange={(e) => useProject.setState({ name: e.target.value || 'Untitled' })}
        className="h-8 w-[200px] min-w-0 rounded-[10px] bg-transparent px-2 text-[13.5px] font-medium text-fg outline-none placeholder:text-fg-subtle hover:bg-surface-3 focus:bg-surface-3"
      />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={t('project.menu')} className="grid size-8 place-items-center rounded-[10px] text-fg-muted hover:bg-surface-3 hover:text-fg">
            <ChevronDown size={15} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={6} align="start" className="menu-surface z-50 min-w-[240px] rounded-[14px] p-1.5 animate-[fade-in_120ms_ease-out]">
            <DropdownMenu.Item
              className={item}
              onSelect={() => newProject()}
            >
              <FilePlus2 size={15} />
              {t('project.new')}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={item}
              onSelect={async () => {
                const id = useLibrary.getState().currentId;
                if (!id) return;
                const copy = await library.duplicate(id);
                if (copy) await library.open(copy);
              }}
            >
              <Copy size={15} />
              {t('project.duplicate')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={() => useUi.getState().setAllProjectsOpen(true)}>
              <LayoutGrid size={15} />
              {t('library.all')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
            <DropdownMenu.Item className={item} onSelect={openProjectFile}>
              <FolderOpen size={15} />
              {t('project.open')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={() => void saveProjectFile()}>
              <Save size={15} />
              <span className="flex-1">{t('project.save')}</span>
              <Kbd>{MOD}S</Kbd>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {savedAt && (
        <span className="ml-1 hidden items-center gap-1 text-[12px] text-fg-subtle xl:flex" title={new Date(savedAt).toLocaleTimeString()}>
          <Check size={12} />
          {t('project.autosaved')}
        </span>
      )}
    </div>
  );
}
