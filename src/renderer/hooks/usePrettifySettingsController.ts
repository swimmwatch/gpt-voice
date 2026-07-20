import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  applyExternalPrettifyProviderSelection,
  createAppSettingsValidationError,
  createPrettifyProviderTransitionState,
  PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS,
  type AppSettingsFieldErrors,
  type AppSettingsFieldKey,
  type PrettifySettingsDraft,
} from '@renderer/appSettingsUtils';
import {
  createPrettifyProviderModelOptions,
  createPrettifyProviderModelStates,
  mergePrettifyProviderModelOptions,
  normalizeCodexCliSettingsForModel,
  type PrettifyProviderModelOptions,
  type PrettifyProviderModelStates,
} from '@renderer/prettifyModelControl';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  getPrettifyProviderCapabilities,
  type ClaudeCliPrettifySettings,
  type CodexCliPrettifySettings,
  type PrettifyProviderId,
} from '@shared/prettifySettings';

type Translate = (key: string, params?: Record<string, string>) => string;

interface UsePrettifySettingsControllerOptions {
  setFieldErrors: Dispatch<SetStateAction<AppSettingsFieldErrors>>;
  t: Translate;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getConfiguredPrettifyModel(settings: PrettifySettingsDraft, providerId: PrettifyProviderId): string {
  switch (providerId) {
    case 'ollama':
      return settings.ollama.model;
    case 'vllm':
      return settings.vllm.model;
    case 'claude-cli':
      return settings.claudeCli.model;
    case 'codex-cli':
      return settings.codexCli.model;
  }
}

/** Owns Prettify drafts, model discovery, provider transitions, and Ollama lifecycle actions. */
export function usePrettifySettingsController({ setFieldErrors, t }: UsePrettifySettingsControllerOptions) {
  const [prettifySettings, setPrettifySettings] = useState<PrettifySettingsDraft | null>(null);
  const [initialPrettifySettings, setInitialPrettifySettings] = useState<PrettifySettingsDraft | null>(null);
  const [modelOptions, setModelOptions] = useState<PrettifyProviderModelOptions>(() =>
    createPrettifyProviderModelOptions(DEFAULT_PRETTIFY_SETTINGS),
  );
  const [providerModelStates, setProviderModelStates] = useState<PrettifyProviderModelStates>(
    createPrettifyProviderModelStates,
  );
  const [modelError, setModelError] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState('');
  const [modelLoadStatus, setModelLoadStatus] = useState('');
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isModelActionMenuOpen, setIsModelActionMenuOpen] = useState(false);
  const modelRequestRef = useRef(0);
  const disposedRef = useRef(false);

  const clearFieldErrors = useCallback(
    (...keys: AppSettingsFieldKey[]): void => {
      setFieldErrors((current) => {
        if (!keys.some((key) => current[key])) return current;
        const next = { ...current };
        for (const key of keys) delete next[key];
        return next;
      });
    },
    [setFieldErrors],
  );

  const resetModelActionState = useCallback((): void => {
    setModelError('');
    setModelLoadError('');
    setModelLoadStatus('');
    setIsModelActionMenuOpen(false);
  }, []);

  const requestModels = useCallback(
    async (settingsSnapshot: PrettifySettingsDraft, selectDefaultHttpModel: boolean): Promise<void> => {
      const providerId = settingsSnapshot.providerId;
      const requestId = ++modelRequestRef.current;
      setIsLoadingModels(true);
      setModelError('');
      clearFieldErrors('prettifyModel');
      setProviderModelStates((current) => ({
        ...current,
        [providerId]: { ...current[providerId], checkStatus: 'checking' },
      }));

      try {
        const result = await window.electronAPI.listPrettifyModels(providerId, settingsSnapshot);
        if (disposedRef.current || requestId !== modelRequestRef.current) return;
        setProviderModelStates((current) => ({
          ...current,
          [providerId]: {
            availability: result.availability,
            checkStatus: result.success ? 'available' : 'unavailable',
            source: result.source,
          },
        }));
        if (!result.success) {
          setModelError(result.error || t('prettify.modelsRefreshFailed'));
          return;
        }

        const configuredModel = getConfiguredPrettifyModel(settingsSnapshot, providerId);
        const nextModels = mergePrettifyProviderModelOptions(result.models, configuredModel);
        setModelOptions((current) => ({ ...current, [providerId]: nextModels }));
        setPrettifySettings((current) => {
          if (!current || current.providerId !== providerId) return current;
          if (selectDefaultHttpModel && providerId === 'ollama' && !current.ollama.model && result.models[0]) {
            return { ...current, ollama: { ...current.ollama, model: result.models[0].id } };
          }
          if (selectDefaultHttpModel && providerId === 'vllm' && !current.vllm.model && result.models[0]) {
            return { ...current, vllm: { ...current.vllm, model: result.models[0].id } };
          }
          if (providerId === 'codex-cli') {
            return {
              ...current,
              codexCli: normalizeCodexCliSettingsForModel(current.codexCli, nextModels, true),
            };
          }
          return current;
        });
      } catch (error: unknown) {
        if (!disposedRef.current && requestId === modelRequestRef.current) {
          setProviderModelStates((current) => ({
            ...current,
            [providerId]: {
              ...current[providerId],
              availability: { status: 'unavailable' },
              checkStatus: 'unavailable',
            },
          }));
          setModelError(getErrorMessage(error));
        }
      } finally {
        if (!disposedRef.current && requestId === modelRequestRef.current) setIsLoadingModels(false);
      }
    },
    [clearFieldErrors, t],
  );

