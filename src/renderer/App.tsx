import React, { useState, useEffect, useEffectEvent, useRef, useCallback, useReducer } from 'react';
import { useDesktopApi } from './DesktopApiProvider';
import LoadingScreen from './components/LoadingScreen';
import MainToolbar from './components/MainToolbar';
import MainPrettifyProviderBand from './components/MainPrettifyProviderBand';
import RecordingControls from './components/RecordingControls';
import TranslateSection from './components/TranslateSection';
import HotkeyActionButton from './components/HotkeyActionButton';
import { useWindowStartupReady } from './WindowStartupGate';
import { useRecording } from './hooks/useRecording';
import { useI18n } from './hooks/useI18n';
import useLocalWhisperMainStatus from './localWhisper/useLocalWhisperMainStatus';
import {
  PROVIDER_CONNECTION_REASONS,
  getProviderLoginState,
  isActiveProviderSettingsChange,
  isProviderConfigured,
  type ProviderConnectionReason,
  type ProviderLoginState,
} from './providerState';
import {
  createProviderSelectionCoordinator,
  type ProviderSelectionCoordinator,
  type ProviderSelectionEvent,
} from './providerSelectionCoordinator';
import {
  clearRecoveredBrowserFailureStatus,
  createBrowserProviderFailurePresentation,
  notificationErrorStatus,
  renderRendererStatus,
  shouldPresentIdleHotkeyStatus,
  textActionStatusToRendererStatus,
  translatedStatus,
  type RendererStatus,
} from './statusPresentation';
import { useProviderHotkeyHomeIntegration } from './useProviderHotkeyHomeIntegration';
import { useMainPrettifyHomeProvider } from './useMainPrettifyHomeProvider';
import type { BackgroundBrowserStatus, ProviderAuthType, ProviderInfo, ProviderSettings } from './types';
import { presentNotificationError } from '@shared/notifications';
import {
  DEFAULT_TRANSLATION_SETTINGS,
  type TranslationProviderConnectionState,
  type TranslationSettings,
} from '@shared/translationProvider';
import { isRecordingLifecycleBusy, type RecordingLifecycleState } from '@shared/recordingLifecycle';
import type { FirstLaunchStartupSnapshot } from '@shared/firstLaunchStartup';
import type { TextActionStatusAction } from '@shared/textActionStatus';
import {
  createTranslationProviderCandidate,
  createTranslationSettingsCandidate,
  createTranslationSettingsViewState,
  doesTranslationConnectionMatchSettings,
  reduceTranslationSettingsViewState,
} from './translationSettingsViewState';
import { FAILED_INITIAL_TRANSLATION_CONNECTION_STATE } from './providerStartupState';
import {
  createFirstLaunchStartupState,
  getFirstLaunchStartupPresentation,
  reduceFirstLaunchStartupState,
} from './firstLaunchStartupState';

const STARTUP_COMPLETION_HOLD_MS = 500;
const STARTUP_REVEAL_DURATION_MS = 180;

type StartupRevealPhase = 'loading' | 'complete-hold' | 'prepared' | 'revealing' | 'revealed';
type StartupRevealProgressPhase = Exclude<StartupRevealPhase, 'loading'>;

interface StartupRevealState {
  isStartupPending: boolean;
  phase: StartupRevealProgressPhase;
}

function createStartupRevealState(isStartupPending: boolean): StartupRevealState {
  return { isStartupPending, phase: 'complete-hold' };
}

