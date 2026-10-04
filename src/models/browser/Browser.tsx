import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import { prepareTexture } from '@/store/assets';
import { mattePlastic } from '@/scene/materials';
import { createScreenMaterial } from '@/scene/screenMaterial';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { useFontsReady } from '../shared/useFontsReady';
import type { DeviceModule, DeviceProps } from '../types';

/*
 * Stylised browser window (neutral chrome, no vendor branding): a floating
 * card or a flat sheet, light or dark, compact bar or tab strip.
 * The toolbar is drawn on a canvas and rendered with the screen material so
 * its colours stay exact, like the page content.
 */

const W = 32;
const RADIUS = 0.55;
const PX_PER_CM = 90; // toolbar canvas resolution

type Theme = 'light' | 'dark';
type Layout = 'compact' | 'tabs';

const palette = {
  light: { bar: '#f3f3f4', strip: '#e4e4e7', tab: '#f3f3f4', field: '#ffffff', text: '#3f3f46', faint: '#a1a1aa', line: '#d9d9de', body: '#ececee' },
  dark: { bar: '#2a2a2e', strip: '#1c1c1f', tab: '#2a2a2e', field: '#1c1c1f', text: '#e4e4e7', faint: '#71717a', line: '#3a3a3f', body: '#232326' },
};

const toolbarHeight = (layout: Layout) => (layout === 'tabs' ? 2.5 : 1.6);