  const initialize = useCallback(
    (snapshot: PrettifySettingsDraft): void => {
      setPrettifySettings(snapshot);
      setInitialPrettifySettings(snapshot);
      setModelOptions(createPrettifyProviderModelOptions(snapshot));
      if (getPrettifyProviderCapabilities(snapshot.providerId).baseUrl) {
        void requestModels(snapshot, false);
      }
    },
    [requestModels],
  );

  const applySavedSnapshot = useCallback((snapshot: PrettifySettingsDraft, saved: boolean): void => {
    setPrettifySettings(snapshot);
    if (saved) setInitialPrettifySettings(snapshot);
  }, []);

  const updateSetting = <Key extends keyof PrettifySettingsDraft>(
    key: Key,
    value: PrettifySettingsDraft[Key],
    fieldKey: AppSettingsFieldKey,
  ): void => {
    clearFieldErrors(fieldKey);
    setPrettifySettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const changeProvider = (providerId: PrettifyProviderId): void => {
    if (!prettifySettings || prettifySettings.providerId === providerId) return;
    const transition = createPrettifyProviderTransitionState(prettifySettings, providerId);
    modelRequestRef.current += 1;
    setIsLoadingModels(false);
    resetModelActionState();
    clearFieldErrors('prettifyProvider', ...transition.clearFieldErrors);
    setPrettifySettings(transition.settings);
  };

  const updateHttpSetting = <Key extends 'baseUrl' | 'model'>(
    key: Key,
    value: string,
    fieldKey: AppSettingsFieldKey,
  ): void => {
    clearFieldErrors(fieldKey);
    resetModelActionState();
    setPrettifySettings((current) => {
      if (!current) return current;
      if (current.providerId === 'ollama') return { ...current, ollama: { ...current.ollama, [key]: value } };
      if (current.providerId === 'vllm') return { ...current, vllm: { ...current.vllm, [key]: value } };
      return current;
    });
  };

  const markProviderUnchecked = (providerId: 'claude-cli' | 'codex-cli'): void => {
    setProviderModelStates((current) => ({
      ...current,
      [providerId]: {
        ...current[providerId],
        availability: { status: 'unavailable' },
        checkStatus: 'unchecked',
      },
    }));
    setModelError('');
  };

  const updateClaudeCliSetting = <Key extends keyof ClaudeCliPrettifySettings>(
    key: Key,
    value: ClaudeCliPrettifySettings[Key],
    fieldKey: AppSettingsFieldKey,
  ): void => {
    clearFieldErrors(fieldKey);
    setPrettifySettings((current) =>
      current ? { ...current, claudeCli: { ...current.claudeCli, [key]: value } } : current,
    );
    if (key === 'executablePath') markProviderUnchecked('claude-cli');
  };

  const updateCodexCliSetting = <Key extends keyof CodexCliPrettifySettings>(
    key: Key,
    value: CodexCliPrettifySettings[Key],
    fieldKey: AppSettingsFieldKey,
  ): void => {
    clearFieldErrors(fieldKey);
    setPrettifySettings((current) =>
      current ? { ...current, codexCli: { ...current.codexCli, [key]: value } } : current,
    );
    if (key === 'executablePath') markProviderUnchecked('codex-cli');
  };

  const updateModel = (value: string): void => {
    clearFieldErrors('prettifyModel');
    resetModelActionState();
    setPrettifySettings((current) => {
      if (!current) return current;
      switch (current.providerId) {
        case 'ollama':
          return { ...current, ollama: { ...current.ollama, model: value } };
        case 'vllm':
          return { ...current, vllm: { ...current.vllm, model: value } };
        case 'claude-cli':
          return { ...current, claudeCli: { ...current.claudeCli, model: value } };
        case 'codex-cli':
          return {
            ...current,
            codexCli: normalizeCodexCliSettingsForModel(
              { ...current.codexCli, model: value },
              modelOptions['codex-cli'],
              providerModelStates['codex-cli'].checkStatus === 'available',
            ),
          };
      }
    });
  };

  const updateVllmApiKey = (value: string): void => {
    clearFieldErrors('prettifyApiKey');
    setPrettifySettings((current) =>
      current ? { ...current, vllm: { ...current.vllm, apiKey: value, clearApiKey: false } } : current,
    );
  };

  const clearVllmApiKey = (): void => {
    clearFieldErrors('prettifyApiKey');
    setPrettifySettings((current) =>
      current ? { ...current, vllm: { ...current.vllm, apiKey: '', hasApiKey: false, clearApiKey: true } } : current,
    );
  };

  const selectedOllamaModelLoaded = Boolean(
    prettifySettings?.providerId === 'ollama' &&
    prettifySettings.ollama.model &&
    modelOptions.ollama.some((option) => option.id === prettifySettings.ollama.model && Boolean(option.isLoaded)),
  );

  const loadSelectedOllamaModel = async (): Promise<void> => {
    if (!prettifySettings || prettifySettings.providerId !== 'ollama') return;
    setIsModelActionMenuOpen(false);
    if (!prettifySettings.ollama.model) {
      setFieldErrors((current) => ({
        ...current,
        prettifyModel: createAppSettingsValidationError('prettify-model-unavailable'),
      }));
      return;
    }
    if (selectedOllamaModelLoaded) {
      setModelLoadError('');
      setModelLoadStatus(t('prettify.modelAlreadyLoaded', { model: prettifySettings.ollama.model }));
      return;
    }

    setIsLoadingModel(true);
    setModelLoadError('');
    setModelLoadStatus('');
    clearFieldErrors('prettifyModel');
    try {
      const selectedModel = prettifySettings.ollama.model;
      const result = await window.electronAPI.loadPrettifyModel('ollama', prettifySettings);
      if (!result.success) {
        setModelLoadError(result.error || t('prettify.modelLoadFailed'));
        return;
      }
      setModelOptions((current) => ({
        ...current,
        ollama: [
          ...current.ollama.map((option) =>
            option.id === selectedModel
              ? { ...option, isLoaded: true, vramSizeBytes: result.vramSizeBytes ?? option.vramSizeBytes }
              : { ...option, isLoaded: false },
          ),
          ...(current.ollama.some((option) => option.id === selectedModel)
            ? []
            : [{ id: selectedModel, isLoaded: true, name: selectedModel, vramSizeBytes: result.vramSizeBytes }]),
        ],
      }));
      setModelLoadStatus(t('prettify.modelLoaded', { model: result.model || selectedModel }));
    } catch (error: unknown) {
      setModelLoadError(getErrorMessage(error));
    } finally {
      setIsLoadingModel(false);
    }
  };

  const unloadSelectedOllamaModel = async (): Promise<void> => {
    if (!prettifySettings || prettifySettings.providerId !== 'ollama') return;
    setIsModelActionMenuOpen(false);
    if (!prettifySettings.ollama.model) {
      setFieldErrors((current) => ({
        ...current,
        prettifyModel: createAppSettingsValidationError('prettify-model-unavailable'),
      }));
      return;
    }
    if (!selectedOllamaModelLoaded) {
      setModelLoadError('');
      setModelLoadStatus(t('prettify.modelNotLoaded', { model: prettifySettings.ollama.model }));
      return;
    }

    setIsLoadingModel(true);
    setModelLoadError('');
    setModelLoadStatus('');
    clearFieldErrors('prettifyModel');
    try {
      const selectedModel = prettifySettings.ollama.model;
      const result = await window.electronAPI.unloadPrettifyModel('ollama', prettifySettings);
      if (!result.success) {
        setModelLoadError(result.error || t('prettify.modelUnloadFailed'));
        return;
      }
      setModelOptions((current) => ({
        ...current,
        ollama: current.ollama.map((option) => (option.id === selectedModel ? { ...option, isLoaded: false } : option)),
      }));
      setModelLoadStatus(t('prettify.modelFreed', { model: result.model || selectedModel }));
    } catch (error: unknown) {
      setModelLoadError(getErrorMessage(error));
    } finally {
      setIsLoadingModel(false);
    }
  };

  useEffect(() => {
    disposedRef.current = false;
    const unsubscribe = window.electronAPI.onPrettifySettingsChanged((snapshot) => {
      modelRequestRef.current += 1;
      setPrettifySettings((current) =>
        current ? applyExternalPrettifyProviderSelection(current, snapshot.providerId) : current,
      );
      setInitialPrettifySettings((current) =>
        current ? applyExternalPrettifyProviderSelection(current, snapshot.providerId) : current,
      );
      setProviderModelStates(createPrettifyProviderModelStates());
      setIsLoadingModels(false);
      setIsLoadingModel(false);
      resetModelActionState();
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.prettifyProvider;
        for (const field of PRETTIFY_PROVIDER_SPECIFIC_FIELD_KEYS) delete next[field];
        return next;
      });
    });
    return () => {
      disposedRef.current = true;
      modelRequestRef.current += 1;
      unsubscribe();
    };
  }, [resetModelActionState, setFieldErrors]);

  return {
    applySavedSnapshot,
    changeProvider,
    clearVllmApiKey,
    initialPrettifySettings,
    initialize,
    isLoadingModel,
    isLoadingModels,
    isModelActionMenuOpen,
    loadSelectedOllamaModel,
    modelError,
    modelLoadError,
    modelLoadStatus,
    modelOptions,
    prettifySettings,
    providerModelStates,
    refreshModels: () => (prettifySettings ? requestModels(prettifySettings, true) : Promise.resolve()),
    selectedOllamaModelLoaded,
    setIsModelActionMenuOpen,
    unloadSelectedOllamaModel,
    updateClaudeCliSetting,
    updateCodexCliSetting,
    updateHttpSetting,
    updateModel,
    updateSetting,
    updateVllmApiKey,
  };
}
