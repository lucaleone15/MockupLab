import { useEffect, useState } from 'react';
import { Download, FileJson, ImagePlus, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { download } from '@/export/exportImage';
import { useProject } from '@/store/project';
import { Spinner, Tooltip, cx } from '@/ui/primitives';
import { pickPhoto } from './importPhoto';
import { PHOTO_TEMPLATES, applyTemplate, applyUserTemplate, deleteUserTemplate, importTemplateFile, loadUserTemplates, templateFile, templateUrl, useTemplates } from './templates';

function Card({ active, loading, src, label, onClick, children }: { active: boolean; loading: boolean; src: string; label: string; onClick: () => void; children?: React.ReactNode }) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={cx(
          'flex w-full flex-col overflow-hidden rounded-xl bg-surface-2 text-left text-[11.5px] leading-tight transition-[box-shadow,transform] duration-150 active:scale-[0.98]',
          active ? 'text-fg shadow-[0_0_0_1.5px_var(--accent)_inset]' : 'text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
        )}
      >
        <img src={src} alt="" className={cx('aspect-[3/2] w-full object-cover', active ? 'p-[1.5px] pb-0 rounded-t-xl' : '')} draggable={false} />
        <span className="truncate px-2.5 py-2">{label}</span>
      </button>
      {loading && (
        <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/40">
          <Spinner />
        </div>
      )}
      {children}
    </div>
  );
}

function pickTemplateFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => input.files?.[0] && importTemplateFile(input.files[0]);
  input.click();
}

/** Left panel in photo mode: bundled templates, the user's saved templates, photo import. */
export function PhotoLibrary() {
  const { t, tr } = useT();
  const templateId = useProject((s) => s.photo.templateId);
  const mine = useTemplates((s) => s.list);
  const [loading, setLoading] = useState<string | null>(null);
  useEffect(() => {
    if (!useTemplates.getState().loaded) void loadUserTemplates();
  }, []);
  const run = async (id: string, fn: () => Promise<unknown>) => {
    setLoading(id);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  };

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface" data-testid="photo-library">
      <div className="shrink-0 px-4 pb-2 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('photo.library')}</div>
        <p className="mt-1.5 text-[11px] leading-snug text-fg-subtle">{t('photo.library.hint')}</p>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
        <button
          type="button"
          onClick={pickPhoto}
          className="mb-4 flex w-full items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3 py-3 text-left text-[12px] font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg"
        >
          <ImagePlus size={16} className="text-accent" />
          {t('photo.import')}
        </button>

        <div className="mb-2 px-1 text-[12px] font-medium text-fg">{t('photo.templates')}</div>
        <div className="mb-4 grid grid-cols-1 gap-2">
          {PHOTO_TEMPLATES.map((tpl) => (
            <Card key={tpl.id} active={templateId === tpl.id} loading={loading === tpl.id} src={templateUrl(tpl.thumb)} label={tr(tpl.name)} onClick={() => run(tpl.id, () => applyTemplate(tpl))} />
          ))}
        </div>

        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[12px] font-medium text-fg">{t('photo.myTemplates')}</span>
          <Tooltip label={t('photo.template.importFile')}>
            <button type="button" aria-label={t('photo.template.importFile')} onClick={pickTemplateFile} className="grid size-6 place-items-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg">
              <FileJson size={14} />
            </button>
          </Tooltip>
        </div>
        {mine.length === 0 ? (
          <p className="mx-1 rounded-lg border border-dashed border-line-strong p-3 text-[11.5px] leading-relaxed text-fg-subtle">{t('photo.myTemplates.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {mine.map((tpl) => (
              <Card key={tpl.id} active={templateId === `user:${tpl.id}`} loading={loading === tpl.id} src={tpl.url} label={tpl.name} onClick={() => run(tpl.id, () => applyUserTemplate(tpl))}>
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Tooltip label={t('photo.template.exportFile')}>
                    <button
                      type="button"
                      aria-label={t('photo.template.exportFile')}
                      onClick={async () => {
                        const f = await templateFile(tpl);
                        download(f.blob, f.filename);
                      }}
                      className="grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                    >
                      <Download size={12} />
                    </button>
                  </Tooltip>
                  <Tooltip label={t('photo.template.delete')}>
                    <button
                      type="button"
                      aria-label={t('photo.template.delete')}
                      onClick={() => {
                        if (window.confirm(t('photo.template.deleteConfirm', { name: tpl.name }))) void deleteUserTemplate(tpl.id);
                      }}
                      className="grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </Tooltip>
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="mx-1 mt-4 text-[10.5px] leading-relaxed text-fg-subtle">{t('photo.credits')}</p>
      </div>
    </aside>
  );
}
