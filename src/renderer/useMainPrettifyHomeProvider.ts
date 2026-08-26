import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPrettifyProviderSettingsInput } from '@renderer/appSettingsUtils';
import {
  getMainPrettifyHttpConnectionStatus,
  MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES,
  reduceMainPrettifyProviderSelection,
  type MainPrettifyHttpConnectionState,
} from '@renderer/mainPrettifyProvider';
import {
  createMainPrettifyCliConnectionCoordinator,
  getActivePrettifyCliProviderId,
  type MainPrettifyCliConnectionState,
} from '@renderer/mainPrettifyCliConnection';
import { getOllamaModelControl } from '@renderer/prettifyModelControl';
import type { ElectronAPI } from '@renderer/types';
import { presentNotificationError } from '@shared/notifications';
import {
  DEFAULT_PRETTIFY_PROVIDER_ID,
  DEFAULT_PRETTIFY_SETTINGS,
  isPrettifyCliProviderId,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';

interface UseMainPrettifyHomeProviderOptions {
  readonly desktopApi: ElectronAPI;
  readonly isSharedProviderChangesLocked: boolean;
  readonly onConnectionRecovered: () => void;
  readonly translate: (key: string) => string;
}

export interface MainPrettifyHomeProvider {
  readonly cliConnection: MainPrettifyCliConnectionState | null;
  readonly connectionError: string;
  readonly error: string;
  readonly httpConnection: MainPrettifyHttpConnectionState | null;
  readonly isInitialLoading: boolean;
  readonly isModelActionRunning: boolean;
  readonly isProviderChangeSaving: boolean;
  readonly isProviderChangesLocked: boolean;
  readonly ollamaModels: readonly PrettifyModelOption[];
  readonly onModelAction: () => Promise<void>;
  readonly onProviderChange: (providerId: PrettifyProviderId) => Promise<void>;
  readonly settings: PrettifySettings;
}

/** Owns main-window Prettify settings, connection feedback, and model controls. */
export function useMainPrettifyHomeProvider({
  desktopApi,
  isSharedProviderChangesLocked,
  onConnectionRecovered,
  translate,
}: UseMainPrettifyHomeProviderOptions): MainPrettifyHomeProvider {
  const [prettifyProviderSelection, dispatchPrettifyProviderSelection] = useReducer(
    reduceMainPrettifyProviderSelection,
    {
      error: '',
      pendingRequestId: null,
      settings: DEFAULT_PRETTIFY_SETTINGS,
    },
  );
  const prettifySettings = prettifyProviderSelection.settings;
  const isProviderChangeSaving = prettifyProviderSelection.pendingRequestId !== null;
  const [ollamaModels, setOllamaModels] = useState<PrettifyModelOption[]>([]);
  const [isOllamaModelActionRunning, setIsOllamaModelActionRunning] = useState(false);
  const [isVllmModelLoadRunning, setIsVllmModelLoadRunning] = useState(false);
  const [modelActionError, setModelActionError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [httpConnection, setHttpConnection] = useState<MainPrettifyHttpConnectionState | null>(null);
  const [cliConnection, setCliConnection] = useState<MainPrettifyCliConnectionState | null>(null);
  const [hasLoadedInitialSettings, setHasLoadedInitialSettings] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const prettifyModelRefreshIdRef = useRef(0);
  const prettifyProviderChangeRequestRef = useRef(0);
  const [cliConnectionCoordinator] = useState(() =>
    createMainPrettifyCliConnectionCoordinator({
      check: (providerId) => desktopApi.checkPrettifyCliConnection(providerId),
      update: (connection) => {
        setCliConnection(connection);
        if (connection?.status === 'connected') onConnectionRecovered();
        if (connection !== null && connection.status !== 'checking') {
          setIsInitialLoading(false);
        }
      },
    }),
  );
  const isModelActionRunning = isOllamaModelActionRunning || isVllmModelLoadRunning;
  const isProviderChangesLocked = isSharedProviderChangesLocked || isProviderChangeSaving || isModelActionRunning;

  const refreshProviderState = useCallback(
    async (settings: PrettifySettings): Promise<void> => {
      const refreshId = ++prettifyModelRefreshIdRef.current;
      dispatchPrettifyProviderSelection({ settings, type: 'snapshot' });
      setIsOllamaModelActionRunning(false);
      setIsVllmModelLoadRunning(settings.providerId === 'vllm');
      setModelActionError('');
      setConnectionError('');

      if (isPrettifyCliProviderId(settings.providerId)) {
        setOllamaModels([]);
        setHttpConnection(null);
        return;
      }

      const providerId = settings.providerId;
      setHttpConnection({
        providerId,
        status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Checking,
      });
      try {
        const result = await desktopApi.listPrettifyModels(providerId, createPrettifyProviderSettingsInput(settings));
        if (refreshId === prettifyModelRefreshIdRef.current) {
          setOllamaModels(providerId === 'ollama' && result.success ? result.models : []);
          const status = getMainPrettifyHttpConnectionStatus(settings, result.success);
          setHttpConnection({
            providerId,
            status,
          });
          if (status === MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.Connected) onConnectionRecovered();
          setConnectionError(
            result.success
              ? ''
              : presentNotificationError(result.error, {
                  context: 'generic',
                  t: translate,
                }).userMessage,
          );
        }
      } catch {
        if (refreshId === prettifyModelRefreshIdRef.current) {
          setOllamaModels([]);
          setHttpConnection({
            providerId,
            status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected,
          });
          setConnectionError(translate('error.notificationUnknown'));
        }
      } finally {
        if (refreshId === prettifyModelRefreshIdRef.current) setIsVllmModelLoadRunning(false);
      }
    },
    [desktopApi, onConnectionRecovered, translate],
  );

  useEffect(() => {
    if (!hasLoadedInitialSettings) return;
    cliConnectionCoordinator.refresh(
      getActivePrettifyCliProviderId(prettifySettings.providerId, isProviderChangeSaving),
    );
  }, [
    cliConnectionCoordinator,
    hasLoadedInitialSettings,
    isProviderChangeSaving,
    prettifySettings.claudeCli.executablePath,
    prettifySettings.claudeCli.timeoutSeconds,
    prettifySettings.codexCli.executablePath,
    prettifySettings.codexCli.timeoutSeconds,
    prettifySettings.providerId,
  ]);

  useEffect(
    () => () => {
      cliConnectionCoordinator.dispose();
    },
    [cliConnectionCoordinator],
  );

  useEffect(() => {
    let disposed = false;
    const refresh = async (settings: PrettifySettings, initial: boolean): Promise<void> => {
      if (disposed) return;
      if (initial) setHasLoadedInitialSettings(true);
      await refreshProviderState(settings);
      if (initial && !disposed && !isPrettifyCliProviderId(settings.providerId)) {
        setIsInitialLoading(false);
      }
    };

    void desktopApi
      .getPrettifySettings()
      .then((settings) => refresh(settings, true))
      .catch(() => {
        if (disposed) return;
        setHasLoadedInitialSettings(true);
        if (isPrettifyCliProviderId(DEFAULT_PRETTIFY_PROVIDER_ID)) {
          setCliConnection({
            errorCode: 'process-failed',
            providerId: DEFAULT_PRETTIFY_PROVIDER_ID,
            status: 'unavailable',
          });
        } else {
          setHttpConnection({
            providerId: DEFAULT_PRETTIFY_PROVIDER_ID,
            status: MAIN_PRETTIFY_HTTP_CONNECTION_STATUSES.NotConnected,
          });
        }
        setConnectionError(translate('error.notificationUnknown'));
        setIsInitialLoading(false);
      });
    const unsubscribe = desktopApi.onPrettifySettingsChanged((settings) => {
      void refresh(settings, false);
    });

    return () => {
      disposed = true;
      prettifyProviderChangeRequestRef.current += 1;
      unsubscribe();
    };
  }, [desktopApi, refreshProviderState, translate]);

  const onProviderChange = useCallback(
    async (providerId: PrettifyProviderId): Promise<void> => {
      if (isProviderChangesLocked || providerId === prettifySettings.providerId || isProviderChangeSaving) return;

      const requestId = ++prettifyProviderChangeRequestRef.current;
      const previousSettings = prettifySettings;
      prettifyModelRefreshIdRef.current += 1;
      cliConnectionCoordinator.refresh(null);
      dispatchPrettifyProviderSelection({ providerId, requestId, type: 'begin' });
      setIsOllamaModelActionRunning(false);
      setIsVllmModelLoadRunning(false);
      setModelActionError('');

      try {
        const result = await desktopApi.setPrettifySettings({ providerId });
        if (requestId !== prettifyProviderChangeRequestRef.current) return;
        dispatchPrettifyProviderSelection(
          result.success
            ? { requestId, settings: result.settings, type: 'resolved' }
            : {
                error: translate('mainDock.prettifySaveFailed'),
                requestId,
                settings: result.settings,
                type: 'rejected',
              },
        );
      } catch {
        if (requestId !== prettifyProviderChangeRequestRef.current) return;
        dispatchPrettifyProviderSelection({
          error: translate('mainDock.prettifySaveFailed'),
          requestId,
          settings: previousSettings,
          type: 'rejected',
        });
      }
    },
    [
      cliConnectionCoordinator,
      desktopApi,
      isProviderChangeSaving,
      isProviderChangesLocked,
      prettifySettings,
      translate,
    ],
  );

  const onModelAction = useCallback(async (): Promise<void> => {
    const ollamaModelControl = getOllamaModelControl(prettifySettings, ollamaModels);
    if (isProviderChangesLocked || !ollamaModelControl || isModelActionRunning) return;

    const refreshId = prettifyModelRefreshIdRef.current;
    const { model, isLoaded } = ollamaModelControl;
    setIsOllamaModelActionRunning(true);
    setModelActionError('');

    try {
      const providerSettingsInput = createPrettifyProviderSettingsInput(prettifySettings);
      const result = isLoaded
        ? await desktopApi.unloadPrettifyModel('ollama', providerSettingsInput)
        : await desktopApi.loadPrettifyModel('ollama', providerSettingsInput);
      if (refreshId !== prettifyModelRefreshIdRef.current) return;

      if (!result.success) {
        const fallback = translate(isLoaded ? 'prettify.modelUnloadFailed' : 'prettify.modelLoadFailed');
        setModelActionError(
          presentNotificationError(result.error, { context: 'prettify', fallback, t: translate }).userMessage,
        );
        return;
      }

      const vramSizeBytes =
        !isLoaded && 'vramSizeBytes' in result && typeof result.vramSizeBytes === 'number'
          ? result.vramSizeBytes
          : undefined;
      setOllamaModels((current) => {
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
        const fallback = translate(isLoaded ? 'prettify.modelUnloadFailed' : 'prettify.modelLoadFailed');
        setModelActionError(
          presentNotificationError(error, { context: 'prettify', fallback, t: translate }).userMessage,
        );
      }
    } finally {
      if (refreshId === prettifyModelRefreshIdRef.current) setIsOllamaModelActionRunning(false);
    }
  }, [desktopApi, isModelActionRunning, isProviderChangesLocked, ollamaModels, prettifySettings, translate]);

  return {
    cliConnection,
    connectionError,
    error: prettifyProviderSelection.error || modelActionError,
    httpConnection,
    isInitialLoading,
    isModelActionRunning,
    isProviderChangeSaving,
    isProviderChangesLocked,
    ollamaModels,
    onModelAction,
    onProviderChange,
    settings: prettifySettings,
  };
}
