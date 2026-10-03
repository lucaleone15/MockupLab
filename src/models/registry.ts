import type { DeviceCategory, DeviceModule } from './types';
import { browserWindow } from './browser/Browser';
import { desktop24, display27, monitor27 } from './desktop/Desktop';
import { laptop14, laptopAir } from './laptop/Laptop';
import { phoneClassic, phoneNeo, phonePro } from './phone/phones';
import { tablet11, tablet13 } from './tablet/Tablet';

/** Every available model, in library order. Add new modules here. */
export const MODELS: DeviceModule[] = [
  phonePro,
  phoneClassic,
  phoneNeo,
  tablet11,
  tablet13,
  laptop14,
  laptopAir,
  desktop24,
  display27,
  monitor27,
  browserWindow,
];

const byId = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: string): DeviceModule {
  return byId.get(id) ?? MODELS[0];
}

export function modelsByCategory(): [DeviceCategory, DeviceModule[]][] {
  const groups = new Map<DeviceCategory, DeviceModule[]>();
  for (const m of MODELS) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
  return [...groups];
}
