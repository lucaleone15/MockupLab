/*
 * The design system's component bundle (scripts/build-design-system.mjs): the app's real interface primitives
 * and its mark, exposed as window.MockupLab for the design system's live previews.
 */
import { Tooltip as RTooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { LogoMark } from '@/shell/Logo';

export { Button, IconButton, Tooltip, Kbd, GroupTitle, Section, Field, Segmented, Slider, ColorField, Spinner, Switch, Advanced, Chip, Sheet } from '@/ui/primitives';
export { LogoMark };

/** Tooltips need this around them (the app puts one at its root). */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </RTooltip.Provider>
  );
}

/** The lockup: the mark and « MockupLab » in Archivo Expanded, in the colour of the text around it. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2" data-testid="logo">
      <LogoMark size={size} />
      <span className="font-display font-bold leading-none" style={{ fontSize: Math.round(size * 0.66) }}>
        MockupLab
      </span>
    </span>
  );
}
