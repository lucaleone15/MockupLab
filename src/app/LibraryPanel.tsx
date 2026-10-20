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
  ScrollText,
  Mails,
  Newspaper,
  Package,
  RectangleVertical,
  Shirt,
  SwatchBook,
  ShoppingBag,
  Wine,
  Watch,
  Box,
  Upload,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { useUserModules } from '@/models/registry';
import type { DeviceCategory, DeviceModule } from '@/models/types';
import { askConfirm } from '@/ui/dialogs';
import { switchModel } from '@/lib/switchModel';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Tooltip, cx } from '@/ui/primitives';

/** MIME type used when a model card is dragged onto the scene. */
export const MODEL_DRAG_TYPE = 'application/x-mockuplab-model';

export const CATEGORY_KEYS: Partial<Record<DeviceCategory, I18nKey>> = {
  phone: 'library.phones',
  tablet: 'library.tablets',
  wearable: 'library.wearables',
  laptop: 'library.laptops',
  desktop: 'library.desktops',
  browser: 'library.browser',
  signage: 'library.signage',
  print: 'library.print',
  merch: 'library.merch',
  brand: 'library.brand',
};

/** Line icons for print and objects (no proportional silhouette makes sense there). */
const OBJECT_ICONS: Record<string, LucideIcon> = {
  watch: Watch,
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
  letterhead: ScrollText,
  envelope: Mails,
  badge: BadgeCheck,
  'roll-up': RectangleVertical,
  box: Package,
  tube: Cylinder,
  mug: Coffee,
  bottle: Wine,
  tote: ShoppingBag,
  tshirt: Shirt,
  'swatch-fan': SwatchBook,
};

const SHELL = 'fill-surface-4 stroke-fg-subtle';
const SCREEN = 'fill-surface-2';

/** Line-art silhouette drawn from the model's real proportions. */
export function Silhouette({ model, small }: { model: DeviceModule; small?: boolean }) {
  const Icon = model.category === 'custom' ? Box : OBJECT_ICONS[model.id];
  if (Icon)
    return (
      <span className={cx('grid place-items-center text-fg-subtle', small ? 'size-7 shrink-0' : 'h-14 w-14')}>
        <Icon size={small ? 17 : 30} strokeWidth={1.25} />
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
    <svg viewBox="0 0 80 80" className={small ? 'size-7 shrink-0' : 'h-14 w-14'} aria-hidden>
      {art}
    </svg>
  );
}

/** A device of the library: a click adds it to the scene, or replaces the device `replaceId` when given. */
export function ModelCard({ model: m, onDelete, onAdded, replaceId }: { model: DeviceModule; onDelete?: () => void; onAdded?: () => void; replaceId?: string }) {
  const { t, tr } = useT();
  const addItem = useProject((s) => s.addItem);
  const resetView = useUi((s) => s.resetView);
  return (
                  <div key={m.id} className="group relative">
                    <Tooltip label={t(replaceId ? 'library.replace' : 'library.add')}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(MODEL_DRAG_TYPE, m.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          if (replaceId) void switchModel(replaceId, m.id);
                          else {
                            addItem(m.id);
                            resetView();
                          }
                          onAdded?.();
                        }}
                        className={cx(
                          'flex w-full flex-col items-center gap-1 rounded-[12px] bg-surface-2 px-1.5 pb-2 pt-1.5 text-[12px] leading-tight text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] transition-[box-shadow,background-color,color,transform] duration-150 hover:bg-surface-3 hover:text-fg active:scale-[0.97]',
                        )}
                      >
                        <Silhouette model={m} />
                        <span className="text-center">{tr(m.name)}</span>
                      </button>
                    </Tooltip>
                    {onDelete && (
                      <Tooltip label={t('glb.delete')}>
                        <button
                          type="button"
                          aria-label={t('glb.delete')}
                          onClick={onDelete}
                          className="absolute left-1.5 top-1.5 grid size-6 scale-90 place-items-center rounded-full bg-black/60 text-white opacity-0 shadow-md transition-[opacity,transform] duration-150 group-hover:scale-100 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                );
}

export function UserModels({ onAdded, replaceId }: { onAdded?: () => void; replaceId?: string } = {}) {
  const { t } = useT();
  const modules = useUserModules((s) => s.modules);
  const load = () => import('@/models/glb/userModels');
  return (
    <div className="mb-2">
      <div className="mb-2 px-1 text-[12px] font-medium text-fg">{t('library.custom')}</div>
      {modules.length > 0 && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          {modules.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              onAdded={onAdded}
              replaceId={replaceId}
              onDelete={() => {
                void askConfirm({ title: t('glb.delete'), body: t('glb.deleteConfirm', { name: m.name.fr }), confirm: t('comp.delete'), danger: true }).then((ok) => {
                  if (ok) void load().then((x) => x.deleteUserModel(m.id));
                });
              }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => void load().then((x) => x.pickModelFile())}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-left text-[12px] font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg"
        data-testid="import-glb"
      >
        <Upload size={15} className="shrink-0 text-accent" />
        {t('glb.import')}
      </button>
      <p className="mx-1 mt-2 text-[11px] leading-snug text-fg-subtle">{t('glb.hint')}</p>
    </div>
  );
}
