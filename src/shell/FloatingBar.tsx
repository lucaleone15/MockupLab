import { ChevronDown, Check, Maximize2, Scan, Sparkles } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useT } from '@/i18n';
import { RATIOS, SOCIAL, socialOf } from '@/export/settings';
import { NETWORKS, NETWORK_ORDER, accountOf, type Network } from '@/social/networks';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { variants } from '@/variants/store';
import { Tooltip, cx } from '@/ui/primitives';

const btn = 'flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg';

/** Output format, recenter, full-screen preview and Ideas, floating over the stage. */
export function FloatingBar({ onFullscreen }: { onFullscreen: () => void }) {
  const { t } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const setExport = useProject((s) => s.setExport);
  return (
    <div className="menu-surface pointer-events-auto flex items-center gap-1 rounded-[14px] p-1" data-testid="floating-bar">
      <div role="radiogroup" aria-label={t('props.ratio')} className="flex">
        {RATIOS.map((r) => (
          <Tooltip key={r.id} label={r.hint ?? r.label}>
            <button
              type="button"
              role="radio"
              aria-checked={ratio === r.id}
              aria-label={r.label}
              onClick={() => {
                setExport({ ratio: r.id });
                useProject.getState().setSocial({ network: null });
              }}
              className={cx('h-8 rounded-[10px] px-2.5 text-[12.5px] font-medium tabular-nums transition-colors', ratio === r.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-3 hover:text-fg')}
            >
              {r.label}
            </button>
          </Tooltip>
        ))}
      </div>
      <SeeOn />
      <span className="mx-1 h-5 w-px bg-line-strong" />
      <Tooltip label={t('stage.resetView')} shortcut="F">
        <button type="button" className={btn} aria-label={t('stage.resetView')} onClick={() => useUi.getState().resetView()}>
          <Scan size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t('stage.fullscreen')}>
        <button type="button" className={btn} aria-label={t('stage.fullscreen')} onClick={onFullscreen}>
          <Maximize2 size={15} />
        </button>
      </Tooltip>
      <span className="mx-1 h-5 w-px bg-line-strong" />
      <Tooltip label={t('stage.ideasHint')}>
        <button type="button" className={cx(btn, 'text-fg')} onClick={() => variants.open()} data-testid="open-variants">
          <Sparkles size={15} />
          {t('stage.ideas')}
        </button>
      </Tooltip>
    </div>
  );
}

const row = 'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface-3';
const field =
  'h-8 w-full rounded-[8px] bg-surface-2 px-2.5 text-[12.5px] text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none placeholder:text-fg-subtle focus:shadow-[0_0_0_1.5px_var(--accent)_inset]';

/** “Voir sur…”: the scene inside a generic post, story, TikTok or YouTube interface, and the other social sizes. */
function SeeOn() {
  const { t, tr } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const social = useProject((s) => s.social);
  const brand = useProject((s) => s.brand);
  const setExport = useProject((s) => s.setExport);
  const setSocial = useProject((s) => s.setSocial);
  const format = socialOf(ratio);
  const choose = (network: Network | null) => {
    setSocial({ network });
    if (network) setExport({ ratio: NETWORKS[network].ratio });
  };
  const label = social.network ? tr(NETWORKS[social.network].label) : format ? tr(format.label) : t('social.see');
  const on = !!social.network || !!format;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`${t('social.see')}${on ? ` · ${label}` : ''}`} className={cx(btn, on && 'bg-fg text-bg hover:bg-fg hover:text-bg')}>
          {label}
          <ChevronDown size={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className="menu-surface z-50 flex w-[280px] flex-col gap-1 rounded-[14px] p-1.5 animate-[fade-in_120ms_ease-out]">
          {[null, ...NETWORK_ORDER].map((n) => (
            <button key={n ?? 'none'} type="button" data-testid={`see-on-${n ?? 'none'}`} aria-pressed={social.network === n} onClick={() => choose(n)} className={row}>
              {n ? tr(NETWORKS[n].label) : t('social.none')}
              {n && <span className="ml-auto text-[11.5px] tabular-nums text-fg-subtle">{socialOf(NETWORKS[n].ratio)?.px.join(' × ')}</span>}
              <Check size={13} className={cx(!n && 'ml-auto', social.network === n ? '' : 'opacity-0')} />
            </button>
          ))}
          <div className="mx-2.5 mt-1 text-[11.5px] font-medium text-fg-subtle">{t('social.others')}</div>
          {SOCIAL.filter((f) => !NETWORK_ORDER.some((n) => NETWORKS[n].ratio === f.id)).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={!social.network && ratio === f.id}
              onClick={() => {
                setSocial({ network: null });
                setExport({ ratio: f.id });
              }}
              className={row}
            >
              {tr(f.label)}
              <span className="ml-auto text-[11.5px] tabular-nums text-fg-subtle">{f.px.join(' × ')}</span>
              <Check size={13} className={!social.network && ratio === f.id ? '' : 'opacity-0'} />
            </button>
          ))}
          <div className="mx-1 mt-1 flex flex-col gap-1.5 border-t border-line px-1.5 pb-1 pt-2.5">
            <div className="text-[11.5px] font-medium text-fg-subtle">{t('social.text')}</div>
            <input aria-label={t('social.account')} placeholder={accountOf({ ...social, account: '' }, brand)} value={social.account} onChange={(e) => setSocial({ account: e.target.value })} className={field} />
            <input aria-label={t('social.caption')} placeholder={t('social.caption')} value={social.caption} onChange={(e) => setSocial({ caption: e.target.value })} className={field} />
            {social.network === 'youtube' && <input aria-label={t('social.title')} placeholder={t('social.title')} value={social.title} onChange={(e) => setSocial({ title: e.target.value })} className={field} />}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
