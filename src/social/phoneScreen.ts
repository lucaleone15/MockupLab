import { t } from '@/i18n';
import type { ParamDef, ParamValue } from '@/models/types';
import { chromeOf } from './networks';
import { paintChrome, type AvatarFrame, type SocialText } from './paint';

/*
 * The social phone: a phone whose screen shows a generic Insta post, story or
 * Reel with the user's image inside (like the Browser model's page). The whole
 * screen is painted on a canvas that becomes the screen texture.
 */

export type PhoneApp = 'none' | 'post' | 'story' | 'reel';
export const PHONE_APPS: Exclude<PhoneApp, 'none'>[] = ['post', 'story', 'reel'];

const withApp = (p: Record<string, ParamValue>) => !!p.app && p.app !== 'none';
const hidden = () => false;

/** How the account's picture is framed: 'auto' fills the disc with a photo and shows a logo whole. */
export type AvatarFit = 'auto' | 'fill' | 'whole';

/** The phone settings that put an app on the screen. */
export const SOCIAL_PARAMS: ParamDef[] = [
  {
    id: 'app',
    kind: 'choice',
    label: { fr: 'Appli à l’écran', en: 'App on screen' },
    options: [
      { value: 'none', label: { fr: 'Aucune', en: 'None' } },
      { value: 'post', label: { fr: 'Post', en: 'Post' } },
      { value: 'story', label: { fr: 'Story', en: 'Story' } },
      { value: 'reel', label: { fr: 'Reel', en: 'Reel' } },
    ],
    default: 'none',
  },
  { id: 'account', kind: 'text', label: { fr: 'Nom du compte', en: 'Account name' }, default: '', placeholder: 'Ta marque par défaut', visible: withApp },
  {
    id: 'avatar',
    kind: 'image',
    label: { fr: 'Photo du compte', en: 'Account photo' },
    default: '',
    hint: { fr: 'Sinon, le logo de ta marque', en: 'Otherwise, your brand’s logo' },
    fallback: 'brand-logo',
    frame: { fit: 'avatarFit', zoom: 'avatarZoom', x: 'avatarX', y: 'avatarY' },
    visible: withApp,
  },
  // its framing, edited inside the photo's control
  { id: 'avatarFit', kind: 'choice', label: { fr: 'Cadrage', en: 'Framing' }, options: [{ value: 'auto', label: { fr: 'Auto', en: 'Auto' } }, { value: 'fill', label: { fr: 'Remplir', en: 'Fill' } }, { value: 'whole', label: { fr: 'Logo entier', en: 'Whole logo' } }], default: 'auto', visible: hidden },
  { id: 'avatarZoom', kind: 'slider', label: { fr: 'Zoom', en: 'Zoom' }, min: 1, max: 3, step: 0.01, default: 1, visible: hidden },
  { id: 'avatarX', kind: 'slider', label: { fr: 'Position', en: 'Position' }, min: -1, max: 1, step: 0.01, default: 0, visible: hidden },
  { id: 'avatarY', kind: 'slider', label: { fr: 'Position', en: 'Position' }, min: -1, max: 1, step: 0.01, default: 0, visible: hidden },
  { id: 'caption', kind: 'text', label: { fr: 'Légende', en: 'Caption' }, default: '', placeholder: 'Le site est en ligne', visible: withApp },
];

/** The interface's words, in the app's language. */
export function socialWords(): SocialText['words'] {
  return {
    likes: t('social.ui.likes'),
    message: t('social.ui.message'),
    following: t('social.ui.following'),
    forYou: t('social.ui.forYou'),
    ago: t('social.ui.ago'),
    comments: t('social.ui.comments'),
    sound: t('social.ui.sound'),
  };
}

const FONT = '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

function sizeOf(img: CanvasImageSource) {
  const i = img as HTMLImageElement & HTMLCanvasElement;
  return [i.naturalWidth || i.width, i.naturalHeight || i.height] as const;
}

/** Draws `img` covering the rect (centred crop). */
function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const [iw, ih] = sizeOf(img);
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * A story or a short video: a tall image covers the rect; a wider one (a post,
 * a landscape photo) sits in the middle at full width, over a blurred,
 * darkened copy of itself, as the apps show it. Returns the image's rect.
 */
