import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ArrowDown, ArrowUp, ChevronDown, Download, ImagePlus, Pipette, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { ratioValue } from '@/export/settings';
import { pickImages } from '@/lib/importImage';
import { BrandKit } from '@/app/panels/TextPanel';
import { navigate } from '@/shell/route';
import { useAssets } from '@/store/assets';
import { DEFAULT_BRAND, useProject } from '@/store/project';
import { Button, Segmented, Spinner, Switch, cx } from '@/ui/primitives';
import { SUPPORTS } from '@/quick/detect';
import { STYLES, pack, usePack, type PackFile } from './store';
import { ModeRole } from '@/shell/ModeRole';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3">
        <span className="grid size-7 place-items-center rounded-full bg-fg text-[13px] font-semibold text-bg">{n}</span>
        <span className="font-display text-[20px] font-bold">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function FileRow({ f, index, count }: { f: PackFile; index: number; count: number }) {
  const { t } = useT();
  const asset = useAssets((s) => s.assets[f.assetId]);
  return (
    <li data-testid="project-file" className="flex items-center gap-3 rounded-[12px] bg-surface-2 p-2 pr-3">
      <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-surface-3">{asset && <img src={asset.url} alt="" className="h-full w-full object-cover object-top" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{f.name}</span>
        {!f.confident && <span className="text-[12px] text-fg-muted">{t('quick.toConfirm')}</span>}
        {f.pdf && (
          <button type="button" className="block text-[12.5px] font-medium text-accent hover:underline" onClick={() => void pack.addPdfPages(f.id)}>
            {f.pdf.pages === 2 ? t('project.pdfMoreOne') : t('project.pdfMore', { n: f.pdf.pages - 1 })}
          </button>
        )}
      </span>
      <select
        aria-label={t('project.supportOf', { name: f.name })}
        value={f.support}
        onChange={(e) => pack.setSupport(f.id, e.target.value as PackFile['support'])}
        className="h-8 rounded-[10px] bg-surface px-2.5 text-[13px] text-fg shadow-[0_0_0_1px_var(--line-strong)_inset] outline-none"
      >
        {SUPPORTS.map((s) => (
          <option key={s} value={s}>
            {t(`support.${s}` as I18nKey)}
          </option>
        ))}
      </select>
      <button type="button" aria-label={t('project.up')} disabled={index === 0} onClick={() => pack.move(f.id, -1)} className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30">
        <ArrowUp size={14} />
      </button>
      <button type="button" aria-label={t('project.down')} disabled={index === count - 1} onClick={() => pack.move(f.id, 1)} className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30">
        <ArrowDown size={14} />
      </button>
      <button type="button" aria-label={t('project.removeImage', { name: f.name })} onClick={() => pack.remove(f.id)} className="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-danger">
        <X size={14} />
      </button>
    </li>
  );
}

