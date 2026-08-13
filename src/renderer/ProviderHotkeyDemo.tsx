import { Settings } from 'lucide-react';
import { useMemo, useState } from 'react';
import MainToolbar from '@renderer/components/MainToolbar';
import MainPrettifyProviderBand from '@renderer/components/MainPrettifyProviderBand';
import TranslateSection from '@renderer/components/TranslateSection';
import RecordingControls from '@renderer/components/RecordingControls';
import HotkeyActionButton from '@renderer/components/HotkeyActionButton';
import { Button } from '@renderer/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { PROVIDER_CONNECTION_REASONS } from '@renderer/providerState';
import { translatedStatus } from '@renderer/statusPresentation';
import type { ProviderInfo } from '@renderer/types';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifyProviderId } from '@shared/prettifySettings';
import {
  DEFAULT_TRANSLATION_SETTINGS,
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderId,
} from '@shared/translationProvider';
import { LOCAL_WHISPER_PROVIDER_ID, type LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';

const DEMO_HOTKEYS = Object.freeze({
  prettify: 'Ctrl + Shift + F12',
  translation: 'Ctrl + F11',
  voice: 'F9',
});

const VOICE_PROVIDERS: ProviderInfo[] = [
  {
    authType: 'localRuntime',
    category: 'local',
    hasSettings: true,
    id: LOCAL_WHISPER_PROVIDER_ID,
    name: 'Local Whisper',
    transcriptionMode: 'batch',
  },
];

const LOCAL_WHISPER_READY: LocalWhisperMainStatusSnapshot = Object.freeze({
  failure: null,
  providerId: LOCAL_WHISPER_PROVIDER_ID,
  runtime: Object.freeze({
    activity: 'Idle',
    blockingCode: null,
    canAttempt: true,
    capability: 'Validated',
    modelSetup: 'Installed',
    operationalStatus: 'Ready',
    residency: 'Loaded',
    runtimeSetup: 'Installed',
    supportTier: 'Production',
  }),
  selectedButUnavailable: false,
  snapshotRevision: 1,
});

/** Deterministic, provider-inert rendering of the approved widened home screen. */
export default function ProviderHotkeyDemo(): React.JSX.Element {
  const [prettifyProvider, setPrettifyProvider] = useState<PrettifyProviderId>('codex-cli');
  const [translationProvider, setTranslationProvider] = useState<TranslationProviderId>('google');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const noAction = (): void => undefined;
  const prettifySettings = useMemo(
    () => ({
      ...DEFAULT_PRETTIFY_SETTINGS,
      providerId: prettifyProvider,
      codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, model: 'gpt-5.6-luna' },
    }),
    [prettifyProvider],
  );
  const translationSettings = useMemo(
    () => ({
      ...DEFAULT_TRANSLATION_SETTINGS,
      providerId: translationProvider,
      targetLanguageByProvider: {
        ...DEFAULT_TRANSLATION_SETTINGS.targetLanguageByProvider,
        [translationProvider]: targetLanguage,
      },
    }),
    [targetLanguage, translationProvider],
  );
  const translationConnection = useMemo(
    () => ({
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
      providerId: translationProvider,
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
      targetLanguage,
    }),
    [targetLanguage, translationProvider],
  );

  return (
    <main className="command-dock command-dock-hotkey-demo" data-demo="provider-hotkeys">
      <MainToolbar
        actionControl={
          <HotkeyActionButton actionLabel="Use Voice provider" hotkey={DEMO_HOTKEYS.voice} onActivate={noAction} />
        }
        activeProviderAuthType="localRuntime"
        activeProviderHasSettings
        activeProviderId={LOCAL_WHISPER_PROVIDER_ID}
        activeProviderName="Local Whisper"
        isLoggedIn
        isLoggingIn={false}
        isProviderChangesLocked={false}
        isVoiceProviderSwitching={false}
        localWhisperPendingAction={null}
        localWhisperResidencyFailure={null}
        localWhisperResidencyFailureSequence={0}
        localWhisperStatus={LOCAL_WHISPER_READY}
        onLocalWhisperResidencyAction={noAction}
        onOpenAbout={noAction}
        onOpenAppSettings={noAction}
        onOpenHistory={noAction}
        onOpenProviderSettings={noAction}
        onProviderChange={noAction}
        onProviderLogin={noAction}
        providerConnectionFailureTooltip=""
        providerConnectionReason={PROVIDER_CONNECTION_REASONS.LocalRuntimeReady}
        providers={VOICE_PROVIDERS}
      />

      <MainPrettifyProviderBand
        actionControl={
          <HotkeyActionButton
            actionLabel="Use Prettify provider"
            disabled
            hotkey={DEMO_HOTKEYS.prettify}
            onActivate={noAction}
          />
        }
        cliConnection={{ providerId: 'codex-cli', status: 'connected' }}
        connectionError=""
        error=""
        httpConnection={null}
        isModelActionRunning={false}
        isProviderChangesLocked={false}
        isProviderChangeSaving={false}
        ollamaModels={[]}
        onModelAction={noAction}
        onOpenSettings={noAction}
        onProviderChange={setPrettifyProvider}
        settings={prettifySettings}
      />

      <TranslateSection
        actionControl={
          <HotkeyActionButton
            actionLabel="Use Translation provider"
            hotkey={DEMO_HOTKEYS.translation}
            onActivate={noAction}
          />
        }
        connectionState={translationConnection}
        error=""
        isProviderChangesLocked={false}
        isProviderChangeSaving={false}
        isSaving={false}
        onProviderChange={setTranslationProvider}
        onTargetLanguageChange={setTargetLanguage}
        settings={translationSettings}
        settingsControl={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Open Translation settings"
                className="command-dock-translation-settings-shortcut command-dock-settings-shortcut"
                onClick={noAction}
                size="icon"
                title="Open Translation settings"
                variant="outline"
              >
                <Settings aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open Translation settings</TooltipContent>
          </Tooltip>
        }
      />

      <RecordingControls
        hidePrimaryAction
        onCancel={noAction}
        onPause={noAction}
        onResume={noAction}
        onStart={noAction}
        onStop={noAction}
        recordingDisabled={false}
        recordHotkey={DEMO_HOTKEYS.voice}
        state="idle"
        status={translatedStatus('status.copiedToClipboard')}
      />
    </main>
  );
}
