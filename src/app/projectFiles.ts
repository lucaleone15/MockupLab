import { t } from '@/i18n';
import { download } from '@/export/exportImage';
import { exportProjectFile, importProjectFile } from '@/store/persistence';
import { toast } from '@/store/toasts';

export async function saveProjectFile() {
  const { blob, filename } = await exportProjectFile();
  download(blob, filename);
  toast.success(t('project.saved'));
}

export function openProjectFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => input.files?.[0] && importProjectFile(input.files[0]);
  input.click();
}
