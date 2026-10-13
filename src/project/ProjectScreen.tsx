import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImagePlus, SlidersHorizontal, X } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { ratioValue } from '@/export/settings';
import { pickImages } from '@/lib/importImage';
import { BrandKit } from '@/app/panels/TextPanel';
import { SCENE_PRESETS } from '@/scene/scenePresets';
import { navigate } from '@/shell/route';
import { useAssets } from '@/store/assets';
import { DEFAULT_BRAND, useProject } from '@/store/project';
import { Button, Spinner, Switch, cx } from '@/ui/primitives';
import { SUPPORTS } from '@/quick/detect';
import { STYLES, pack, usePack, type PackColors, type PackFile } from './store';
import { lighten } from './palettes';
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

function PackItem({ url, label, onOpen, onDownload, ratio, target }: { url?: string; label: string; onOpen?: () => void; onDownload?: () => void; ratio: number; target?: string }) {
  const { t } = useT();
  const busy = usePack((s) => s.busy);
  return (
    <div data-testid="pack-item" className="group flex flex-col gap-1.5">
      <div className="relative overflow-hidden rounded-[14px] bg-surface-2" style={{ aspectRatio: String(ratio) }}>
        {url ? <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover animate-[fade-in_250ms_ease-out]" /> : <span className="absolute inset-0 grid place-items-center text-fg-subtle"><Spinner /></span>}
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

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex h-7 w-full overflow-hidden rounded-md shadow-[0_0_0_1px_var(--line)_inset]">
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

/** Pack colours: the style's own, a palette drawn from the images, the brand's, or one picked. */
function PackColorsBlock() {
  const { t } = useT();
  const colors = usePack((s) => s.colors);
  const brandColors = useProject((p) => p.brand.colors);
  // the sample brand is not "my brand"
  const filled = brandColors.map((c) => c.hex).join() !== DEFAULT_BRAND.colors.map((c) => c.hex).join();
  const brand = filled ? brandColors.map((c) => c.hex).slice(0, 3) : [];
  const options: { key: string; label: string; source: PackColors['source']; palette: string[] | null; index?: number; preview: string[] }[] = [
    { key: 'style', label: t('project.colors.style'), source: 'style', palette: null, preview: [] },
    ...colors.suggestions.map((p, i) => ({ key: `img${i}`, label: t('project.colors.fromImages', { n: i + 1 }), source: 'images' as const, palette: p, index: i, preview: p })),
    ...(brand.length ? [{ key: 'brand', label: t('project.colors.brand'), source: 'brand' as const, palette: brand, preview: brand }] : []),
  ];
  const activeKey = colors.source === 'images' ? `img${colors.index}` : colors.source;
  // the picker fires while dragging: the pack is re-rendered once the colour settles
  const [picked, setPicked] = useState<string | null>(null);
  const timer = useRef(0);
  const pick = (hex: string) => {
    setPicked(hex);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPicked(null);
      pack.setPalette('custom', [hex, lighten(hex, 0.12), lighten(hex, -0.5)]);
    }, 350);
  };
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">{t('project.colors')}</h3>
        <p className="text-[12.5px] text-fg-muted">{t('project.colors.hint')}</p>
      </div>
      <div role="radiogroup" aria-label={t('project.colors')} className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={activeKey === o.key}
            aria-label={o.label}
            onClick={() => pack.setPalette(o.source, o.palette, o.index)}
            className={cx('flex flex-col gap-1.5 rounded-[10px] p-1.5 text-left transition-shadow', activeKey === o.key ? 'shadow-[0_0_0_2px_var(--accent)]' : 'hover:bg-surface-2')}
          >
            {o.preview.length ? <Swatches colors={o.preview} /> : <span className="grid h-7 place-items-center rounded-md bg-surface-3 text-[11px] text-fg-muted">—</span>}
            <span className="truncate text-[11.5px] text-fg-muted">{o.label}</span>
          </button>
        ))}
        <label className={cx('flex cursor-pointer flex-col gap-1.5 rounded-[10px] p-1.5', colors.source === 'custom' ? 'shadow-[0_0_0_2px_var(--accent)]' : 'hover:bg-surface-2')}>
          <input
            type="color"
            aria-label={t('project.colors.pick')}
            value={picked ?? (colors.source === 'custom' && colors.palette ? colors.palette[0] : '#d9d4cb')}
            onChange={(e) => pick(e.target.value)}
            className="h-7 w-full cursor-pointer rounded-md"
          />
          <span className="truncate text-[11.5px] text-fg-muted">{t('project.colors.pick')}</span>
        </label>
      </div>
      {colors.palette && (
        <label className="flex cursor-pointer items-center gap-3 text-[13px]">
          <Switch checked={colors.vary} onChange={pack.setVary} label={t('project.colors.vary')} />
          {t('project.colors.vary')}
        </label>
      )}
    </div>
  );
}

/** Under a scene of the pack: its colour, picked among the palette's. */
function SceneColor({ target, name }: { target: string; name: string }) {
  const { t } = useT();
  const colors = usePack((s) => s.colors);
  if (!colors.palette) return null;
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
  const { t, tr } = useT();
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
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-2">
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
            </div>
            <div className="overflow-hidden rounded-[14px] bg-surface-2">
              <p className="px-5 pt-4 text-[12.5px] leading-snug text-fg-muted">{t('project.brandHint')}</p>
              <BrandKit />
            </div>
          </div>
        </Step>
        {s.files.length > 0 && (
          <Step n={2} title={t('project.step.style')}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {STYLES.map((id) => {
                const url = s.thumbs.styles[id];
                const preset = SCENE_PRESETS.find((p) => p.id === id)!;
                const active = s.style === id;
                return (
                  <button key={id} type="button" data-testid="project-style" aria-pressed={active} onClick={() => pack.setStyle(id)} className="flex flex-col gap-1.5 text-left">
                    <span className={cx('relative block overflow-hidden rounded-[12px] bg-surface-2 transition-shadow', active && 'shadow-[0_0_0_2.5px_var(--accent)]')} style={{ aspectRatio: String(ratio) }}>
                      {url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-fg-subtle"><Spinner /></span>}
                    </span>
                    <span className={cx('truncate text-[12.5px]', active ? 'font-medium text-fg' : 'text-fg-muted')}>{tr(preset.name)}</span>
                  </button>
                );
              })}
            </div>
            <PackColorsBlock />
          </Step>
        )}
        {s.files.length > 0 && (
          <Step n={3} title={t('project.step.pack')}>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="col-span-2 row-span-2">
                <PackItem url={s.thumbs.hero} label={t('project.hero')} ratio={ratio} target="hero" onOpen={open('hero')} onDownload={() => void pack.downloadOne('hero')} />
              </div>
              {s.files.map((f) => (
                <PackItem key={f.id} url={s.thumbs.items[f.id]} label={f.name} ratio={ratio} target={f.id} onOpen={open(f.id)} onDownload={() => void pack.downloadOne(f.id)} />
              ))}
              {s.board && <PackItem url={s.thumbs.board} label={t('project.board')} ratio={1.5} />}
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
