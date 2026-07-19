import React, { useState, useEffect, useEffectEvent, useRef, useCallback, useReducer } from 'react';
import LoadingScreen from './components/LoadingScreen';
import MainToolbar from './components/MainToolbar';
import MainPrettifyProviderBand from './components/MainPrettifyProviderBand';
import RecordingControls from './components/RecordingControls';
import TranslateSection from './components/TranslateSection';
import { useWindowStartupReady } from './WindowStartupGate';
import { useRecording } from './hooks/useRecording';
import { useI18n } from './hooks/useI18n';
import { getOllamaModelControl } from './prettifyModelControl';
import { reduceMainPrettifyProviderSelection } from './mainPrettifyProvider';
import {
  getProviderLoginState,
  isActiveProviderSettingsChange,
  isProviderConfigured,
  type ProviderLoginState,
} from './providerState';
import {
  createProviderSelectionCoordinator,
  type ProviderSelectionCoordinator,
  type ProviderSelectionEvent,
} from './providerSelectionCoordinator';
import {
  literalStatus,
  notificationErrorStatus,
  renderRendererStatus,
  shouldPresentIdleHotkeyStatus,
  translatedStatus,
  type RendererStatus,
} from './statusPresentation';
import type { BackgroundBrowserStatus, ProviderAuthType, ProviderInfo, ProviderSettings } from './types';
import { presentNotificationError } from '@shared/notifications';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

