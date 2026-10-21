import { hexToHsl, lighten, tone } from '@/lib/color';
import { DEFAULT_CAMERA, DEFAULT_DECOR, DEFAULT_GROUND, useProject } from '@/store/project';

/*
 * Plain photo studios in one colour, for Quick and Project: a seamless
 * sweep, a painted podium, or the same studio in the colour's deep shade.
 * The light follows the colour: high-key on a pale one, studio on a dark one.
 */

export type StudioLook = 'studio' | 'podium' | 'dark';

/** The deep shade of a colour (dark colours stay as they are). */
export function deepShade(color: string): string {
  const c = hexToHsl(color);
  return c.l <= 0.22 ? color : tone(c, 0.14, 0.3);
}

/** Stages a studio look in a colour; `second` paints the podium (a close tone of the colour by default). */
export function applyStudioLook(look: StudioLook, color: string, second?: string) {
  const s = useProject.getState();
  const base = look === 'dark' ? deepShade(color) : color;
  const light = hexToHsl(base).l > 0.5;
  s.setBackground({ kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: lighten(base, light ? 0.05 : 0.07), at: 0 }, { color: base, at: 1 }] });
  s.setDecor(
    look === 'podium'
      ? { ...DEFAULT_DECOR, kind: 'podium', podiumFinish: 'paint', shape: 'cylinder', arch: false, color: second ?? lighten(base, light ? 0.05 : 0.08) }
      : { ...DEFAULT_DECOR, kind: 'sweep' },
  );
  s.applyLightPreset(light ? 'highkey' : 'studio');
  s.setGround({ ...DEFAULT_GROUND });
  s.setPose('standing');
  s.setCamera({ ...DEFAULT_CAMERA, preset: 'threeQuarter' });
}
