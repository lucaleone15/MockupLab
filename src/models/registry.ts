import type { DeviceCategory, DeviceModule } from './types';
import { phonePro } from './phone/PhonePro';

/** Every available model. Add new modules here. */
export const MODELS: DeviceModule[] = [phonePro];

const byId = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id: string): DeviceModule {
  return byId.get(id) ?? MODELS[0];
}

export function modelsByCategory(): [DeviceCategory, DeviceModule[]][] {
  const groups = new Map<DeviceCategory, DeviceModule[]>();
  for (const m of MODELS) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
  return [...groups];
}
