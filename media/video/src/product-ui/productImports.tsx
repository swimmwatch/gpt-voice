import type { JSX } from 'react';
import MainToolbar from '@renderer/components/MainToolbar';
import PrettifyModelMemoryRow from '@renderer/components/PrettifyModelMemoryRow';
import RecordingControls from '@renderer/components/RecordingControls';
import TranslateSection from '@renderer/components/TranslateSection';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import {
  getRecordingWorkspaceViewState,
  RecordingWorkspacePrimaryAction,
  RecordingWorkspaceSecondaryAction,
  RecordingWorkspaceStatus,
} from '@renderer/mainWindowViewState';
import { getProviderSettingsViewState } from '@renderer/providerSettingsViewState';
import '@renderer/styles/globals.css';

export {
  getProviderSettingsViewState,
  getRecordingWorkspaceViewState,
  MainToolbar,
  PrettifyModelMemoryRow,
  RecordingControls,
  RecordingWorkspacePrimaryAction,
  RecordingWorkspaceSecondaryAction,
  RecordingWorkspaceStatus,
  TranslateSection,
};

/** Renders only in the Task 7 debug proof; Task 8 replaces it with the complete ProductUiFrame. */
export function ProductImportProbe(): JSX.Element {
  return (
    <TooltipProvider>
      <div className="command-dock" style={{ height: 117, width: 460 }}>
        <MainToolbar
          activeProviderAuthType="browserSession"
          activeProviderId="chatgpt"
          activeProviderName="ChatGPT Web"
          isLoggedIn
          isLoggingIn={false}
          onOpenAbout={() => undefined}
          onOpenAppSettings={() => undefined}
          onOpenHistory={() => undefined}
          onOpenProviderSettings={() => undefined}
          onProviderChange={() => undefined}
          onProviderLogin={() => undefined}
          providers={[{ authType: 'browserSession', id: 'chatgpt', name: 'ChatGPT Web' }]}
        />
      </div>
    </TooltipProvider>
  );
}
