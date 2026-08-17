import { Settings } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import MainToolbar from '@renderer/components/MainToolbar';
import MainPrettifyProviderBand from '@renderer/components/MainPrettifyProviderBand';
import RecordingControls from '@renderer/components/RecordingControls';
import TranslateSection from '@renderer/components/TranslateSection';
import HotkeyActionButton from '@renderer/components/HotkeyActionButton';
import { Button } from '@renderer/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import type { TranslationKey } from '@main/i18n';
import { useI18n } from '@renderer/hooks/useI18n';
import type { CapturedAudioClock } from '@renderer/recordingElapsedTime';
import { PROVIDER_CONNECTION_REASONS } from '@renderer/providerState';
import { translatedStatus, type RendererStatus } from '@renderer/statusPresentation';
import type { ProviderHotkeyContextualAction } from '@renderer/useProviderHotkeyHomeIntegration';
import type { ProviderInfo } from '@renderer/types';
import { LOCAL_WHISPER_PROVIDER_ID, type LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifySettings } from '@shared/prettifySettings';
import type { ProviderContextualAction, ProviderHomeAction } from '@shared/providerHomeAction';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import {
  DEFAULT_TRANSLATION_SETTINGS,
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionState,
  type TranslationSettings,
} from '@shared/translationProvider';

const DEMO_CLOCK_STEP_MS = 1_000;

const DEMO_HOTKEYS = Object.freeze({
  cancel: 'Esc',
  prettify: 'Ctrl + Shift + F12',
  stop: 'F10',
  translation: 'Ctrl + F11',
  voice: 'F9',
});

const DEMO_FIXTURE_OPTIONS = [
  { id: 'idle', labelKey: 'indicator.idle' },
  { id: 'starting', labelKey: 'recording.starting' },
  { id: 'recording', labelKey: 'status.recording' },
  { id: 'paused', labelKey: 'status.paused' },
  { id: 'stopping', labelKey: 'status.stopping' },
  { id: 'transcribing', labelKey: 'status.transcribing' },
  { id: 'retrying', labelKey: 'status.resendingTranscription' },
  { id: 'prettify', labelKey: 'prettify.provider' },
  { id: 'translation', labelKey: 'translate.provider' },
  { id: 'unknown-owner', labelKey: 'providerHotkeyDemo.ownerlessLock' },
  { id: 'priority-status', labelKey: 'providerHotkeyDemo.statusDetailPriority' },
] as const satisfies readonly { readonly id: string; readonly labelKey: TranslationKey }[];

type DemoFixtureId = (typeof DEMO_FIXTURE_OPTIONS)[number]['id'];

interface DemoFixture {
  readonly activeOwner: ProviderHomeAction | null;
  readonly locked: boolean;
  readonly lifecycle: RecordingLifecycleState;
  readonly status: RendererStatus | null;
}

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

const DEMO_PRETTIFY_SETTINGS = {
  ...DEFAULT_PRETTIFY_SETTINGS,
  codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, model: 'gpt-5.6-luna' },
  providerId: 'codex-cli',
} satisfies PrettifySettings;

const DEMO_TRANSLATION_SETTINGS = {
  ...DEFAULT_TRANSLATION_SETTINGS,
  providerId: 'google',
  targetLanguageByProvider: {
    ...DEFAULT_TRANSLATION_SETTINGS.targetLanguageByProvider,
    google: 'en',
  },
} satisfies TranslationSettings;

const DEMO_TRANSLATION_CONNECTION = {
  detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
  providerId: 'google',
  status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
  targetLanguage: 'en',
} satisfies TranslationProviderConnectionState;

const NO_DEMO_ACTION = (): void => undefined;

function getDemoFixture(id: DemoFixtureId): DemoFixture {
  switch (id) {
    case 'starting':
    case 'recording':
    case 'paused':
    case 'stopping':
    case 'transcribing':
    case 'retrying':
      return { activeOwner: 'voice', lifecycle: id, locked: false, status: null };
    case 'prettify':
      return { activeOwner: 'prettify', lifecycle: 'idle', locked: false, status: null };
    case 'translation':
      return { activeOwner: 'translation', lifecycle: 'idle', locked: false, status: null };
    case 'unknown-owner':
      return { activeOwner: null, lifecycle: 'idle', locked: true, status: null };
    case 'priority-status':
      return {
        activeOwner: 'voice',
        lifecycle: 'recording',
        locked: false,
        status: translatedStatus('status.copiedToClipboard'),
      };
    case 'idle':
      return { activeOwner: null, lifecycle: 'idle', locked: false, status: null };
  }
}

function getFixtureAfterContextualAction(action: ProviderContextualAction): DemoFixtureId {
  switch (action) {
    case 'pause':
      return 'paused';
    case 'resume':
      return 'recording';
    case 'cancel':
      return 'idle';
    case 'stop':
      return 'stopping';
  }
}