function drawToolbar(theme: Theme, layout: Layout, url: string): HTMLCanvasElement {
  const p = palette[theme];
  const h = toolbarHeight(layout);
  const c = document.createElement('canvas');
  c.width = Math.round(W * PX_PER_CM);
  c.height = Math.round(h * PX_PER_CM);
  const g = c.getContext('2d')!;
  const u = PX_PER_CM / 10; // 1 mm
  g.fillStyle = layout === 'tabs' ? p.strip : p.bar;
  g.fillRect(0, 0, c.width, c.height);

  const barTop = layout === 'tabs' ? 10 * u : 0;
  const barH = c.height - barTop;
  const cy = barTop + barH / 2;
  const lightsY = layout === 'tabs' ? 5 * u : cy;

  // window controls
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    g.beginPath();
    g.arc(7 * u + i * 6.5 * u, lightsY, 2.1 * u, 0, Math.PI * 2);
    g.fillStyle = col;
    g.fill();
  });

  if (layout === 'tabs') {
    // active tab + one inactive tab
    const tabX = 27 * u;
    const tabW = 60 * u;
    g.fillStyle = p.tab;
    g.beginPath();
    g.roundRect(tabX, 1.6 * u, tabW, barTop - 1.6 * u + 2, [2.2 * u, 2.2 * u, 0, 0]);
    g.fill();
    g.fillStyle = p.text;
    g.font = `500 ${3.1 * u}px "Geist Variable", system-ui, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText(prettyHost(url), tabX + 9 * u, 5.8 * u);
    g.fillStyle = theme === 'light' ? '#ff5c35' : '#ff7350';
    g.beginPath();
    g.roundRect(tabX + 3.4 * u, 4.2 * u, 3.4 * u, 3.4 * u, 0.8 * u);
    g.fill();
    g.fillStyle = p.faint;
    g.fillRect(tabX + tabW + 8 * u, 4.6 * u, 22 * u, 2.4 * u);
    g.fillRect(tabX + tabW + 36 * u, 4.6 * u, 3 * u, 2.4 * u);
    g.fillStyle = p.bar;
    g.fillRect(0, barTop, c.width, barH);
  }

  // navigation arrows
  g.strokeStyle = p.faint;
  g.lineWidth = 0.55 * u;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const nx = layout === 'tabs' ? 8 * u : 27 * u;
  for (const [x, dir] of [
    [nx, -1],
    [nx + 7 * u, 1],
  ] as const) {
    g.beginPath();
    g.moveTo(x + dir * -1.2 * u, cy - 2.2 * u);
    g.lineTo(x + dir * 1.2 * u, cy);
    g.lineTo(x + dir * -1.2 * u, cy + 2.2 * u);
    g.stroke();
  }

  // address field
  const fieldW = Math.min(c.width * 0.46, 150 * u);
  const fx = layout === 'tabs' ? 22 * u : (c.width - fieldW) / 2;
  const fw = layout === 'tabs' ? c.width - fx - 22 * u : fieldW;
  const fh = 9.5 * u;
  g.fillStyle = p.field;
  g.beginPath();
  g.roundRect(fx, cy - fh / 2, fw, fh, fh / 2.4);
  g.fill();
  if (theme === 'light') {
    g.strokeStyle = p.line;
    g.lineWidth = 0.25 * u;
    g.stroke();
  }
  // padlock
  const lx = layout === 'tabs' ? fx + 5 * u : fx + fw / 2 - textWidth(g, url, u) / 2 - 4.5 * u;
  g.strokeStyle = p.text;
  g.lineWidth = 0.45 * u;
  g.beginPath();
  g.arc(lx + 1.3 * u, cy - 0.6 * u, 1 * u, Math.PI, 0);
  g.stroke();
  g.fillStyle = p.text;
  g.beginPath();
  g.roundRect(lx, cy - 0.6 * u, 2.6 * u, 2.3 * u, 0.4 * u);
  g.fill();
  // url
  g.font = `450 ${3.3 * u}px "Geist Variable", system-ui, sans-serif`;
  g.textBaseline = 'middle';
  g.fillStyle = p.text;
  g.fillText(url, lx + 4.5 * u, cy + 0.15 * u);

  // separator line under the toolbar
  g.fillStyle = p.line;
  g.fillRect(0, c.height - Math.max(1, 0.25 * u), c.width, Math.max(1, 0.25 * u));
  return c;
}

const prettyHost = (url: string) => url.replace(/^https?:\/\//, '').split('/')[0] || url;

function textWidth(g: CanvasRenderingContext2D, text: string, u: number) {
  g.font = `450 ${3.3 * u}px "Geist Variable", system-ui, sans-serif`;
  return g.measureText(text).width;
}

const ASPECTS: Record<string, number> = { '16:10': 16 / 10, '16:9': 16 / 9, '4:3': 4 / 3 };

function Browser({ surfaces, screen, params }: DeviceProps) {
  const theme = (params.theme as Theme) ?? 'light';
  const layout = (params.layout as Layout) ?? 'compact';
  const url = String(params.url ?? 'mockuplab.app');
  const flat = params.style === 'flat';
  const aspect = ASPECTS[String(params.aspect)] ?? 16 / 10;
  const contentH = W / aspect;
  const barH = toolbarHeight(layout);
  const total = contentH + barH;
  const depth = flat ? 0.04 : 0.32;
  const invalidate = useThree((s) => s.invalidate);

  // Fonts must be ready before drawing text on the toolbar canvas.
  const fontsReady = useFontsReady();

  const chromeMaterial = useMemo(() => createScreenMaterial(), []);
  useEffect(() => {
    const tex = prepareTexture(new THREE.CanvasTexture(drawToolbar(theme, layout, url)));
    chromeMaterial.emissiveMap = tex;
    chromeMaterial.needsUpdate = true;
    chromeMaterial.specularIntensity = screen.reflection * 2;
    invalidate();
    return () => tex.dispose();
  }, [theme, layout, url, fontsReady, chromeMaterial, screen.reflection, invalidate]);
  useEffect(() => () => chromeMaterial.dispose(), [chromeMaterial]);

  const g = useMemo(
    () => ({
      body: roundedSlab({ width: W + 0.08, height: total + 0.08, radius: RADIUS + 0.04, thickness: depth, front: flat ? 0 : 0.1, back: flat ? 0 : 0.14, smooth: 0.5, segments: 16, edgeSegments: 6 }),
      bar: roundedPlane(W, barH, [RADIUS, RADIUS, 0, 0], { smooth: 0.5, segments: 16 }),
      content: roundedPlane(W, contentH, [0, 0, RADIUS, RADIUS], { smooth: 0.5, segments: 16 }),
    }),
    [total, barH, contentH, depth, flat],
  );
  const material = useScreenMaterial(surfaces.screen, aspect, screen);
  const front = depth / 2 + 0.008;

  // Keep the bottom edge where the stage expects it whatever the page ratio.
  const offsetY = total / 2 - browserWindow.size[1] / 2;
  return (
    <group position={[0, offsetY, 0]}>
      <mesh geometry={g.body} material={mattePlastic(palette[theme].body, 0.5)} castShadow />
      <mesh geometry={g.bar} material={chromeMaterial} position={[0, total / 2 - barH / 2, front]} />
      <mesh geometry={g.content} material={material} position={[0, -total / 2 + contentH / 2, front]} />
    </group>
  );
}

export const browserWindow: DeviceModule = {
  id: 'browser',
  name: { fr: 'Navigateur', en: 'Browser' },
  category: 'browser',
  size: [W, W / 1.6 + 1.6, 0.32],
  surfaces: [{ id: 'screen', label: { fr: 'Page', en: 'Page' }, aspect: 16 / 10, nativeSize: [1440, 900] }],
  finishes: [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#e4e4e7', colors: {} }],
  defaultFinish: 'default',
  params: [
    {
      id: 'theme',
      kind: 'choice',
      label: { fr: 'Thème', en: 'Theme' },
      options: [
        { value: 'light', label: { fr: 'Clair', en: 'Light' } },
        { value: 'dark', label: { fr: 'Sombre', en: 'Dark' } },
      ],
      default: 'light',
    },
    {
      id: 'layout',
      kind: 'choice',
      label: { fr: 'Barre', en: 'Toolbar' },
      options: [
        { value: 'compact', label: { fr: 'Compacte', en: 'Compact' } },
        { value: 'tabs', label: { fr: 'Onglets', en: 'Tabs' } },
      ],
      default: 'compact',
    },
    {
      id: 'style',
      kind: 'choice',
      label: { fr: 'Rendu', en: 'Style' },
      options: [
        { value: 'card', label: { fr: 'Carte 3D', en: '3D card' } },
        { value: 'flat', label: { fr: 'Plat', en: 'Flat' } },
      ],
      default: 'card',
    },
    {
      id: 'aspect',
      kind: 'choice',
      label: { fr: 'Format de page', en: 'Page ratio' },
      options: [
        { value: '16:10', label: { fr: '16:10', en: '16:10' } },
        { value: '16:9', label: { fr: '16:9', en: '16:9' } },
        { value: '4:3', label: { fr: '4:3', en: '4:3' } },
      ],
      default: '16:10',
    },
    { id: 'url', kind: 'text', label: { fr: 'Adresse', en: 'URL' }, default: 'mockuplab.app', placeholder: 'monportfolio.com' },
  ],
  view: { target: [0, 11, 0], offset: [14, 6, 60] },
  yaw: -0.22,
  Component: Browser,
};
