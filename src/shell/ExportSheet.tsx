import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { deleteExport, getExport, listExports, type ExportMeta } from '@/library/exports';
import { useLibrary } from '@/library/store';
import { useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { ExportForm } from '@/app/PropertiesPanel';
import { photoOutputSize } from '@/photo/exportPhoto';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Sheet } from '@/ui/primitives';

/** Saves a kept export again, without recording it a second time. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** The project's kept exports: download again or delete. */
function RecentExports() {
  const { t, lang } = useT();
  const id = useLibrary((s) => s.currentId);
  const count = useLibrary((s) => s.list.find((p) => p.id === s.currentId)?.exportCount ?? 0);
  const [list, setList] = useState<ExportMeta[]>([]);
  useEffect(() => {
    if (id) void listExports(id).then(setList);
    else setList([]);
  }, [id, count]);
  if (!id || !list.length) return null;
  const size = new Intl.NumberFormat(lang, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 });
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-[13px] font-semibold">{t('library.recentExports')}</h3>
      <ul className="flex flex-col gap-1">
        {list.map((e) => (
          <li key={e.id} data-testid="recent-export" className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{e.name}</span>
              <span className="block text-[11.5px] text-fg-muted">{size.format(e.size / 1048576)}</span>
            </span>
            <Button
              size="sm"
              onClick={async () => {
                const blob = await getExport(id, e.id);
                if (blob) saveBlob(blob, e.name);
              }}
            >
              <Download size={13} />
              {t('library.download')}
            </Button>
            <button type="button" aria-label={t('library.deleteExport')} onClick={() => void deleteExport(id, e.id)} className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-danger">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The one place to export an image: format, size, quality, then download. */
export function ExportSheet() {
  const { t } = useT();
  const open = useUi((s) => s.exportOpen);
  const exporting = useUi((s) => s.exporting);
  const setOpen = useUi((s) => s.setExportOpen);
  const noPhoto = useProject((s) => s.mode === 'photo' && !s.photo.assetId);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t('export.title')}
      testId="export-sheet"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!!exporting || noPhoto || (useProject.getState().mode === 'photo' && !photoOutputSize().width)}
            onClick={() => {
              setOpen(false);
              void exportImage('image');
            }}
          >
            <Download size={16} strokeWidth={2.2} />
            {t('export.download')}
          </Button>
        </>
      }
    >
      <ExportForm />
      <RecentExports />
    </Sheet>
  );
}
