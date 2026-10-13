import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Check, ChevronLeft, ChevronRight, Columns2, Download, Maximize2, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { FORMATS, outputSize, ratioValue } from '@/export/settings';
import { useProject } from '@/store/project';
import { Button, Segmented, Spinner, Tooltip, cx } from '@/ui/primitives';
import { AXES, type Axis } from './looks';
import { useVariants, variants } from './store';

const AXIS_LABEL: Record<Axis, I18nKey> = {
  set: 'variants.axis.set',
  background: 'variants.axis.background',
  light: 'variants.axis.light',
  angle: 'variants.axis.angle',
  finish: 'variants.axis.finish',
};

function Thumb({ id, className }: { id: string; className?: string }) {
  const url = useVariants((s) => s.thumbs[id]);
  const ratio = ratioValue(useProject((s) => s.export.ratio));
  return (
    <div className={cx('relative w-full overflow-hidden rounded-lg bg-surface-3', className)} style={{ aspectRatio: String(ratio) }}>
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover animate-[fade-in_250ms_ease-out]" draggable={false} />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-fg-subtle">
          <Spinner />
        </div>
      )}
    </div>
  );
}

function Card({ id, index, onZoom }: { id: string; index: number; onZoom: () => void }) {
  const { t } = useT();
  const look = useVariants((s) => s.looks.find((l) => l.id === id));
  const selected = useVariants((s) => s.selected.includes(id));
  const ready = useVariants((s) => !!s.thumbs[id]);
  if (!look) return null;
  const action = 'grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80';
  return (
    <div className="group flex flex-col gap-2" data-testid="variant">
      <div className="relative">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${String(index + 1).padStart(2, '0')} · ${look.label}`}
          onClick={() => variants.toggle(id)}
          className={cx(
            'relative block w-full cursor-pointer rounded-xl p-1 text-left transition-shadow duration-150',
            selected ? 'shadow-[0_0_0_2px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong)]',
          )}
        >
          <Thumb id={id} />
          <span
            className={cx(
              'absolute left-3 top-3 grid size-6 place-items-center rounded-full transition-colors',
              selected ? 'bg-accent text-accent-fg' : 'bg-black/45 text-transparent ring-1 ring-white/60 group-hover:text-white/70',
            )}
          >
            <Check size={14} strokeWidth={3} />
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white/85 backdrop-blur">{String(index + 1).padStart(2, '0')}</span>
        </button>
        {ready && (
          <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Tooltip label={t('variants.zoom')}>
              <button type="button" aria-label={t('variants.zoom')} className={action} onClick={onZoom}>
                <Maximize2 size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t('variants.refine')}>
              <button type="button" aria-label={t('variants.refine')} className={action} onClick={() => variants.refine(id)}>
                <Wand2 size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t('variants.use')}>
              <button type="button" aria-label={t('variants.use')} className={cx(action, 'bg-accent text-accent-fg hover:bg-accent-hover')} onClick={() => void variants.apply(id)}>
                <Check size={14} strokeWidth={2.5} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      <div className="truncate px-1 text-[12px] text-fg-muted" title={look.label}>
        {look.label}
      </div>
    </div>
  );
}

/** Large view of one look (arrows to browse), or two side by side. */
function Viewer({ ids, start, onClose }: { ids: string[]; start: number; onClose: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(Math.max(0, start));
  const looks = useVariants((s) => s.looks);
  const ratio = ratioValue(useProject((s) => s.export.ratio));
  const compare = ids.length === 2 && start < 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => (v + 1) % ids.length);
      else if (e.key === 'ArrowLeft') setI((v) => (v - 1 + ids.length) % ids.length);
      else if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [ids.length, onClose]);
  const label = (id: string) => looks.find((l) => l.id === id)?.label ?? '';
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-surface/97 p-6 backdrop-blur-xl animate-[fade-in_150ms_ease-out]" data-testid="variant-viewer">
      <div className="mb-4 flex items-center gap-3">
        <div className="text-[14px] font-semibold">{compare ? t('variants.compare') : `${i + 1} / ${ids.length}`}</div>
        {!compare && <div className="truncate text-[12.5px] text-fg-muted">{label(ids[i])}</div>}
        <button type="button" onClick={onClose} aria-label={t('cancel')} className="ml-auto grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg">
          <X size={16} />
        </button>
      </div>
      {compare ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 items-center gap-4">
          {ids.map((id, k) => (
            <div key={id} className="flex min-h-0 flex-col gap-2">
              <Thumb id={id} />
              <div className="flex items-center gap-2 text-[12.5px] text-fg-muted">
                <span className="text-fg-subtle">{k === 0 ? 'A' : 'B'}</span>
                <span className="truncate">{label(id)}</span>
                <Button size="sm" variant="primary" className="ml-auto" onClick={() => void variants.apply(id)}>
                  <Check size={13} />
                  {t('variants.use')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div style={{ width: `min(100%, calc((100vh - 230px) * ${ratio}))` }}>
            <Thumb id={ids[i]} />
          </div>
          <button type="button" aria-label="←" onClick={() => setI((v) => (v - 1 + ids.length) % ids.length)} className="absolute left-0 grid size-10 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="→" onClick={() => setI((v) => (v + 1) % ids.length)} className="absolute right-0 grid size-10 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {!compare && (
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => variants.toggle(ids[i])}>
            <Check size={14} />
            {useVariants.getState().selected.includes(ids[i]) ? t('variants.unselect') : t('variants.select')}
          </Button>
          <Button onClick={() => (onClose(), variants.refine(ids[i]))}>
            <Wand2 size={14} />
            {t('variants.refine')}
          </Button>
          <Button variant="primary" onClick={() => void variants.apply(ids[i])}>
            <Check size={14} />
            {t('variants.use')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function VariantsDialog() {
  const { t } = useT();
  const open = useVariants((s) => s.open);
  const looks = useVariants((s) => s.looks);
  const selected = useVariants((s) => s.selected);
  const axes = useVariants((s) => s.axes);
  const count = useVariants((s) => s.count);
  const job = useVariants((s) => s.job);
  const exportSettings = useProject((s) => s.export);
  const [viewer, setViewer] = useState<{ ids: string[]; start: number } | null>(null);
  const out = outputSize(exportSettings);
  const format = FORMATS.find((f) => f.id === exportSettings.format)?.label;
  const exporting = job?.kind === 'export';

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && variants.close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px] animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          className="menu-surface fixed inset-4 z-40 flex flex-col overflow-hidden rounded-[18px] animate-[toast-in_200ms_var(--ease-out-quart)]"
          onEscapeKeyDown={(e) => viewer && e.preventDefault()}
          data-testid="variants"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
            <div className="mr-2 flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-[10px] bg-fg text-bg">
                <Sparkles size={16} />
              </span>
              <div>
                <Dialog.Title className="font-display text-[20px] font-bold leading-tight">{t('variants.title')}</Dialog.Title>
                <Dialog.Description className="text-[11.5px] text-fg-subtle">{t('variants.subtitle')}</Dialog.Description>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11.5px] text-fg-subtle">{t('variants.vary')}</span>
              {AXES.map((a) => {
                const on = axes.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => variants.setAxes(on ? axes.filter((x) => x !== a) : [...axes, a])}
                    className={cx(
                      'h-7 rounded-full px-3 text-[12px] font-medium transition-colors',
                      on ? 'bg-fg text-bg' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
                    )}
                  >
                    {t(AXIS_LABEL[a])}
                  </button>
                );
              })}
            </div>
            <div className="w-[132px]">
              <Segmented size="sm" value={String(count)} onChange={(v) => variants.setCount(Number(v))} options={['6', '9', '12'].map((v) => ({ value: v, label: v }))} />
            </div>
            <Button onClick={() => variants.generate()} disabled={exporting || !axes.length}>
              <RefreshCw size={14} />
              {selected.length ? t('variants.regenerateKeep') : t('variants.regenerate')}
            </Button>
            <Dialog.Close className="ml-auto grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={t('cancel')}>
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="relative min-h-0 flex-1">
            <div className="scroll-thin h-full overflow-y-auto p-5">
              <div className="grid gap-x-4 gap-y-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                {looks.map((l, i) => (
                  <Card key={l.id} id={l.id} index={i} onZoom={() => setViewer({ ids: looks.map((x) => x.id), start: i })} />
                ))}
              </div>
            </div>
            {viewer && <Viewer ids={viewer.ids} start={viewer.start} onClose={() => setViewer(null)} />}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
            <div className="text-[12.5px] text-fg-muted">{t('variants.selected', { n: selected.length })}</div>
            <Button size="sm" variant="ghost" onClick={() => variants.selectAll(selected.length < looks.length)}>
              {selected.length < looks.length ? t('variants.all') : t('variants.none')}
            </Button>
            {selected.length === 2 && (
              <Button size="sm" onClick={() => setViewer({ ids: selected, start: -1 })}>
                <Columns2 size={13} />
                {t('variants.compare')}
              </Button>
            )}
            {job && (
              <div className="flex min-w-[220px] items-center gap-2.5 text-[12px] text-fg-muted">
                <Spinner size={13} />
                <span>{t(job.kind === 'export' ? 'variants.exporting' : 'variants.rendering', { done: job.done, total: job.total })}</span>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-4">
                  <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(job.done / Math.max(1, job.total)) * 100}%` }} />
                </div>
                {exporting && (
                  <button type="button" onClick={() => variants.cancel()} className="text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
                    {t('cancel')}
                  </button>
                )}
              </div>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11.5px] tabular-nums text-fg-subtle">
                {out.width} × {out.height} · {format}
              </span>
              <Button variant="primary" onClick={() => void variants.exportSelected()} disabled={!selected.length || exporting} data-testid="variants-export">
                <Download size={15} />
                {selected.length > 1 ? t('variants.exportZip', { n: selected.length }) : t('variants.export')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
