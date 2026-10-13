import { t } from '@/i18n';
import { toast } from '@/store/toasts';

/*
 * PDFs (a poster, a flyer exported from a layout app) are imported as an
 * image of their first page, rendered at 200 dpi (4096 px at most).
 * pdf.js is only loaded when a PDF shows up.
 */

const DPI = 200;
const MAX_SIDE = 4096;

export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export async function pdfToImage(file: File, pageNumber = 1): Promise<File> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    let scale = DPI / 72;
    const long = Math.max(base.width, base.height) * scale;
    if (long > MAX_SIDE) scale *= MAX_SIDE / long;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
    const name = `${file.name.replace(/\.pdf$/i, '') || 'document'}-p${pageNumber}.png`;
    return new File([blob], name, { type: 'image/png' });
  } finally {
    void doc.cleanup?.();
  }
}

/** Replaces each PDF by an image of its first page; unreadable ones are reported and left out. */
export async function expandPdfs(files: Iterable<File>): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (!isPdf(f)) {
      out.push(f);
      continue;
    }
    try {
      out.push(await pdfToImage(f));
    } catch {
      toast.error(t('pdf.error', { name: f.name }));
    }
  }
  return out;
}

/** Number of pages of a PDF (0 if it cannot be read). */
export async function pdfPageCount(file: File): Promise<number> {
  try {
    const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    return doc.numPages;
  } catch {
    return 0;
  }
}

export const IMAGE_OR_PDF = 'image/*,application/pdf';
