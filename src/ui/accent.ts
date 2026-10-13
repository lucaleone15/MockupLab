/** The interface accent colour of the current theme (blue in light, white in dark), for canvas and 3D helpers. */
export function accentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0071e3';
}
