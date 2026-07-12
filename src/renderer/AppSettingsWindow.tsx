import React, { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import rendererLog from 'electron-log/renderer';
import HotkeyModal from '@renderer/components/HotkeyModal';
import BrowserSection from '@renderer/components/settings/BrowserSection';
import NetworkSection from '@renderer/components/settings/NetworkSection';
import PrettifySection from '@renderer/components/settings/PrettifySection';
import SettingsFooter from '@renderer/components/settings/SettingsFooter';
import SettingsNavigation, { type SettingsSectionId } from '@renderer/components/settings/SettingsNavigation';
import ShortcutsSection from '@renderer/components/settings/ShortcutsSection';
import { useWindowStartupReady } from '@renderer/WindowStartupGate';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';
import { Tabs, TabsContent } from '@renderer/components/ui/tabs';
import {
  createAppSettingsLogSummary,
  createEditableSettings,
  getCloakBrowserLocaleOptions,
  getCloakBrowserTimezoneOptions,
  getAppSettingsFormState,
  hasAppSettingsFieldErrors,
  saveAppSettingsState,
  type AppSettingsSaveResult,
  type AppSettingsFieldErrors,
  type AppSettingsFieldKey,
  type EditableCloakBrowserSettings,
} from '@renderer/appSettingsUtils';
import { useI18n } from '@renderer/hooks/useI18n';
import { getSettingsCloseDisposition } from '@renderer/settingsCloseViewState';
import { type HotkeySettings, type HotkeyTarget } from '@shared/hotkeys';
import { type PrettifyModelOption, type PrettifyProviderId, type PrettifySettings } from '@shared/prettifySettings';
import type { TextActionSettings } from '@shared/textActionSettings';

const log = rendererLog.scope('app-settings');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function getActivePrettifyProviderSettings(settings: PrettifySettings) {
  return settings.providerId === 'vllm' ? settings.vllm : settings.ollama;
}

/** Coordinates the transactional CloakBrowser, prettify, text-action, and shortcut settings form. */
const AppSettingsWindow: React.FC = () => {
  const { isReady: isI18nReady, t } = useI18n();
  const [settings, setSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [prettifySettings, setPrettifySettings] = useState<PrettifySettings | null>(null);
  const [initialPrettifySettings, setInitialPrettifySettings] = useState<PrettifySettings | null>(null);
  const [textActionSettings, setTextActionSettings] = useState<TextActionSettings | null>(null);
  const [initialTextActionSettings, setInitialTextActionSettings] = useState<TextActionSettings | null>(null);
  const [hotkeySettings, setHotkeySettings] = useState<HotkeySettings | null>(null);
  const [prettifyModelOptions, setPrettifyModelOptions] = useState<Record<PrettifyProviderId, PrettifyModelOption[]>>({
    ollama: [],
    vllm: [],
  });
  const [prettifyModelError, setPrettifyModelError] = useState('');
  const [isLoadingPrettifyModels, setIsLoadingPrettifyModels] = useState(false);
  const [prettifyModelLoadError, setPrettifyModelLoadError] = useState('');
  const [prettifyModelLoadStatus, setPrettifyModelLoadStatus] = useState('');
  const [isLoadingPrettifyModel, setIsLoadingPrettifyModel] = useState(false);
  const [isPrettifyModelActionMenuOpen, setIsPrettifyModelActionMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('shortcuts');
  const [hotkeyTarget, setHotkeyTarget] = useState<HotkeyTarget>('record');
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform>('linux');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AppSettingsFieldErrors>({});
  const [isDiscardConfirmationOpen, setIsDiscardConfirmationOpen] = useState(false);
  const closeRequestFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    const loadSettings = async (): Promise<void> => {
      try {
        const [nextSettings, nextPrettifySettings, nextTextActionSettings, nextHotkeySettings, nextPlatform] =
          await Promise.all([
            window.electronAPI.getCloakBrowserSettings(),
            window.electronAPI.getPrettifySettings(),
            window.electronAPI.getTextActionSettings(),
            window.electronAPI.getHotkey(),
            window.electronAPI.getPlatform(),
          ]);
        if (disposed) return;

        const editableSettings = createEditableSettings(nextSettings);
        setSettings(editableSettings);
        setInitialSettings(editableSettings);
        setPrettifySettings(nextPrettifySettings);
        setInitialPrettifySettings(nextPrettifySettings);
        setTextActionSettings(nextTextActionSettings);
        setInitialTextActionSettings(nextTextActionSettings);
        setHotkeySettings(nextHotkeySettings);
        setPlatform(nextPlatform);
        setIsLoadingPrettifyModels(true);

        try {
          const result = await window.electronAPI.listPrettifyModels(
            nextPrettifySettings.providerId,
            nextPrettifySettings,
          );
          if (disposed) return;
          if (!result.success) {
            setPrettifyModelError(result.error || '');
            return;
          }

          setPrettifyModelOptions((current) => ({
            ...current,
            [result.providerId]: result.models,
          }));
        } catch (modelError: unknown) {
          if (!disposed) {
            setPrettifyModelError(getErrorMessage(modelError));
          }
        } finally {
          if (!disposed) {
            setIsLoadingPrettifyModels(false);
          }
        }
      } catch (loadError: unknown) {
        if (!disposed) {
          setError(getErrorMessage(loadError));
        }
      }
    };

    void loadSettings();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      void window.electronAPI.setHotkeyCaptureActive(false).catch(() => undefined);
    };
  }, []);

  const updateSetting = <Key extends keyof EditableCloakBrowserSettings>(
    key: Key,
    value: EditableCloakBrowserSettings[Key],
    fieldKey?: AppSettingsFieldKey,
  ): void => {
    if (fieldKey) clearFieldErrors(fieldKey);
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateProxySetting = <Key extends keyof EditableCloakBrowserSettings['proxy']>(
    key: Key,
    value: EditableCloakBrowserSettings['proxy'][Key],
    fieldKey?: AppSettingsFieldKey,
  ): void => {
    const fieldsToClear: AppSettingsFieldKey[] = [];
    if (fieldKey) fieldsToClear.push(fieldKey);
    if (key === 'enabled' && value === false) fieldsToClear.push('proxyServer', 'proxyUsername', 'proxyPassword');
    if (key === 'server') fieldsToClear.push('proxyUsername', 'proxyPassword');
    if (key === 'geoip' && value === true) fieldsToClear.push('locale', 'timezone');
    if (fieldsToClear.length) clearFieldErrors(...fieldsToClear);

    setSettings((current) =>
      current
        ? {
            ...current,
            proxy: {
              ...current.proxy,
              [key]: value,
            },
          }
        : current,
    );
  };

  const updatePrettifySetting = <Key extends keyof PrettifySettings>(
    key: Key,
    value: PrettifySettings[Key],
    fieldKey: AppSettingsFieldKey,
  ): void => {
    clearFieldErrors(fieldKey);
    if (key === 'providerId') {
      setPrettifyModelError('');
      setPrettifyModelLoadError('');
      setPrettifyModelLoadStatus('');
      setIsPrettifyModelActionMenuOpen(false);
      clearFieldErrors('prettifyBaseUrl', 'prettifyModel', 'prettifyApiKey');
    }
    setPrettifySettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const updatePrettifyProviderSetting = <Key extends keyof PrettifySettings['ollama'] & keyof PrettifySettings['vllm']>(
    key: Key,
    value: PrettifySettings['ollama'][Key] | PrettifySettings['vllm'][Key],
    fieldKey: AppSettingsFieldKey,
  ): void => {
    clearFieldErrors(fieldKey);
    setPrettifyModelError('');
    setPrettifyModelLoadError('');
    setPrettifyModelLoadStatus('');
    if (key === 'baseUrl' || key === 'model') {
      setIsPrettifyModelActionMenuOpen(false);
    }
    setPrettifySettings((current) =>
      current
        ? {
            ...current,
            [current.providerId]: {
              ...current[current.providerId],
              [key]: value,
            },
          }
        : current,
    );
  };

  const updateVllmApiKey = (value: string): void => {
    clearFieldErrors('prettifyApiKey');
    setPrettifySettings((current) =>
      current
        ? {
            ...current,
            vllm: {
              ...current.vllm,
              apiKey: value,
              clearApiKey: false,
            },
          }
        : current,
    );
  };

  const clearVllmApiKey = (): void => {
    clearFieldErrors('prettifyApiKey');
    setPrettifySettings((current) =>
      current
        ? {
            ...current,
            vllm: {
              ...current.vllm,
              apiKey: '',
              hasApiKey: false,
              clearApiKey: true,
            },
          }
        : current,
    );
  };

  const refreshPrettifyModels = async (): Promise<void> => {
    if (!prettifySettings) return;

    setIsLoadingPrettifyModels(true);
    setPrettifyModelError('');
    clearFieldErrors('prettifyModel');
    try {
      const providerId = prettifySettings.providerId;
      const result = await window.electronAPI.listPrettifyModels(providerId, prettifySettings);
      if (!result.success) {
        setPrettifyModelError(result.error || t('prettify.modelsRefreshFailed'));
        return;
      }

      setPrettifyModelOptions((current) => ({
        ...current,
        [providerId]: result.models,
      }));

      const activeProviderSettings = getActivePrettifyProviderSettings(prettifySettings);
      if (!activeProviderSettings.model && result.models[0]) {
        updatePrettifyProviderSetting('model', result.models[0].id, 'prettifyModel');
      }
    } catch (modelError: unknown) {
      setPrettifyModelError(getErrorMessage(modelError));
    } finally {
      setIsLoadingPrettifyModels(false);
    }
  };

  const isSelectedOllamaModelLoaded = (): boolean => {
    if (!prettifySettings || prettifySettings.providerId !== 'ollama' || !prettifySettings.ollama.model) return false;
    return prettifyModelOptions.ollama.some(
      (option) => option.id === prettifySettings.ollama.model && Boolean(option.isLoaded),
    );
  };

  const loadSelectedOllamaModel = async (): Promise<void> => {
    if (!prettifySettings || prettifySettings.providerId !== 'ollama') return;
    setIsPrettifyModelActionMenuOpen(false);
    if (!prettifySettings.ollama.model) {
      setFieldErrors((current) => ({ ...current, prettifyModel: t('prettify.noModels') }));
      return;
    }
    if (isSelectedOllamaModelLoaded()) {
      setPrettifyModelLoadError('');
      setPrettifyModelLoadStatus(t('prettify.modelAlreadyLoaded', { model: prettifySettings.ollama.model }));
      return;
    }

    setIsLoadingPrettifyModel(true);
    setPrettifyModelLoadError('');
    setPrettifyModelLoadStatus('');
    clearFieldErrors('prettifyModel');
    try {
      const selectedModel = prettifySettings.ollama.model;
      const result = await window.electronAPI.loadPrettifyModel('ollama', prettifySettings);
      if (!result.success) {
        setPrettifyModelLoadError(result.error || t('prettify.modelLoadFailed'));
        return;
      }

      setPrettifyModelOptions((current) => ({
        ...current,
        ollama: [
          ...current.ollama.map((option) =>
            option.id === selectedModel
              ? {
                  ...option,
                  isLoaded: true,
                  vramSizeBytes: result.vramSizeBytes ?? option.vramSizeBytes,
                }
              : {
                  ...option,
                  isLoaded: false,
                },
          ),
          ...(current.ollama.some((option) => option.id === selectedModel)
            ? []
            : [
                {
                  id: selectedModel,
                  isLoaded: true,
                  name: selectedModel,
                  vramSizeBytes: result.vramSizeBytes,
                },
              ]),
        ],
      }));
      setPrettifyModelLoadStatus(t('prettify.modelLoaded', { model: result.model || selectedModel }));
    } catch (loadError: unknown) {
      setPrettifyModelLoadError(getErrorMessage(loadError));
    } finally {
      setIsLoadingPrettifyModel(false);
    }
  };

  const unloadSelectedOllamaModel = async (): Promise<void> => {
    if (!prettifySettings || prettifySettings.providerId !== 'ollama') return;
    setIsPrettifyModelActionMenuOpen(false);
    if (!prettifySettings.ollama.model) {
      setFieldErrors((current) => ({ ...current, prettifyModel: t('prettify.noModels') }));
      return;
    }
    if (!isSelectedOllamaModelLoaded()) {
      setPrettifyModelLoadError('');
      setPrettifyModelLoadStatus(t('prettify.modelNotLoaded', { model: prettifySettings.ollama.model }));
      return;
    }

    setIsLoadingPrettifyModel(true);
    setPrettifyModelLoadError('');
    setPrettifyModelLoadStatus('');
    clearFieldErrors('prettifyModel');
    try {
      const selectedModel = prettifySettings.ollama.model;
      const result = await window.electronAPI.unloadPrettifyModel('ollama', prettifySettings);
      if (!result.success) {
        setPrettifyModelLoadError(result.error || t('prettify.modelUnloadFailed'));
        return;
      }

      setPrettifyModelOptions((current) => ({
        ...current,
        ollama: current.ollama.map((option) =>
          option.id === selectedModel
            ? {
                ...option,
                isLoaded: false,
              }
            : option,
        ),
      }));
      setPrettifyModelLoadStatus(t('prettify.modelFreed', { model: result.model || selectedModel }));
    } catch (unloadError: unknown) {
      setPrettifyModelLoadError(getErrorMessage(unloadError));
    } finally {
      setIsLoadingPrettifyModel(false);
    }
  };

  const updateTextActionSetting = <Key extends keyof TextActionSettings>(
    key: Key,
    value: TextActionSettings[Key],
  ): void => {
    setTextActionSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  function clearFieldErrors(...keys: AppSettingsFieldKey[]): void {
    setFieldErrors((current) => {
      if (!keys.some((key) => current[key])) return current;
      const next = { ...current };
      for (const key of keys) {
        delete next[key];
      }
      return next;
    });
  }

  const getHotkeyValue = (target: HotkeyTarget): string => {
    if (!hotkeySettings) return '';
    if (target === 'record') return hotkeySettings.hotkey;
    if (target === 'stop') return hotkeySettings.stopHotkey;
    if (target === 'cancel') return hotkeySettings.cancelHotkey;
    if (target === 'translate') return hotkeySettings.translateHotkey;
    if (target === 'retryTranscription') return hotkeySettings.retryTranscriptionHotkey;
    return hotkeySettings.prettifyHotkey;
  };

  const openHotkeyModal = async (target: HotkeyTarget): Promise<void> => {
    setError('');
    try {
      const result = await window.electronAPI.setHotkeyCaptureActive(true);
      if (!result.success) {
        setError(t('appSettings.saveFailed'));
        return;
      }
      setHotkeyTarget(target);
      setShowHotkeyModal(true);
    } catch (hotkeyError: unknown) {
      setError(hotkeyError instanceof Error ? hotkeyError.message : String(hotkeyError));
    }
  };

  const closeHotkeyModal = (): void => {
    setShowHotkeyModal(false);
    void window.electronAPI.setHotkeyCaptureActive(false).catch(() => undefined);
  };

  const applyHotkey = async (newHotkey: string): Promise<void> => {
    setError('');
    try {
      const result = await window.electronAPI.setHotkey(hotkeyTarget, newHotkey);
      if (result.success) {
        setHotkeySettings(result);
      } else {
        setError(result.error || t('appSettings.saveFailed'));
      }
    } catch (hotkeyError: unknown) {
      setError(hotkeyError instanceof Error ? hotkeyError.message : String(hotkeyError));
    } finally {
      closeHotkeyModal();
    }
  };

  const clearProxyPassword = (): void => {
    clearFieldErrors('proxyPassword');
    setSettings((current) =>
      current
        ? {
            ...current,
            proxy: {
              ...current.proxy,
              password: '',
              hasPassword: false,
              clearPassword: true,
            },
          }
        : current,
    );
  };

  const forceCloseWindow = useCallback((): void => {
    void window.electronAPI.closeAppSettings();
  }, []);

  /** Saves all dirty settings groups in their dependency-safe order. */
  const saveSettings = async (): Promise<void> => {
    if (
      !settings ||
      !initialSettings ||
      !prettifySettings ||
      !initialPrettifySettings ||
      !textActionSettings ||
      !initialTextActionSettings
    ) {
      log.debug('App Settings save ignored because settings are not fully loaded');
      return;
    }

    setIsSaving(true);
    setError('');
    setFieldErrors({});
    const localeOptions = getCloakBrowserLocaleOptions(settings.locale);
    const timezoneOptions = getCloakBrowserTimezoneOptions(settings.timezone);
    const saveInput = {
      settings,
      initialSettings,
      localeValues: localeOptions,
      prettifySettings,
      initialPrettifySettings,
      textActionSettings,
      initialTextActionSettings,
      timezoneValues: timezoneOptions,
    };
    const logSummary = createAppSettingsLogSummary(saveInput);
    log.info('Saving App Settings:', { changedGroups: logSummary.changedGroups });
    log.debug('App Settings save summary:', logSummary);
    if (logSummary.changedGroups.length === 0) {
      log.debug('App Settings save requested with no changes');
    }

    let saveResult: AppSettingsSaveResult;
    try {
      saveResult = await saveAppSettingsState(saveInput, {
        saveCloakBrowserSettings: window.electronAPI.saveCloakBrowserSettings,
        setPrettifySettings: window.electronAPI.setPrettifySettings,
        setTextActionSettings: window.electronAPI.setTextActionSettings,
      });
    } catch (saveError: unknown) {
      setIsSaving(false);
      log.error('App Settings save IPC error:', getErrorMessage(saveError));
      setError(getErrorMessage(saveError));
      return;
    }
    if (saveResult.prettifySettings) {
      setPrettifySettings(saveResult.prettifySettings);
      if (saveResult.prettifySettingsSaved) {
        setInitialPrettifySettings(saveResult.prettifySettings);
      }
    }
    if (saveResult.textActionSettings) {
      setTextActionSettings(saveResult.textActionSettings);
      if (saveResult.textActionSettingsSaved) {
        setInitialTextActionSettings(saveResult.textActionSettings);
      }
    }
    if (saveResult.settings) {
      setSettings(saveResult.settings);
      if (saveResult.settingsSaved) {
        setInitialSettings(saveResult.settings);
      }
    }

    setIsSaving(false);
    if (!saveResult.success) {
      if (saveResult.fieldErrors && hasAppSettingsFieldErrors(saveResult.fieldErrors)) {
        log.warn('App Settings save blocked by validation:', {
          fields: Object.keys(saveResult.fieldErrors).filter(
            (field) => saveResult.fieldErrors?.[field as AppSettingsFieldKey],
          ),
        });
        setFieldErrors(saveResult.fieldErrors);
        return;
      }
      log.warn('App Settings save failed:', {
        error: saveResult.error,
        prettifySettingsSaved: Boolean(saveResult.prettifySettingsSaved),
        textActionSettingsSaved: Boolean(saveResult.textActionSettingsSaved),
        cloakBrowserSettingsSaved: Boolean(saveResult.settingsSaved),
      });
      setError(saveResult.error || t('appSettings.saveFailed'));
      return;
    }
    log.info('App Settings saved:', {
      changedGroups: logSummary.changedGroups,
      prettifySettingsSaved: Boolean(saveResult.prettifySettingsSaved),
      textActionSettingsSaved: Boolean(saveResult.textActionSettingsSaved),
      cloakBrowserSettingsSaved: Boolean(saveResult.settingsSaved),
    });
    log.info('App Settings save succeeded; closing settings window');
    forceCloseWindow();
  };

  const proxyGeoipActive = Boolean(settings?.proxy.enabled && settings.proxy.geoip);
  const localeOptions = getCloakBrowserLocaleOptions(settings?.locale);
  const timezoneOptions = getCloakBrowserTimezoneOptions(settings?.timezone);
  const selectedOllamaModelLoaded = isSelectedOllamaModelLoaded();
  const formState =
    settings &&
    initialSettings &&
    prettifySettings &&
    initialPrettifySettings &&
    textActionSettings &&
    initialTextActionSettings
      ? getAppSettingsFormState({
          initialPrettifySettings,
          initialSettings,
          initialTextActionSettings,
          localeValues: localeOptions,
          prettifySettings,
          settings,
          textActionSettings,
          timezoneValues: timezoneOptions,
        })
      : null;
  const visibleFieldErrors = formState?.isDirty ? { ...formState.validationErrors, ...fieldErrors } : fieldErrors;
  const isSettingsReady = Boolean(formState && hotkeySettings);
  useWindowStartupReady(isI18nReady && (isSettingsReady || Boolean(error)));
  const renderFieldError = (fieldKey: AppSettingsFieldKey): React.ReactNode => {
    const message = visibleFieldErrors[fieldKey];
    return message || null;
  };
  const saveDisabled = isSaving || !formState || !formState.isDirty || !formState.isValid;
  const isDirty = formState?.isDirty ?? false;
  const restoreCloseRequestFocus = useCallback((): void => {
    window.requestAnimationFrame(() => closeRequestFocusRef.current?.focus());
  }, []);
  const handleDiscardConfirmationOpenChange = useCallback(
    (open: boolean): void => {
      setIsDiscardConfirmationOpen(open);
      if (!open) {
        restoreCloseRequestFocus();
      }
    },
    [restoreCloseRequestFocus],
  );
  const requestCloseWindow = useCallback((): void => {
    const disposition = getSettingsCloseDisposition({ isDirty, isSaving });
    if (disposition === 'block') {
      return;
    }
    if (disposition === 'confirm') {
      if (isDiscardConfirmationOpen) {
        return;
      }
      closeRequestFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIsDiscardConfirmationOpen(true);
      return;
    }
    forceCloseWindow();
  }, [forceCloseWindow, isDirty, isDiscardConfirmationOpen, isSaving]);
  const discardChanges = useCallback((): void => {
    setIsDiscardConfirmationOpen(false);
    forceCloseWindow();
  }, [forceCloseWindow]);
  const handleDiscardConfirmationKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDiscardConfirmationOpenChange(false);
      }
    },
    [handleDiscardConfirmationOpenChange],
  );

  useEffect(() => window.electronAPI.onAppSettingsCloseRequested(requestCloseWindow), [requestCloseWindow]);

  return (
    <>
      <main className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-4 [-webkit-app-region:no-drag]">
        <header className="shrink-0">
          <h1 className="text-lg font-semibold text-foreground">{t('appSettings.title')}</h1>
        </header>
        {!isSettingsReady && !error && (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner label={t('loading.initializing')} />
            {t('loading.initializing')}
          </div>
        )}

        {settings &&
          initialSettings &&
          prettifySettings &&
          initialPrettifySettings &&
          textActionSettings &&
          initialTextActionSettings &&
          hotkeySettings && (
            <>
              <Tabs
                className="flex min-h-0 flex-1 flex-col"
                onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
                orientation="vertical"
                value={activeSection}
              >
                <div className="flex min-h-0 flex-1 gap-4">
                  <SettingsNavigation t={t} />
                  <div
                    className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
                    data-slot="settings-content"
                  >
                    <TabsContent className="mt-0" value="shortcuts">
                      <ShortcutsSection
                        getHotkeyValue={getHotkeyValue}
                        onHotkeyChange={(target) => void openHotkeyModal(target)}
                        onTextActionEnabledChange={updateTextActionSetting}
                        t={t}
                        textActionSettings={textActionSettings}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="prettify">
                      <PrettifySection
                        fieldError={renderFieldError}
                        isLoadingModel={isLoadingPrettifyModel}
                        isLoadingModels={isLoadingPrettifyModels}
                        isModelActionMenuOpen={isPrettifyModelActionMenuOpen}
                        modelLoadError={prettifyModelLoadError}
                        modelLoadStatus={prettifyModelLoadStatus}
                        modelOptions={prettifyModelOptions}
                        modelRefreshError={prettifyModelError}
                        onBaseUrlChange={(value) => updatePrettifyProviderSetting('baseUrl', value, 'prettifyBaseUrl')}
                        onClearVllmApiKey={clearVllmApiKey}
                        onLoadModel={() => void loadSelectedOllamaModel()}
                        onMaxOutputTokensChange={(value) =>
                          updatePrettifySetting('maxOutputTokens', value, 'prettifyMaxOutputTokens')
                        }
                        onMinPChange={(value) => updatePrettifySetting('minP', value, 'prettifyMinP')}
                        onModelActionMenuOpenChange={setIsPrettifyModelActionMenuOpen}
                        onModelChange={(value) => updatePrettifyProviderSetting('model', value, 'prettifyModel')}
                        onPromptChange={(value) => updatePrettifySetting('prompt', value, 'prettifyPrompt')}
                        onProviderChange={(providerId) =>
                          updatePrettifySetting('providerId', providerId, 'prettifyProvider')
                        }
                        onRefreshModels={() => void refreshPrettifyModels()}
                        onRepeatPenaltyChange={(value) =>
                          updatePrettifySetting('repeatPenalty', value, 'prettifyRepeatPenalty')
                        }
                        onSeedChange={(value) => updatePrettifySetting('seed', value, 'prettifySeed')}
                        onTemperatureChange={(value) =>
                          updatePrettifySetting('temperature', value, 'prettifyTemperature')
                        }
                        onTopKChange={(value) => updatePrettifySetting('topK', value, 'prettifyTopK')}
                        onTopPChange={(value) => updatePrettifySetting('topP', value, 'prettifyTopP')}
                        onUnloadModel={() => void unloadSelectedOllamaModel()}
                        onVllmApiKeyChange={updateVllmApiKey}
                        prettifySettings={prettifySettings}
                        selectedOllamaModelLoaded={selectedOllamaModelLoaded}
                        t={t}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="browser">
                      <BrowserSection
                        fieldError={renderFieldError}
                        localeOptions={localeOptions}
                        onBackgroundModeChange={(value) => updateSetting('backgroundMode', value, 'backgroundMode')}
                        onFingerprintSeedChange={(value) => updateSetting('fingerprintSeed', value, 'fingerprintSeed')}
                        onHumanizeChange={(value) => updateSetting('humanize', value)}
                        onHumanPresetChange={(value) => updateSetting('humanPreset', value, 'humanPreset')}
                        onLocaleChange={(value) => updateSetting('locale', value, 'locale')}
                        onResetFingerprint={() =>
                          updateSetting('fingerprintSeed', generateFingerprintSeed(), 'fingerprintSeed')
                        }
                        onTimezoneChange={(value) => updateSetting('timezone', value, 'timezone')}
                        proxyGeoipActive={proxyGeoipActive}
                        settings={settings}
                        t={t}
                        timezoneOptions={timezoneOptions}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="network">
                      <NetworkSection
                        fieldError={renderFieldError}
                        onBypassChange={(value) => updateProxySetting('bypass', value, 'proxyBypass')}
                        onClearPassword={clearProxyPassword}
                        onEnabledChange={(value) => updateProxySetting('enabled', value)}
                        onGeoipChange={(value) => updateProxySetting('geoip', value)}
                        onPasswordChange={(value) => updateProxySetting('password', value, 'proxyPassword')}
                        onServerChange={(value) => updateProxySetting('server', value, 'proxyServer')}
                        onUsernameChange={(value) => updateProxySetting('username', value, 'proxyUsername')}
                        settings={settings}
                        t={t}
                      />
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
              <SettingsFooter
                error={error}
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={() => void saveSettings()}
                saveDisabled={saveDisabled}
                t={t}
              />
            </>
          )}

        {!isSettingsReady && error && <p className="text-sm text-destructive">{error}</p>}
        {showHotkeyModal && (
          <HotkeyModal
            target={hotkeyTarget}
            platform={platform}
            onApply={(newHotkey) => void applyHotkey(newHotkey)}
            onClose={closeHotkeyModal}
          />
        )}
      </main>

      <AlertDialog open={isDiscardConfirmationOpen} onOpenChange={handleDiscardConfirmationOpenChange}>
        <AlertDialogContent onKeyDown={handleDiscardConfirmationKeyDown}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.discardChangesConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('appSettings.discardChangesDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t('common.keepEditing')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={discardChanges} variant="destructive">
                {t('common.discardChanges')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppSettingsWindow;
