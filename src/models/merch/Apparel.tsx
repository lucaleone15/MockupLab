import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceFinish, DeviceModule, DeviceProps, ParamDef } from '../types';
import { ribbonGeometry } from '../print/geometry';
import { drawFitted, useComposedTexture, useFabricMaterial } from '../print/shared';

/*
 * Garments laid flat. The silhouette is a 2D path; a blurred copy of it gives
 * the height map (fabric rises softly from the edges, like a garment with a
 * little volume), with a few broad wrinkles on top. The design is printed
 * into a zone of the fabric texture, which is cut out by the silhouette.
 */

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];

const fabricParam = (def: string): ParamDef => ({
  id: 'color',
  kind: 'swatch',
  label: { fr: 'Tissu', en: 'Fabric' },
  options: [
    { value: '#f4f3ef', label: { fr: 'Blanc', en: 'White' } },
    { value: '#e7dfcd', label: { fr: 'Naturel', en: 'Natural' } },
    { value: '#9c9c9e', label: { fr: 'Gris chiné', en: 'Heather grey' } },
    { value: '#1d1d20', label: { fr: 'Noir', en: 'Black' } },
    { value: '#25304a', label: { fr: 'Marine', en: 'Navy' } },
    { value: '#55654f', label: { fr: 'Kaki', en: 'Khaki' } },
    { value: '#b4623f', label: { fr: 'Terracotta', en: 'Terracotta' } },
  ],
  default: def,
});

type Path = (g: CanvasRenderingContext2D, k: number) => void;

/** Height field (0..1) from a blurred silhouette, sampled on a coarse grid. */
function heightField(path: Path, W: number, H: number, res = 256, blurCm = 5) {
  const c = document.createElement('canvas');
  c.width = res;
  c.height = Math.round((res * H) / W);
  const g = c.getContext('2d')!;
  const k = res / W;
  g.filter = `blur(${blurCm * k}px)`;
  g.fillStyle = '#fff';
  g.save();
  g.translate(c.width / 2, c.height / 2);
  path(g, k);
  g.fill();
  g.restore();
  const data = g.getImageData(0, 0, c.width, c.height).data;
  return (x: number, y: number) => {
    // x, y in cm, origin at the centre, y up
    const px = Math.min(c.width - 1, Math.max(0, Math.round((x / W + 0.5) * (c.width - 1))));
    const py = Math.min(c.height - 1, Math.max(0, Math.round((0.5 - y / H) * (c.height - 1))));
    return data[(py * c.width + px) * 4 + 3] / 255;
  };
}

/** Grid covering W × H cm (lying flat), displaced by the height field and soft wrinkles. */
function garmentGeometry(path: Path, W: number, H: number, puff: number, seed: number) {
  const field = heightField(path, W, H);
  const g = new THREE.PlaneGeometry(W, H, 180, Math.round((180 * H) / W));
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const a = field(x, y);
    // 0 at the silhouette edge (a = 0.5), full height inside
    const inside = Math.max(0, (a - 0.5) * 2) ** 0.6;
    const wrinkles =
      0.22 * Math.sin(x * 0.21 + y * 0.09 + seed) * Math.sin(y * 0.17 - seed) + 0.12 * Math.sin(x * 0.53 - y * 0.41 + seed * 2);
    pos.setZ(i, inside * (puff + wrinkles * inside));
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ tote bag */

const BAG_W = 38;
const BAG_H = 42;
const TOTE_TEX: [number, number] = [1536, 1698];

const bagPath: Path = (g, k) => {
  g.beginPath();
  g.roundRect((-BAG_W / 2) * k, (-BAG_H / 2) * k, BAG_W * k, BAG_H * k, 0.6 * k);
};

function Tote({ surfaces, params }: DeviceProps) {
  const color = String(params.color);
  const texture = useComposedTexture(
    surfaces.print,
    TOTE_TEX,
    (g, img, w, h) => {
      const k = w / BAG_W;
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      // top hem
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, 2.6 * k, w, 0.12 * k);
      if (img) {
        g.globalAlpha = 0.97;
        drawFitted(g, img, 6 * k, 8 * k, 26 * k, 28 * k, surfaces.print?.fit ?? 'contain');
        g.globalAlpha = 1;
      }
    },
    [color, surfaces.print?.fit],
  );
  const fabric = useFabricMaterial(texture, 9, { cutout: true });
  const strap = useFabricMaterial(null, 4, { color });
  const g = useMemo(() => {
    const top = -BAG_H / 2 + 0.5;
    const handle = (sx: number) =>
      ribbonGeometry(
        [
          new THREE.Vector3(sx * 7, 0.6, top),
          new THREE.Vector3(sx * 7.6, 0.4, top - 10),
          new THREE.Vector3(sx * 4, 0.3, top - 22),
          new THREE.Vector3(sx * -2, 0.3, top - 25),
          new THREE.Vector3(sx * -7, 0.4, top - 16),
          new THREE.Vector3(sx * -7, 0.6, top),
        ],
        2.6,
        120,
      );
    return { bag: garmentGeometry(bagPath, BAG_W, BAG_H, 1.1, 1.7), handles: [handle(1), handle(-1)] };
  }, []);
  return (
    <group position={[0, 0, 12]}>
      <mesh geometry={g.bag} material={fabric} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      {g.handles.map((h, i) => (
        <mesh key={i} geometry={h} material={strap} position={[i ? 0.4 : -0.4, 0, 0]} castShadow receiveShadow />
      ))}
    </group>
  );
}

