import { useT } from '@/i18n';
import { navigate, urlOf } from './route';

/** The mark: the curve of a photo studio's paper sweep with a device standing on it (the one blue). */
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden className={className}>
      <path d="M5 3.5V18a9 9 0 0 0 9 9h12.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <rect x="14.5" y="11.5" width="7.2" height="13.5" rx="2.1" fill="#2f6bff" />
    </svg>
  );
}

/** The sweep mark and « MockupLab » in one colour, Geist set tight. Links to the home page. */
export function Logo({ asLink = true, tone }: { asLink?: boolean; tone?: 'light' }) {
  const { t } = useT();
  const mark = (
    <span className={`flex items-center gap-2${tone === 'light' ? ' text-white' : ''}`} data-testid="logo">
      <LogoMark />
      <span className="text-[17px] font-semibold leading-none tracking-[-0.03em]">MockupLab</span>
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
