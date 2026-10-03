import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { I18nString } from '@/i18n';
import type { AmbienceId, GoboId } from '@/store/project';

/*
 * Light moods of the table set. A CC0 HDRI (Poly Haven) provides soft fill
 * light and believable reflections — it is never shown. Its brightest region
 * (the window) is detected and the HDRI is turned so that window sits to the
 * front-left, where the key light and its projected shadows come from.
 */

export interface AmbienceSpec {
  name: I18nString;
  /** CSS swatch for the UI. */
  swatch: string;
  key: { color: string; intensity: number };
  exposure: number;
  environment: number;
}

/*
 * All moods share one neutral daylight HDRI for fill and reflections (a
 * coloured HDRI tints walls and tables); the mood comes from the key light.
 */
export const AMBIENCES: Record<AmbienceId, AmbienceSpec> = {
  day: {
    name: { fr: 'Lumière du jour', en: 'Daylight' },
    swatch: 'linear-gradient(135deg, #ffffff, #e4e8ec)',
    key: { color: '#fffaf3', intensity: 3.4 },
    exposure: 0.95,
    environment: 0.32,
  },
  sun: {
    name: { fr: 'Soleil', en: 'Sunlight' },
    swatch: 'linear-gradient(135deg, #fffaf0, #f7dcae)',
    key: { color: '#fff0d8', intensity: 4.6 },
    exposure: 0.92,
    environment: 0.26,
  },
  evening: {
    name: { fr: 'Fin de journée', en: 'Late afternoon' },
    swatch: 'linear-gradient(135deg, #ffe6c8, #e2a46e)',
    key: { color: '#ffd2a1', intensity: 4 },
    exposure: 0.95,
    environment: 0.22,
  },
};

export const AMBIENCE_ORDER: AmbienceId[] = ['day', 'sun', 'evening'];

/** Where the key light comes from in the table set: front-left, above. */
export const KEY_AZIMUTH = -52;
export const KEY_ELEVATION = 34;

const url = () => `${import.meta.env.BASE_URL}assets/light/day/env.hdr`;

export interface LoadedAmbience {
  env: THREE.DataTexture;
  /** Y rotation (radians) bringing the HDRI's window to KEY_AZIMUTH. */
  rotation: number;
}

/** Azimuth (radians, from +Z towards +X) of the brightest region of an equirect HDR. */
function brightestAzimuth(tex: THREE.DataTexture): number {
  const { width, height, data } = tex.image as { width: number; height: number; data: Float32Array | Uint16Array };
  const half = tex.type === THREE.HalfFloatType;
  const value = (i: number) => (half ? THREE.DataUtils.fromHalfFloat((data as Uint16Array)[i]) : (data as Float32Array)[i]);
  const stride = data.length / (width * height);
  const cols = new Float32Array(64);
  // Only the band above the horizon: windows, not the floor.
  for (let y = Math.floor(height * 0.15); y < height * 0.5; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * stride;
      cols[Math.floor((x / width) * 64)] += 0.2126 * value(i) + 0.7152 * value(i + 1) + 0.0722 * value(i + 2);
    }
  }
  let best = 0;
  let bx = 0;
  for (let x = 0; x < 64; x++) {
    const s = cols[(x + 63) % 64] + cols[x] * 2 + cols[(x + 1) % 64];
    if (s > best) {
      best = s;
      bx = x;
    }
  }
  // three's equirect: u = atan(z, x) / 2π + 0.5 → direction (cos φ, ·, sin φ)
  const phi = ((bx + 0.5) / 64 - 0.5) * Math.PI * 2;
  return Math.atan2(Math.cos(phi), Math.sin(phi));
}

const cache = new Map<AmbienceId, Promise<LoadedAmbience>>();

export function loadAmbience(id: AmbienceId): Promise<LoadedAmbience> {
  let p = cache.get(id);
  if (!p) {
    p = new HDRLoader().loadAsync(url()).then((env) => {
      env.mapping = THREE.EquirectangularReflectionMapping;
      const rotation = THREE.MathUtils.degToRad(KEY_AZIMUTH) - brightestAzimuth(env);
      return { env, rotation };
    });
    cache.set(id, p);
  }
  return p;
}

export function useAmbience(id: AmbienceId | null): LoadedAmbience | null {
  const [loaded, setLoaded] = useState<{ id: AmbienceId; a: LoadedAmbience } | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadAmbience(id).then((a) => {
      if (!alive) return;
      setLoaded({ id, a });
      invalidate();
    });
    return () => {
      alive = false;
    };
  }, [id, invalidate]);
  return id && loaded?.id === id ? loaded.a : null;
}

/* ------------------------------------------------------------ gobos */

const gobos = new Map<GoboId, THREE.Texture>();

/**
 * Light cookie projected by the key light: white lets light through, black
 * blocks it. Drawn on a canvas and slightly blurred like a real out-of-focus
 * shadow.
 */
export function goboTexture(id: Exclude<GoboId, 'none'>): THREE.Texture {
  let t = gobos.get(id);
  if (t) return t;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#000';
  g.filter = 'blur(10px)';
  if (id === 'window') {
    // Two-by-three window panes with a thick frame.
    const bar = S * 0.035;
    g.fillRect(0, 0, S, S * 0.12);
    g.fillRect(0, S * 0.88, S, S * 0.12);
    g.fillRect(0, 0, S * 0.14, S);
    g.fillRect(S * 0.86, 0, S * 0.14, S);
    g.fillRect(S / 2 - bar / 2, 0, bar, S);
    g.fillRect(0, S * 0.38 - bar / 2, S, bar);
    g.fillRect(0, S * 0.63 - bar / 2, S, bar);
  } else if (id === 'blinds') {
    for (let y = 0; y < S; y += S / 14) g.fillRect(0, y, S, S / 14 * 0.42);
  } else {
    // Foliage: clusters of leaf shapes along a few branches (seeded).
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.filter = 'blur(7px)';
    for (let b = 0; b < 5; b++) {
      let x = rnd() * S;
      let y = S * (0.1 + rnd() * 0.3);
      const dx = (rnd() - 0.5) * 18;
      for (let i = 0; i < 46; i++) {
        x += dx + (rnd() - 0.5) * 30;
        y += 14 + rnd() * 10;
        g.save();
        g.translate(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 60);
        g.rotate(rnd() * Math.PI * 2);
        g.beginPath();
        g.ellipse(0, 0, 22 + rnd() * 30, 9 + rnd() * 10, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  gobos.set(id, t);
  return t;
}

export const WALL_COLORS = ['#ece6dc', '#d9c8b0', '#b9c2ae', '#c98a6b', '#aebccb', '#e6c9c2', '#3a3a3d'];
