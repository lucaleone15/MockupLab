import { HelpDialog } from './HelpDialog';
import { Tour } from '@/shell/Tour';
import { NameDialog } from '@/library/NameDialog';
import { ProjectPage } from '@/library/ProjectPage';
import { ExportSheet } from '@/shell/ExportSheet';
import { AllProjectsSheet } from '@/library/AllProjectsSheet';
import { PreviewOverlay } from './Viewport';
import { VariantsDialog } from '@/variants/VariantsDialog';
import { BatchDialog } from '@/variants/BatchDialog';

/** The windows that open over any screen (help, guide, projects, export…): loaded once the page is shown. */
export default function Overlays() {
  return (
    <>
      <HelpDialog />
      <Tour />
      <NameDialog />
      <ProjectPage />
      <VariantsDialog />
      <PreviewOverlay />
      <BatchDialog />
      <ExportSheet />
      <AllProjectsSheet />
    </>
  );
}