/** Coordinates the main recording lifecycle, provider state, notifications, and IPC subscriptions. */
const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [recordingState, setRecordingState] = useState<RecordingLifecycleState>('idle');
  const [status, setStatus] = useState<RendererStatus | null>(null);
  const [recordHotkey, setRecordHotkey] = useState('F9');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
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

  const { t, isReady: isI18nReady } = useI18n();
  const activeProvider = providers.find((provider) => provider.id === activeProviderId);
  const activeProviderName = activeProvider?.name || activeProviderId;
  const activeProviderAuthType = activeProvider?.authType || 'browserSession';
  const activeProviderTranscriptionMode = activeProvider?.transcriptionMode || 'batch';

  useWindowStartupReady(isI18nReady && !isLoading);

  const preserveStatusRef = useRef(false);
  const recordingStateRef = useRef<RecordingLifecycleState>('idle');
  const activeProviderIdRef = useRef(activeProviderId);
  const activeProviderAuthTypeRef = useRef<ProviderAuthType>('browserSession');
  const providerSelectionCoordinatorRef = useRef<ProviderSelectionCoordinator | null>(null);
  const prettifyModelRefreshIdRef = useRef(0);
  const prettifyProviderChangeRequestRef = useRef(0);

  const updateRecordingState = useCallback((nextState: RecordingLifecycleState): void => {
    recordingStateRef.current = nextState;
    setRecordingState(nextState);
  }, []);

  const showStatusNotification = useCallback(
    (nextStatus: RendererStatus) => {
      const notificationBody = renderRendererStatus(nextStatus, t).trim();
      if (!notificationBody) return;
      void window.electronAPI.showNotification('GPT-Voice', notificationBody).catch(() => undefined);
    },
    [t],
  );

  const setStatusAndNotify = useCallback(
    (nextStatus: RendererStatus) => {
      setStatus(nextStatus);
      showStatusNotification(nextStatus);
    },
    [showStatusNotification],
  );

  const refreshOllamaModelState = useCallback(async (settings: PrettifySettings): Promise<void> => {
    const refreshId = ++prettifyModelRefreshIdRef.current;
    dispatchPrettifyProviderSelection({ settings, type: 'snapshot' });
    setIsPrettifyModelActionRunning(false);
    setPrettifyModelActionError('');

    if (settings.providerId !== 'ollama' || !settings.ollama.model) {
      setOllamaModelOptions([]);
      return;
    }

    try {
      const result = await window.electronAPI.listPrettifyModels('ollama', settings);
      if (refreshId === prettifyModelRefreshIdRef.current) {
        setOllamaModelOptions(result.success ? result.models : []);
      }
    } catch {
      if (refreshId === prettifyModelRefreshIdRef.current) {
        setOllamaModelOptions([]);
      }
    }
  }, []);

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
    const refresh = (settings: PrettifySettings): void => {
      if (!disposed) {
        void refreshOllamaModelState(settings);
      }
    };

    void window.electronAPI
      .getPrettifySettings()
      .then(refresh)
      .catch(() => undefined);
    const unsubscribe = window.electronAPI.onPrettifySettingsChanged(refresh);

    return () => {
      disposed = true;
      prettifyProviderChangeRequestRef.current += 1;
      unsubscribe();
    };
  }, [refreshOllamaModelState]);

  const applyProviderLoginState = useCallback(
    (
      authType: ProviderAuthType,
      hasSession: boolean,
      backgroundStatus?: BackgroundBrowserStatus,
    ): ProviderLoginState => {
      const loginState = getProviderLoginState(authType, hasSession, backgroundStatus);
      setIsLoggedIn(loginState.isLoggedIn);
      setIsLoading(loginState.isLoading);

      if (authType === 'browserSession' && loginState.sessionExpired) {
        preserveStatusRef.current = true;
        setStatusAndNotify(translatedStatus('status.sessionExpired'));
      } else if (authType === 'browserSession' && backgroundStatus?.error) {
        preserveStatusRef.current = true;
        setStatusAndNotify(
          translatedStatus('status.browserInitFailed', {
            error: notificationErrorStatus(presentNotificationError(backgroundStatus.error, { context: 'generic' })),
          }),
        );
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
      getActiveProvider: () => window.electronAPI.getActiveProvider(),
      getProviders: () => window.electronAPI.getProviders(),
      getRuntimeState: async () => {
        const [hasSession, backgroundStatus] = await Promise.all([
          window.electronAPI.checkSession(),
          window.electronAPI.getBgBrowserStatus(),
        ]);
        return { backgroundStatus, hasSession };
      },
      setActiveProvider: (providerId) => window.electronAPI.setActiveProvider(providerId),
    });
    providerSelectionCoordinatorRef.current = providerSelectionCoordinator;
    const subscriptions = [
      window.electronAPI.onToggleRecording((recording: boolean) => {
        if (disposed) return;
        if (recording) void recordingActionsRef.current.startRecording();
      }),
      window.electronAPI.onStopRecording(() => {
        if (disposed) return;
        recordingActionsRef.current.stopRecording();
      }),
      window.electronAPI.onPauseRecording(() => {
        if (!disposed) recordingActionsRef.current.pauseRecording();
      }),
      window.electronAPI.onResumeRecording(() => {
        if (!disposed) recordingActionsRef.current.resumeRecording();
      }),
      window.electronAPI.onCancelRecording(() => {
        if (!disposed) recordingActionsRef.current.cancelRecording();
      }),
      window.electronAPI.onRetryTranscription(() => {
        if (!disposed) void recordingActionsRef.current.resendLastTranscription();
      }),
      window.electronAPI.onTranslationStatus((nextStatus) => {
        if (!disposed) setStatus(literalStatus(nextStatus));
      }),
      window.electronAPI.onBgBrowserReady((providerId) => {
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
      }),
      window.electronAPI.onBgBrowserError((providerId, error, authExpired) => {
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
        void window.electronAPI.checkSession().then((hasSession) => {
          if (
            !disposed &&
            providerId === activeProviderIdRef.current &&
            activeProviderAuthTypeRef.current === 'browserSession'
          ) {
            applyProviderLoginStateRef.current('browserSession', hasSession, { ready: false, error });
          }
        });
      }),
      window.electronAPI.onHotkeySettingsChanged((settings) => {
        if (disposed) return;
        setRecordHotkey(settings.hotkey);
        if (shouldPresentIdleHotkeyStatus(recordingStateRef.current, preserveStatusRef.current)) {
          setStatus(translatedStatus('status.pressToRecord', { hotkey: settings.hotkey }));
        }
      }),
    ];

    void providerSelectionCoordinator.bootstrap();

    void window.electronAPI.getHotkey().then(({ hotkey: hk }) => {
      if (disposed) return;
      setRecordHotkey(hk);
      if (shouldPresentIdleHotkeyStatus(recordingStateRef.current, preserveStatusRef.current)) {
        setStatus(translatedStatus('status.pressToRecord', { hotkey: hk }));
      }
    });

    void window.electronAPI.getTranslateSettings().then(({ targetLang: tl }) => {
      if (disposed) return;
      setTargetLang(tl);
    });

    return () => {
      disposed = true;
      providerSelectionCoordinator.dispose();
      if (providerSelectionCoordinatorRef.current === providerSelectionCoordinator) {
        providerSelectionCoordinatorRef.current = null;
      }
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    };
  }, [isI18nReady]);

  const applyProviderSettingsSnapshot = useCallback(
    (settings: ProviderSettings): void => {
      if (settings.authType === 'browserSession') {
        setIsLoading(false);
        if (!settings.hasSession) {
          setIsLoggedIn(false);
          preserveStatusRef.current = true;
          setStatusAndNotify(translatedStatus('status.providerNotConfigured', { provider: activeProviderName }));
        }
        return;
      }

      const configured = isProviderConfigured(settings);
      setIsLoggedIn(configured);
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
    return window.electronAPI.onProviderSettingsChanged((settings) => {
      if (isActiveProviderSettingsChange(settings, activeProviderId)) applyProviderSettingsSnapshot(settings);
    });
  }, [activeProviderId, applyProviderSettingsSnapshot]);

  const openProviderSettings = async (providerId: string): Promise<void> => {
    try {
      const result = await window.electronAPI.openProviderSettings(providerId);
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
    preserveStatusRef.current = false;
    setStatus(translatedStatus('status.loggingIn', { provider: providerName }));
    try {
      const result = await window.electronAPI.providerLogin(providerId);
      if (activeProviderIdRef.current !== providerId) return;
      if (result.success) {
        setIsLoggedIn(true);
        setStatusAndNotify(translatedStatus('status.loggedIn', { provider: providerName }));
      } else {
        preserveStatusRef.current = true;
        const presented = presentNotificationError(result.error, {
          context: 'generic',
        });
        setStatusAndNotify(translatedStatus('status.loginFailed', { error: notificationErrorStatus(presented) }));
      }
    } catch (error: unknown) {
      if (activeProviderIdRef.current !== providerId) return;
      preserveStatusRef.current = true;
      const presented = presentNotificationError(error, {
        context: 'generic',
      });
      setStatusAndNotify(translatedStatus('status.loginFailed', { error: notificationErrorStatus(presented) }));
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
      const result = await window.electronAPI.setPrettifySettings({ providerId });
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
        ? await window.electronAPI.unloadPrettifyModel('ollama', prettifySettings)
        : await window.electronAPI.loadPrettifyModel('ollama', prettifySettings);
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

  const openAppSettingsWindow = useCallback((section?: 'prettify'): void => {
    void window.electronAPI.openAppSettings(section).catch(() => {
      setStatus(translatedStatus('error.notificationUnknown'));
    });
  }, []);

  const openHistoryWindow = useCallback((): void => {
    void window.electronAPI.openTranscriptionHistory().catch(() => {
      setStatus(translatedStatus('error.notificationUnknown'));
    });
  }, []);

  const openAboutWindow = useCallback((): void => {
    void window.electronAPI.openAbout().catch(() => {
      setStatus(translatedStatus('error.notificationUnknown'));
    });
  }, []);

  if (!isI18nReady || isLoading) return <LoadingScreen />;

  return (
    <main className="command-dock" data-slot="main-window">
      <MainToolbar
        activeProviderAuthType={activeProviderAuthType}
        activeProviderId={activeProviderId}
        activeProviderHasSettings={Boolean(activeProvider?.hasSettings)}
        activeProviderName={activeProviderName}
        isLoggedIn={isLoggedIn}
        isLoggingIn={isLoggingIn}
        onOpenAbout={openAboutWindow}
        onOpenAppSettings={() => openAppSettingsWindow()}
        onOpenHistory={openHistoryWindow}
        onOpenProviderSettings={() => void openProviderSettings(activeProviderId)}
        onProviderChange={(providerId) => void handleProviderChange(providerId)}
        onProviderLogin={() => void handleLogin()}
        providers={providers}
      />
      <MainPrettifyProviderBand
        error={prettifyProviderSelection.error || prettifyModelActionError}
        isModelActionRunning={isPrettifyModelActionRunning}
        isProviderChangeSaving={prettifyProviderSelection.pendingRequestId !== null}
        ollamaModels={ollamaModelOptions}
        onModelAction={() => void handleOllamaModelAction()}
        onOpenSettings={() => openAppSettingsWindow('prettify')}
        onProviderChange={(providerId) => void handlePrettifyProviderChange(providerId)}
        settings={prettifySettings}
      />
      <RecordingControls
        onCancel={cancelRecording}
        onPause={pauseRecording}
        onResume={resumeRecording}
        onStart={startRecording}
        onStop={stopRecording}
        recordHotkey={recordHotkey}
        state={recordingState}
        status={renderRendererStatus(status, t)}
      />
      <TranslateSection
        targetLang={targetLang}
        onLangChange={(lang) => {
          setTargetLang(lang);
          void window.electronAPI.setTranslateSettings(lang);
        }}
      />
    </main>
  );
};

export default App;
