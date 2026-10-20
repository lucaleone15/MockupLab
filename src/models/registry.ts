import { create } from 'zustand';
import type { DeviceCategory, DeviceModule } from './types';
import { browserWindow } from './browser/Browser';
import { socialCard } from './social/SocialCard';
import { desktop24, display27, monitor27 } from './desktop/Desktop';
import { laptop14, laptopAir } from './laptop/Laptop';
import { phoneClassic, phoneNeo, phonePro } from './phone/phones';
import { tablet11, tablet13 } from './tablet/Tablet';
import { watch } from './watch/Watch';
import { bottle, box, mug, tube } from './merch/Objects';
import { tote, tshirt } from './merch/Apparel';
import { badge } from './print/Badge';
import { swatchFan } from './brand/Brand';
import { streetPoster, totem, tv } from './signage/Signage';
import { businessCard, envelope, flyer, letterhead, postcard } from './print/Cards';
import { poster, rollUp } from './print/Posters';
import { book, brochure, magazine } from './print/Publications';

/** Every available model, in library order. Add new modules here. */
export const MODELS: DeviceModule[] = [
  phonePro,
  phoneClassic,
  phoneNeo,
  tablet11,
  tablet13,
  watch,
  laptop14,
  laptopAir,
  desktop24,
  display27,
  monitor27,
  tv,
  totem,
  streetPoster,
  browserWindow,
  socialCard,
  businessCard,
  postcard,
  flyer,
  poster,
  brochure,
  magazine,
  book,
  letterhead,
  envelope,
  badge,
  rollUp,
  box,
  tube,
  mug,
  bottle,
  tote,
  tshirt,
  swatchFan,
];

const byId = new Map(MODELS.map((m) => [m.id, m]));

/** Models imported by the user (.glb), registered at run time. */
export const useUserModules = create<{ modules: DeviceModule[] }>(() => ({ modules: [] }));

export function registerUserModule(m: DeviceModule) {
  byId.set(m.id, m);
  useUserModules.setState((s) => ({ modules: [...s.modules.filter((x) => x.id !== m.id), m] }));
}

export function unregisterUserModule(id: string) {
  byId.delete(id);
  useUserModules.setState((s) => ({ modules: s.modules.filter((x) => x.id !== id) }));
}

export function hasModel(id: string) {
  return byId.has(id);
}

export function getModel(id: string): DeviceModule {
  return byId.get(id) ?? MODELS[0];
}

export function modelsByCategory(): [DeviceCategory, DeviceModule[]][] {
  const groups = new Map<DeviceCategory, DeviceModule[]>();
  for (const m of MODELS) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
  return [...groups];
}