function fill(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number): [number, number, number, number] {
  const [iw, ih] = sizeOf(img);
  if (iw / ih <= (w / h) * 1.25) {
    cover(ctx, img, x, y, w, h);
    return [x, y, w, h];
  }
  ctx.save();
  ctx.filter = `blur(${Math.round(w / 18)}px) brightness(0.6)`;
  cover(ctx, img, x - w * 0.1, y - h * 0.1, w * 1.2, h * 1.2);
  ctx.restore();
  const ph = (w * ih) / iw;
  const py = y + (h - ph) / 2;
  ctx.drawImage(img, x, py, w, ph);
  return [x, py, w, ph];
}

/** Height of the apps' bottom bar with the home indicator (83 pt). */
const TAB_BAR = 228;

/** Time on the left, signal, wifi and battery on the right; the island sits between (it is part of the 3D model). */
function statusBar(ctx: CanvasRenderingContext2D, w: number, h: number, k: number, color: string) {
  const y = h * 0.56;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.font = `600 ${46 * k}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 170 * k, y);
  // signal bars
  const sx = w - 300 * k;
  for (let i = 0; i < 4; i++) {
    const bh = (10 + i * 7) * k;
    ctx.beginPath();
    ctx.roundRect(sx + i * 13 * k, y + 16 * k - bh, 9 * k, bh, 2 * k);
    ctx.fill();
  }
  // wifi
  const wx = w - 212 * k;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6 * k;
  for (const r of [10, 21, 32]) {
    ctx.beginPath();
    ctx.arc(wx, y + 15 * k, r * k, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  // battery
  const bx = w - 168 * k;
  ctx.lineWidth = 3 * k;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.roundRect(bx, y - 15 * k, 64 * k, 31 * k, 9 * k);
  ctx.stroke();
  ctx.fillRect(bx + 67 * k, y - 5 * k, 4 * k, 11 * k);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.roundRect(bx + 5 * k, y - 10 * k, 46 * k, 21 * k, 5 * k);
  ctx.fill();
}

function homeIndicator(ctx: CanvasRenderingContext2D, w: number, h: number, k: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  // 134 × 5 pt, 8 pt above the bottom edge
  ctx.roundRect(w / 2 - 184 * k, h - 36 * k, 368 * k, 14 * k, 7 * k);
  ctx.fill();
}

/** The feed's bottom bar: home, search, new, reels, profile (generic line icons). */
function tabBar(ctx: CanvasRenderingContext2D, w: number, h: number, k: number, dark: boolean) {
  // 49 pt of bar + 34 pt for the home indicator, 24 pt icons
  const bar = TAB_BAR * k;
  const fg = dark ? '#fff' : '#111';
  ctx.fillStyle = dark ? '#000' : '#fff';
  ctx.fillRect(0, h - bar, w, bar);
  if (!dark) {
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(0, h - bar, w, 2 * k);
  }
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  ctx.lineWidth = 5.2 * k;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const y = h - bar + 68 * k;
  const step = w / 5;
  const s = 31 * k;
  // home
  let x = step / 2;
  ctx.beginPath();
  ctx.moveTo(x - s, y - 2 * k);
  ctx.lineTo(x, y - s);
  ctx.lineTo(x + s, y - 2 * k);
  ctx.lineTo(x + s, y + s);
  ctx.lineTo(x - s, y + s);
  ctx.closePath();
  ctx.stroke();
  // search
  x += step;
  ctx.beginPath();
  ctx.arc(x - 4 * k, y - 4 * k, s * 0.75, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.5, y + s * 0.5);
  ctx.lineTo(x + s, y + s);
  ctx.stroke();
  // new
  x += step;
  ctx.beginPath();
  ctx.roundRect(x - s, y - s, s * 2, s * 2, 12 * k);
  ctx.moveTo(x, y - s * 0.5);
  ctx.lineTo(x, y + s * 0.5);
  ctx.moveTo(x - s * 0.5, y);
  ctx.lineTo(x + s * 0.5, y);
  ctx.stroke();
  // reels
  x += step;
  ctx.beginPath();
  ctx.roundRect(x - s, y - s, s * 2, s * 2, 12 * k);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 7 * k, y - 11 * k);
  ctx.lineTo(x + 12 * k, y);
  ctx.lineTo(x - 7 * k, y + 11 * k);
  ctx.closePath();
  ctx.fill();
  // profile
  x += step;
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.stroke();
}

/** The feed's top bar: “new” on the left, likes and messages on the right (no app name). */
function feedHeader(ctx: CanvasRenderingContext2D, w: number, y: number, k: number) {
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 5.2 * k;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const s = 29 * k;
  ctx.beginPath();
  ctx.roundRect(48 * k, y - s, s * 2, s * 2, 12 * k);
  ctx.moveTo(48 * k + s, y - s * 0.5);
  ctx.lineTo(48 * k + s, y + s * 0.5);
  ctx.moveTo(48 * k + s * 0.5, y);
  ctx.lineTo(48 * k + s * 1.5, y);
  ctx.stroke();
  // heart
  const hx = w - 170 * k;
  ctx.beginPath();
  ctx.moveTo(hx, y + s * 0.85);
  ctx.bezierCurveTo(hx - s * 1.4, y - s * 0.1, hx - s * 1.1, y - s * 1.25, hx, y - s * 0.5);
  ctx.bezierCurveTo(hx + s * 1.1, y - s * 1.25, hx + s * 1.4, y - s * 0.1, hx, y + s * 0.85);
  ctx.stroke();
  // messages (paper plane in a bubble)
  const mx = w - 70 * k;
  ctx.beginPath();
  ctx.arc(mx, y, s * 1.05, 0.65 * Math.PI, 2.55 * Math.PI);
  ctx.lineTo(mx - s * 1.05, y + s * 1.05);
  ctx.closePath();
  ctx.stroke();
}

/** Width / height of the post, story or Reel on its own (no phone around it). */
export function cardAspect(app: Exclude<PhoneApp, 'none'>) {
  if (app !== 'post') return 9 / 16;
  const room = chromeOf('ig-post');
  return 1 / (room.top + 5 / 4 + room.bottom);
}

/**
 * The app with the image inside, at `aspect` (width / height): a phone's
 * screen (status bar, app bars), or with `device: false` the post, story or
 * Reel on its own. The photo rect is kept in `dataset.photo`.
 */
export function paintPhoneScreen(app: Exclude<PhoneApp, 'none'>, image: CanvasImageSource, aspect: number, text: SocialText, { device = true } = {}): HTMLCanvasElement {
  const w = 1080;
  const h = Math.round(w / aspect);
  const k = w / 1080;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const status = device ? 150 * k : 0;
  let photo: [number, number, number, number];

  if (app === 'post') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    const header = device ? 130 * k : 0;
    if (device) {
      statusBar(ctx, w, status, k, '#111');
      feedHeader(ctx, w, status + header / 2, k);
    }
    const top = status + header;
    const room = chromeOf('ig-post');
    const ph = (w * 5) / 4;
    photo = [0, top + room.top * w, w, ph];
    cover(ctx, image, ...photo);
    ctx.save();
    ctx.translate(0, top);
    paintChrome(ctx, 'ig-post', w, ph, text);
    ctx.restore();
    if (device) {
      tabBar(ctx, w, h, k, false);
      homeIndicator(ctx, w, h, k, '#111');
    }
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const nav = device && app === 'reel' ? TAB_BAR * k : 0;
    photo = fill(ctx, image, 0, 0, w, h - nav);
    if (device) {
      // a soft shade under the status bar so it reads on any image
      const g = ctx.createLinearGradient(0, 0, 0, status * 1.4);
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, status * 1.4);
      statusBar(ctx, w, status, k, '#fff');
    }
    ctx.save();
    const below = device ? (app === 'story' ? status : status * 0.55) : 20 * k;
    ctx.translate(0, below);
    paintChrome(ctx, app === 'story' ? 'story' : 'tiktok', w, h - nav - below - (device && app === 'story' ? 40 * k : 0), text);
    ctx.restore();
    if (device) {
      if (app === 'reel') tabBar(ctx, w, h, k, true);
      homeIndicator(ctx, w, h, k, '#fff');
    }
  }
  c.dataset.app = app;
  c.dataset.photo = photo.map(Math.round).join(',');
  return c;
}

/** The account picture's framing from the settings (`logo`: the picture is the brand's logo). */
export function frameOf(params: Record<string, ParamValue>, logo: boolean): AvatarFrame {
  const fit = (params.avatarFit as AvatarFit | undefined) ?? 'auto';
  const num = (v: ParamValue | undefined, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return { fill: fit === 'auto' ? !logo : fit === 'fill', zoom: num(params.avatarZoom, 1), x: num(params.avatarX, 0), y: num(params.avatarY, 0) };
}
