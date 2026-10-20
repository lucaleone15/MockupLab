import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { useUi, type StudioPage } from '@/store/ui';
import { Button } from '@/ui/primitives';
import { MOD } from '@/app/shortcuts';
import { useNameDialogOpen } from '@/library/NameDialog';

/*
 * The first-visit guide: a short tour of the Studio, one part at a time — the
 * part is lit, the rest dimmed, a card says what it is for. It opens by itself
 * the first time the Studio is shown, and from the ⋯ menu afterwards.
 */

const DONE_KEY = 'mockuplab:tour';

interface Step {
  id: string;
  /** What is lit (none: a card in the middle). */
  target?: string;
  /** The rail page shown during the step (its panel is lit). */
  page?: StudioPage;
}

const PANEL = '[data-testid="rail-page"]';

const STEPS: Step[] = [
  { id: 'welcome' },
  { id: 'scene', target: '[data-testid="frame"]' },
  { id: 'devices', page: 'devices', target: PANEL },
  { id: 'settings', page: 'settings', target: PANEL },
  { id: 'decor', page: 'decor', target: PANEL },
  { id: 'light', page: 'light', target: PANEL },
  { id: 'camera', page: 'camera', target: PANEL },
  { id: 'text', page: 'text', target: PANEL },
  { id: 'format', target: '[data-testid="floating-bar"]' },
  { id: 'export', target: '[data-testid="top-export"]' },
  { id: 'modes', target: '[data-testid="mode-switch"]' },
  { id: 'end' },
];

/** The guide has been seen (finished or skipped). */
function seen() {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

/** Opens the guide the first time the Studio is shown. */
export function useFirstVisitTour() {
  // a new project is named first; the guide comes after
  const naming = useNameDialogOpen();
  useEffect(() => {
    // automated browsers (the check scripts) are not first-time visitors
    if (seen() || navigator.webdriver || naming) return;
    const timer = setTimeout(() => useUi.getState().setTourStep(0), 700);
    return () => clearTimeout(timer);
  }, [naming]);
}

function close() {
  markSeen();
  useUi.getState().setTourStep(null);
  useUi.getState().setStudioPage('devices');
}

const CARD_W = 320;
const GAP = 14;
const PAD = 6;

/** Where the card goes: beside the lit part where there is room, else below or above it. */
function cardPosition(rect: DOMRect | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: (vw - CARD_W) / 2, top: Math.max(16, (vh - cardH) / 2) };
  const clampTop = (y: number) => Math.min(Math.max(16, y), vh - cardH - 16);
  const clampLeft = (x: number) => Math.min(Math.max(16, x), vw - CARD_W - 16);
  if (rect.right + GAP + CARD_W + 16 <= vw && rect.height > 120) return { left: rect.right + GAP, top: clampTop(rect.top + 24) };
  if (rect.left - GAP - CARD_W >= 16 && rect.height > 120) return { left: rect.left - GAP - CARD_W, top: clampTop(rect.top + 24) };
  if (rect.bottom + GAP + cardH + 16 <= vh) return { left: clampLeft(rect.left + rect.width / 2 - CARD_W / 2), top: rect.bottom + GAP };
  return { left: clampLeft(rect.left + rect.width / 2 - CARD_W / 2), top: Math.max(16, rect.top - GAP - cardH) };
}

export function Tour() {
  const { t } = useT();
  const index = useUi((s) => s.tourStep);
  const screen = useUi((s) => s.screen);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(180);
  const step = index === null ? null : STEPS[index];
  const active = !!step && screen === 'studio';

  // show the step's page, then measure what it lights (again once the page has slid in, and on resize)
  useLayoutEffect(() => {
    if (!active || !step) return;
    if (step.page) useUi.getState().setStudioPage(step.page);
    const measure = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 220);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, [active, step]);

  useLayoutEffect(() => {
    if (card) setCardH(card.offsetHeight);
  }, [card, index, rect]);

  // the guide owns the keyboard while it is open: arrows move through it, Esc closes it
  useEffect(() => {
    if (!active || index === null) return;
    const onKey = (e: KeyboardEvent) => {
      const go = { ArrowRight: 1, Enter: 1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Escape') close();
      else if (go === 1) index < STEPS.length - 1 ? useUi.getState().setTourStep(index + 1) : close();
      else if (go === -1 && index > 0) useUi.getState().setTourStep(index - 1);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, index]);

  if (!active || index === null || !step) return null;
  const last = index === STEPS.length - 1;
  const pos = cardPosition(rect, cardH);
  const hole = rect && { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };

  return createPortal(
    <div className="fixed inset-0 z-[60]" data-testid="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-[16px] ring-2 ring-accent transition-[left,top,width,height] duration-300 ease-[var(--ease-out-quart)]"
          style={{ ...hole, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.58)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/58 animate-[fade-in_200ms_ease-out]" />
      )}
      <div
        ref={setCard}
        className="menu-surface absolute flex flex-col gap-3 rounded-[18px] p-5 transition-[left,top] duration-300 ease-[var(--ease-out-quart)]"
        style={{ width: CARD_W, left: pos.left, top: pos.top }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="tour-title" className="font-display text-[18px] font-bold leading-tight">
            {t(`tour.${step.id}.title` as I18nKey)}
          </h2>
          <button type="button" onClick={close} aria-label={t('tour.skip')} className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg">
            <X size={15} />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-fg-muted">{t(`tour.${step.id}.body` as I18nKey, { mod: MOD })}</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[12px] tabular-nums text-fg-subtle">
            {index + 1} / {STEPS.length}
          </span>
          <span className="flex-1" />
          {index === 0 ? (
            <Button variant="ghost" size="sm" onClick={close}>
              {t('tour.skip')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => useUi.getState().setTourStep(index - 1)}>
              {t('tour.back')}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => (last ? close() : useUi.getState().setTourStep(index + 1))} data-testid="tour-next">
            {t(last ? 'tour.done' : index === 0 ? 'tour.start' : 'tour.next')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
