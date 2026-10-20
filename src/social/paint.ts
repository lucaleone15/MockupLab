import { chromeOf, type Network } from './networks';

/*
 * Draws a generic social interface around (post, YouTube) or over (story,
 * TikTok) an image of width `w` and height `h` placed at (0, top). Used for
 * the on-screen preview (over the live scene) and for the export (around the
 * rendered image), so both look the same. Sizes scale with the width.
 */

export interface SocialText {
  account: string;
  caption: string;
  title: string;
  /** Interface words in the app's language. */
  words: { likes: string; message: string; following: string; forYou: string; ago: string; comments: string; sound: string; subscribers: string; subscribe: string; views: string };
  avatar?: CanvasImageSource | null;
}

const FONT = '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, img?: CanvasImageSource | null, ring?: string) {
  ctx.save();
  if (ring) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.drawImage(img, x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
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
  const k = w / 1080;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (network === 'ig-post') {
    const fg = '#111';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, top);
    ctx.fillRect(0, top + h, w, room.bottom * w);
    avatar(ctx, 64 * k, top / 2, 40 * k, d.avatar, '#d9d9d9');
    text(ctx, d.account.replace(/^@/, ''), 128 * k, top / 2, 34 * k, fg, 600);
    text(ctx, '•••', w - 50 * k, top / 2, 30 * k, fg, 700, 'right');
    const iy = top + h + 66 * k;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 5 * k;
    heart(ctx, 66 * k, iy, 62 * k);
    bubble(ctx, 162 * k, iy, 58 * k);
    plane(ctx, 258 * k, iy, 58 * k);
    bookmark(ctx, w - 66 * k, iy, 58 * k);
    text(ctx, d.words.likes, 40 * k, iy + 82 * k, 32 * k, fg, 600);
    const caption = wrap(ctx, `${d.account.replace(/^@/, '')} ${d.caption}`.trim(), 32 * k, 400, w - 80 * k, 2);
    caption.forEach((line, i) => {
      const y = iy + 136 * k + i * 44 * k;
      if (i === 0) {
        const name = d.account.replace(/^@/, '');
        text(ctx, name, 40 * k, y, 32 * k, fg, 600);
        ctx.font = `600 ${32 * k}px ${FONT}`;
        const nw = ctx.measureText(name + ' ').width;
        text(ctx, line.slice(name.length).trim(), 40 * k + nw, y, 32 * k, fg);
      } else text(ctx, line, 40 * k, y, 32 * k, fg);
    });
    text(ctx, d.words.comments, 40 * k, iy + 136 * k + caption.length * 44 * k + 4 * k, 30 * k, '#8e8e8e');
  } else if (network === 'story') {
    const g = ctx.createLinearGradient(0, 0, 0, 260 * k);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 260 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(24 * k, 28 * k, w - 48 * k, 6 * k);
    ctx.fillStyle = '#fff';
    ctx.fillRect(24 * k, 28 * k, (w - 48 * k) * 0.6, 6 * k);
    avatar(ctx, 76 * k, 104 * k, 38 * k, d.avatar);
    text(ctx, d.account.replace(/^@/, ''), 132 * k, 104 * k, 32 * k, '#fff', 600);
    ctx.font = `600 ${32 * k}px ${FONT}`;
    text(ctx, d.words.ago, 132 * k + ctx.measureText(d.account.replace(/^@/, '') + '  ').width, 104 * k, 32 * k, 'rgba(255,255,255,0.75)');
    const by = h - 110 * k;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.roundRect(28 * k, by - 50 * k, w - 230 * k, 100 * k, 50 * k);
    ctx.stroke();
    text(ctx, d.words.message, 72 * k, by, 32 * k, '#fff');
    ctx.lineWidth = 5 * k;
    ctx.strokeStyle = '#fff';
    heart(ctx, w - 150 * k, by, 64 * k);
    plane(ctx, w - 60 * k, by, 60 * k);
  } else if (network === 'tiktok') {
    const g = ctx.createLinearGradient(0, h * 0.62, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    text(ctx, d.words.following, w / 2 - 24 * k, 110 * k, 36 * k, 'rgba(255,255,255,0.7)', 600, 'right');
    text(ctx, d.words.forYou, w / 2 + 24 * k, 110 * k, 36 * k, '#fff', 700, 'left');
    ctx.font = `700 ${36 * k}px ${FONT}`;
    const fy = ctx.measureText(d.words.forYou).width;
    ctx.fillStyle = '#fff';
    ctx.fillRect(w / 2 + 24 * k + fy / 2 - 30 * k, 140 * k, 60 * k, 6 * k);
    const cx = w - 84 * k;
    let y = h * 0.52;
    avatar(ctx, cx, y, 50 * k, d.avatar, '#fff');
    ctx.fillStyle = '#fe2c55';
    ctx.beginPath();
    ctx.arc(cx, y + 54 * k, 20 * k, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, '+', cx, y + 53 * k, 32 * k, '#fff', 700, 'center');
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5 * k;
    for (const [draw, n] of [
      [(yy: number) => heart(ctx, cx, yy, 76 * k, true), '12,4 k'],
      [(yy: number) => bubble(ctx, cx, yy, 70 * k), '318'],
      [(yy: number) => plane(ctx, cx, yy, 68 * k), '96'],
    ] as const) {
      y += 170 * k;
      draw(y);
      text(ctx, n, cx, y + 64 * k, 26 * k, '#fff', 600, 'center');
    }
    text(ctx, d.account, 40 * k, h - 250 * k, 36 * k, '#fff', 700);
    wrap(ctx, d.caption, 32 * k, 400, w - 220 * k, 2).forEach((line, i) => text(ctx, line, 40 * k, h - 196 * k + i * 44 * k, 32 * k, '#fff'));
    text(ctx, `♫  ${d.words.sound}`, 40 * k, h - 92 * k, 30 * k, '#fff');
  } else {
    // YouTube-like: the player, then the title and the channel on a dark page
    const y0 = top + h;
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, y0, w, room.bottom * w);
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, y0 - 4 * k, w * 0.32, 4 * k);
    const lines = wrap(ctx, d.title || d.caption || d.account, 40 * k, 600, w - 64 * k, 1);
    text(ctx, lines[0] ?? '', 32 * k, y0 + 52 * k, 40 * k, '#f1f1f1', 600);
    text(ctx, d.words.views, 32 * k, y0 + 100 * k, 28 * k, '#aaa');
    avatar(ctx, 64 * k, y0 + 168 * k, 34 * k, d.avatar);
    text(ctx, d.account.replace(/^@/, ''), 116 * k, y0 + 156 * k, 30 * k, '#f1f1f1', 600);
    text(ctx, d.words.subscribers, 116 * k, y0 + 188 * k, 24 * k, '#aaa');
    ctx.font = `600 ${28 * k}px ${FONT}`;
    const sw = ctx.measureText(d.words.subscribe).width + 56 * k;
    ctx.fillStyle = '#f1f1f1';
    ctx.beginPath();
    ctx.roundRect(w - 32 * k - sw, y0 + 140 * k, sw, 56 * k, 28 * k);
    ctx.fill();
    text(ctx, d.words.subscribe, w - 32 * k - sw / 2, y0 + 168 * k, 28 * k, '#0f0f0f', 600, 'center');
  }
  ctx.restore();
}

/** The rendered image inside its interface (a new canvas). */
export function paintSocial(image: HTMLCanvasElement, network: Network, d: SocialText): HTMLCanvasElement {
  const room = chromeOf(network);
  const w = image.width;
  const top = Math.round(room.top * w);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = top + image.height + Math.round(room.bottom * w);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(image, 0, top);
  paintChrome(ctx, network, w, image.height, d);
  return out;
}