/** Holds completed startup feedback briefly, then coordinates the main-window reveal. */
function useStartupReveal(isStartupPending: boolean): StartupRevealPhase {
  const [revealState, setRevealState] = useState<StartupRevealState>(() => createStartupRevealState(isStartupPending));

  if (revealState.isStartupPending !== isStartupPending) {
    setRevealState(createStartupRevealState(isStartupPending));
  }

  const phase: StartupRevealPhase = isStartupPending ? 'loading' : revealState.phase;

  useEffect(() => {
    if (phase !== 'complete-hold') return undefined;

    const holdTimer = window.setTimeout(
      () => setRevealState((current) => ({ ...current, phase: 'prepared' })),
      STARTUP_COMPLETION_HOLD_MS,
    );
    return () => window.clearTimeout(holdTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'prepared') return undefined;

    let secondAnimationFrame: number | undefined;
    const firstAnimationFrame = window.requestAnimationFrame(() => {
      secondAnimationFrame = window.requestAnimationFrame(() =>
        setRevealState((current) => ({ ...current, phase: 'revealing' })),
      );
    });
    return () => {
      window.cancelAnimationFrame(firstAnimationFrame);
      if (secondAnimationFrame !== undefined) window.cancelAnimationFrame(secondAnimationFrame);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revealing') return undefined;

    const revealTimer = window.setTimeout(
      () => setRevealState((current) => ({ ...current, phase: 'revealed' })),
      STARTUP_REVEAL_DURATION_MS,
    );
    return () => window.clearTimeout(revealTimer);
  }, [phase]);

  return phase;
}

/** Coordinates the main recording lifecycle, provider state, notifications, and IPC subscriptions. */
const App: React.FC = () => {
  const desktopApi = useDesktopApi();
  const localWhisperMain = useLocalWhisperMainStatus(desktopApi);
  const [isInitialVoiceProviderLoading, setIsInitialVoiceProviderLoading] = useState(true);
  const [firstLaunchStartupState, dispatchFirstLaunchStartup] = useReducer(
    reduceFirstLaunchStartupState,
    createFirstLaunchStartupState(),
  );
  const [isFirstLaunchRetryPending, setIsFirstLaunchRetryPending] = useState(false);
  const [didFirstLaunchRetryFail, setDidFirstLaunchRetryFail] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingLifecycleState>('idle');
  const [isTextActionActivityActive, setIsTextActionActivityActive] = useState<boolean | null>(null);
  const [status, setStatus] = useState<RendererStatus | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVoiceProviderSwitching, setIsVoiceProviderSwitching] = useState(false);
  const [providerConnectionReason, setProviderConnectionReason] = useState<ProviderConnectionReason>(
    PROVIDER_CONNECTION_REASONS.SessionMissing,
  );
  const [providerConnectionFailureStatus, setProviderConnectionFailureStatus] = useState<RendererStatus | null>(null);
  const [translationSettingsSelection, dispatchTranslationSettingsSelection] = useReducer(
    reduceTranslationSettingsViewState,
    createTranslationSettingsViewState(DEFAULT_TRANSLATION_SETTINGS),
  );
  const translationSettings = translationSettingsSelection.settings;
  const [translationConnectionState, setTranslationConnectionState] =
    useState<TranslationProviderConnectionState | null>(null);
  const [hasLoadedInitialTranslationSettings, setHasLoadedInitialTranslationSettings] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const isTranslationProviderSwitching =
    translationSettingsSelection.pendingRequestId !== null &&
    translationSettingsSelection.settings.providerId !== translationSettingsSelection.confirmedSettings.providerId;
  const [activeTextAction, setActiveTextAction] = useState<TextActionStatusAction | null>(null);

  const { t, isReady: isI18nReady } = useI18n();
  const isSharedProviderChangesLocked =
    isVoiceProviderSwitching ||
    isTranslationProviderSwitching ||
    isRecordingLifecycleBusy(recordingState) ||
    activeTextAction !== null ||
    isTextActionActivityActive === true;
  const mainPrettifyProvider = useMainPrettifyHomeProvider({
    desktopApi,
    isSharedProviderChangesLocked,
    translate: t,
  });
  const {
    isInitialLoading: isInitialPrettifyProviderLoading,
    isModelActionRunning: isPrettifyModelActionRunning,
    isProviderChangeSaving: isPrettifyProviderSwitching,
    isProviderChangesLocked,
    settings: prettifySettings,
  } = mainPrettifyProvider;
  const activeProvider = providers.find((provider) => provider.id === activeProviderId);
  const activeProviderName = activeProvider?.name ?? '';
  const activeProviderAuthType = activeProvider?.authType ?? null;
  const activeProviderTranscriptionMode = activeProvider?.transcriptionMode || 'batch';
  const firstLaunchStartupPresentation = getFirstLaunchStartupPresentation(firstLaunchStartupState, {
    prettifyPending: isInitialPrettifyProviderLoading,
    translationSettingsPending: !hasLoadedInitialTranslationSettings,
    voicePending: isInitialVoiceProviderLoading,
  });
  const startupRevealPhase = useStartupReveal(!isI18nReady || firstLaunchStartupPresentation.isPending);
  useWindowStartupReady(true);

  useEffect(() => {
    let disposed = false;
    const acceptSnapshot = (snapshot: FirstLaunchStartupSnapshot): void => {
      if (disposed) return;
      dispatchFirstLaunchStartup({ snapshot, type: 'main-snapshot-received' });
      setDidFirstLaunchRetryFail(false);
    };

    const unsubscribe = desktopApi.onFirstLaunchStartupSnapshot(acceptSnapshot);
    void desktopApi
      .getFirstLaunchStartupSnapshot()
      .then(acceptSnapshot)
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopApi]);

  useEffect(() => {
    let disposed = false;
    let activityEventVersion = 0;
    const unsubscribe = desktopApi.onTextActionActivityChanged((active) => {
      if (disposed) return;
      activityEventVersion += 1;
      setIsTextActionActivityActive(active);
    });
    const queryEventVersion = activityEventVersion;

    void desktopApi
      .getTextActionActivity()
      .then((active) => {
        if (!disposed && activityEventVersion === queryEventVersion) setIsTextActionActivityActive(active);
      })
      .catch(() => {
        if (!disposed && activityEventVersion === queryEventVersion) setIsTextActionActivityActive(true);
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopApi]);

  const retryFirstLaunchStartup = useCallback(async (): Promise<void> => {
    if (isFirstLaunchRetryPending) return;
    setIsFirstLaunchRetryPending(true);
    setDidFirstLaunchRetryFail(false);
    try {
      const snapshot = await desktopApi.retryFirstLaunchStartup();
      dispatchFirstLaunchStartup({ snapshot, type: 'main-snapshot-received' });
    } catch {
      setDidFirstLaunchRetryFail(true);
    } finally {
      setIsFirstLaunchRetryPending(false);
    }
  }, [desktopApi, isFirstLaunchRetryPending]);

  const preserveStatusRef = useRef(false);
  const recordingStateRef = useRef<RecordingLifecycleState>('idle');
  const activeProviderIdRef = useRef<string | null>(activeProviderId);
  const activeProviderAuthTypeRef = useRef<ProviderAuthType | null>(null);
  const providerSelectionCoordinatorRef = useRef<ProviderSelectionCoordinator | null>(null);
  const translationSettingsRequestRef = useRef(0);
  const translationSettingsSavePendingRef = useRef(false);
  const translationSettingsRef = useRef(translationSettings);
  const translationConnectionRequestRef = useRef(0);

  useEffect(() => {
    translationSettingsRef.current = translationSettings;
  }, [translationSettings]);

  const updateRecordingState = useCallback((nextState: RecordingLifecycleState): void => {
    recordingStateRef.current = nextState;
    setRecordingState(nextState);
  }, []);

  const showStatusNotification = useCallback(
    (nextStatus: RendererStatus) => {
      const notificationBody = renderRendererStatus(nextStatus, t).trim();
      if (!notificationBody) return;
      void desktopApi.showNotification('GPT-Voice', notificationBody).catch(() => undefined);
    },
    [desktopApi, t],
  );

  const setStatusAndNotify = useCallback(
    (nextStatus: RendererStatus) => {
      setStatus(nextStatus);
      showStatusNotification(nextStatus);
    },
    [showStatusNotification],
  );

  const applyBrowserProviderFailure = useCallback(
    (error: unknown): void => {
      const failure = createBrowserProviderFailurePresentation(error);
      setIsLoggedIn(false);
      setProviderConnectionReason(failure.reason);
      setProviderConnectionFailureStatus(failure.status);
      preserveStatusRef.current = true;
      setStatusAndNotify(failure.status);
    },
    [setStatusAndNotify],
  );

  const presentBrowserProviderRequestFailure = useCallback(
    (error: unknown): void => {
      const failure = createBrowserProviderFailurePresentation(error);
      setProviderConnectionFailureStatus(failure.status);
      preserveStatusRef.current = true;
      setStatusAndNotify(failure.status);
    },
    [setStatusAndNotify],
  );

  const recordingActions = useRecording({
    setStatus,
    setRecordingState: updateRecordingState,
    notifyStatus: showStatusNotification,
    t,
    transcriptionMode: activeProviderTranscriptionMode,
  });
  const recordingActionsRef = useRef(recordingActions);
  useEffect(() => {
    recordingActionsRef.current = recordingActions;
  }, [recordingActions]);
  const { startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording } = recordingActions;
  const presentIdleRecordHotkey = useCallback((hotkey: string): void => {
    if (shouldPresentIdleHotkeyStatus(recordingStateRef.current, preserveStatusRef.current)) {
      setStatus(translatedStatus('status.pressToRecord', { hotkey }));
    }
  }, []);
  const providerHotkeyIntegration = useProviderHotkeyHomeIntegration({
    activeProviderId,
    activeTextAction,
    desktopApi,
    isInitialVoiceProviderLoading,
    isPrettifyModelActionRunning,
    isPrettifyProviderSwitching,
    isTextActionActivityActive,
    isTranslationProviderSwitching,
    isVoiceProviderSwitching,
    onIdleRecordHotkey: presentIdleRecordHotkey,
    onProviderActionRejected: () => setStatus(translatedStatus('error.notificationUnknown')),
    onVoiceCancel: cancelRecording,
    onVoicePause: pauseRecording,
    onVoiceResume: resumeRecording,
    onVoiceStart: () => void startRecording(),
    onVoiceStop: stopRecording,
    recordingState,
    translate: t,
  });
  const applyProviderLoginState = useCallback(
    (
      authType: ProviderAuthType,
      hasSession: boolean,
      backgroundStatus?: BackgroundBrowserStatus,
    ): ProviderLoginState => {
      const loginState = getProviderLoginState(authType, hasSession, backgroundStatus);
      setIsLoggedIn(loginState.isLoggedIn);
      setProviderConnectionReason(loginState.reason);
      setProviderConnectionFailureStatus(null);

      if (authType === 'browserSession' && loginState.sessionExpired) {
        preserveStatusRef.current = true;
        setStatusAndNotify(translatedStatus('status.sessionExpired'));
      } else if (authType === 'browserSession' && backgroundStatus?.error) {
        presentBrowserProviderRequestFailure(backgroundStatus.error);
      } else if (authType === 'browserSession' && backgroundStatus?.ready) {
        preserveStatusRef.current = false;
        setStatus(clearRecoveredBrowserFailureStatus);
      }

      return loginState;
    },
    [presentBrowserProviderRequestFailure, setStatusAndNotify],
  );

  const applyProviderLoginStateRef = useRef(applyProviderLoginState);
  useEffect(() => {
    applyProviderLoginStateRef.current = applyProviderLoginState;
  }, [applyProviderLoginState]);

  const handleProviderSelectionEvent = useEffectEvent((event: ProviderSelectionEvent): void => {
    switch (event.type) {
      case 'bootstrap-completed':
        setIsInitialVoiceProviderLoading(false);
        setProviders(event.providers);
        if (event.providerId === null || event.authType === null) {
          activeProviderIdRef.current = null;
          activeProviderAuthTypeRef.current = null;
          setActiveProviderId(null);
          setIsLoggedIn(false);
          setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.SessionMissing);
          setProviderConnectionFailureStatus(null);
          return;
        }
        activeProviderIdRef.current = event.providerId;
        activeProviderAuthTypeRef.current = event.authType;
        setActiveProviderId(event.providerId);
        applyProviderLoginState(event.authType, event.runtime.hasSession, event.runtime.backgroundStatus);
        return;
      case 'bootstrap-failed': {
        setIsInitialVoiceProviderLoading(false);
        applyBrowserProviderFailure(event.error);
        return;
      }
      case 'switch-started':
        recordingActionsRef.current.cancelStreamingForProviderChange();
        setIsLoggingIn(false);
        setIsVoiceProviderSwitching(true);
        setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.Checking);
        setProviderConnectionFailureStatus(null);
        return;
      case 'switch-completed': {
        if (event.result.success) {
          if (event.result.committedProviderId === null) return;
          activeProviderIdRef.current = event.result.committedProviderId;
          activeProviderAuthTypeRef.current = event.authType;
          setActiveProviderId(event.result.committedProviderId);
          applyProviderLoginState(event.authType, event.runtime.hasSession, event.runtime.backgroundStatus);
          return;
        }
        if (event.result.committedProviderId === null) {
          activeProviderIdRef.current = null;
          activeProviderAuthTypeRef.current = null;
          setActiveProviderId(null);
          setIsLoggedIn(false);
          setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.SessionMissing);
          setProviderConnectionFailureStatus(null);
          return;
        }
        const committedProvider = providers.find((provider) => provider.id === event.result.committedProviderId);
        const committedAuthType = committedProvider?.authType ?? activeProviderAuthTypeRef.current;
        if (committedAuthType === null) return;
        activeProviderIdRef.current = event.result.committedProviderId;
        activeProviderAuthTypeRef.current = committedAuthType;
        setActiveProviderId(event.result.committedProviderId);
        applyProviderLoginState(committedAuthType, event.runtime.hasSession, event.runtime.backgroundStatus);
        return;
      }
      case 'switch-failed': {
        if (event.committedProviderId === null) {
          activeProviderIdRef.current = null;
          activeProviderAuthTypeRef.current = null;
          setActiveProviderId(null);
          setIsLoggedIn(false);
          setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.SessionMissing);
          setProviderConnectionFailureStatus(null);
          return;
        }
        if (event.committedProviderId && event.runtime) {
          const committedProvider = providers.find((provider) => provider.id === event.committedProviderId);
          const committedAuthType = committedProvider?.authType ?? activeProviderAuthTypeRef.current;
          if (committedAuthType === null) return;
          activeProviderIdRef.current = event.committedProviderId;
          activeProviderAuthTypeRef.current = committedAuthType;
          setActiveProviderId(event.committedProviderId);
          applyProviderLoginState(committedAuthType, event.runtime.hasSession, event.runtime.backgroundStatus);
          return;
        }
        if (activeProviderAuthTypeRef.current === 'localRuntime') {
          setProviderConnectionReason(
            isLoggedIn
              ? PROVIDER_CONNECTION_REASONS.LocalRuntimeReady
              : PROVIDER_CONNECTION_REASONS.LocalRuntimeNotReady,
          );
          setProviderConnectionFailureStatus(null);
          return;
        }
        applyBrowserProviderFailure(event.error);
        return;
      }
      case 'switch-settled':
        setIsVoiceProviderSwitching(false);
        return;
    }
  });

  useEffect(() => {
    if (!isI18nReady) {
      return undefined;
    }

    let disposed = false;
    const providerSelectionCoordinator = createProviderSelectionCoordinator({
      emit: (event) => {
        if (!disposed) handleProviderSelectionEvent(event);
      },
      getActiveProvider: () => desktopApi.getActiveProvider(),
      getProviders: () => desktopApi.getProviders(),
      getRuntimeState: async () => {
        const [hasSession, backgroundStatus] = await Promise.all([
          desktopApi.checkSession(),
          desktopApi.getBgBrowserStatus(),
        ]);
        return { backgroundStatus, hasSession };
      },
      setActiveProvider: (providerId) => desktopApi.setActiveProvider(providerId),
    });
    providerSelectionCoordinatorRef.current = providerSelectionCoordinator;
    const subscriptions = [
      desktopApi.onToggleRecording((recording: boolean) => {
        if (disposed) return;
        if (recording && activeProviderIdRef.current !== null) void recordingActionsRef.current.startRecording();
      }),
      desktopApi.onStopRecording(() => {
        if (disposed) return;
        recordingActionsRef.current.stopRecording();
      }),
      desktopApi.onPauseRecording(() => {
        if (!disposed) recordingActionsRef.current.pauseRecording();
      }),
      desktopApi.onResumeRecording(() => {
        if (!disposed) recordingActionsRef.current.resumeRecording();
      }),
      desktopApi.onCancelRecording(() => {
        if (!disposed) recordingActionsRef.current.cancelRecording();
      }),
      desktopApi.onRetryTranscription(() => {
        if (!disposed) void recordingActionsRef.current.resendLastTranscription();
      }),
      desktopApi.onTranslationStatus((nextStatus) => {
        if (disposed) return;
        if (nextStatus) {
          setActiveTextAction((current) => {
            if (nextStatus.phase === 'working') return nextStatus.action;
            return current === nextStatus.action ? null : current;
          });
        }
        setStatus(textActionStatusToRendererStatus(nextStatus));
      }),
      desktopApi.onTranslationProviderConnectionChanged((connectionState) => {
        if (disposed) return;
        if (!doesTranslationConnectionMatchSettings(connectionState, translationSettingsRef.current)) return;
        translationConnectionRequestRef.current += 1;
        setTranslationConnectionState(connectionState);
      }),
      desktopApi.onBgBrowserReady((providerId) => {
        if (
          disposed ||
          providerId !== activeProviderIdRef.current ||
          activeProviderAuthTypeRef.current !== 'browserSession'
        ) {
          return;
        }
        preserveStatusRef.current = false;
        setIsLoggedIn(true);
        setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.BrowserReady);
        setProviderConnectionFailureStatus(null);
        setStatus(clearRecoveredBrowserFailureStatus);
      }),
      desktopApi.onBgBrowserError((providerId, error, authExpired) => {
        if (
          disposed ||
          providerId !== activeProviderIdRef.current ||
          activeProviderAuthTypeRef.current !== 'browserSession'
        ) {
          return;
        }
        if (authExpired) {
          applyProviderLoginStateRef.current('browserSession', false, { ready: false, error, authExpired: true });
          return;
        }
        // The background-browser event is synchronous; refresh its session state without delaying the event callback.
        void desktopApi
          .checkSession()
          .then((hasSession) => {
            if (
              !disposed &&
              providerId === activeProviderIdRef.current &&
              activeProviderAuthTypeRef.current === 'browserSession'
            ) {
              applyProviderLoginStateRef.current('browserSession', hasSession, { ready: false, error });
            }
          })
          .catch(() => {
            if (
              !disposed &&
              providerId === activeProviderIdRef.current &&
              activeProviderAuthTypeRef.current === 'browserSession'
            ) {
              applyProviderLoginStateRef.current('browserSession', false, { ready: false, error });
            }
          });
      }),
    ];

    void providerSelectionCoordinator.bootstrap();

    const translationSettingsRequestId = ++translationSettingsRequestRef.current;
    void desktopApi
      .getTranslateSettings()
      .then((settings) => {
        if (disposed || translationSettingsRequestId !== translationSettingsRequestRef.current) return;
        dispatchTranslationSettingsSelection({ settings, type: 'snapshot' });
        setHasLoadedInitialTranslationSettings(true);
      })
      .catch(() => {
        if (disposed || translationSettingsRequestId !== translationSettingsRequestRef.current) return;
        setHasLoadedInitialTranslationSettings(true);
        setTranslationConnectionState(FAILED_INITIAL_TRANSLATION_CONNECTION_STATE);
      });

    const translationConnectionRequestId = ++translationConnectionRequestRef.current;
    void desktopApi
      .getTranslationProviderConnection()
      .then((connectionState) => {
        if (disposed || translationConnectionRequestId !== translationConnectionRequestRef.current) return;
        setTranslationConnectionState(connectionState);
      })
      .catch(() => {
        if (disposed || translationConnectionRequestId !== translationConnectionRequestRef.current) return;
        setTranslationConnectionState(FAILED_INITIAL_TRANSLATION_CONNECTION_STATE);
      });

    return () => {
      disposed = true;
      translationSettingsRequestRef.current += 1;
      translationConnectionRequestRef.current += 1;
      translationSettingsSavePendingRef.current = false;
      providerSelectionCoordinator.dispose();
      if (providerSelectionCoordinatorRef.current === providerSelectionCoordinator) {
        providerSelectionCoordinatorRef.current = null;
      }
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    };
  }, [desktopApi, isI18nReady]);

  const applyProviderSettingsSnapshot = useCallback(
    (settings: ProviderSettings): void => {
      if (settings.authType === 'browserSession') {
        setProviderConnectionFailureStatus(null);
        if (!settings.hasSession) {
          setIsLoggedIn(false);
          setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.SessionMissing);
          preserveStatusRef.current = true;
          setStatusAndNotify(translatedStatus('status.providerNotConfigured', { provider: activeProviderName }));
        }
        return;
      }

      const configured = isProviderConfigured(settings);
      setIsLoggedIn(configured);
      setProviderConnectionReason(
        configured ? PROVIDER_CONNECTION_REASONS.ApiConfigured : PROVIDER_CONNECTION_REASONS.ApiNotConfigured,
      );
      setProviderConnectionFailureStatus(null);
      if (configured) {
        preserveStatusRef.current = false;
        setStatusAndNotify(translatedStatus('status.providerConfigured', { provider: activeProviderName }));
      } else {
        preserveStatusRef.current = true;
        setStatusAndNotify(translatedStatus('status.providerNotConfigured', { provider: activeProviderName }));
      }
    },
    [activeProviderName, setStatusAndNotify],
  );

  useEffect(() => {
    activeProviderIdRef.current = activeProviderId;
    return desktopApi.onProviderSettingsChanged((settings) => {
      if (activeProviderId && isActiveProviderSettingsChange(settings, activeProviderId)) {
        applyProviderSettingsSnapshot(settings);
      }
    });
  }, [activeProviderId, applyProviderSettingsSnapshot, desktopApi]);

  const openProviderSettings = async (providerId: string): Promise<void> => {
    if (isProviderChangesLocked || isRecordingLifecycleBusy(recordingStateRef.current)) return;
    try {
      const result = await desktopApi.openProviderSettings(providerId);
      if (!result.success) {
        setStatus(
          result.error
            ? notificationErrorStatus(presentNotificationError(result.error, { context: 'generic' }))
            : translatedStatus('error.notificationUnknown'),
        );
      }
    } catch {
      setStatus(translatedStatus('error.notificationUnknown'));
    }
  };

  const handleLogin = async (): Promise<void> => {
    const providerId = activeProviderId;
    const providerName = activeProviderName;
    if (
      isProviderChangesLocked ||
      isRecordingLifecycleBusy(recordingStateRef.current) ||
      !providerId ||
      !activeProviderAuthType
    ) {
      return;
    }
    if (activeProviderAuthType === 'apiKey') {
      await openProviderSettings(providerId);
      return;
    }

    setIsLoggingIn(true);
    setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.Checking);
    setProviderConnectionFailureStatus(null);
    preserveStatusRef.current = false;
    setStatus(translatedStatus('status.loggingIn', { provider: providerName }));
    try {
      const result = await desktopApi.providerLogin(providerId);
      if (activeProviderIdRef.current !== providerId) return;
      if (result.success) {
        setIsLoggedIn(true);
        setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.BrowserReady);
        setStatusAndNotify(translatedStatus('status.loggedIn', { provider: providerName }));
      } else {
        setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.BrowserUnavailable);
        preserveStatusRef.current = true;
        const presented = presentNotificationError(result.error, {
          context: 'generic',
        });
        const failureStatus = translatedStatus('status.loginFailed', { error: notificationErrorStatus(presented) });
        setProviderConnectionFailureStatus(failureStatus);
        setStatusAndNotify(failureStatus);
      }
    } catch (error: unknown) {
      if (activeProviderIdRef.current !== providerId) return;
      setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.BrowserUnavailable);
      preserveStatusRef.current = true;
      const presented = presentNotificationError(error, {
        context: 'generic',
      });
      const failureStatus = translatedStatus('status.loginFailed', { error: notificationErrorStatus(presented) });
      setProviderConnectionFailureStatus(failureStatus);
      setStatusAndNotify(failureStatus);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleProviderChange = (providerId: string): void => {
    if (isProviderChangesLocked) return;
    const authType = providers.find((provider) => provider.id === providerId)?.authType ?? 'browserSession';
    void providerSelectionCoordinatorRef.current?.switchProvider(providerId, authType);
  };

  const openAppSettingsWindow = useCallback(
    (section?: 'prettify'): void => {
      if (isProviderChangesLocked) return;
      void desktopApi
        .openAppSettings(section)
        .then((result) => {
          if (!result.success) {
            setStatus(
              result.error
                ? notificationErrorStatus(presentNotificationError(result.error, { context: 'generic' }))
                : translatedStatus('error.notificationUnknown'),
            );
          }
        })
        .catch(() => {
          setStatus(translatedStatus('error.notificationUnknown'));
        });
    },
    [desktopApi, isProviderChangesLocked],
  );

  const openHistoryWindow = useCallback((): void => {
    void desktopApi.openTranscriptionHistory().catch(() => {
      setStatus(translatedStatus('error.notificationUnknown'));
    });
  }, [desktopApi]);

  const openAboutWindow = useCallback((): void => {
    void desktopApi.openAbout().catch(() => {
      setStatus(translatedStatus('error.notificationUnknown'));
    });
  }, [desktopApi]);

  const saveTranslationSettings = async (candidate: TranslationSettings): Promise<void> => {
    if (translationSettingsSavePendingRef.current) return;
    translationSettingsSavePendingRef.current = true;

    const requestId = ++translationSettingsRequestRef.current;
    const previousSettings = translationSettingsRef.current;
    const fallbackError = t('translate.settingsSaveFailed');
    translationSettingsRef.current = candidate;
    dispatchTranslationSettingsSelection({
      candidate,
      requestId,
      type: 'save-started',
    });

    try {
      const result = await desktopApi.setTranslateSettings(candidate);
      if (requestId !== translationSettingsRequestRef.current) return;
      if (result.success) {
        const connectionRequestId = translationConnectionRequestRef.current;
        try {
          const connectionState = await desktopApi.getTranslationProviderConnection();
          if (requestId !== translationSettingsRequestRef.current) return;
          if (connectionRequestId === translationConnectionRequestRef.current) {
            setTranslationConnectionState(
              doesTranslationConnectionMatchSettings(connectionState, candidate)
                ? connectionState
                : FAILED_INITIAL_TRANSLATION_CONNECTION_STATE,
            );
          }
        } catch {
          if (requestId !== translationSettingsRequestRef.current) return;
          if (connectionRequestId === translationConnectionRequestRef.current) {
            setTranslationConnectionState(FAILED_INITIAL_TRANSLATION_CONNECTION_STATE);
          }
        }
      }
      if (requestId !== translationSettingsRequestRef.current) return;
      translationSettingsSavePendingRef.current = false;
      if (!result.success) translationSettingsRef.current = previousSettings;
      dispatchTranslationSettingsSelection({
        error: fallbackError,
        requestId,
        result,
        type: 'save-completed',
      });
    } catch {
      if (requestId !== translationSettingsRequestRef.current) return;
      translationSettingsSavePendingRef.current = false;
      translationSettingsRef.current = previousSettings;
      dispatchTranslationSettingsSelection({
        error: fallbackError,
        requestId,
        type: 'save-failed',
      });
    }
  };

  if (!isI18nReady) {
    return (
      <LoadingScreen
        hasRetryableFailure={firstLaunchStartupPresentation.hasRetryableFailure}
        isRetryPending={isFirstLaunchRetryPending}
        mode="startup"
        onRetry={() => void retryFirstLaunchStartup()}
        progress={firstLaunchStartupPresentation.progress}
        retryFailed={didFirstLaunchRetryFail}
        stages={firstLaunchStartupPresentation.stages}
      />
    );
  }

  const isMainScreenMounted =
    startupRevealPhase === 'prepared' || startupRevealPhase === 'revealing' || startupRevealPhase === 'revealed';
  const isMainScreenAccessible = startupRevealPhase === 'revealing' || startupRevealPhase === 'revealed';
  const isMainScreenInteractive = startupRevealPhase === 'revealed';
  const isStartupLoaderVisible = startupRevealPhase !== 'revealed';

  return (
    <div className="main-startup-reveal" data-startup-reveal-state={startupRevealPhase}>
      {isMainScreenMounted && (
        <main
          aria-disabled={providerHotkeyIntegration.isMainInteractionLocked}
          aria-hidden={!isMainScreenAccessible || undefined}
          className="command-dock"
          data-slot="main-window"
          inert={providerHotkeyIntegration.isMainInteractionLocked || !isMainScreenInteractive}
        >
          <MainToolbar
            actionControl={
              <HotkeyActionButton
                actionLabel={providerHotkeyIntegration.voiceActionLabel}
                active={providerHotkeyIntegration.presentation.activeOwner === 'voice'}
                hotkey={providerHotkeyIntegration.recordHotkey}
                locked={providerHotkeyIntegration.presentation.eligibility.voice.locked}
                onActivate={providerHotkeyIntegration.activateVoice}
              />
            }
            activeProviderAuthType={activeProviderAuthType}
            activeProviderId={activeProviderId}
            activeProviderHasSettings={Boolean(activeProvider?.hasSettings)}
            activeProviderName={activeProviderName}
            isLoggedIn={isLoggedIn}
            isLoggingIn={isLoggingIn}
            isProviderChangesLocked={isProviderChangesLocked}
            isVoiceProviderSwitching={isVoiceProviderSwitching}
            localWhisperStatus={localWhisperMain.snapshot}
            localWhisperPendingAction={localWhisperMain.pendingAction}
            localWhisperResidencyFailure={localWhisperMain.failure}
            localWhisperResidencyFailureSequence={localWhisperMain.failureSequence}
            providerConnectionFailureTooltip={
              providerConnectionFailureStatus ? renderRendererStatus(providerConnectionFailureStatus, t) : ''
            }
            providerConnectionReason={providerConnectionReason}
            onOpenAbout={openAboutWindow}
            onOpenAppSettings={() => openAppSettingsWindow()}
            onOpenHistory={openHistoryWindow}
            onOpenProviderSettings={() => {
              if (activeProviderId) void openProviderSettings(activeProviderId);
            }}
            onLocalWhisperResidencyAction={(action) => {
              if (!isProviderChangesLocked) void localWhisperMain.runResidencyAction(action);
            }}
            onProviderChange={(providerId) => void handleProviderChange(providerId)}
            onProviderLogin={() => void handleLogin()}
            providers={providers}
          />
          <MainPrettifyProviderBand
            actionControl={
              <HotkeyActionButton
                actionLabel={t('prettify.provider')}
                active={providerHotkeyIntegration.presentation.activeOwner === 'prettify'}
                busy={providerHotkeyIntegration.pendingProviderHomeAction === 'prettify'}
                hotkey={providerHotkeyIntegration.prettifyHotkey}
                locked={providerHotkeyIntegration.presentation.eligibility.prettify.locked}
                onActivate={providerHotkeyIntegration.activatePrettify}
              />
            }
            cliConnection={mainPrettifyProvider.cliConnection}
            connectionError={mainPrettifyProvider.connectionError}
            error={mainPrettifyProvider.error}
            httpConnection={mainPrettifyProvider.httpConnection}
            isModelActionRunning={mainPrettifyProvider.isModelActionRunning}
            isProviderChangesLocked={isProviderChangesLocked}
            isProviderChangeSaving={isPrettifyProviderSwitching}
            ollamaModels={mainPrettifyProvider.ollamaModels}
            onModelAction={() => void mainPrettifyProvider.onModelAction()}
            onOpenSettings={() => openAppSettingsWindow('prettify')}
            onProviderChange={(providerId) => void mainPrettifyProvider.onProviderChange(providerId)}
            settings={prettifySettings}
          />
          <TranslateSection
            actionControl={
              <HotkeyActionButton
                actionLabel={t('translate.provider')}
                active={providerHotkeyIntegration.presentation.activeOwner === 'translation'}
                busy={providerHotkeyIntegration.pendingProviderHomeAction === 'translation'}
                hotkey={providerHotkeyIntegration.translateHotkey}
                locked={providerHotkeyIntegration.presentation.eligibility.translation.locked}
                onActivate={providerHotkeyIntegration.activateTranslation}
              />
            }
            connectionState={translationConnectionState}
            error={translationSettingsSelection.error}
            isProviderChangesLocked={isProviderChangesLocked}
            isProviderChangeSaving={isTranslationProviderSwitching}
            isSaving={translationSettingsSelection.pendingRequestId !== null}
            onProviderChange={(providerId) => {
              if (isProviderChangesLocked) return;
              const candidate = createTranslationProviderCandidate(
                translationSettingsSelection.confirmedSettings,
                providerId,
              );
              void saveTranslationSettings(candidate);
            }}
            onTargetLanguageChange={(targetLanguage) => {
              if (isProviderChangesLocked) return;
              const candidate = createTranslationSettingsCandidate(
                translationSettingsSelection.confirmedSettings,
                targetLanguage,
              );
              void saveTranslationSettings(candidate);
            }}
            settings={translationSettings}
          />
          <RecordingControls
            contextualActions={providerHotkeyIntegration.contextualActions}
            state={recordingState}
            status={status}
          />
        </main>
      )}
      {isStartupLoaderVisible && (
        <div
          aria-hidden={startupRevealPhase === 'revealing' || undefined}
          className="main-startup-loader-overlay"
          data-slot="main-startup-loader-overlay"
        >
          <LoadingScreen
            hasRetryableFailure={firstLaunchStartupPresentation.hasRetryableFailure}
            isComplete={!firstLaunchStartupPresentation.isPending}
            isRetryPending={isFirstLaunchRetryPending}
            mode="startup"
            onRetry={() => void retryFirstLaunchStartup()}
            progress={firstLaunchStartupPresentation.progress}
            retryFailed={didFirstLaunchRetryFail}
            stages={firstLaunchStartupPresentation.stages}
          />
        </div>
      )}
    </div>
  );
};

export default App;
