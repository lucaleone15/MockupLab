import { useState } from 'react';
import { Tooltip } from 'radix-ui';
import { useT, type I18nKey } from '@/i18n';
import { QuickScreen } from '@/quick/QuickScreen';
import { ProjectScreen } from '@/project/ProjectScreen';
import { HiddenStage } from '@/shell/HiddenStage';
import { ErrorBoundary, hasWebGL2 } from './ErrorBoundary';
import { Logo } from '@/shell/Logo';
import { useGlobalInput } from './shortcuts';
import { useRouteSync } from '@/shell/route';
import { HelpDialog } from './HelpDialog';
import { Tour } from '@/shell/Tour';
import { AppDialogs } from '@/ui/dialogs';
import { NameDialog } from '@/library/NameDialog';
import { ProjectPage } from '@/library/ProjectPage';
import { Toaster } from './Toaster';
import { TopBar } from '@/shell/TopBar';
import { ExportSheet } from '@/shell/ExportSheet';
import { AllProjectsSheet } from '@/library/AllProjectsSheet';
import { UpdateBanner } from '@/pwa/UpdateBanner';
import { PreviewOverlay } from './Viewport';
import { useUi } from '@/store/ui';
import { Home } from '@/home/Home';
import { StudioScreen } from '@/studio/StudioScreen';
import { VariantsDialog } from '@/variants/VariantsDialog';
import { BatchDialog } from '@/variants/BatchDialog';

const webgl = hasWebGL2();

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

/** The editor is made for a desktop screen; small screens get a word of warning. */
function SmallScreenNotice() {
  const { t } = useT();
  const [hidden, setHidden] = useState(() => window.innerWidth >= 960);
  if (hidden) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-bg/95 p-6 text-center backdrop-blur" role="dialog" aria-modal="true">
      <div className="max-w-[360px]">
        <div className="mb-3 flex justify-center">
          <Logo asLink={false} />
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
  const screen = useUi((s) => s.screen);
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        {screen === 'home' ? (
          <Home />
        ) : (
          <>
            <TopBar />
            <ErrorBoundary label={t(`screen.${screen}` as I18nKey)} key={screen}>
              {screen === 'quick' ? <QuickScreen /> : screen === 'project' ? <ProjectScreen /> : <StudioScreen />}
            </ErrorBoundary>
          </>
        )}
        {(screen === 'quick' || screen === 'project') && <HiddenStage />}
      </div>
      <Toaster />
      <HelpDialog />
      <Tour />
      <AppDialogs />
      <NameDialog />
      <ProjectPage />
      <VariantsDialog />
      <PreviewOverlay />
      <SmallScreenNotice />
      <BatchDialog />
      <ExportSheet />
      <AllProjectsSheet />
      <UpdateBanner />
    </Tooltip.Provider>
  );
}
