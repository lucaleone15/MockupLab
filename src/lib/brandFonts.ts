import { askFiles } from '@/ui/dialogs';
import { t } from '@/i18n';
import { useAssets } from '@/store/assets';
import { toast } from '@/store/toasts';
import type { BrandFont, OverlayFont } from '@/store/project';
import { useProject } from '@/store/project';
import { registerFontAsset } from './fontFaces';

/*
 * Typefaces of the brand kit. Bundled faces are always available; font files
 * imported by the user (.ttf, .otf, .woff, .woff2) are kept as assets, saved
 * with the project, and registered with the document through the FontFace API.
 * Nothing is ever uploaded.
 */

export const BUILTIN_FONTS: { family: string; label: string; style?: 'italic' }[] = [
  { family: 'Geist Variable', label: 'Geist' },
  { family: 'Instrument Serif', label: 'Instrument Serif', style: 'italic' },
  { family: 'Geist Mono Variable', label: 'Geist Mono' },
  { family: 'Georgia', label: 'Georgia' },
  { family: 'Helvetica Neue', label: 'Helvetica Neue' },
];

export { registerFontAsset };

const uid = () => Math.random().toString(36).slice(2, 10);

/** Imports a font file and returns the brand font pointing at it. */
export async function importFontFile(file: File): Promise<BrandFont | null> {
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
    toast.error(t('brand.fontInvalid', { name: file.name }));
    return null;
  }
  const id = uid();
  // A unique family name avoids clashing with installed fonts of the same name.
  const family = `${file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ')} · ${id.slice(0, 4)}`;
  useAssets.getState().add({ id, name: file.name, url: URL.createObjectURL(file), width: 0, height: 0, blob: file });
  try {
    await registerFontAsset(id, family);
  } catch {
    toast.error(t('brand.fontInvalid', { name: file.name }));
    return null;
  }
  return { family, assetId: id };
}

export async function pickFontFile(): Promise<File | null> {
  const [file] = await askFiles({ title: t('file.fontTitle'), hint: t('file.fontHint'), accept: '.ttf,.otf,.woff,.woff2', multiple: false });
  return file ?? null;
}

/** Display name of a brand font (imported ones carry a short unique suffix). */
export const fontLabel = (f: BrandFont) => f.family.replace(/ · [a-z0-9]{4}$/, '').replace(/ Variable$/, '');

const STACKS: Record<'sans' | 'serif' | 'mono', string> = {
  sans: '"Geist Variable", system-ui, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  mono: '"Geist Mono Variable", ui-monospace, monospace',
};

/** CSS font-family for an overlay font, resolving the brand typefaces. */
export function fontStack(font: OverlayFont): string {
  if (font === 'heading' || font === 'body') {
    const f = useProject.getState().brand[font];
    return `"${f.family}", ${STACKS.sans}`;
  }
  return STACKS[font];
}

/** Instrument Serif only exists in italic: used as an editorial accent. */
export const isItalicFamily = (family: string) => family === 'Instrument Serif';
