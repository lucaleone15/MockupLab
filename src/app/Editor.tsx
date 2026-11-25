import { useT, type I18nKey } from '@/i18n';
import { QuickScreen } from '@/quick/QuickScreen';
import { ProjectScreen } from '@/project/ProjectScreen';
import { HiddenStage } from '@/shell/HiddenStage';
import { TOP_BAR, TopBar } from '@/shell/TopBar';
import { sceneTone } from '@/lib/sceneTone';
import { useProject } from '@/store/project';
import { StudioScreen } from '@/studio/StudioScreen';
import type { Mode } from '@/store/ui';
import { ErrorBoundary } from './ErrorBoundary';

/** Studio, Rapide and Projet with their top bar: the 3D editor, loaded when one of them is opened. */
export default function Editor({ screen }: { screen: Mode }) {
  const { t } = useT();
  const tone = useProject((s) => sceneTone(s.background));
  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col" data-scene={screen === 'studio' ? tone : undefined}>
        <TopBar />
        {/* the Studio's scene runs under the top bar; Rapide and Projet start below it */}
        <div className="flex min-h-0 flex-1 flex-col" style={{ paddingTop: screen === 'studio' ? 0 : TOP_BAR }}>
          <ErrorBoundary label={t(`screen.${screen}` as I18nKey)} key={screen}>
            {screen === 'quick' ? <QuickScreen /> : screen === 'project' ? <ProjectScreen /> : <StudioScreen />}
          </ErrorBoundary>
        </div>
      </div>
      {(screen === 'quick' || screen === 'project') && <HiddenStage />}
    </>
  );
}
