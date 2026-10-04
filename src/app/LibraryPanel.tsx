import type { ReactNode } from 'react';
import {
  BadgeCheck,
  BookMarked,
  BookOpenText,
  Coffee,
  Cylinder,
  FileText,
  GalleryVertical,
  Signpost,
  Tv,
  Frame,
  IdCard,
  Mail,
  Mails,
  Newspaper,
  Package,
  Plus,
  RectangleVertical,
  Shirt,
  ShoppingBag,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { modelsByCategory } from '@/models/registry';
import type { DeviceCategory, DeviceModule } from '@/models/types';
import { selectSelectedItem, useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Tooltip, cx } from '@/ui/primitives';

/** MIME type used when a model card is dragged onto the scene. */
export const MODEL_DRAG_TYPE = 'application/x-mockuplab-model';

const CATEGORY_KEYS: Partial<Record<DeviceCategory, I18nKey>> = {
  phone: 'library.phones',
  tablet: 'library.tablets',
  laptop: 'library.laptops',
  desktop: 'library.desktops',
  browser: 'library.browser',
  signage: 'library.signage',
  print: 'library.print',
  merch: 'library.merch',
};

/** Line icons for print and objects (no proportional silhouette makes sense there). */
const OBJECT_ICONS: Record<string, LucideIcon> = {
  tv: Tv,
  totem: GalleryVertical,
  'street-poster': Signpost,
  'business-card': IdCard,
  postcard: Mail,
  flyer: FileText,
  poster: Frame,
  brochure: BookOpenText,
  magazine: Newspaper,
  book: BookMarked,
  stationery: Mails,
  badge: BadgeCheck,
  'roll-up': RectangleVertical,
  box: Package,
  tube: Cylinder,
  mug: Coffee,
  bottle: Wine,
  tote: ShoppingBag,
  tshirt: Shirt,
};

const SHELL = 'fill-surface-4 stroke-fg-subtle';
const SCREEN = 'fill-surface-2';

/** Line-art silhouette drawn from the model's real proportions. */
function Silhouette({ model }: { model: DeviceModule }) {
  const Icon = OBJECT_ICONS[model.id];
  if (Icon)
    return (
      <span className="grid h-14 w-14 place-items-center text-fg-subtle">
        <Icon size={30} strokeWidth={1.25} />
      </span>
    );
  const [w, h] = model.size;
  let art: ReactNode;
  if (model.category === 'phone' || model.category === 'tablet') {
    const k = 60 / Math.max(w, h);
    const sw = w * k;
    const sh = h * k;
    const x = 40 - sw / 2;
    const y = 40 - sh / 2;
    const r = model.category === 'phone' ? sw * 0.19 : sw * 0.08;
    art = (
      <>
        <rect x={x} y={y} width={sw} height={sh} rx={r} className={SHELL} strokeWidth={1.2} />
        <rect x={x + 2.2} y={y + 2.2} width={sw - 4.4} height={sh - 4.4} rx={r * 0.75} className={SCREEN} />
        {model.category === 'phone' && <rect x={40 - 4} y={y + 4.4} width={8} height={2.4} rx={1.2} className="fill-fg-subtle" />}
      </>
    );
  } else if (model.category === 'laptop') {
    art = (
      <>
        <rect x={14} y={18} width={52} height={34} rx={2.5} className={SHELL} strokeWidth={1.2} />
        <rect x={16.5} y={20.5} width={47} height={29} rx={1} className={SCREEN} />
        <path d="M8 55 h64 l-3 5 h-58 z" className={SHELL} strokeWidth={1.2} strokeLinejoin="round" />
      </>
    );
  } else if (model.category === 'desktop') {
    const chin = model.id.startsWith('desktop');
    art = (
      <>
        <rect x={10} y={14} width={60} height={chin ? 40 : 35} rx={2.5} className={SHELL} strokeWidth={1.2} />
        <rect x={12.5} y={16.5} width={55} height={31} rx={0.8} className={SCREEN} />
        <path d={chin ? 'M34 54 l-2 10 h16 l-2 -10' : 'M36 49 v13 M28 64 h24'} className="fill-surface-4 stroke-fg-subtle" strokeWidth={1.2} strokeLinecap="round" />
      </>
    );
  } else {
    art = (
      <>
        <rect x={10} y={18} width={60} height={42} rx={3} className={SHELL} strokeWidth={1.2} />
        <path d="M10 26 h60" className="stroke-fg-subtle" strokeWidth={1} />
        {[15, 19.5, 24].map((cx) => (
          <circle key={cx} cx={cx} cy={22} r={1.4} className="fill-fg-subtle" />
        ))}
        <rect x={30} y={20.2} width={24} height={3.6} rx={1.8} className={SCREEN} />
        <rect x={12} y={28} width={56} height={30} rx={1} className={SCREEN} />
      </>
    );
  }
  return (
    <svg viewBox="0 0 80 80" className="h-14 w-14" aria-hidden>
      {art}
    </svg>
  );
}

export function LibraryPanel() {
  const { t, tr } = useT();
  const selected = useProject(selectSelectedItem);
  const replaceModel = useProject((s) => s.replaceModel);
  const addItem = useProject((s) => s.addItem);
  const resetView = useUi((s) => s.resetView);

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-10 shrink-0 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {t('library.title')}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
        {modelsByCategory().map(([cat, models]) => (
          <div key={cat} className="mb-4">
            <div className="mb-2 px-1 text-[12px] font-medium text-fg">{CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}</div>
            <div className="grid grid-cols-2 gap-2">
              {models.map((m) => {
                const active = selected?.modelId === m.id;
                return (
                  <div key={m.id} className="group relative">
                    <Tooltip label={t('library.replace')}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(MODEL_DRAG_TYPE, m.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          if (!selected) return;
                          if (active) resetView();
                          else replaceModel(selected.id, m.id);
                        }}
                        className={cx(
                          'flex w-full flex-col items-center gap-1 rounded-xl bg-surface-2 px-1.5 pb-2 pt-1.5 text-[11.5px] leading-tight transition-[box-shadow,background-color,transform] duration-150 active:scale-[0.97]',
                          active
                            ? 'text-fg shadow-[0_0_0_1.5px_var(--accent)_inset]'
                            : 'text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-3 hover:text-fg',
                        )}
                      >
                        <Silhouette model={m} />
                        <span className="text-center">{tr(m.name)}</span>
                      </button>
                    </Tooltip>
                    <Tooltip label={t('library.add')}>
                      <button
                        type="button"
                        aria-label={t('library.add')}
                        onClick={() => {
                          addItem(m.id);
                          resetView();
                        }}
                        className="absolute right-1.5 top-1.5 grid size-6 scale-90 place-items-center rounded-full bg-accent text-accent-fg opacity-0 shadow-md transition-[opacity,transform] duration-150 group-hover:scale-100 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="mx-1 rounded-lg border border-dashed border-line-strong p-3 text-[11.5px] leading-relaxed text-fg-subtle">
          {t('library.more')}
        </p>
      </div>
    </aside>
  );
}
