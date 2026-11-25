import { Suspense, lazy, useEffect, useState } from 'react';
import { Tooltip } from 'radix-ui';
import { useT } from '@/i18n';
import { hasWebGL2 } from './ErrorBoundary';
import { Logo } from '@/shell/Logo';
import { useGlobalInput } from './shortcuts';
import { useRouteSync } from '@/shell/route';
import { AppDialogs } from '@/ui/dialogs';
import { Toaster } from './Toaster';
import { useSpecular } from '@/ui/useSpecular';
import { UpdateBanner } from '@/pwa/UpdateBanner';
import { useUi } from '@/store/ui';
import { Home } from '@/home/Home';
import { About } from '@/home/About';

const webgl = hasWebGL2();

// the landing shows first: the editor loads when a mode opens, the shared windows once the page is idle
const Editor = lazy(() => import('./Editor'));
const Overlays = lazy(() => import('./Overlays'));

/** True once the page has shown and settled (or right away when the first screen is not the landing). */
function useIdle(now: boolean) {
  const [idle, setIdle] = useState(now);
  useEffect(() => {
    if (idle) return;
    const go = () => setIdle(true);
    // Safari has no requestIdleCallback
    const ric = typeof requestIdleCallback === 'function';
    const id = ric ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 1200);
    return () => (ric ? cancelIdleCallback(id as number) : clearTimeout(id));
  }, [idle]);
  return idle;
}

function NoWebGL() {
  const { t } = useT();
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-[460px]">
        <div className="mb-3 flex justify-center">
          <Logo asLink={false} />
        </div>
        <h1 className="text-[18px] font-semibold">{t('webgl.title')}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{t('webgl.body')}</p>
      </div>
    </div>
  );
}

export function App() {
  useGlobalInput();
  useSpecular();
  useRouteSync();
  if (!webgl) return <NoWebGL />;
  const screen = useUi((s) => s.screen);
  const idle = useIdle(screen !== 'home');
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        {screen === 'home' ? (
          <Home />
        ) : screen === 'about' ? (
          <About />
        ) : (
          <Suspense fallback={null}>
            <Editor screen={screen} />
          </Suspense>
        )}
      </div>
      <Toaster />
      <AppDialogs />
      {idle && (
        <Suspense fallback={null}>
          <Overlays />
        </Suspense>
      )}
      <UpdateBanner />
    </Tooltip.Provider>
  );
}
