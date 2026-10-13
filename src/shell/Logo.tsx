import { useT } from '@/i18n';
import { navigate, SCREEN_HASH } from './route';

/** "Mockup" + "Lab" in Syne; the brand orange lives only here. Links to the home page. */
export function Logo({ asLink = true, tone }: { asLink?: boolean; tone?: 'light' }) {
  const { t } = useT();
  const mark = (
    <span className="flex items-center gap-2" data-testid="logo">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={28} height={28} className="size-7 shrink-0" draggable={false} />
      <span className={`font-display text-[17px] font-bold leading-none${tone === 'light' ? ' text-white' : ''}`}>
        <span>Mockup</span>
        <span className="text-brand">Lab</span>
      </span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <a
      href={SCREEN_HASH.home}
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