function createContextualAction(
  action: ProviderContextualAction,
  provider: ProviderHomeAction,
  hotkey: string,
  label: string,
  onActivate: () => void,
): ProviderHotkeyContextualAction {
  return {
    action,
    available: true,
    busy: false,
    hotkey,
    icon: action,
    label,
    onActivate,
    provider,
  };
}

function getDemoContextualActions(
  fixtureId: DemoFixtureId,
  onFixtureChange: (nextFixtureId: DemoFixtureId) => void,
  translate: ReturnType<typeof useI18n>['t'],
): readonly ProviderHotkeyContextualAction[] {
  const setFixtureForAction = (action: ProviderContextualAction): void => {
    onFixtureChange(getFixtureAfterContextualAction(action));
  };
  const cancelVoice = (): void => setFixtureForAction('cancel');

  switch (fixtureId) {
    case 'starting':
      return [createContextualAction('cancel', 'voice', DEMO_HOTKEYS.cancel, translate('recording.cancel'), cancelVoice)];
    case 'recording':
      return [
        createContextualAction('pause', 'voice', DEMO_HOTKEYS.voice, translate('recording.pause'), () =>
          setFixtureForAction('pause'),
        ),
        createContextualAction('stop', 'voice', DEMO_HOTKEYS.stop, translate('recording.stop'), () =>
          setFixtureForAction('stop'),
        ),
        createContextualAction('cancel', 'voice', DEMO_HOTKEYS.cancel, translate('recording.cancel'), cancelVoice),
      ];
    case 'paused':
      return [
        createContextualAction('resume', 'voice', DEMO_HOTKEYS.voice, translate('recording.resume'), () =>
          setFixtureForAction('resume'),
        ),
        createContextualAction('stop', 'voice', DEMO_HOTKEYS.stop, translate('recording.stop'), () =>
          setFixtureForAction('stop'),
        ),
        createContextualAction('cancel', 'voice', DEMO_HOTKEYS.cancel, translate('recording.cancel'), cancelVoice),
      ];
    case 'transcribing':
    case 'retrying':
      return [createContextualAction('cancel', 'voice', DEMO_HOTKEYS.cancel, translate('recording.cancel'), cancelVoice)];
    case 'prettify':
      return [
        createContextualAction('cancel', 'prettify', DEMO_HOTKEYS.cancel, translate('recording.cancel'), () =>
          onFixtureChange('idle'),
        ),
      ];
    case 'translation':
      return [
        createContextualAction('cancel', 'translation', DEMO_HOTKEYS.cancel, translate('recording.cancel'), () =>
          onFixtureChange('idle'),
        ),
      ];
    case 'idle':
    case 'stopping':
    case 'unknown-owner':
    case 'priority-status':
      return [];
  }
}

function useDemoClock(): { readonly advance: () => void; readonly clock: CapturedAudioClock } {
  const callbacksRef = useRef(new Map<number, () => void>());
  const nextHandleRef = useRef(0);
  const nowRef = useRef(0);
  const clock = useMemo<CapturedAudioClock>(
    () => ({
      clearInterval: (handle) => callbacksRef.current.delete(handle),
      now: () => nowRef.current,
      setInterval: (callback) => {
        const handle = nextHandleRef.current;
        nextHandleRef.current += 1;
        callbacksRef.current.set(handle, callback);
        return handle;
      },
    }),
    [],
  );
  const advance = useCallback(() => {
    nowRef.current += DEMO_CLOCK_STEP_MS;
    callbacksRef.current.forEach((callback) => callback());
  }, []);

  return { advance, clock };
}

