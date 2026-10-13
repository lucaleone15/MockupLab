import { useEffect } from 'react';
import { Check, Download, ImagePlus, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { RATIOS, ratioValue } from '@/export/settings';
import { pickImages } from '@/lib/importImage';
import { navigate } from '@/shell/route';
import { useAssets } from '@/store/assets';
import { useProject } from '@/store/project';
import { Button, Chip, GroupTitle, Spinner, cx } from '@/ui/primitives';
import { SUPPORTS } from './detect';
import { QUICK_TAGS } from './templates';
import { labelOf, quick, useQuick, type QuickTile } from './store';
import { ModeRole } from '@/shell/ModeRole';

const FORMATS = RATIOS.filter((r) => ['16:9', '4:3', '1:1', '4:5', '9:16'].includes(r.id));

function Tile({ tile }: { tile: QuickTile }) {
  const { t } = useT();
  const url = useQuick((s) => s.thumbs[tile.id]);
  const selected = useQuick((s) => s.selected.includes(tile.id));
  const busy = useQuick((s) => s.busy === tile.id);
  const ratio = ratioValue(useProject((s) => s.export.ratio));
  const label = labelOf(tile);
  return (
    <div data-testid="quick-tile" className="group flex flex-col gap-1.5">
      <div className={cx('relative overflow-hidden rounded-[14px] bg-surface-2 transition-shadow', selected && 'shadow-[0_0_0_2.5px_var(--accent)]')} style={{ aspectRatio: String(ratio) }}>
        {url ? (
          <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover animate-[fade-in_250ms_ease-out]" draggable={false} />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-fg-subtle">
            <Spinner />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="primary" size="sm" disabled={!url || !!busy} onClick={() => void quick.download([tile.id])}>
            {busy ? <Spinner size={12} /> : <Download size={13} />}
            {t('quick.download')}
          </Button>
          <Button size="sm" className="bg-white text-[#1d1d1f] hover:bg-white/90" onClick={() => void quick.customize(tile.id, () => navigate('studio'))}>
            <SlidersHorizontal size={13} />
            {t('quick.customize')}
          </Button>
        </span>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t('quick.select', { name: label })}
          onClick={() => quick.toggle(tile.id)}
          className={cx(
            'absolute left-2.5 top-2.5 grid size-6 place-items-center rounded-full transition-[opacity,background-color]',
            selected ? 'bg-accent text-accent-fg opacity-100' : 'bg-black/40 text-white opacity-0 ring-1 ring-white/70 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Check size={13} strokeWidth={3} />
        </button>
      </div>
      <span className="truncate px-0.5 text-[12.5px] text-fg-muted">{label}</span>
    </div>
  );
}

export function QuickScreen() {
  const { t } = useT();
  const s = useQuick();
  const asset = useAssets((a) => (s.assetId ? a.assets[s.assetId] : undefined));
  const ratio = useProject((p) => p.export.ratio);
  useEffect(() => {
    quick.start();
    return () => quick.stop();
  }, []);
  const shown = s.filter === 'all' ? s.tiles : s.tiles.filter((x) => x.tags.includes(s.filter as never));
  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2" data-testid="quick-screen">
      <aside className="glass flex w-[280px] shrink-0 flex-col gap-6 overflow-y-auto rounded-[14px] p-5">
        <div className="flex flex-col gap-3">
          {!asset && <ModeRole screen="quick" className="text-fg" />}
          <GroupTitle>{t('quick.design')}</GroupTitle>
          <button
            type="button"
            data-testid="quick-pick"
            onClick={() => pickImages((files) => files[0] && void quick.setImage(files[0]))}
            className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[12px] border-[1.5px] border-dashed border-line-strong bg-surface-2 text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            {asset ? (
              <img src={asset.url} alt={asset.name} className="h-full w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-center text-[13px]">
                <ImagePlus size={22} className="text-accent" />
                {t('quick.pick')}
              </span>
            )}
          </button>
          {asset ? <span className="truncate text-[12.5px] text-fg-muted">{asset.name}</span> : <span className="text-[12.5px] leading-snug text-fg-muted">{t('quick.sampleNote')}</span>}
        </div>
        <div className="flex flex-col gap-2.5">
          <GroupTitle aside={!s.confident ? <span className="text-[12px] text-fg-muted">{t('quick.toConfirm')}</span> : undefined}>{t('quick.support')}</GroupTitle>
          <div className="flex flex-wrap gap-1.5" data-testid="quick-support">
            {SUPPORTS.map((sp) => (
              <Chip key={sp} active={sp === s.support} onClick={() => quick.setSupport(sp)}>
                {t(`support.${sp}` as I18nKey)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <GroupTitle>{t('quick.format')}</GroupTitle>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((r) => (
              <Chip
                key={r.id}
                active={r.id === ratio}
                onClick={() => {
                  useProject.getState().setExport({ ratio: r.id });
                  quick.refresh();
                }}
              >
                {r.label}
              </Chip>
            ))}
          </div>
        </div>
      </aside>
      <main className="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px]">
        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3 pt-5" data-testid="quick-filter">
          <h1 className="font-display mr-3 text-[22px] font-bold">{t('screen.quick')}</h1>
          <Chip active={s.filter === 'all'} onClick={() => quick.setFilter('all')}>
            {t('quick.tag.all')}
          </Chip>
          {QUICK_TAGS.map((tag) => (
            <Chip key={tag} active={s.filter === tag} onClick={() => quick.setFilter(tag)}>
              {t(`quick.tag.${tag}` as I18nKey)}
            </Chip>
          ))}
          <Button className="ml-auto" onClick={() => void quick.more()}>
            <Sparkles size={14} />
            {t('quick.more')}
          </Button>
        </div>
        <div className="scroll-thin grid flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 gap-y-5 overflow-y-auto overscroll-contain px-5 pb-6">
          {shown.map((tile) => (
            <Tile key={tile.id} tile={tile} />
          ))}
        </div>
        {s.selected.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-[13px] text-fg-muted">{t('quick.selected', { n: s.selected.length })}</span>
            <Button variant="primary" disabled={!!s.busy} onClick={() => void quick.download(s.selected)}>
              <Download size={15} />
              {t('quick.downloadSelection')}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
