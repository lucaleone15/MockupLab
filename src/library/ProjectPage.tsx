import { useEffect, useState } from 'react';
import { Clapperboard, Download, RotateCcw } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { RATIOS, socialOf } from '@/export/settings';
import { library } from '@/store/persistence';
import type { Project } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Sheet } from '@/ui/primitives';
import { openProject, relativeTime } from './actions';
import { getExport, listExports, resumeExport, type ExportMeta } from './exports';
import { useLibrary } from './store';

/** Saves a kept export again, without recording it a second time. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** "PNG · 1920 × 1080 · 16:9", "MP4 · 1920 × 1080 · 16:9 · 10 s". */
function settingsLine(e: ExportMeta, tr: (s: { fr: string; en: string }) => string) {
  const s = e.settings;
  if (!s) return e.name;
  const ratio = socialOf(s.ratio) ? tr(socialOf(s.ratio)!.label) : (RATIOS.find((r) => r.id === s.ratio)?.label ?? s.ratio);
  return [s.format.toUpperCase().replace('JPEG', 'JPG'), `${s.width} × ${s.height}`, ratio, s.kind === 'video' && s.duration ? `${s.duration} s` : ''].filter(Boolean).join(' · ');
}

/** "Studio photo · 3/4": what the scene stood on, and the angle. */
function sceneLine(p: Project | undefined, t: (k: I18nKey) => string) {
  if (!p) return '';
  const k = p.decor.kind;
  const support = p.background.kind === 'transparent' ? t('bg.kind.transparent') : t(`support.${k === 'surface' ? 'table' : k === 'none' ? 'sweep' : k}` as I18nKey);
  return `${support} · ${t(`camera.${p.camera.preset}` as I18nKey)}`;
}

function ExportEntry({ projectId, e, last }: { projectId: string; e: ExportMeta; last: boolean }) {
  const { t, tr, lang } = useT();
  const thumb = useLibrary((s) => s.thumbs[projectId]);
  const [url, setUrl] = useState<string | null>(null);
  const image = e.type.startsWith('image/');
  useEffect(() => {
    if (!e.hasFile || !image) return;
    let u: string | null = null;
    void getExport(projectId, e.id).then((b) => {
      if (!b) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [projectId, e.id, e.hasFile, image]);
  const close = () => useUi.getState().setProjectPageId(null);
  return (
    <li data-testid="export-entry" className="flex flex-col overflow-hidden rounded-[12px] bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset]">
      <div className="relative grid aspect-[16/10] place-items-center overflow-hidden bg-surface-3 text-fg-subtle">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : thumb ? <img src={thumb} alt="" className="h-full w-full object-cover opacity-80" /> : null}
        {e.settings?.kind === 'video' && <Clapperboard size={22} className="absolute text-white drop-shadow" />}
        {last && <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">{t('projectPage.last')}</span>}
      </div>
      <div className="flex flex-col gap-0.5 px-3 pb-3 pt-2">
        <span className="truncate text-[12.5px] font-semibold">{settingsLine(e, tr)}</span>
        <span className="truncate text-[11.5px] text-fg-muted">{[sceneLine(e.snapshot, t), relativeTime(e.createdAt, lang)].filter(Boolean).join(' · ')}</span>
        <div className="mt-2 flex gap-1.5">
          {e.hasFile && (
            <Button
              size="sm"
              className="flex-1"
              onClick={async () => {
                const blob = await getExport(projectId, e.id);
                if (blob) saveBlob(blob, e.name);
              }}
            >
              <Download size={13} />
              {t('library.download')}
            </Button>
          )}
          {e.snapshot && (
            <Button
              size="sm"
              variant="primary"
              className="flex-1"
              onClick={() => {
                close();
                void resumeExport(projectId, e.id);
              }}
            >
              <RotateCcw size={13} />
              {t('projectPage.resume')}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** A project: its name, and every export it made (newest first) with its settings; download or resume each. */
export function ProjectPage() {
  const { t, lang } = useT();
  const id = useUi((s) => s.projectPageId);
  const meta = useLibrary((s) => s.list.find((p) => p.id === id));
  const thumb = useLibrary((s) => (id ? s.thumbs[id] : undefined));
  const [list, setList] = useState<ExportMeta[]>([]);
  const [name, setName] = useState('');
  useEffect(() => {
    if (!id) return setList([]);
    void listExports(id).then(setList);
  }, [id, meta?.exportCount]);
  useEffect(() => setName(meta && meta.name !== 'Untitled' ? meta.name : ''), [meta?.name]);
  const close = () => useUi.getState().setProjectPageId(null);
  if (!id || !meta) return null;
  const rename = () => {
    const next = name.trim();
    if (next && next !== meta.name) void library.rename(meta.id, next);
  };
  return (
    <Sheet open onOpenChange={(v) => !v && close()} title={meta.name === 'Untitled' ? t('project.untitled') : meta.name} size="lg" testId="project-page">
      <div className="flex items-center gap-4">
        <div className="grid h-[84px] w-[134px] shrink-0 place-items-center overflow-hidden rounded-[12px] bg-surface-3">{thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            aria-label={t('project.name')}
            value={name}
            placeholder={t('project.untitled')}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === 'Enter' && rename()}
            className="h-9 rounded-[10px] bg-surface-2 px-3 text-[14px] font-semibold text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1.5px_var(--accent)_inset]"
          />
          <span className="text-[12px] text-fg-muted">
            {relativeTime(meta.updatedAt, lang)} · {t('library.exports', { n: list.length })}
          </span>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            close();
            void openProject(meta);
          }}
        >
          {t('projectPage.open')}
        </Button>
      </div>
      {list.length ? (
        <ul className="grid grid-cols-3 gap-3">
          {list.map((e, i) => (
            <ExportEntry key={e.id} projectId={meta.id} e={e} last={i === 0} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-[13px] text-fg-muted">{t('projectPage.none')}</p>
      )}
    </Sheet>
  );
}
