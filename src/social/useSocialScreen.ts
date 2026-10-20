import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import type { ParamValue } from '@/models/types';
import type { ScreenCompose } from '@/scene/useScreenMaterial';
import { loadImage, useAssets } from '@/store/assets';
import type { Brand } from '@/store/project';
import { handleOf } from './networks';
import { frameOf, paintPhoneScreen, socialWords, type PhoneApp } from './phoneScreen';

/** The phone's screen painting when it shows an app (the brand's logo as the avatar), else undefined. */
export function useSocialScreen(params: Record<string, ParamValue>, brand: Brand, aspect: number, { device = true } = {}): ScreenCompose | undefined {
  const { lang } = useT();
  const app = (params.app as PhoneApp | undefined) ?? 'none';
  // the account's photo, else the brand's logo
  const photoId = (typeof params.avatar === 'string' && params.avatar) || brand.logoAssetId;
  const logo = useAssets((s) => (photoId ? s.assets[photoId] : undefined));
  const [avatar, setAvatar] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!logo || app === 'none') return;
    let alive = true;
    loadImage(logo.url)
      .then((img) => alive && setAvatar({ url: logo.url, img }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [logo, app]);
  if (app === 'none') return undefined;
  const face = logo && avatar?.url === logo.url ? avatar.img : null;
  const account = handleOf(String(params.account ?? ''), brand);
  const caption = String(params.caption ?? '');
  const frame = frameOf(params, photoId === brand.logoAssetId);
  return {
    key: JSON.stringify([app, account, caption, lang, face ? logo!.url : '', aspect, device, frame]),
    draw: (image) => {
      const c = paintPhoneScreen(app, image, aspect, { account, caption, words: socialWords(), avatar: face, avatarFrame: frame }, { device });
      // the check scripts read the last painted screens
      if (import.meta.env.DEV) ((window as unknown as { __phoneScreens?: HTMLCanvasElement[] }).__phoneScreens ??= []).splice(0, Infinity, c);
      return c;
    },
  };
}
