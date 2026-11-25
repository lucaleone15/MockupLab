import { FolderOpen } from 'lucide-react';
import { useT } from '@/i18n';
import { useLibrary } from '@/library/store';
import { useUi } from '@/store/ui';
import { cx } from '@/ui/primitives';
import { LangSwitch } from './LangSwitch';
import { Logo } from './Logo';
import { navigate, urlOf } from './route';

/** Height of the band the top bar floats in, on every screen (the editor's panels start below it). */
export const TOP_BAR = 60;
/** The top bar itself, the same on the pages and in the editor: one glass pill across the screen. */
export const BAR = 'glass-float pointer-events-auto flex h-12 w-full items-center rounded-full';
/** The band that holds it (named for the screen change: the bar stays put while the page under it changes). */
export const BAND = 'flex items-center px-3 max-md:px-2';

/** The empty project autosaved on a first visit is not worth listing. */
const worth = (m: { name: string; exportCount: number; assets: string[] }) => (m.name && m.name !== 'Untitled') || m.exportCount > 0 || m.assets.length > 0;

/**
 * The one bar of the pages (landing, about): the logo and the links on the
 * left, the language and the way into the Studio on the right. `light` when it
 * floats over a white section.
 */
export function SiteHeader({ light = false }: { light?: boolean }) {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  const hasProjects = useLibrary((s) => s.list.some(worth));
  const link = 'flex h-8 items-center gap-2 rounded-full px-3 text-[13.5px] font-medium transition-colors hover:bg-surface-3 hover:text-fg';
  return (
    <div className={cx('sticky top-0 z-30 h-0', light ? 'text-[#1d1d1f]' : 'text-white')} data-theme={light ? 'light' : 'dark'}>
      <header className={BAND} style={{ height: TOP_BAR, viewTransitionName: 'top-bar' }}>
        <div data-testid="site-header" className={cx(BAR, 'pl-4 pr-1.5 max-sm:pl-3')}>
          <Logo tone={light ? undefined : 'light'} shrink />
          <nav aria-label={t('screen.home')} className="ml-5 flex items-center gap-0.5 max-sm:ml-2">
            <a
              href={urlOf('about')}
              aria-current={screen === 'about' ? 'page' : undefined}
              data-testid="nav-about"
              onClick={(e) => {
                e.preventDefault();
                navigate('about');
              }}
              className={cx(link, screen === 'about' ? 'text-fg' : 'text-fg-muted')}
            >
              {t('home.credit.about')}
            </a>
            {hasProjects && (
              <button type="button" aria-label={t('home.myProjects')} onClick={() => useUi.getState().setAllProjectsOpen(true)} className={cx(link, 'text-fg-muted')}>
                <FolderOpen size={16} aria-hidden className="sm:hidden" />
                <span className="max-sm:hidden">{t('home.myProjects')}</span>
              </button>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 max-sm:gap-1">
            <LangSwitch tone={light ? undefined : 'light'} />
            <button
              type="button"
              data-testid="header-studio"
              onClick={() => navigate('studio')}
              className="h-9 rounded-full bg-brand-solid px-4 text-[13.5px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-solid-hover active:scale-[0.97] max-sm:px-3.5"
            >
              <span className="max-sm:hidden">{t('home.openStudio')}</span>
              <span className="sm:hidden">{t('screen.studio')}</span>
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
