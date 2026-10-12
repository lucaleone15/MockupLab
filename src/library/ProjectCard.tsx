import { DropdownMenu } from 'radix-ui';
import { Camera, Copy, Ellipsis, PencilLine, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useLang, useT } from '@/i18n';
import { library } from '@/store/persistence';
import { cx } from '@/ui/primitives';
import { openProject, relativeTime } from './actions';
import { useLibrary, type ProjectMeta } from './store';

const row = 'flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg';

/** One recent project: thumbnail, name, screen, date, exports; menu to rename, duplicate, delete. */
export function ProjectCard({ meta }: { meta: ProjectMeta }) {
  const { t } = useT();
  const lang = useLang((s) => s.lang);
  const thumb = useLibrary((s) => s.thumbs[meta.id]);
  const name = meta.name === 'Untitled' || !meta.name ? t('project.untitled') : meta.name;
  const photo = meta.mode === 'photo';
  return (
    <div data-testid="project-card" className="glass group relative flex flex-col overflow-hidden rounded-[16px]">
      <button type="button" aria-label={`${t('home.open')} ${name}`} onClick={() => void openProject(meta)} className="flex flex-col text-left">
        <span className={cx('grid aspect-[16/10] place-items-center overflow-hidden bg-surface-2 text-fg-subtle')}>
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out-quart)] group-hover:scale-[1.03]" draggable={false} />
          ) : photo ? (
            <Camera size={26} strokeWidth={1.5} />
          ) : (
            <SlidersHorizontal size={26} strokeWidth={1.5} />
          )}
        </span>
        <span className="flex flex-col gap-0.5 px-3.5 pb-3 pt-2.5">
          <span className="truncate text-[14px] font-semibold">{name}</span>
          <span className="truncate text-[12.5px] text-fg-muted">
            {t(photo ? 'screen.photo' : 'screen.studio')}, {relativeTime(meta.updatedAt, lang)}
            {meta.exportCount > 0 && `, ${t('library.exports', { n: meta.exportCount })}`}
          </span>
        </span>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={t('library.options', { name })}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity duration-150 hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <Ellipsis size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={6} align="end" className="menu-surface z-50 min-w-[200px] rounded-[14px] p-1.5 animate-[fade-in_120ms_ease-out]">
            <DropdownMenu.Item
              className={row}
              onSelect={() => {
                const next = window.prompt(t('library.renamePrompt'), name);
                if (next !== null && next.trim()) void library.rename(meta.id, next.trim());
              }}
            >
              <PencilLine size={15} />
              {t('library.rename')}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={row} onSelect={() => void library.duplicate(meta.id)}>
              <Copy size={15} />
              {t('library.duplicate')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
            <DropdownMenu.Item
              className={cx(row, 'text-danger')}
              onSelect={() => {
                if (window.confirm(t('library.deleteConfirm', { name }))) void library.remove(meta.id);
              }}
            >
              <Trash2 size={15} />
              {t('library.delete')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