function PackItem({ url, label, onOpen, onDownload, ratio, target, index = 0 }: { url?: string; label: string; onOpen?: () => void; onDownload?: () => void; ratio: number; target?: string; index?: number }) {
  const { t } = useT();
  const busy = usePack((s) => s.busy);
  return (
    <div data-testid="pack-item" className="group flex flex-col gap-1.5 animate-[rise_380ms_var(--ease-out)_both]" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="relative overflow-hidden rounded-[14px] bg-surface-2" style={{ aspectRatio: String(ratio) }}>
        {url ? <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover animate-[img-in_420ms_var(--ease-out)]" /> : <span className="absolute inset-0 grid place-items-center text-fg-subtle"><Spinner /></span>}
        {onOpen && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
            {onDownload && (
              <Button variant="primary" size="sm" disabled={!url || busy} onClick={onDownload}>
                <Download size={13} />
                {t('quick.download')}
              </Button>
            )}
            <Button size="sm" className="bg-white text-[#1d1d1f] hover:bg-white/90" onClick={onOpen}>
              <SlidersHorizontal size={13} />
              {t('project.openStudio')}
            </Button>
          </span>
        )}
      </div>
      <span className="truncate px-0.5 text-[12.5px] text-fg-muted">{label}</span>
      {target && <SceneColor target={target} name={label} />}
    </div>
  );
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

/** One colour of the palette: its swatch and code; a click opens the ways to change it. */
function PaletteSwatch({ i, color }: { i: number; color: string }) {
  const { t } = useT();
  const count = usePack((s) => s.colors.palette.length);
  const found = usePack((s) => s.colors.imageColors);
  const [draft, setDraft] = useState(color);
  // the picker fires while dragging: the pack is re-rendered once the colour settles
  const timer = useRef(0);
  const pick = (hex: string) => {
    setDraft(hex);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => pack.setColor(i, hex), 300);
  };
  return (
    <Popover.Root onOpenChange={(open) => open && setDraft(color)}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={t('project.colors.swatch', { n: i + 1, color })} className="flex flex-col items-center gap-1.5 rounded-[12px] animate-[pop-in_220ms_var(--ease-out)]">
          <span className="block size-11 rounded-[12px] shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: color }} />
          <span className="text-[11px] uppercase tabular-nums text-fg-muted">{color}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="start" className="menu-surface menu-pop z-50 flex w-[248px] flex-col gap-3 rounded-[14px] p-3 text-fg">
          <div className="flex items-center gap-2">
            <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-[10px] shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: draft }}>
              <input type="color" aria-label={t('project.colors.pick')} value={/^#[0-9a-f]{6}$/i.test(draft) ? draft : color} onChange={(e) => pick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <input
              aria-label={t('project.colors.hex')}
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pack.setColor(i, draft)}
              onBlur={() => pack.setColor(i, draft)}
              className="h-9 min-w-0 flex-1 rounded-[10px] bg-surface-2 px-2.5 text-[13px] uppercase tabular-nums outline-none shadow-[0_0_0_1px_var(--line)_inset] focus:shadow-[0_0_0_1.5px_var(--accent)_inset]"
            />
            {EyeDropper && (
              <button
                type="button"
                aria-label={t('project.colors.eyedropper')}
                title={t('project.colors.eyedropper')}
                onClick={() => void new EyeDropper().open().then((r) => pack.setColor(i, r.sRGBHex), () => undefined)}
                className="grid size-9 shrink-0 place-items-center rounded-[10px] text-fg-muted hover:bg-surface-3 hover:text-fg"
              >
                <Pipette size={15} />
              </button>
            )}
          </div>
          {found.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-fg-muted">{t('project.colors.fromImages')}</span>
              <div className="flex flex-wrap gap-1.5">
                {found.map((c) => (
                  <button key={c} type="button" aria-label={t('project.colors.take', { color: c })} title={c} onClick={() => pack.setColor(i, c)} className="size-6 rounded-full shadow-[0_0_0_1px_var(--line-strong)_inset] hover:scale-110" style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
          <Button size="sm" disabled={count <= 1} onClick={() => pack.removeColor(i)}>
            {t('project.colors.remove')}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The pack's palette: detected from the images, then changed by hand. */
function PaletteEditor() {
  const { t } = useT();
  const colors = usePack((s) => s.colors);
  const brandColors = useProject((p) => p.brand.colors);
  // the sample brand is not "my brand"
  const brand = brandColors.map((c) => c.hex).join() !== DEFAULT_BRAND.colors.map((c) => c.hex).join() && brandColors.length > 0;
  const link = 'rounded-md text-[12.5px] font-medium text-accent hover:underline';
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{t('project.colors')}</h3>
        <p className="text-[12.5px] text-fg-muted">{t('project.colors.hint')}</p>
      </div>
      <div data-testid="pack-palette" className="flex flex-wrap items-start gap-3">
        {colors.palette.map((c, i) => (
          <PaletteSwatch key={i} i={i} color={c} />
        ))}
        {colors.palette.length < 5 && (
          <button
            type="button"
            aria-label={t('project.colors.add')}
            title={t('project.colors.add')}
            onClick={pack.addColor}
            className="grid size-11 place-items-center rounded-[12px] border-[1.5px] border-dashed border-line-strong text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[13px] text-fg-muted">{t('project.colors.inPack')}</span>
        <div className="w-[300px] max-w-full">
          <Segmented
            value={colors.vary ? 'each' : 'one'}
            options={[
              { value: 'one', label: t('project.colors.one') },
              { value: 'each', label: t('project.colors.each') },
            ]}
            onChange={(v) => pack.setVary(v === 'each')}
          />
        </div>
        <span className="flex items-center gap-4">
          <button type="button" className={link} onClick={pack.redetect}>
            {t('project.colors.redetect')}
          </button>
          {brand && (
            <button type="button" className={link} onClick={pack.takeBrand}>
              {t('project.colors.brand')}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** The brand kit, folded away: it only dresses the presentation board. */
function BrandFold() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[14px] bg-surface-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
        <span className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold">{t('project.brandFold')}</span>
          <span className="text-[12.5px] text-fg-muted">{t('project.brandFoldHint')}</span>
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-fg-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div className={cx('fold grid', open && 'fold-open')}>
        <div className="min-h-0 overflow-hidden">{open && <BrandKit />}</div>
      </div>
    </div>
  );
}

/** Under a scene of the pack: its colour, picked among the palette's. */
function SceneColor({ target, name }: { target: string; name: string }) {
  const { t } = useT();
  const colors = usePack((s) => s.colors);
  const current = pack.sceneColor(target);
  return (
    <span className="flex items-center gap-1 px-0.5">
      {colors.palette.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={t('project.colors.scene', { name, color: c })}
          aria-pressed={current === c}
          onClick={() => pack.setSceneColor(target, c)}
          className={cx('size-4 rounded-full transition-transform hover:scale-110', current === c ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]' : 'shadow-[0_0_0_1px_var(--line-strong)_inset]')}
          style={{ background: c }}
        />
      ))}
      {colors.perScene[target] && (
        <button type="button" aria-label={t('project.colors.sceneReset', { name })} onClick={() => pack.setSceneColor(target, null)} className="ml-1 text-fg-subtle hover:text-fg">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export function ProjectScreen() {
  const { t } = useT();
  const s = usePack();
  const ratio = ratioValue(useProject((p) => p.export.ratio));
  useEffect(() => {
    pack.start();
    return () => pack.stop();
  }, []);
  const open = (target: string) => () => void pack.openInStudio(target, () => navigate('studio'));
  return (
    <div className="flex min-h-0 flex-1 p-2" data-testid="project-screen">
      <main className="glass scroll-thin flex min-w-0 flex-1 flex-col gap-10 overflow-y-auto overscroll-contain rounded-[14px] px-8 py-7">
        <Step n={1} title={t('project.step.images')}>
          <div className="flex max-w-[860px] flex-col gap-3">
            {!s.files.length && <ModeRole screen="project" className="mb-1 text-[14px] text-fg" />}
            {s.files.length > 0 && (
              <ul className="flex flex-col gap-2">
                {s.files.map((f, i) => (
                  <FileRow key={f.id} f={f} index={i} count={s.files.length} />
                ))}
              </ul>
            )}
            <button
              type="button"
              data-testid="project-add"
              onClick={() => pickImages((files) => void pack.add(files))}
              className="flex items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-line-strong px-4 py-5 text-[13.5px] font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg"
            >
              <ImagePlus size={18} className="text-accent" />
              {s.files.length ? t('project.addMore') : t('project.addFirst')}
            </button>
            <BrandFold />
          </div>
        </Step>
        {s.files.length > 0 && (
          <Step n={2} title={t('project.step.style')}>
            <div className="grid max-w-[860px] grid-cols-3 gap-3">
              {STYLES.map((id) => {
                const url = s.thumbs.styles[id];
                const active = s.style === id;
                return (
                  <button key={id} type="button" data-testid="project-style" aria-pressed={active} onClick={() => pack.setStyle(id)} className="flex flex-col gap-1.5 text-left">
                    <span className={cx('relative block overflow-hidden rounded-[12px] bg-surface-2 transition-shadow', active && 'shadow-[0_0_0_2.5px_var(--accent)]')} style={{ aspectRatio: String(ratio) }}>
                      {url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover animate-[img-in_420ms_var(--ease-out)]" /> : <span className="absolute inset-0 grid place-items-center text-fg-subtle"><Spinner /></span>}
                    </span>
                    <span className={cx('truncate text-[12.5px]', active ? 'font-medium text-fg' : 'text-fg-muted')}>{t(`project.style.${id}` as I18nKey)}</span>
                  </button>
                );
              })}
            </div>
            <PaletteEditor />
          </Step>
        )}
        {s.files.length > 0 && (
          <Step n={3} title={t('project.step.pack')}>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="col-span-2 row-span-2">
                <PackItem url={s.thumbs.hero} label={t('project.hero')} ratio={ratio} target="hero" onOpen={open('hero')} onDownload={() => void pack.downloadOne('hero')} />
              </div>
              {s.files.map((f, i) => (
                <PackItem key={f.id} index={i + 1} url={s.thumbs.items[f.id]} label={f.name} ratio={ratio} target={f.id} onOpen={open(f.id)} onDownload={() => void pack.downloadOne(f.id)} />
              ))}
              {s.board && <PackItem index={s.files.length + 1} url={s.thumbs.board} label={t('project.board')} ratio={1.5} />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <label className="flex cursor-pointer items-center gap-3 text-[13px]">
                <Switch checked={s.board} onChange={pack.setBoard} label={t('project.boardToggle')} />
                {t('project.boardToggle')}
              </label>
              <Button variant="primary" size="lg" disabled={s.busy} onClick={() => void pack.downloadZip()}>
                {s.busy ? <Spinner size={14} /> : <Download size={16} />}
                {t('project.downloadPack')}
              </Button>
            </div>
          </Step>
        )}
      </main>
    </div>
  );
}
