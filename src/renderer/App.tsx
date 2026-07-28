import React, { useState, useEffect, useEffectEvent, useRef, useCallback, useReducer } from 'react';
import { useDesktopApi } from './DesktopApiProvider';
import LoadingScreen from './components/LoadingScreen';
import MainToolbar from './components/MainToolbar';
import MainPrettifyProviderBand from './components/MainPrettifyProviderBand';
import RecordingControls from './components/RecordingControls';
import TranslateSection from './components/TranslateSection';
import { useWindowStartupReady } from './WindowStartupGate';
import { useRecording } from './hooks/useRecording';
import { useI18n } from './hooks/useI18n';
import { getOllamaModelControl } from './prettifyModelControl';
import {
  MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES,
  reduceMainPrettifyProviderSelection,
  type MainPrettifyHttpConnectionState,
} from './mainPrettifyProvider';
import {
  createMainPrettifyCliConnectionCoordinator,
  getActivePrettifyCliProviderId,
  type MainPrettifyCliConnectionState,
} from './mainPrettifyCliConnection';
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
  notificationErrorStatus,
  renderRendererStatus,
  shouldPresentIdleHotkeyStatus,
  textActionStatusToRendererStatus,
  translatedStatus,
  type RendererStatus,
} from './statusPresentation';
import type { BackgroundBrowserStatus, ProviderAuthType, ProviderInfo, ProviderSettings } from './types';
import { presentNotificationError } from '@shared/notifications';
import {
  DEFAULT_PRETTIFY_PROVIDER_ID,
  DEFAULT_PRETTIFY_SETTINGS,
  isPrettifyCliProviderId,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';
import {
  DEFAULT_TRANSLATION_SETTINGS,
  type TranslationProviderConnectionState,
  type TranslationSettings,
} from '@shared/translationProvider';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import {
  createTranslationProviderCandidate,
  createTranslationSettingsCandidate,
  createTranslationSettingsViewState,
  reduceTranslationSettingsViewState,
} from './translationSettingsViewState';
import { FAILED_INITIAL_TRANSLATION_CONNECTION_STATE, isInitialProviderStartupPending } from './providerStartupState';

/** Coordinates the main recording lifecycle, provider state, notifications, and IPC subscriptions. */
const App: React.FC = () => {
  const desktopApi = useDesktopApi();
  const [isLoading, setIsLoading] = useState(true);
  const [recordingState, setRecordingState] = useState<RecordingLifecycleState>('idle');
  const [status, setStatus] = useState<RendererStatus | null>(null);
  const [recordHotkey, setRecordHotkey] = useState('F9');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
  const [activeProviderId, setActiveProviderId] = useState('chatgpt');
  const [prettifyProviderSelection, dispatchPrettifyProviderSelection] = useReducer(
    reduceMainPrettifyProviderSelection,
    {
      error: '',
      pendingRequestId: null,
      settings: DEFAULT_PRETTIFY_SETTINGS,
    },
  );
  const prettifySettings = prettifyProviderSelection.settings;
  const [ollamaModelOptions, setOllamaModelOptions] = useState<PrettifyModelOption[]>([]);
  const [isPrettifyModelActionRunning, setIsPrettifyModelActionRunning] = useState(false);
  const [prettifyModelActionError, setPrettifyModelActionError] = useState('');
  const [prettifyConnectionError, setPrettifyConnectionError] = useState('');
  const [prettifyHttpConnection, setPrettifyHttpConnection] = useState<MainPrettifyHttpConnectionState | null>(null);
  const [prettifyCliConnection, setPrettifyCliConnection] = useState<MainPrettifyCliConnectionState | null>(null);
  const [hasLoadedInitialPrettifySettings, setHasLoadedInitialPrettifySettings] = useState(false);
  const [isInitialPrettifyProviderLoading, setIsInitialPrettifyProviderLoading] = useState(true);
  const [prettifyCliConnectionCoordinator] = useState(() =>
    createMainPrettifyCliConnectionCoordinator({
      check: (providerId) => desktopApi.checkPrettifyCliConnection(providerId),
      update: (connection) => {
        setPrettifyCliConnection(connection);
        if (connection !== null && connection.status !== 'checking') {
          setIsInitialPrettifyProviderLoading(false);
        }
      },
    }),
  );

  const { t, isReady: isI18nReady } = useI18n();
  const activeProvider = providers.find((provider) => provider.id === activeProviderId);
  const activeProviderName = activeProvider?.name || activeProviderId;
  const activeProviderAuthType = activeProvider?.authType || 'browserSession';
  const activeProviderTranscriptionMode = activeProvider?.transcriptionMode || 'batch';
  const providerStartupPending = isInitialProviderStartupPending({
    prettifyPending: isInitialPrettifyProviderLoading,
    translationConnection: translationConnectionState,
    translationSettingsPending: !hasLoadedInitialTranslationSettings,
    voicePending: isLoading,
  });

  useWindowStartupReady(isI18nReady && !providerStartupPending);

  const preserveStatusRef = useRef(false);
  const recordingStateRef = useRef<RecordingLifecycleState>('idle');
  const activeProviderIdRef = useRef(activeProviderId);
  const activeProviderAuthTypeRef = useRef<ProviderAuthType>('browserSession');
  const providerSelectionCoordinatorRef = useRef<ProviderSelectionCoordinator | null>(null);
  const prettifyModelRefreshIdRef = useRef(0);
  const prettifyProviderChangeRequestRef = useRef(0);
  const translationSettingsRequestRef = useRef(0);
  const translationSettingsSavePendingRef = useRef(false);
  const translationConnectionRequestRef = useRef(0);

  const updateRecordingState = useCallback((nextState: RecordingLifecycleState): void => {
    recordingStateRef.current = nextState;
    setRecordingState(nextState);
  }, []);

  useEffect(() => {
    if (!hasLoadedInitialPrettifySettings) return;
    prettifyCliConnectionCoordinator.refresh(
      getActivePrettifyCliProviderId(prettifySettings.providerId, prettifyProviderSelection.pendingRequestId !== null),
    );
  }, [
    hasLoadedInitialPrettifySettings,
    prettifySettings.providerId,
    prettifySettings.claudeCli.executablePath,
    prettifySettings.claudeCli.timeoutSeconds,
    prettifySettings.codexCli.executablePath,
    prettifySettings.codexCli.timeoutSeconds,
    prettifyProviderSelection.pendingRequestId,
    prettifyCliConnectionCoordinator,
  ]);

  useEffect(
    () => () => {
      prettifyCliConnectionCoordinator.dispose();
    },
    [prettifyCliConnectionCoordinator],
  );

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

  const refreshPrettifyProviderState = useCallback(
    async (settings: PrettifySettings): Promise<void> => {
      const refreshId = ++prettifyModelRefreshIdRef.current;
      dispatchPrettifyProviderSelection({ settings, type: 'snapshot' });
      setIsPrettifyModelActionRunning(false);
      setPrettifyModelActionError('');
      setPrettifyConnectionError('');

      if (isPrettifyCliProviderId(settings.providerId)) {
        setOllamaModelOptions([]);
        setPrettifyHttpConnection(null);
        return;
      }

      const providerId = settings.providerId;
      setPrettifyHttpConnection({
        providerId,
        status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Checking,
      });
      try {
        const result = await desktopApi.listPrettifyModels(providerId, settings);
        if (refreshId === prettifyModelRefreshIdRef.current) {
          setOllamaModelOptions(providerId === 'ollama' && result.success ? result.models : []);
          setPrettifyHttpConnection({
            providerId,
            status: result.success
              ? MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Connected
              : MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected,
          });
          setPrettifyConnectionError(
            result.success
              ? ''
              : presentNotificationError(result.error, {
                  context: 'generic',
                }).userMessage,
          );
        }
      } catch {
        if (refreshId === prettifyModelRefreshIdRef.current) {
          setOllamaModelOptions([]);
          setPrettifyHttpConnection({
            providerId,
            status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected,
          });
          setPrettifyConnectionError(t('error.notificationUnknown'));
        }
      }
    },
    [desktopApi, t],
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

  useEffect(() => {
    let disposed = false;
    const refresh = async (settings: PrettifySettings, initial: boolean): Promise<void> => {
      if (disposed) return;
      if (initial) {
        setHasLoadedInitialPrettifySettings(true);
      }
      await refreshPrettifyProviderState(settings);
      if (initial && !disposed && !isPrettifyCliProviderId(settings.providerId)) {
        setIsInitialPrettifyProviderLoading(false);
      }
    };

    void desktopApi
      .getPrettifySettings()
      .then((settings) => refresh(settings, true))
      .catch(() => {
        if (disposed) return;
        setHasLoadedInitialPrettifySettings(true);
        if (isPrettifyCliProviderId(DEFAULT_PRETTIFY_PROVIDER_ID)) {
          setPrettifyCliConnection({
            errorCode: 'process-failed',
            providerId: DEFAULT_PRETTIFY_PROVIDER_ID,
            status: 'unavailable',
          });
        } else {
          setPrettifyHttpConnection({
            providerId: DEFAULT_PRETTIFY_PROVIDER_ID,
            status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected,
          });
        }
        setPrettifyConnectionError(t('error.notificationUnknown'));
        setIsInitialPrettifyProviderLoading(false);
      });
    const unsubscribe = desktopApi.onPrettifySettingsChanged((settings) => {
      void refresh(settings, false);
    });

    return () => {
      disposed = true;
      prettifyProviderChangeRequestRef.current += 1;
      unsubscribe();
    };
  }, [desktopApi, refreshPrettifyProviderState, t]);

  const applyProviderLoginState = useCallback(
    (
      authType: ProviderAuthType,
      hasSession: boolean,
      backgroundStatus?: BackgroundBrowserStatus,
    ): ProviderLoginState => {
      const loginState = getProviderLoginState(authType, hasSession, backgroundStatus);
      setIsLoggedIn(loginState.isLoggedIn);
      setIsLoading(loginState.isLoading);
      setProviderConnectionReason(loginState.reason);
      setProviderConnectionFailureStatus(null);

      if (authType === 'browserSession' && loginState.sessionExpired) {
        preserveStatusRef.current = true;
        setStatusAndNotify(translatedStatus('status.sessionExpired'));
      } else if (authType === 'browserSession' && backgroundStatus?.error) {
        preserveStatusRef.current = true;
        const failureStatus = translatedStatus('status.browserInitFailed', {
          error: notificationErrorStatus(presentNotificationError(backgroundStatus.error, { context: 'generic' })),
        });
        setProviderConnectionFailureStatus(failureStatus);
        setStatusAndNotify(failureStatus);
      } else if (authType === 'browserSession' && backgroundStatus?.ready) {
        preserveStatusRef.current = false;
      }

      return loginState;
    },
    [setStatusAndNotify],
  );

  const applyProviderLoginStateRef = useRef(applyProviderLoginState);
  useEffect(() => {
    applyProviderLoginStateRef.current = applyProviderLoginState;
  }, [applyProviderLoginState]);

  const handleProviderSelectionEvent = useEffectEvent((event: ProviderSelectionEvent): void => {
    switch (event.type) {
      case 'bootstrap-completed':
        activeProviderIdRef.current = event.providerId;
        activeProviderAuthTypeRef.current = event.authType;
        setProviders(event.providers);
        setActiveProviderId(event.providerId);
        applyProviderLoginState(event.authType, event.runtime.hasSession, event.runtime.backgroundStatus);
        return;
      case 'bootstrap-failed': {
        setIsLoading(false);
        preserveStatusRef.current = true;
        const presented = presentNotificationError(event.error, {
          context: 'generic',
        });
        setStatusAndNotify(translatedStatus('status.browserInitFailed', { error: notificationErrorStatus(presented) }));
        return;
      }
      case 'switch-started':
        recordingActionsRef.current.cancelStreamingForProviderChange();
        activeProviderIdRef.current = event.providerId;
        activeProviderAuthTypeRef.current = event.authType;
        setActiveProviderId(event.providerId);
        setIsLoggingIn(false);
        setIsLoading(true);
        setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.Checking);
        setProviderConnectionFailureStatus(null);
        return;
      case 'switch-completed': {
        const loginState = applyProviderLoginState(
          event.authType,
          event.runtime.hasSession,
          event.runtime.backgroundStatus,
        );
        if (!loginState.sessionExpired && !event.result.success && event.result.error) {
          preserveStatusRef.current = true;
          const presented = presentNotificationError(event.result.error, { context: 'generic' });
          setStatusAndNotify(
            translatedStatus('status.browserInitFailed', { error: notificationErrorStatus(presented) }),
          );
        }
        return;
      }
      case 'switch-failed': {
        preserveStatusRef.current = true;
        const presented = presentNotificationError(event.error, {
          context: 'generic',
        });
        setStatusAndNotify(translatedStatus('status.browserInitFailed', { error: notificationErrorStatus(presented) }));
        return;
      }
      case 'switch-settled':
        setIsLoading(false);
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
        if (recording) void recordingActionsRef.current.startRecording();
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
        if (!disposed) setStatus(textActionStatusToRendererStatus(nextStatus));
      }),
      desktopApi.onTranslationProviderConnectionChanged((connectionState) => {
        if (disposed) return;
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
        setIsLoading(false);
        setProviderConnectionReason(PROVIDER_CONNECTION_REASONS.BrowserReady);
        setProviderConnectionFailureStatus(null);
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
      desktopApi.onHotkeySettingsChanged((settings) => {
        if (disposed) return;
        setRecordHotkey(settings.hotkey);
        if (shouldPresentIdleHotkeyStatus(recordingStateRef.current, preserveStatusRef.current)) {
          setStatus(translatedStatus('status.pressToRecord', { hotkey: settings.hotkey }));
        }
      }),
    ];

    void providerSelectionCoordinator.bootstrap();

    void desktopApi.getHotkey().then(({ hotkey: hk }) => {
      if (disposed) return;
      setRecordHotkey(hk);
      if (shouldPresentIdleHotkeyStatus(recordingStateRef.current, preserveStatusRef.current)) {
        setStatus(translatedStatus('status.pressToRecord', { hotkey: hk }));
      }
    });

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
        setIsLoading(false);
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
      setIsLoading(false);
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
      if (isActiveProviderSettingsChange(settings, activeProviderId)) applyProviderSettingsSnapshot(settings);
    });
  }, [activeProviderId, applyProviderSettingsSnapshot, desktopApi]);

  const openProviderSettings = async (providerId: string): Promise<void> => {
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
    const authType = providers.find((provider) => provider.id === providerId)?.authType ?? 'browserSession';
    void providerSelectionCoordinatorRef.current?.switchProvider(providerId, authType);
  };

  const ollamaModelControl = getOllamaModelControl(prettifySettings, ollamaModelOptions);

  const handlePrettifyProviderChange = async (providerId: PrettifyProviderId): Promise<void> => {
    if (providerId === prettifySettings.providerId || prettifyProviderSelection.pendingRequestId !== null) {
      return;
    }

    const requestId = ++prettifyProviderChangeRequestRef.current;
    const previousSettings = prettifySettings;
    dispatchPrettifyProviderSelection({ providerId, requestId, type: 'begin' });
    setIsPrettifyModelActionRunning(false);
    setPrettifyModelActionError('');

    try {
      const result = await desktopApi.setPrettifySettings({ providerId });
      if (requestId !== prettifyProviderChangeRequestRef.current) return;
      dispatchPrettifyProviderSelection(
        result.success
          ? { requestId, settings: result.settings, type: 'resolved' }
          : {
              error: t('mainDock.prettifySaveFailed'),
              requestId,
              settings: result.settings,
              type: 'rejected',
            },
      );
    } catch {
      if (requestId !== prettifyProviderChangeRequestRef.current) return;
      dispatchPrettifyProviderSelection({
        error: t('mainDock.prettifySaveFailed'),
        requestId,
        settings: previousSettings,
        type: 'rejected',
      });
    }
  };

  const handleOllamaModelAction = async (): Promise<void> => {
    if (!prettifySettings || !ollamaModelControl || isPrettifyModelActionRunning) {
      return;
    }

    const refreshId = prettifyModelRefreshIdRef.current;
    const { model, isLoaded } = ollamaModelControl;
    setIsPrettifyModelActionRunning(true);
    setPrettifyModelActionError('');

    try {
      const result = isLoaded
        ? await desktopApi.unloadPrettifyModel('ollama', prettifySettings)
        : await desktopApi.loadPrettifyModel('ollama', prettifySettings);
      if (refreshId !== prettifyModelRefreshIdRef.current) {
        return;
      }

      if (!result.success) {
        const fallback = t(isLoaded ? 'prettify.modelUnloadFailed' : 'prettify.modelLoadFailed');
        setPrettifyModelActionError(
          presentNotificationError(result.error, { context: 'prettify', fallback, t }).userMessage,
        );
        return;
      }

      const vramSizeBytes =
        !isLoaded && 'vramSizeBytes' in result && typeof result.vramSizeBytes === 'number'
          ? result.vramSizeBytes
          : undefined;
      setOllamaModelOptions((current) => {
        const hasSelectedModel = current.some((option) => option.id === model);
        if (isLoaded) {
          return current.map((option) => (option.id === model ? { ...option, isLoaded: false } : option));
        }

        const nextOptions = current.map((option) => ({
          ...option,
          isLoaded: option.id === model,
          ...(option.id === model && vramSizeBytes !== undefined ? { vramSizeBytes } : {}),
        }));
        return hasSelectedModel
          ? nextOptions
          : [...nextOptions, { id: model, isLoaded: true, name: model, vramSizeBytes }];
      });
    } catch (error: unknown) {
      if (refreshId === prettifyModelRefreshIdRef.current) {
        const fallback = t(isLoaded ? 'prettify.modelUnloadFailed' : 'prettify.modelLoadFailed');
        setPrettifyModelActionError(presentNotificationError(error, { context: 'prettify', fallback, t }).userMessage);
      }
    } finally {
      if (refreshId === prettifyModelRefreshIdRef.current) {
        setIsPrettifyModelActionRunning(false);
      }
    }
  };

  const openAppSettingsWindow = useCallback(
    (section?: 'prettify'): void => {
      void desktopApi.openAppSettings(section).catch(() => {
        setStatus(translatedStatus('error.notificationUnknown'));
      });
    },
    [desktopApi],
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
    const fallbackError = t('translate.settingsSaveFailed');
    dispatchTranslationSettingsSelection({
      candidate,
      requestId,
      type: 'save-started',
    });

    try {
      const result = await desktopApi.setTranslateSettings(candidate);
      if (requestId !== translationSettingsRequestRef.current) return;
      translationSettingsSavePendingRef.current = false;
      dispatchTranslationSettingsSelection({
        error: fallbackError,
        requestId,
        result,
        type: 'save-completed',
      });
    } catch {
      if (requestId !== translationSettingsRequestRef.current) return;
      translationSettingsSavePendingRef.current = false;
      dispatchTranslationSettingsSelection({
        error: fallbackError,
        requestId,
        type: 'save-failed',
      });
    }
  };

  if (!isI18nReady || providerStartupPending) return <LoadingScreen />;

  return (
    <main className="command-dock" data-slot="main-window">
      <MainToolbar
        activeProviderAuthType={activeProviderAuthType}
        activeProviderId={activeProviderId}
        activeProviderHasSettings={Boolean(activeProvider?.hasSettings)}
        activeProviderName={activeProviderName}
        isLoggedIn={isLoggedIn}
        isLoggingIn={isLoggingIn}
        providerConnectionFailureTooltip={
          providerConnectionFailureStatus ? renderRendererStatus(providerConnectionFailureStatus, t) : ''
        }
        providerConnectionReason={providerConnectionReason}
        onOpenAbout={openAboutWindow}
        onOpenAppSettings={() => openAppSettingsWindow()}
        onOpenHistory={openHistoryWindow}
        onOpenProviderSettings={() => void openProviderSettings(activeProviderId)}
        onProviderChange={(providerId) => void handleProviderChange(providerId)}
        onProviderLogin={() => void handleLogin()}
        providers={providers}
      />
      <MainPrettifyProviderBand
        cliConnection={prettifyCliConnection}
        connectionError={prettifyConnectionError}
        error={prettifyProviderSelection.error || prettifyModelActionError}
        httpConnection={prettifyHttpConnection}
        isModelActionRunning={isPrettifyModelActionRunning}
        isProviderChangeSaving={prettifyProviderSelection.pendingRequestId !== null}
        ollamaModels={ollamaModelOptions}
        onModelAction={() => void handleOllamaModelAction()}
        onOpenSettings={() => openAppSettingsWindow('prettify')}
        onProviderChange={(providerId) => void handlePrettifyProviderChange(providerId)}
        settings={prettifySettings}
      />
      <TranslateSection
        connectionState={translationConnectionState}
        error={translationSettingsSelection.error}
        isSaving={translationSettingsSelection.pendingRequestId !== null}
        onProviderChange={(providerId) => {
          const candidate = createTranslationProviderCandidate(
            translationSettingsSelection.confirmedSettings,
            providerId,
          );
          void saveTranslationSettings(candidate);
        }}
        onTargetLanguageChange={(targetLanguage) => {
          const candidate = createTranslationSettingsCandidate(
            translationSettingsSelection.confirmedSettings,
            targetLanguage,
          );
          void saveTranslationSettings(candidate);
        }}
        settings={translationSettings}
      />
      <RecordingControls
        onCancel={cancelRecording}
        onPause={pauseRecording}
        onResume={resumeRecording}
        onStart={startRecording}
        onStop={stopRecording}
        recordHotkey={recordHotkey}
        state={recordingState}
        status={status}
      />
    </main>
  );
};

export default App;
