import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t, useT } from '@/i18n';
import { useAssets } from '@/store/assets';
import { useProject } from '@/store/project';
import { accountOf, chromeOf, NETWORKS, type Network } from './networks';
import { paintChrome, type SocialText } from './paint';

/** The interface's words, in the app's language. */
function words(): SocialText['words'] {
  return {
    likes: t('social.ui.likes'),
    message: t('social.ui.message'),
    following: t('social.ui.following'),
    forYou: t('social.ui.forYou'),
    ago: t('social.ui.ago'),
    comments: t('social.ui.comments'),
    sound: t('social.ui.sound'),
    subscribers: t('social.ui.subscribers'),
    subscribe: t('social.ui.subscribe'),
    views: t('social.ui.views'),
  };
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });

/** What the interface shows now (the brand's logo as the avatar, loaded). */
export async function socialTextNow(): Promise<SocialText> {
  const p = useProject.getState();
  const logo = p.brand.logoAssetId ? useAssets.getState().assets[p.brand.logoAssetId] : undefined;
  return { account: accountOf(p.social, p.brand), caption: p.social.caption, title: p.social.title, words: words(), avatar: logo ? await loadImage(logo.url) : null };
}

/** Room the interface adds around an image of ratio `ratio` (width / height), as the whole card's ratio. */
export function cardRatio(ratio: number, network: Network | null) {
  if (!network) return ratio;
  const room = chromeOf(network);
  return 1 / (1 / ratio + room.top + room.bottom);
}

/**
 * The live scene inside the network's interface: `children` is the scene
 * frame (width × height); the interface is painted over the whole card.
 */
export function SocialFrame({ network, width, height, children }: { network: Network; width: number; height: number; children: ReactNode }) {
  const { tr, lang } = useT();
  const social = useProject((s) => s.social);
  const brand = useProject((s) => s.brand);
  const logo = useAssets((s) => (brand.logoAssetId ? s.assets[brand.logoAssetId] : undefined));
  const [avatar, setAvatar] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const room = chromeOf(network);
  const top = Math.round(room.top * width);
  const card = top + height + Math.round(room.bottom * width);
  const account = accountOf(social, brand);

  useEffect(() => {
    let alive = true;
    if (logo) void loadImage(logo.url).then((img) => alive && setAvatar(img));
    else setAvatar(null);
    return () => {
      alive = false;
    };
  }, [logo]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(width * dpr);
    c.height = Math.round(card * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, card);
    paintChrome(ctx, network, width, height, { account, caption: social.caption, title: social.title, words: words(), avatar });
  }, [network, width, height, card, account, social.caption, social.title, avatar, lang]);

  return (
    <div
      data-testid="social-frame"
      aria-label={[tr(NETWORKS[network].label), account, social.caption, social.title].filter(Boolean).join(' · ')}
      className="relative overflow-hidden rounded-[10px] transition-[width,height] duration-300 ease-[var(--ease-out-quart)]"
      style={{ width, height: card, boxShadow: 'var(--frame-shadow)' }}
    >
      <div className="absolute inset-x-0" style={{ top, height }}>
        {children}
      </div>
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-10" style={{ width, height: card }} />
    </div>
  );
}
