import { useT } from '@/i18n';
import { navigate, urlOf } from '@/shell/route';

export const PORTFOLIO = 'https://luca-leone.ch';
export const LINKEDIN = 'https://www.linkedin.com/in/leone-luca';
export const GITHUB = 'https://github.com/lucaleone15/MockupLab';

/** The Swiss flag: a white cross on red, square (as the real one). */
export function SwissFlag({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0 rounded-[3px]">
      <rect width="32" height="32" fill="#da291c" />
      <path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#fff" />
    </svg>
  );
}

/** The end of the landing and of the about page: who made it, where, and the links (the about page shows its
 * own, bigger, just above). */
export function Credit({ about = true, links = true }: { about?: boolean; links?: boolean }) {
  const { t } = useT();
  const link = 'underline-offset-4 transition-colors hover:text-white hover:underline';
  return (
    <div data-testid="home-credit" className="mt-16 flex flex-col items-center gap-4 text-[13.5px] text-white/45">
      <p className="flex flex-wrap items-center justify-center gap-y-1">
        <span className="whitespace-nowrap">
          {t('home.credit.by')} <span className="text-white/75">Luca Leone</span>
        </span>
        {about && (
          <span>
            <span aria-hidden className="mx-2">·</span>
            <a
              href={urlOf('about')}
              onClick={(e) => {
                e.preventDefault();
                navigate('about');
              }}
              className={link}
            >
              {t('home.credit.about')}
            </a>
          </span>
        )}
        {links &&
          [
            [PORTFOLIO, t('home.credit.portfolio')],
            [LINKEDIN, 'LinkedIn'],
          ].map(([href, label]) => (
          <span key={href}>
            <span aria-hidden className="mx-2">·</span>
            <a href={href} target="_blank" rel="noreferrer" className={link}>
              {label}
            </a>
          </span>
        ))}
      </p>
      <p data-testid="swiss-made" className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 text-[12.5px] font-medium text-white/70">
        <SwissFlag />
        {t('home.credit.swiss')}
      </p>
    </div>
  );
}
