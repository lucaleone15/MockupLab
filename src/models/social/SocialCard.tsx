import { useMemo } from 'react';
import { roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import { mattePlastic } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { cardAspect, SOCIAL_PARAMS, type PhoneApp } from '@/social/phoneScreen';
import { useSocialScreen } from '@/social/useSocialScreen';
import type { DeviceModule, DeviceProps, ParamDef, ParamValue } from '../types';

/*
 * A post, a story or a Reel on its own, like the Browser window: a floating
 * card or a flat sheet showing the app with the user's image inside (no
 * phone around it). The whole face is painted (phoneScreen.ts).
 */

const W = 13;

type App = Exclude<PhoneApp, 'none'>;
const appOf = (params: Record<string, ParamValue>): App => (['post', 'story', 'reel'].includes(String(params.app)) ? (params.app as App) : 'post');

function dims(params: Record<string, ParamValue>) {
  const app = appOf(params);
  const h = W / cardAspect(app);
  const depth = params.style === 'flat' ? 0.04 : 0.3;
  return { app, h, depth, radius: app === 'post' ? 0.45 : 0.9 };
}

function SocialCard({ surfaces, screen, params, brand }: DeviceProps) {
  const { app, h, depth, radius } = dims(params);
  const flat = params.style === 'flat';
  const aspect = cardAspect(app);
  const compose = useSocialScreen({ ...params, app }, brand, aspect, { device: false });
  const material = useScreenMaterial(surfaces.screen, aspect, screen, { compose });
  const g = useMemo(
    () => ({
      body: roundedSlab({ width: W + 0.08, height: h + 0.08, radius: radius + 0.04, thickness: depth, front: flat ? 0 : 0.08, back: flat ? 0 : 0.12, smooth: 0.5, segments: 16, edgeSegments: 6 }),
      face: roundedPlane(W, h, radius, { smooth: 0.5, segments: 16 }),
    }),
    [h, depth, radius, flat],
  );
  return (
    <group>
      <mesh geometry={g.body} material={mattePlastic(app === 'post' ? '#f4f4f5' : '#111113', 0.5)} castShadow />
      <mesh geometry={g.face} material={material} position={[0, 0, depth / 2 + 0.008]} />
    </group>
  );
}

const APP_PARAM: ParamDef = {
  id: 'app',
  kind: 'choice',
  label: { fr: 'Publication', en: 'Post type' },
  options: [
    { value: 'post', label: { fr: 'Post', en: 'Post' } },
    { value: 'story', label: { fr: 'Story', en: 'Story' } },
    { value: 'reel', label: { fr: 'Reel', en: 'Reel' } },
  ],
  default: 'post',
};

export const socialCard: DeviceModule = {
  id: 'social-card',
  name: { fr: 'Publication', en: 'Social post' },
  category: 'browser',
  size: [W, W / cardAspect('post'), 0.3],
  sizeFor: (p) => {
    const { h, depth } = dims(p);
    return { size: [W, h, depth] };
  },
  surfaces: [{ id: 'screen', label: { fr: 'Image', en: 'Image' }, aspect: 4 / 5, nativeSize: [1080, 1350] }],
  finishes: [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f4f5', colors: {} }],
  defaultFinish: 'default',
  params: [
    APP_PARAM,
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
    // account, its photo and the caption, always shown here (the card always shows an app)
    ...SOCIAL_PARAMS.filter((p) => p.id !== 'app').map((p) => (['account', 'avatar', 'caption'].includes(p.id) ? ({ ...p, visible: undefined } as ParamDef) : p)),
  ],
  view: { target: [0, 14, 0], offset: [12, 6, 54] },
  yaw: -0.22,
  Component: SocialCard,
};
