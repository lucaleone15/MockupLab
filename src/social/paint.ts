import { chromeOf, type Network } from './networks';

/*
 * Draws a generic social interface around (post) or over (story, short video)
 * an image of width `w` and height `h` placed at (0, top), for the social
 * phone's screen (phoneScreen.ts). Sizes scale with the width.
 */

/** How the account's picture sits in its disc. */
export interface AvatarFrame {
  /** true: the picture fills the disc; false: it shows whole on white (a logo). */
  fill: boolean;
  /** 1 = the picture just fits; more zooms in. */
  zoom: number;
  /** Where the crop sits, -1…1 on each axis (0 = centred). */
  x: number;
  y: number;
}

export const DEFAULT_FRAME: AvatarFrame = { fill: true, zoom: 1, x: 0, y: 0 };

export interface SocialText {
  account: string;
  caption: string;
  /** Interface words in the app's language. */
  words: { likes: string; message: string; following: string; forYou: string; ago: string; comments: string; sound: string };
  avatar?: CanvasImageSource | null;
  avatarFrame?: AvatarFrame;
}

const FONT = '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

/*
 * One type scale for the three interfaces, in iOS points (a 393 pt wide phone
 * painted 1080 px wide: 1 pt = 2.75 px), so the account, the caption and the
 * icons are the same size in a post, a story and a Reel, as in the apps.
 */
export const PT = 1080 / 393;
const NAME = 14.5;
const BODY = 14.5;
const META = 13.5;
const COUNT = 12.5;
const TAB = 16.5;
const ICON = 26;
const STROKE = 1.9;

/** Paints the picture in a disc of radius r at (x, y), framed (a gradient without a picture). */
export function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, img?: CanvasImageSource | null, ring?: string, frame: AvatarFrame = DEFAULT_FRAME) {
  ctx.save();
  if (ring) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.14, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const i = img as HTMLImageElement;
    const iw = i.naturalWidth || i.width;
    const ih = i.naturalHeight || i.height;
    const zoom = Math.max(1, frame.zoom);
    if (frame.fill) {
      // a square crop of the picture, zoomed and moved, fills the disc
      const side = Math.min(iw, ih) / zoom;
      const sx = (iw - side) / 2 + (frame.x * (iw - side)) / 2;
      const sy = (ih - side) / 2 + (frame.y * (ih - side)) / 2;
      ctx.drawImage(img, sx, sy, side, side, x - r, y - r, r * 2, r * 2);
    } else {
      // the whole picture (a logo) on white, zoomed and moved
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      const s = (r * 1.4 * zoom) / Math.max(iw, ih);
      ctx.drawImage(img, x - (iw * s) / 2 - frame.x * r * 0.6, y - (ih * s) / 2 - frame.y * r * 0.6, iw * s, ih * s);
    }
  } else {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, '#4b7bff');
    g.addColorStop(1, '#9b5cff');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Wraps `s` to `maxW`, at most `lines` lines (the last one ends with …). */
function wrap(ctx: CanvasRenderingContext2D, s: string, size: number, weight: number, maxW: number, lines: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const out: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW) line = next;
    else {
      out.push(line);
      line = word;
      if (out.length === lines) break;
    }
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === lines && s.split(/\s+/).join(' ').length > out.join(' ').length) out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…';
  return out;
}

/* simple line icons, drawn at (x, y) with size u */
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, filled = false) {
  ctx.beginPath();
  ctx.moveTo(x, y + u * 0.35);
  ctx.bezierCurveTo(x - u * 0.55, y - u * 0.05, x - u * 0.45, y - u * 0.5, x, y - u * 0.22);
  ctx.bezierCurveTo(x + u * 0.45, y - u * 0.5, x + u * 0.55, y - u * 0.05, x, y + u * 0.35);
  if (filled) ctx.fill();
  else ctx.stroke();
}
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, u * 0.42, u * 0.38, 0, 0.35 * Math.PI, 2.25 * Math.PI);
  ctx.lineTo(x + u * 0.42, y + u * 0.38);
  ctx.closePath();
  ctx.stroke();
}
function plane(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.beginPath();
  ctx.moveTo(x - u * 0.42, y - u * 0.3);
  ctx.lineTo(x + u * 0.42, y - u * 0.38);
  ctx.lineTo(x + u * 0.05, y + u * 0.4);
  ctx.lineTo(x - u * 0.05, y - u * 0.02);
  ctx.closePath();
  ctx.moveTo(x - u * 0.05, y - u * 0.02);
  ctx.lineTo(x + u * 0.42, y - u * 0.38);
  ctx.stroke();
}
function bookmark(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.beginPath();
  ctx.moveTo(x - u * 0.3, y - u * 0.4);
  ctx.lineTo(x + u * 0.3, y - u * 0.4);
  ctx.lineTo(x + u * 0.3, y + u * 0.42);
  ctx.lineTo(x, y + u * 0.18);
  ctx.lineTo(x - u * 0.3, y + u * 0.42);
  ctx.closePath();
  ctx.stroke();
}

