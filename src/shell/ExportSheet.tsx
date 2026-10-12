import { Download } from 'lucide-react';
import { useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { ExportForm } from '@/app/PropertiesPanel';
import { photoOutputSize } from '@/photo/exportPhoto';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Sheet } from '@/ui/primitives';

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
              void exportImage();
            }}
          >
            <Download size={16} strokeWidth={2.2} />
            {t('export.download')}
          </Button>
        </>
      }
    >
      <ExportForm />
    </Sheet>
  );
}
