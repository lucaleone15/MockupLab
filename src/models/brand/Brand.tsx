import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { drawBrandArt, paletteRoles } from '@/lib/brandDraw';
import { registerFontAsset } from '@/lib/fontFaces';
import { loadImage, prepareTexture, useAssets } from '@/store/assets';
import type { Brand } from '@/store/project';
import { polishedMetal } from '@/scene/materials';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';
import { cardGeometry } from '../print/geometry';
import { paperMaterial } from '../print/shared';

/*
 * Brand-identity objects drawn from the brand kit: a swatch fan (one blade
 * per palette colour, with name and hex) and a type specimen card.
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

function Blade({ index, brand, version, angle }: { index: number; brand: Brand; version: string; angle: number }) {
  const color = brand.colors[index];
  const tex = useCanvasTexture(
    460,
    1500,
    (g) => {
      const W = 460;
      const H = 1500;
      g.fillStyle = '#f7f5f0';
      g.fillRect(0, 0, W, H);
      g.fillStyle = color.hex;
      g.fillRect(0, 0, W, H * 0.7);
      g.fillStyle = '#1d1b19';
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.font = font(brand, 'heading', 700, 54);
      g.fillText(color.name, 34, H * 0.7 + 96, W - 60);
      g.globalAlpha = 0.65;
      g.font = `400 40px "Geist Mono Variable", ui-monospace, monospace`;
      g.fillText(color.hex.toUpperCase(), 34, H * 0.7 + 160);
      g.globalAlpha = 0.4;
      g.font = font(brand, 'body', 500, 30);
      g.fillText(brand.name, 34, H - 120, W - 60);
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
  const n = brand.colors.length;
  const spread = THREE.MathUtils.degToRad(Number(params.spread ?? 70));
  return (
    <group position={[0, 0, 4]}>
      {brand.colors.map((_, i) => (
        <Blade key={i} index={i} brand={brand} version={version} angle={n > 1 ? spread / 2 - (i / (n - 1)) * spread : 0} />
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
  category: 'brand',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [24, 0.4, 18],
  sizeFor: () => ({ size: [24, 0.4, 18], focus: [0, 0, -4] }),
  surfaces: [],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [{ id: 'spread', kind: 'slider', label: { fr: 'Ouverture', en: 'Spread' }, min: 0, max: 120, step: 1, default: 70, unit: '°' }],
  view: { target: [0, 0, 0], offset: [4, 34, 20] },
  yaw: 0,
  Component: SwatchFan,
};

/* ------------------------------------------------------------ specimen card */

const SW = 14.8;
const SH = 21;

function drawSpecimen(g: CanvasRenderingContext2D, W: number, H: number, brand: Brand, logo: HTMLImageElement | null) {
  const r = paletteRoles(brand);
  g.fillStyle = r.light;
  g.fillRect(0, 0, W, H);
  const ink = r.ink(r.light);
  const pad = W * 0.09;
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.font = font(brand, 'heading', 800, W * 0.42);
  g.fillText('Aa', pad - W * 0.01, pad + W * 0.36);
  g.font = font(brand, 'heading', 700, W * 0.07);
  const hName = brand.heading.family.replace(/ · [a-z0-9]{4}$/, '').replace(/ Variable$/, '');
  g.fillText(hName, pad, pad + W * 0.5, W - pad * 2);
  g.globalAlpha = 0.6;
  g.font = font(brand, 'body', 400, W * 0.04);
  const bName = brand.body.family.replace(/ · [a-z0-9]{4}$/, '').replace(/ Variable$/, '');
  g.fillText(`${bName} — texte courant`, pad, pad + W * 0.58, W - pad * 2);
  g.globalAlpha = 1;
  g.font = font(brand, 'body', 400, W * 0.055);
  ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', '0123456789 &@?!'].forEach((l, i) => g.fillText(l, pad, H * 0.47 + i * W * 0.075, W - pad * 2));
  const n = brand.colors.length;
  const chip = Math.min((W - pad * 2) / (n * 1.3), W * 0.11);
  brand.colors.forEach((c, i) => {
    g.fillStyle = c.hex;
    g.beginPath();
    g.arc(pad + chip / 2 + i * chip * 1.3, H - pad - chip / 2, chip / 2, 0, Math.PI * 2);
    g.fill();
  });
  if (logo) {
    const a = logo.naturalWidth / logo.naturalHeight;
    const lh = chip * 1.1;
    g.drawImage(logo, W - pad - lh * a, H - pad - lh, lh * a, lh);
  }
}

function Specimen({ brand: kit }: DeviceProps) {
  const { brand, logo, version } = useBrandAssets(kit);
  const front = useCanvasTexture(1480, 2100, (g) => drawSpecimen(g, 1480, 2100, brand, logo), [version, logo]);
  const back = useCanvasTexture(1480, 2100, (g) => drawBrandArt(g, 1480, 2100, brand, logo, 'primary'), [version, logo]);
  const g = useMemo(() => cardGeometry(SW, SH, 0.08, 0.05), []);
  const mFront = useMemo(() => new THREE.MeshPhysicalMaterial({ map: front, roughness: 0.85, sheen: 0.25, sheenColor: new THREE.Color('#fff') }), [front]);
  const mBack = useMemo(() => new THREE.MeshPhysicalMaterial({ map: back, roughness: 0.85, sheen: 0.25, sheenColor: new THREE.Color('#fff') }), [back]);
  // Two cards: the specimen, and a second one showing the brand colour, slightly fanned.
  return (
    <group>
      <group position={[SW * 0.32, 0.05, 1]} rotation={[0, -0.1, 0]}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={g.edge} material={paperMaterial()} castShadow receiveShadow />
          <mesh geometry={g.front} material={mBack} castShadow receiveShadow />
          <mesh geometry={g.back} material={paperMaterial()} />
        </group>
      </group>
      <group position={[-SW * 0.3, 0.14, 0]} rotation={[0, 0.06, 0]}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={g.edge} material={paperMaterial()} castShadow receiveShadow />
          <mesh geometry={g.front} material={mFront} castShadow receiveShadow />
          <mesh geometry={g.back} material={paperMaterial()} />
        </group>
      </group>
    </group>
  );
}

export const specimenCard: DeviceModule = {
  id: 'specimen',
  name: { fr: 'Spécimen', en: 'Specimen' },
  category: 'brand',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [25, 0.4, 22],
  sizeFor: () => ({ size: [25, 0.4, 22], focus: [0, 0, 0] }),
  surfaces: [],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  view: { target: [0, 0, 0], offset: [4, 34, 22] },
  yaw: 0,
  Component: Specimen,
};
