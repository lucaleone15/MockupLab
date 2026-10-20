import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { registerFontAsset } from '@/lib/fontFaces';
import { loadImage, prepareTexture, useAssets } from '@/store/assets';
import type { Brand } from '@/store/project';
import { polishedMetal } from '@/scene/materials';
import { colorsOf, type DeviceFinish, type DeviceModule, type DeviceProps, type NamedColor } from '../types';
import { cardGeometry } from '../print/geometry';
import { paperMaterial } from '../print/shared';

/*
 * A brand-identity object drawn from the brand kit: a swatch fan (one blade
 * per palette colour, with name and hex), listed with the printed goods.
 */

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];

const font = (brand: Brand, role: 'heading' | 'body', weight: number, px: number) =>
  `${brand[role].family === 'Instrument Serif' ? 'italic 400' : weight} ${px}px "${brand[role].family}", "Geist Variable", system-ui, sans-serif`;

/** Brand kit + logo image + "fonts ready" flag, so canvases redraw when anything changes. */
function useBrandAssets(brand: Brand) {
  const logoAsset = useAssets((s) => (brand.logoAssetId ? s.assets[brand.logoAssetId] : undefined));
  const [ready, setReady] = useState<{ key: string; logo: HTMLImageElement | null } | null>(null);
  const key = JSON.stringify(brand);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const f of [brand.heading, brand.body]) if (f.assetId) await registerFontAsset(f.assetId, f.family).catch(() => undefined);
      await Promise.all([document.fonts.load(font(brand, 'heading', 800, 40)), document.fonts.load(font(brand, 'body', 500, 40))]).catch(() => undefined);
      const logo = logoAsset ? await loadImage(logoAsset.url) : null;
      if (alive) setReady({ key, logo });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, logoAsset]);
  return { brand, logo: ready?.logo ?? null, version: ready?.key ?? '' };
}

function useCanvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, deps: unknown[]) {
  const invalidate = useThree((s) => s.invalidate);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return prepareTexture(new THREE.CanvasTexture(c));
  }, [w, h]);
  useEffect(() => {
    const c = tex.image as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    draw(g);
    tex.needsUpdate = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex, invalidate, ...deps]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/* ------------------------------------------------------------ swatch fan */

const BW = 4.6;
const BH = 15;
const PIVOT = 1.3;

function Blade({ index, color, brand, version, angle }: { index: number; color: NamedColor; brand: Brand; version: string; angle: number }) {
  const tex = useCanvasTexture(
    460,
    1500,
    (g) => {
      const W = 460;
      const H = 1500;
      // the name and values at the outer end, which stays clear when the blades fan out; the colour down to the rivet
      const band = H * 0.25;
      g.fillStyle = '#f7f5f0';
      g.fillRect(0, 0, W, H);
      g.fillStyle = color.hex;
      g.fillRect(0, band, W, H - band);
      g.fillStyle = '#1d1b19';
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.font = font(brand, 'heading', 700, 56);
      g.fillText(color.name || color.hex.toUpperCase(), 34, 104, W - 60);
      g.globalAlpha = 0.7;
      g.font = `400 40px "Geist Mono Variable", ui-monospace, monospace`;
      g.fillText(color.hex.toUpperCase(), 34, 182);
      const rgb = /^#[0-9a-f]{6}$/i.test(color.hex) ? [1, 3, 5].map((k) => parseInt(color.hex.slice(k, k + 2), 16)) : null;
      if (rgb) {
        g.font = `400 34px "Geist Mono Variable", ui-monospace, monospace`;
        g.fillText(`RGB ${rgb.join(' ')}`, 34, 238);
      }
      g.globalAlpha = 0.45;
      g.font = font(brand, 'body', 500, 28);
      g.fillText(brand.name, 34, band - 34, W - 60);
      // rivet hole
      g.globalAlpha = 1;
      g.fillStyle = '#d8d4cc';
      g.beginPath();
      g.arc(W / 2, H - (PIVOT / BH) * H, 26, 0, Math.PI * 2);
      g.fill();
    },
    [version, color.hex, color.name],
  );
  const g = useMemo(() => cardGeometry(BW, BH, 0.04, 0.35), []);
  const front = useMemo(() => new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.75, sheen: 0.2, sheenColor: new THREE.Color('#fff') }), [tex]);
  return (
    // each blade turns around the rivet near its bottom edge and sits a hair above the previous one
    <group position={[0, 0.04 * index + 0.02, 0]} rotation={[0, angle, 0]}>
      <group position={[0, 0, -(BH / 2 - PIVOT)]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={g.edge} material={paperMaterial()} castShadow receiveShadow />
        <mesh geometry={g.front} material={front} castShadow receiveShadow />
        <mesh geometry={g.back} material={paperMaterial()} />
      </group>
    </group>
  );
}

function SwatchFan({ params, brand: kit }: DeviceProps) {
  const { brand, version } = useBrandAssets(kit);
  // its own colours, else the brand's palette
  const colors = colorsOf(params.colors) ?? brand.colors;
  const n = colors.length;
  const spread = THREE.MathUtils.degToRad(Number(params.spread ?? 70));
  return (
    <group position={[0, 0, 4]}>
      {colors.map((color, i) => (
        <Blade key={i} index={i} color={color} brand={brand} version={version} angle={n > 1 ? spread / 2 - (i / (n - 1)) * spread : 0} />
      ))}
      <mesh position={[0, 0.04 * n + 0.08, 0]} material={polishedMetal('#b9bcc1')} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.16, 24]} />
      </mesh>
    </group>
  );
}

export const swatchFan: DeviceModule = {
  id: 'swatch-fan',
  name: { fr: 'Nuancier', en: 'Swatch fan' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [24, 0.4, 18],
  sizeFor: () => ({ size: [24, 0.4, 18], focus: [0, 0, -4] }),
  surfaces: [],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    { id: 'colors', kind: 'colors', label: { fr: 'Couleurs', en: 'Colours' }, default: '', max: 10 },
    { id: 'spread', kind: 'slider', label: { fr: 'Ouverture', en: 'Spread' }, min: 0, max: 120, step: 1, default: 70, unit: '°' },
  ],
  view: { target: [0, 0, 0], offset: [4, 34, 20] },
  yaw: 0,
  Component: SwatchFan,
};
