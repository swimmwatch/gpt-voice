import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import LoginButton from './components/LoginButton';
import StatusIndicator from './components/StatusIndicator';
import TranslateSection from './components/TranslateSection';
import ProviderSettingsModal from './components/ProviderSettingsModal';
import { formatByteSize } from './byteFormatting';
import { useRecording } from './hooks/useRecording';
import { useI18n } from './hooks/useI18n';
import { getOllamaModelControl } from './prettifyModelControl';
import { expireBrowserSessionSettings, getProviderLoginState, type ProviderLoginState } from './providerState';
import type { BackgroundBrowserStatus, ProviderInfo, ProviderSettings } from './types';
import { presentNotificationError } from '@shared/notifications';
import type { PrettifyModelOption, PrettifySettings } from '@shared/prettifySettings';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProviderId, setActiveProviderId] = useState('chatgpt');
  const [prettifySettings, setPrettifySettings] = useState<PrettifySettings | null>(null);
  const [ollamaModelOptions, setOllamaModelOptions] = useState<PrettifyModelOption[]>([]);
  const [isPrettifyModelActionRunning, setIsPrettifyModelActionRunning] = useState(false);
  const [prettifyModelActionStatus, setPrettifyModelActionStatus] = useState('');
  const [prettifyModelActionError, setPrettifyModelActionError] = useState('');

  const { t, isReady: isI18nReady } = useI18n();

  const preserveStatusRef = useRef(false);
  const prettifyModelRefreshIdRef = useRef(0);

  const showStatusNotification = useCallback((nextStatus: string) => {
    const notificationBody = nextStatus.trim();
    if (!notificationBody) {
      return;
    }
    void window.electronAPI.showNotification('GPT-Voice', notificationBody).catch(() => undefined);
  }, []);

  const setStatusAndNotify = useCallback(
    (nextStatus: string) => {
      setStatus(nextStatus);
      showStatusNotification(nextStatus);
    },
    [showStatusNotification],
  );

  const refreshOllamaModelState = useCallback(async (settings: PrettifySettings): Promise<void> => {
    const refreshId = ++prettifyModelRefreshIdRef.current;
    setPrettifySettings(settings);
    setIsPrettifyModelActionRunning(false);
    setPrettifyModelActionStatus('');
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

  const { startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording, resendLastTranscription } =
    useRecording({
      setStatus,
      setIsRecording,
      setIsPaused,
      notifyStatus: showStatusNotification,
      t,
    });

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
      unsubscribe();
    };
  }, [refreshOllamaModelState]);

  const applyProviderLoginState = useCallback(
    (hasSession: boolean, backgroundStatus?: BackgroundBrowserStatus): ProviderLoginState => {
      const loginState = getProviderLoginState(hasSession, backgroundStatus);
      setIsLoggedIn(loginState.isLoggedIn);
      setIsLoading(loginState.isLoading);

      if (loginState.sessionExpired) {
        preserveStatusRef.current = true;
        setStatusAndNotify(t('status.sessionExpired'));
        setProviderSettings((settings) => expireBrowserSessionSettings(settings));
      } else if (backgroundStatus?.error) {
        preserveStatusRef.current = true;
        setStatusAndNotify(t('status.browserInitFailed', { error: backgroundStatus.error }));
      } else if (backgroundStatus?.ready) {
        preserveStatusRef.current = false;
      }

      return loginState;
    },
    [setStatusAndNotify, t],
  );

  const refreshProviderState = useCallback(async (): Promise<ProviderLoginState> => {
    const [hasSession, backgroundStatus] = await Promise.all([
      window.electronAPI.checkSession(),
      window.electronAPI.getBgBrowserStatus(),
    ]);
    return applyProviderLoginState(hasSession, backgroundStatus);
  }, [applyProviderLoginState]);

  useEffect(() => {
    if (!isI18nReady) {
      return undefined;
    }

    let disposed = false;
    const subscriptions = [
      window.electronAPI.onToggleRecording((recording: boolean) => {
        if (disposed) return;
        if (recording) startRecording();
      }),
      window.electronAPI.onStopRecording(() => {
        if (disposed) return;
        stopRecording();
      }),
      window.electronAPI.onPauseRecording(() => {
        if (!disposed) pauseRecording();
      }),
      window.electronAPI.onResumeRecording(() => {
        if (!disposed) resumeRecording();
      }),
      window.electronAPI.onCancelRecording(() => {
        if (!disposed) cancelRecording();
      }),
      window.electronAPI.onRetryTranscription(() => {
        if (!disposed) void resendLastTranscription();
      }),
      window.electronAPI.onTranslationStatus((nextStatus) => {
        if (!disposed) setStatus(nextStatus);
      }),
      window.electronAPI.onBgBrowserReady(() => {
        if (disposed) return;
        preserveStatusRef.current = false;
        setIsLoggedIn(true);
        setIsLoading(false);
      }),
      window.electronAPI.onBgBrowserError((error, authExpired) => {
        if (disposed) return;
        if (authExpired) {
          applyProviderLoginState(false, { ready: false, error, authExpired: true });
          return;
        }
        window.electronAPI.checkSession().then((hasSession) => {
          if (!disposed) applyProviderLoginState(hasSession, { ready: false, error });
        });
      }),
      window.electronAPI.onHotkeySettingsChanged((settings) => {
        if (disposed || preserveStatusRef.current) return;
        setStatus(t('status.pressToRecord', { hotkey: settings.hotkey }));
      }),
    ];

    Promise.all([window.electronAPI.checkSession(), window.electronAPI.getBgBrowserStatus()]).then(
      ([hasSession, backgroundStatus]) => {
        if (!disposed) applyProviderLoginState(hasSession, backgroundStatus);
      },
    );

    window.electronAPI.isBgReady().then((ready) => {
      if (disposed) return;
      if (ready) {
        setIsLoggedIn(true);
        setIsLoading(false);
      }
    });

    window.electronAPI.getHotkey().then(({ hotkey: hk }) => {
      if (disposed) return;
      if (!preserveStatusRef.current) {
        setStatus(t('status.pressToRecord', { hotkey: hk }));
      }
    });

    window.electronAPI.getTranslateSettings().then(({ targetLang: tl }) => {
      if (disposed) return;
      setTargetLang(tl);
    });

    window.electronAPI.getProviders().then((value) => {
      if (!disposed) setProviders(value);
    });
    window.electronAPI.getActiveProvider().then((value) => {
      if (!disposed) setActiveProviderId(value);
    });

    return () => {
      disposed = true;
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    };
  }, [
    applyProviderLoginState,
    isI18nReady,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    resendLastTranscription,
    t,
  ]);

  const activeProviderName = providers.find((p) => p.id === activeProviderId)?.name || activeProviderId;
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const activeProviderAuthType = activeProvider?.authType || 'browserSession';

  const openProviderSettings = async () => {
    const settings = await window.electronAPI.getProviderSettings(activeProviderId);
    setProviderSettings(settings);
    setShowProviderSettings(true);
  };

  const handleLogin = async () => {
    if (activeProviderAuthType === 'apiKey') {
      await openProviderSettings();
      return;
    }

    setIsLoggingIn(true);
    preserveStatusRef.current = false;
    setStatus(t('status.loggingIn', { provider: activeProviderName }));
    const result = await window.electronAPI.providerLogin();
    setIsLoggingIn(false);
    if (result.success) {
      setIsLoggedIn(true);
      setStatusAndNotify(t('status.loggedIn', { provider: activeProviderName }));
    } else {
      preserveStatusRef.current = true;
      setStatusAndNotify(t('status.loginFailed', { error: result.error || '' }));
    }
  };

  const handleProviderSettingsSaved = (settings: ProviderSettings) => {
    setProviderSettings(settings);
    const configured = settings.authType === 'apiKey' ? settings.hasApiKey : settings.hasSession;
    setIsLoggedIn(configured);
    if (configured) {
      preserveStatusRef.current = false;
      setStatusAndNotify(t('status.providerConfigured', { provider: activeProviderName }));
    } else {
      preserveStatusRef.current = true;
      setStatusAndNotify(t('status.providerNotConfigured', { provider: activeProviderName }));
    }
  };

  const handleProviderChange = async (providerId: string) => {
    setActiveProviderId(providerId);
    setIsLoading(true);
    const result = await window.electronAPI.setActiveProvider(providerId);
    const loginState = await refreshProviderState();
    if (!loginState.sessionExpired && !result.success && result.error) {
      preserveStatusRef.current = true;
      setStatusAndNotify(t('status.browserInitFailed', { error: result.error }));
    }
    setIsLoading(false);
  };

  const ollamaModelControl = getOllamaModelControl(prettifySettings, ollamaModelOptions);

  const handleOllamaModelAction = async (): Promise<void> => {
    if (!prettifySettings || !ollamaModelControl || isPrettifyModelActionRunning) {
      return;
    }

    const refreshId = prettifyModelRefreshIdRef.current;
    const { model, isLoaded } = ollamaModelControl;
    setIsPrettifyModelActionRunning(true);
    setPrettifyModelActionStatus('');
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

      const resolvedModel = result.model || model;
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
      setPrettifyModelActionStatus(
        t(isLoaded ? 'prettify.modelFreed' : 'prettify.modelLoaded', { model: resolvedModel }),
      );
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

  if (!isI18nReady || isLoading) return <LoadingScreen />;

  return (
    <div className="container">
      <div className="provider-section">
        <label className="provider-label">{t('provider.label')}</label>
        <select
          className="provider-select"
          value={activeProviderId}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="provider-settings-btn" onClick={openProviderSettings} aria-label={t('provider.settings')}>
          {t('provider.settings')}
        </button>
      </div>
      {ollamaModelControl && (
        <div className="prettify-model-control" aria-label={t('prettify.modelActions')}>
          <div className="prettify-model-control-details">
            <span className="prettify-model-control-label">{t('prettify.model')}</span>
            <span className="prettify-model-control-name" title={ollamaModelControl.model}>
              {ollamaModelControl.model}
            </span>
            <span className="prettify-model-control-state">
              {ollamaModelControl.isLoaded && ollamaModelControl.vramSizeBytes !== undefined
                ? t('prettify.modelVramLoaded', { size: formatByteSize(ollamaModelControl.vramSizeBytes) })
                : t(ollamaModelControl.isLoaded ? 'prettify.modelLoaded' : 'prettify.modelNotLoaded', {
                    model: ollamaModelControl.model,
                  })}
            </span>
          </div>
          <button
            type="button"
            className="prettify-model-control-action"
            onClick={() => void handleOllamaModelAction()}
            disabled={isPrettifyModelActionRunning}
            title={t(ollamaModelControl.isLoaded ? 'prettify.freeModelTitle' : 'prettify.loadModelTitle')}
          >
            {isPrettifyModelActionRunning
              ? t('prettify.loadingModel')
              : t(ollamaModelControl.isLoaded ? 'prettify.freeModel' : 'prettify.loadModel')}
          </button>
          {prettifyModelActionStatus && (
            <span className="prettify-model-control-status" role="status" aria-live="polite">
              {prettifyModelActionStatus}
            </span>
          )}
          {prettifyModelActionError && (
            <span className="prettify-model-control-error" role="alert">
              {prettifyModelActionError}
            </span>
          )}
        </div>
      )}
      <LoginButton
        isLoggedIn={isLoggedIn}
        isLoggingIn={isLoggingIn}
        providerName={activeProviderName}
        actionType={activeProviderAuthType === 'apiKey' ? 'configure' : 'login'}
        onLogin={handleLogin}
      />
      <StatusIndicator isRecording={isRecording} isPaused={isPaused} status={status} />
      <TranslateSection
        targetLang={targetLang}
        onLangChange={(lang) => {
          setTargetLang(lang);
          window.electronAPI.setTranslateSettings(lang);
        }}
      />
      {showProviderSettings && activeProvider && providerSettings && (
        <ProviderSettingsModal
          provider={activeProvider}
          settings={providerSettings}
          onClose={() => setShowProviderSettings(false)}
          onSaved={handleProviderSettingsSaved}
          onLogin={handleLogin}
        />
      )}
    </div>
  );
};

export default App;
