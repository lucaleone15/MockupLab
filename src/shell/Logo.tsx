import { useT } from '@/i18n';
import { navigate, urlOf } from './route';

/** The mark: an upright phone in the brand blue, a lighter copy behind it for depth (« 3D »), its island in white. */
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    // the box hugs the drawing (22 × 33 of its 40 × 40 grid): at header size the phone keeps its depth and island
    <svg width={Math.round(size * 0.68)} height={size} viewBox="9.5 3.5 22 33" aria-hidden className={className}>
      <rect x="14" y="4" width="17" height="32" rx="5.2" fill="#2f6bff" opacity={0.35} />
      <rect x="10" y="4" width="17" height="32" rx="5.2" fill="#2f6bff" />
      <rect x="15.3" y="7.4" width="6.4" height="2" rx="1" fill="#fff" />
    </svg>
  );
}

/** The phone mark and « MockupLab » in one colour, Archivo Expanded. Links to the home page. */
export function Logo({ asLink = true, tone, markOnly = false }: { asLink?: boolean; tone?: 'light'; markOnly?: boolean }) {
  const { t } = useT();
  const mark = (
    <span className={`flex items-center gap-2${tone === 'light' ? ' text-white' : ''}`} data-testid="logo">
      <LogoMark />
      {markOnly ? <span className="sr-only">MockupLab</span> : <span className="font-display text-[17px] font-bold leading-none">MockupLab</span>}
    </span>
  );
  if (!asLink) return mark;
  return (
    <a
      href={urlOf('home')}
      aria-label={t('logo.home')}
      onClick={(e) => {
        e.preventDefault();
        navigate('home');
      }}
      className="rounded-lg outline-offset-4"
    >
      {mark}
    </a>
  );
}
