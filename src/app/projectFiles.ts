import { askFiles } from '@/ui/dialogs';
import { t } from '@/i18n';
import { download } from '@/export/exportImage';
import { exportProjectFile, importProjectFile } from '@/store/persistence';
import { toast } from '@/store/toasts';

export async function saveProjectFile() {
  const { blob, filename } = await exportProjectFile();
  download(blob, filename);
  toast.success(t('project.saved'));
}

export async function openProjectFile() {
  const [file] = await askFiles({ title: t('file.projectTitle'), hint: t('file.projectHint'), accept: '.json,application/json', multiple: false });
  if (file) importProjectFile(file);
}
