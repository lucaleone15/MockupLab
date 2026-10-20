import { useEffect, useRef } from 'react';
import { useT, type I18nKey } from '@/i18n';
import { getModel } from '@/models/registry';
import { switchModel } from '@/lib/switchModel';
import { placeholderTexture } from '@/scene/useScreenMaterial';
import { handleOf } from '@/social/networks';
import { PHONE_APPS, cardAspect, paintPhoneScreen, socialWords, type PhoneApp } from '@/social/phoneScreen';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';

const PHONE = 'phone-pro';
const CARD = 'social-card';

type App = Exclude<PhoneApp, 'none'>;

/** A small phone (or the card alone) showing the app, painted like the real one. */
function Thumb({ app, device }: { app: App; device: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const brand = useProject((s) => s.brand);
  const { lang } = useT();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const aspect = device ? getModel(PHONE).surfaces[0].aspect : cardAspect(app);
    const screen = paintPhoneScreen(app, placeholderTexture().image as HTMLCanvasElement, aspect, { account: handleOf('', brand), caption: '', words: socialWords(), avatar: null }, { device });
    c.width = 180;
    c.height = Math.round(180 / aspect);
    c.getContext('2d')!.drawImage(screen, 0, 0, c.width, c.height);
  }, [app, device, brand, lang]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={device ? 'h-[132px] w-auto rounded-[12px] shadow-[0_0_0_3px_#1b1c21,0_0_0_4px_rgb(255_255_255/0.12),0_10px_24px_rgb(10_14_40/0.28)]' : 'h-[120px] w-auto rounded-[6px] shadow-[0_8px_20px_rgb(10_14_40/0.28)]'}
    />
  );
}

/**
 * The « Réseaux sociaux » family: a Phone Pro showing a post, a story or a
 * Reel, or the same on its own like the Browser window. When changing a
 * phone for a phone app, it keeps its model and shows the app.
 */
export function SocialCards({ onPicked, replaceId }: { onPicked: () => void; replaceId?: string }) {
  const { t } = useT();
  const pick = async (app: App, device: boolean) => {
    const s = useProject.getState();
    if (replaceId) {
      const it = s.items.find((x) => x.id === replaceId);
      const keep = it && (device ? getModel(it.modelId).category === 'phone' : it.modelId === CARD);
      if (!keep) await switchModel(replaceId, device ? PHONE : CARD);
      useProject.getState().setParam(replaceId, 'app', app);
    } else {
      s.addItem(device ? PHONE : CARD, undefined, { app });
      useUi.getState().resetView();
    }
    onPicked();
  };
  const row = (device: boolean) => (
    <div className="grid grid-cols-3 gap-2.5">
      {PHONE_APPS.map((app) => (
        <button
          key={app}
          type="button"
          data-testid={`social-${device ? 'card' : 'alone'}-${app}`}
          onClick={() => void pick(app, device)}
          className="flex flex-col items-center justify-end gap-2.5 rounded-[12px] bg-surface-2 px-2 pb-3 pt-4 text-[12.5px] font-medium text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] transition-[background-color,color,transform] duration-150 hover:bg-surface-3 hover:text-fg active:scale-[0.97]"
        >
          <Thumb app={app} device={device} />
          {t(`catalogue.social.${app}` as I18nKey)}
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-snug text-fg-muted">{t('catalogue.socialHint')}</p>
      <h3 className="text-[12.5px] font-semibold text-fg">{t('catalogue.social.inPhone')}</h3>
      {row(true)}
      <h3 className="mt-2 text-[12.5px] font-semibold text-fg">{t('catalogue.social.alone')}</h3>
      {row(false)}
    </div>
  );
}
