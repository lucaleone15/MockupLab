import { useState } from 'react';
import { Tooltip } from 'radix-ui';
import { useT } from '@/i18n';
import { ErrorBoundary, hasWebGL2 } from './ErrorBoundary';
import { Logo } from './TopBar';

const webgl = hasWebGL2();
import { LibraryPanel } from './LibraryPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { useGlobalInput } from './shortcuts';
import { useRouteSync } from '@/shell/route';
import { HelpDialog } from './HelpDialog';
import { Toaster } from './Toaster';
import { TopBar } from './TopBar';
import { PreviewOverlay, Viewport } from './Viewport';
import { useProject } from '@/store/project';
import { PhotoLibrary } from '@/photo/PhotoLibrary';
import { PhotoView } from '@/photo/PhotoView';
import { VariantsDialog } from '@/variants/VariantsDialog';
import { BatchDialog } from '@/variants/BatchDialog';

function NoWebGL() {
  const { t } = useT();
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-[460px]">
        <div className="mb-3 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-[18px] font-semibold">{t('webgl.title')}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{t('webgl.body')}</p>
      </div>
    </div>
  );
}

/** The editor is made for a desktop screen; small screens get a word of warning. */
function SmallScreenNotice() {
  const { t } = useT();
  const [hidden, setHidden] = useState(() => window.innerWidth >= 960);
  if (hidden) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-bg/95 p-6 text-center backdrop-blur" role="dialog" aria-modal="true">
      <div className="max-w-[360px]">
        <div className="mb-3 flex justify-center">
          <Logo />
        </div>
        <p className="text-[13.5px] leading-relaxed text-fg-muted">{t('small.body')}</p>
        <button type="button" onClick={() => setHidden(true)} className="mt-4 h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-fg">
          {t('small.continue')}
        </button>
      </div>
    </div>
  );
}

export function App() {
  useGlobalInput();
  useRouteSync();
  const { t } = useT();
  if (!webgl) return <NoWebGL />;
  const photo = useProject((s) => s.mode === 'photo');
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          {photo ? <PhotoLibrary /> : <LibraryPanel />}
          <ErrorBoundary label={photo ? t('mode.photo') : t('mode.scene')} key={photo ? 'photo' : 'scene'}>
            {photo ? <PhotoView /> : <Viewport />}
          </ErrorBoundary>
          <PropertiesPanel />
        </div>
      </div>
      <Toaster />
      <HelpDialog />
      <VariantsDialog />
      <PreviewOverlay />
      <SmallScreenNotice />
      <BatchDialog />
    </Tooltip.Provider>
  );
}
