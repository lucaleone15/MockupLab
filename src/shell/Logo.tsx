import { useT } from '@/i18n';
import { navigate, urlOf } from './route';

/** The mark: a phone, tilted, its screen lit in the brand blue (the app's icon, drawn plain). */
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={className}>
      <g transform="rotate(-8 20 20)">
        <rect x="12" y="5" width="16" height="30" rx="4.5" fill="none" stroke="currentColor" strokeWidth={2.6} />
        <rect x="14.6" y="7.6" width="10.8" height="24.8" rx="2.4" fill="#2f6bff" />
      </g>
    </svg>
  );
}

/** The phone mark and « MockupLab » in one colour, Archivo Expanded. Links to the home page. */
export function Logo({ asLink = true, tone }: { asLink?: boolean; tone?: 'light' }) {
  const { t } = useT();
  const mark = (
    <span className={`flex items-center gap-2${tone === 'light' ? ' text-white' : ''}`} data-testid="logo">
      <LogoMark />
      <span className="font-display text-[17px] font-bold leading-none">MockupLab</span>
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
