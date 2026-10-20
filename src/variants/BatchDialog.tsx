import { useMemo, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Download, ImagePlus, Layers, X } from 'lucide-react';
import { useT } from '@/i18n';
import { FORMATS, outputSize } from '@/export/settings';
import { useProject } from '@/store/project';
import { Button, Segmented, Spinner, cx } from '@/ui/primitives';
import { batch, batchTarget, useBatch } from './batch';
import { useVariants } from './store';

function pickFiles() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => input.files && batch.add(input.files);
  input.click();
}

export function BatchDialog() {
  const { t, tr } = useT();
  const open = useBatch((s) => s.open);
  const files = useBatch((s) => s.files);
  const style = useBatch((s) => s.style);
  const job = useBatch((s) => s.job);
  const exportSettings = useProject((s) => s.export);
  useProject((s) => s.selectedId);
  const allLooks = useVariants((s) => s.looks);
  const selectedIds = useVariants((s) => s.selected);
  const looks = useMemo(() => allLooks.filter((l) => selectedIds.includes(l.id)), [allLooks, selectedIds]);
  const [over, setOver] = useState(false);
  const target = open ? batchTarget() : null;
  const styles = style === 'variants' ? looks : [];
  const total = files.length * Math.max(1, styles.length);
  const size = outputSize(exportSettings);
  const format = FORMATS.find((f) => f.id === exportSettings.format)?.label;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && batch.close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[4px] animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-40 flex max-h-[88vh] w-[720px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 menu-surface flex-col overflow-hidden rounded-[18px] animate-[toast-in_200ms_var(--ease-out-quart)]"
          data-testid="batch"
          // files dropped here stay here (not on the scene)
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(false);
            batch.add(e.dataTransfer.files);
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-fg text-bg">
              <Layers size={16} />
            </span>
            <div>
              <Dialog.Title className="font-display text-[20px] font-bold leading-tight">{t('batch.title')}</Dialog.Title>
              <Dialog.Description className="text-[11.5px] text-fg-subtle">{t('batch.subtitle')}</Dialog.Description>
            </div>
            <Dialog.Close className="ml-auto grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={t('cancel')}>
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            <button
              type="button"
              onClick={pickFiles}
              className={cx(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
                over ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent',
              )}
            >
              <ImagePlus size={20} className="text-accent" />
              <span className="text-[13px] font-medium">{t('batch.drop')}</span>
              <span className="text-[11.5px] text-fg-subtle">{t('batch.dropHint')}</span>
            </button>

            {files.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="font-medium">{t('batch.images', { n: files.length })}</span>
                  <button type="button" onClick={() => batch.clear()} className="text-fg-subtle hover:text-fg">
                    {t('batch.clear')}
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {files.map((f) => (
                    <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2 shadow-[0_0_0_1px_var(--line)_inset]" title={f.file.name}>
                      <img src={f.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={t('props.remove')}
                        onClick={() => batch.remove(f.id)}
                        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3.5 shadow-[0_0_0_1px_var(--line)_inset]">
              <div className="text-[12px] text-fg-muted">
                {target
                  ? t('batch.targetDevice', { name: tr(target.model.name), slot: target.model.surfaces.length > 1 ? ` · ${tr(target.model.surfaces.find((s) => s.id === target.slot)!.label)}` : '' })
                  : t('batch.noTarget')}
              </div>
              <div className="w-[360px] max-w-full">
                <Segmented
                  value={style}
                  onChange={(v) => batch.setStyle(v)}
                  options={[
                    { value: 'current', label: t('batch.style.current') },
                    { value: 'variants', label: t('batch.style.variants', { n: looks.length }) },
                  ]}
                />
              </div>
              {style === 'variants' && !looks.length && <p className="text-[11.5px] text-fg-subtle">{t('batch.noVariants')}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-line px-5 py-3">
            {job ? (
              <div className="flex flex-1 items-center gap-2.5 text-[12px] text-fg-muted">
                <Spinner size={13} />
                {t('batch.progress', { done: job.done, total: job.total })}
                <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-4">
                  <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(job.done / Math.max(1, job.total)) * 100}%` }} />
                </div>
                <button type="button" onClick={() => batch.cancel()} className="text-fg-subtle hover:text-fg hover:underline">
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <div className="flex-1 text-[11.5px] tabular-nums text-fg-subtle">
                {t('batch.summary', { n: total })} · {size.width} × {size.height} · {format}
              </div>
            )}
            <Button variant="primary" disabled={!files.length || !target || !!job || (style === 'variants' && !looks.length)} onClick={() => void batch.run(styles)} data-testid="batch-run">
              <Download size={15} />
              {t('batch.run')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