export const tote: DeviceModule = {
  id: 'tote',
  name: { fr: 'Tote bag', en: 'Tote bag' },
  category: 'merch',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [40, 2, 70],
  sizeFor: () => ({ size: [40, 2, 70], focus: [0, 1, 12] }),
  surfaces: [{ id: 'print', label: { fr: 'Impression', en: 'Print' }, aspect: 26 / 28, nativeSize: [3071, 3307], fit: 'contain' }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [fabricParam('#e7dfcd')],
  view: { target: [0, 0, 0], offset: [4, 40, 18] },
  yaw: 0,
  Component: Tote,
};

/* ------------------------------------------------------------ t-shirt */

const TEE_W = 86;
const TEE_H = 78;
const TEE_TEX: [number, number] = [2048, 1858];

/** Flat-lay crew-neck tee silhouette (cm, centre origin, canvas y down). */
const teePath: Path = (g, k) => {
  const P = (x: number, y: number): [number, number] => [x * k, -y * k];
  g.beginPath();
  g.moveTo(...P(-26, -37));
  g.lineTo(...P(-26.5, 17));
  g.lineTo(...P(-37.5, 8));
  g.quadraticCurveTo(...P(-41, 11), ...P(-42, 15.5));
  g.lineTo(...P(-31.5, 31));
  g.quadraticCurveTo(...P(-21, 35.5), ...P(-9.5, 36.5));
  g.bezierCurveTo(...P(-7, 29), ...P(7, 29), ...P(9.5, 36.5));
  g.quadraticCurveTo(...P(21, 35.5), ...P(31.5, 31));
  g.lineTo(...P(42, 15.5));
  g.quadraticCurveTo(...P(41, 11), ...P(37.5, 8));
  g.lineTo(...P(26.5, 17));
  g.lineTo(...P(26, -37));
  g.quadraticCurveTo(...P(0, -38), ...P(-26, -37));
  g.closePath();
};

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(amount);
  return `#${c.getHexString()}`;
}

function TShirt({ surfaces, params }: DeviceProps) {
  const color = String(params.color);
  const texture = useComposedTexture(
    surfaces.print,
    TEE_TEX,
    (g, img, w, h) => {
      const k = w / TEE_W;
      g.save();
      g.translate(w / 2, h / 2);
      // body
      teePath(g, k);
      g.fillStyle = color;
      g.fill();
      // inside of the back neck, seen through the neckline
      g.beginPath();
      g.moveTo(-9.5 * k, -36.5 * k);
      g.bezierCurveTo(-7 * k, -29 * k, 7 * k, -29 * k, 9.5 * k, -36.5 * k);
      g.bezierCurveTo(6 * k, -35 * k, -6 * k, -35 * k, -9.5 * k, -36.5 * k);
      g.fillStyle = shade(color, 0.72);
      g.fill();
      // ribbed collar
      g.beginPath();
      g.moveTo(-9.5 * k, -36.5 * k);
      g.bezierCurveTo(-7 * k, -29 * k, 7 * k, -29 * k, 9.5 * k, -36.5 * k);
      g.strokeStyle = shade(color, 0.9);
      g.lineWidth = 2 * k;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 0.08 * k;
      g.stroke();
      // hems: sleeves and bottom
      g.strokeStyle = 'rgba(0,0,0,0.13)';
      g.lineWidth = 0.1 * k;
      g.beginPath();
      g.moveTo(-26 * k, 34.8 * k);
      g.quadraticCurveTo(0, 35.8 * k, 26 * k, 34.8 * k);
      g.moveTo(-39.6 * k, -10 * k);
      g.lineTo(-40.4 * k, -14 * k);
      g.moveTo(39.6 * k, -10 * k);
      g.lineTo(40.4 * k, -14 * k);
      g.stroke();
      g.restore();
      // chest print
      if (img) {
        g.save();
        g.globalAlpha = 0.97;
        drawFitted(g, img, w / 2 - 13 * k, h / 2 - 25 * k, 26 * k, 30 * k, surfaces.print?.fit ?? 'contain');
        g.restore();
      }
    },
    [color, surfaces.print?.fit],
  );
  const fabric = useFabricMaterial(texture, 14, { cutout: true });
  const geometry = useMemo(() => garmentGeometry(teePath, TEE_W, TEE_H, 1.6, 0.6), []);
  return <mesh geometry={geometry} material={fabric} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />;
}

export const tshirt: DeviceModule = {
  id: 'tshirt',
  name: { fr: 'T-shirt', en: 'T-shirt' },
  category: 'merch',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [86, 2.5, 76],
  sizeFor: () => ({ size: [86, 2.5, 76], focus: [0, 1.5, -6] }),
  surfaces: [{ id: 'print', label: { fr: 'Impression poitrine', en: 'Chest print' }, aspect: 26 / 30, nativeSize: [3071, 3543], fit: 'contain' }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [fabricParam('#f4f3ef')],
  view: { target: [0, 0, 0], offset: [0, 60, 22] },
  yaw: 0,
  Component: TShirt,
};
