import { useT } from '@/i18n';
import { navigate, SCREEN_HASH } from './route';

/** "Mockup" + "Lab" in Syne; the brand orange lives only here. Links to the home page. */
export function Logo({ asLink = true }: { asLink?: boolean }) {
  const { t } = useT();
  const mark = (
    <span className="flex items-center gap-2">
      <span className="relative grid size-7 place-items-center rounded-[9px] bg-fg text-bg">
        <span className="block h-[15px] w-[9px] rounded-[3px] border-[1.75px] border-current" />
        <span className="absolute right-[5px] top-[5px] size-[5px] rounded-full bg-brand" />
      </span>
      <span className="font-display text-[17px] leading-none">
        <span className="font-extrabold">Mockup</span>
        <span className="font-medium text-brand">Lab</span>
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
