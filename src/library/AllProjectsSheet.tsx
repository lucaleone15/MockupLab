import { useT } from '@/i18n';
import { useUi } from '@/store/ui';
import { Sheet } from '@/ui/primitives';
import { ProjectCard } from './ProjectCard';
import { useLibrary } from './store';

/** Every stored project, newest first. */
export function AllProjectsSheet() {
  const { t } = useT();
  const open = useUi((s) => s.allProjectsOpen);
  const list = useLibrary((s) => s.list);
  return (
    <Sheet open={open} onOpenChange={useUi.getState().setAllProjectsOpen} title={t('library.all')} size="lg" testId="all-projects">
      {list.length === 0 ? (
        <p className="text-[13px] text-fg-muted">{t('library.none')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {list.map((m) => (
            <ProjectCard key={m.id} meta={m} />
          ))}
        </div>
      )}
    </Sheet>
  );
}