/** Paints the interface; the image is at (0, top) with size w × h, top = chromeOf(network).top × w. */
export function paintChrome(ctx: CanvasRenderingContext2D, network: Network, w: number, h: number, d: SocialText) {
  const room = chromeOf(network);
  const top = room.top * w;
  const u = (w / 1080) * PT; // px per point
  const name = d.account.replace(/^@/, '');
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = STROKE * u;
  if (network === 'ig-post') {
    const fg = '#0c0c0d';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, top);
    ctx.fillRect(0, top + h, w, room.bottom * w);
    avatar(ctx, 28 * u, top / 2, 16 * u, d.avatar, '#dbdbdb', d.avatarFrame);
    text(ctx, name, 54 * u, top / 2, NAME * u, fg, 600);
    text(ctx, '•••', w - 14 * u, top / 2, 11 * u, fg, 700, 'right');
    const iy = top + h + 22 * u;
    ctx.strokeStyle = fg;
    heart(ctx, 26 * u, iy, ICON * u);
    bubble(ctx, 66 * u, iy, ICON * u);
    plane(ctx, 106 * u, iy, ICON * u);
    bookmark(ctx, w - 26 * u, iy, ICON * u);
    const likes = iy + 30 * u;
    text(ctx, d.words.likes, 14 * u, likes, BODY * u, fg, 600);
    const lead = 19.5 * u;
    const caption = wrap(ctx, `${name} ${d.caption}`.trim(), BODY * u, 400, w - 28 * u, 2);
    caption.forEach((line, i) => {
      const y = likes + lead * (i + 1);
      if (i === 0) {
        text(ctx, name, 14 * u, y, BODY * u, fg, 600);
        ctx.font = `600 ${BODY * u}px ${FONT}`;
        const nw = ctx.measureText(name + ' ').width;
        text(ctx, line.slice(name.length).trim(), 14 * u + nw, y, BODY * u, fg);
      } else text(ctx, line, 14 * u, y, BODY * u, fg);
    });
    text(ctx, d.words.comments, 14 * u, likes + lead * (caption.length + 1), META * u, '#737373');
  } else if (network === 'story') {
    const g = ctx.createLinearGradient(0, 0, 0, 90 * u);
    g.addColorStop(0, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 90 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.roundRect(8 * u, 8 * u, w - 16 * u, 2.2 * u, 1.1 * u);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(8 * u, 8 * u, (w - 16 * u) * 0.6, 2.2 * u, 1.1 * u);
    ctx.fill();
    const ay = 34 * u;
    avatar(ctx, 26 * u, ay, 16 * u, d.avatar, undefined, d.avatarFrame);
    text(ctx, name, 50 * u, ay, NAME * u, '#fff', 600);
    ctx.font = `600 ${NAME * u}px ${FONT}`;
    text(ctx, d.words.ago, 50 * u + ctx.measureText(name + '  ').width, ay, NAME * u, 'rgba(255,255,255,0.72)');
    const by = h - 30 * u;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.roundRect(12 * u, by - 22 * u, w - 108 * u, 44 * u, 22 * u);
    ctx.stroke();
    text(ctx, d.words.message, 28 * u, by, BODY * u, '#fff');
    ctx.lineWidth = STROKE * u;
    ctx.strokeStyle = '#fff';
    heart(ctx, w - 70 * u, by, ICON * u);
    plane(ctx, w - 28 * u, by, ICON * u);
  } else {
    const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    const ty = 22 * u;
    text(ctx, d.words.following, w / 2 - 10 * u, ty, TAB * u, 'rgba(255,255,255,0.68)', 600, 'right');
    text(ctx, d.words.forYou, w / 2 + 10 * u, ty, TAB * u, '#fff', 700, 'left');
    ctx.font = `700 ${TAB * u}px ${FONT}`;
    const fy = ctx.measureText(d.words.forYou).width;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(w / 2 + 10 * u + fy / 2 - 11 * u, ty + 14 * u, 22 * u, 2.6 * u, 1.3 * u);
    ctx.fill();
    // the column of actions on the right
    const cx = w - 28 * u;
    let y = h * 0.5;
    avatar(ctx, cx, y, 22 * u, d.avatar, '#fff', d.avatarFrame);
    ctx.fillStyle = '#fe2c55';
    ctx.beginPath();
    ctx.arc(cx, y + 23 * u, 9 * u, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, '+', cx, y + 22.5 * u, 14 * u, '#fff', 700, 'center');
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.3 * u;
    for (const [draw, n] of [
      [(yy: number) => heart(ctx, cx, yy, 34 * u, true), '12,4 k'],
      [(yy: number) => bubble(ctx, cx, yy, 32 * u), '318'],
      [(yy: number) => plane(ctx, cx, yy, 31 * u), '96'],
    ] as const) {
      y += 66 * u;
      draw(y);
      text(ctx, n, cx, y + 29 * u, COUNT * u, '#fff', 600, 'center');
    }
    // account, caption and sound, bottom left
    const lead = 20 * u;
    const lines = wrap(ctx, d.caption, BODY * u, 400, w - 96 * u, 2);
    const sound = h - 18 * u;
    const cap0 = sound - lead * (lines.length + 0.3);
    text(ctx, d.account, 14 * u, cap0 - lead * 1.1, NAME * u + 1.5 * u, '#fff', 700);
    lines.forEach((line, i) => text(ctx, line, 14 * u, cap0 + i * lead, BODY * u, '#fff'));
    text(ctx, `♫  ${d.words.sound}`, 14 * u, sound, META * u, '#fff');
  }
  ctx.restore();
}