/** Deterministic, capability-free rendering of the completed 620 × 292 home screen. */
export default function ProviderHotkeyDemo(): React.JSX.Element {
  const { t } = useI18n();
  const [fixtureId, setFixtureId] = useState<DemoFixtureId>('idle');
  const [transientLockedOwner, setTransientLockedOwner] = useState<ProviderHomeAction | null>(null);
  const { advance, clock } = useDemoClock();
  const fixture = getDemoFixture(fixtureId);
  const contextualActions = getDemoContextualActions(
    fixtureId,
    (nextFixtureId) => {
      setTransientLockedOwner(null);
      setFixtureId(nextFixtureId);
    },
    t,
  );
  const lockOwner = (owner: ProviderHomeAction): void => setTransientLockedOwner(owner);
  const isLocked = (owner: ProviderHomeAction): boolean =>
    fixture.locked || transientLockedOwner !== null || (fixture.activeOwner !== null && fixture.activeOwner !== owner);
  const selectFixture = (nextFixtureId: DemoFixtureId): void => {
    setTransientLockedOwner(null);
    setFixtureId(nextFixtureId);
  };

  return (
    <div className="provider-hotkey-demo-root" data-demo="provider-hotkeys" data-fixture={fixtureId}>
      <main className="command-dock command-dock-hotkey-demo" data-slot="main-window">
        <MainToolbar
          actionControl={
            <HotkeyActionButton
                actionLabel={t('recording.startCommand')}
              active={fixture.activeOwner === 'voice'}
              hotkey={DEMO_HOTKEYS.voice}
              locked={isLocked('voice')}
              onActivate={() => lockOwner('voice')}
            />
          }
          activeProviderAuthType="localRuntime"
          activeProviderHasSettings
          activeProviderId={LOCAL_WHISPER_PROVIDER_ID}
          activeProviderName="Local Whisper"
          isLoggedIn
          isLoggingIn={false}
          isProviderChangesLocked={fixture.locked}
          isVoiceProviderSwitching={false}
          localWhisperPendingAction={null}
          localWhisperResidencyFailure={null}
          localWhisperResidencyFailureSequence={0}
          localWhisperStatus={LOCAL_WHISPER_READY}
          onLocalWhisperResidencyAction={NO_DEMO_ACTION}
          onOpenAbout={NO_DEMO_ACTION}
          onOpenAppSettings={NO_DEMO_ACTION}
          onOpenHistory={NO_DEMO_ACTION}
          onOpenProviderSettings={NO_DEMO_ACTION}
          onProviderChange={NO_DEMO_ACTION}
          onProviderLogin={NO_DEMO_ACTION}
          providerConnectionFailureTooltip=""
          providerConnectionReason={PROVIDER_CONNECTION_REASONS.LocalRuntimeReady}
          providers={VOICE_PROVIDERS}
        />

        <MainPrettifyProviderBand
          actionControl={
            <HotkeyActionButton
                actionLabel={t('prettify.provider')}
              active={fixture.activeOwner === 'prettify'}
              hotkey={DEMO_HOTKEYS.prettify}
              locked={isLocked('prettify')}
              onActivate={() => lockOwner('prettify')}
            />
          }
          cliConnection={{ providerId: 'codex-cli', status: 'connected' }}
          connectionError=""
          error=""
          httpConnection={null}
          isModelActionRunning={false}
          isProviderChangesLocked={fixture.locked}
          isProviderChangeSaving={false}
          ollamaModels={[]}
          onModelAction={NO_DEMO_ACTION}
          onOpenSettings={NO_DEMO_ACTION}
          onProviderChange={NO_DEMO_ACTION}
          settings={DEMO_PRETTIFY_SETTINGS}
        />

        <TranslateSection
          actionControl={
            <HotkeyActionButton
                actionLabel={t('translate.provider')}
              active={fixture.activeOwner === 'translation'}
              hotkey={DEMO_HOTKEYS.translation}
              locked={isLocked('translation')}
              onActivate={() => lockOwner('translation')}
            />
          }
          connectionState={DEMO_TRANSLATION_CONNECTION}
          error=""
          isProviderChangesLocked={fixture.locked}
          isProviderChangeSaving={false}
          isSaving={false}
          onProviderChange={NO_DEMO_ACTION}
          onTargetLanguageChange={NO_DEMO_ACTION}
          settings={DEMO_TRANSLATION_SETTINGS}
          settingsControl={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={t('navigation.openProviderSettings', { provider: t('translate.provider') })}
                  className="command-dock-translation-settings-shortcut command-dock-settings-shortcut"
                  disabled={fixture.locked}
                  onClick={NO_DEMO_ACTION}
                  size="icon"
                  title={t('navigation.openProviderSettings', { provider: t('translate.provider') })}
                  variant="outline"
                >
                  <Settings aria-hidden="true" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('navigation.openProviderSettings', { provider: t('translate.provider') })}</TooltipContent>
            </Tooltip>
          }
        />

        <RecordingControls
          contextualActions={contextualActions}
          elapsedClock={clock}
          state={fixture.lifecycle}
          status={fixture.status}
        />
      </main>

      <aside aria-label={t('providerHotkeyDemo.fixtureControls')} className="provider-hotkey-demo-controls">
        <label>
          {t('providerHotkeyDemo.fixture')}
          <select
            aria-label={t('providerHotkeyDemo.fixture')}
            name="fixture"
            onChange={(event) => selectFixture(event.target.value as DemoFixtureId)}
            value={fixtureId}
          >
            {DEMO_FIXTURE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={advance} type="button">
          {t('providerHotkeyDemo.advanceClock')}
        </button>
        <button onClick={() => setTransientLockedOwner(null)} type="button">
          {t('providerHotkeyDemo.clearLock')}
        </button>
      </aside>
    </div>
  );
}
