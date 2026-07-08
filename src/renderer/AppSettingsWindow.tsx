import React, { useEffect, useRef, useState } from 'react';
import rendererLog from 'electron-log/renderer';
import HotkeyModal from '@renderer/components/HotkeyModal';
import HotkeyRow from '@renderer/components/HotkeyRow';
import {
  createAppSettingsLogSummary,
  createEditableSettings,
  getCloakBrowserLocaleOptions,
  getCloakBrowserTimezoneOptions,
  hasAppSettingsFieldErrors,
  saveAppSettingsState,
  type AppSettingsSaveResult,
  type AppSettingsFieldErrors,
  type AppSettingsFieldKey,
  type EditableCloakBrowserSettings,
} from '@renderer/appSettingsUtils';
import { formatByteSize } from '@renderer/byteFormatting';
import { useI18n } from '@renderer/hooks/useI18n';
import { HOTKEY_TARGETS, type HotkeySettings, type HotkeyTarget } from '@shared/hotkeys';
import {
  PRETTIFY_PROVIDER_IDS,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';
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

const AppSettingsWindow: React.FC = () => {
  const { t } = useI18n();
  const prettifyModelActionMenuRef = useRef<HTMLDivElement>(null);
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
  const [hotkeyTarget, setHotkeyTarget] = useState<HotkeyTarget>('record');
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform>('linux');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AppSettingsFieldErrors>({});

  useEffect(() => {
    let disposed = false;
    Promise.all([
      window.electronAPI.getCloakBrowserSettings(),
      window.electronAPI.getPrettifySettings(),
      window.electronAPI.getTextActionSettings(),
      window.electronAPI.getHotkey(),
      window.electronAPI.getPlatform(),
    ])
      .then(([nextSettings, nextPrettifySettings, nextTextActionSettings, nextHotkeySettings, nextPlatform]) => {
        if (!disposed) {
          const editableSettings = createEditableSettings(nextSettings);
          setSettings(editableSettings);
          setInitialSettings(editableSettings);
          setPrettifySettings(nextPrettifySettings);
          setInitialPrettifySettings(nextPrettifySettings);
          setTextActionSettings(nextTextActionSettings);
          setInitialTextActionSettings(nextTextActionSettings);
          setHotkeySettings(nextHotkeySettings);
          setPlatform(nextPlatform);
        }
      })
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!isPrettifyModelActionMenuOpen) return undefined;

    const handleDocumentMouseDown = (event: MouseEvent): void => {
      if (!prettifyModelActionMenuRef.current?.contains(event.target as Node)) {
        setIsPrettifyModelActionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [isPrettifyModelActionMenuOpen]);

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

  const renderFieldError = (fieldKey: AppSettingsFieldKey): React.ReactNode => {
    const message = fieldErrors[fieldKey];
    return message ? <span className="settings-field-error">{message}</span> : null;
  };

  const getHotkeyValue = (target: HotkeyTarget): string => {
    if (!hotkeySettings) return '';
    if (target === 'record') return hotkeySettings.hotkey;
    if (target === 'stop') return hotkeySettings.stopHotkey;
    if (target === 'cancel') return hotkeySettings.cancelHotkey;
    if (target === 'translate') return hotkeySettings.translateHotkey;
    if (target === 'retryTranscription') return hotkeySettings.retryTranscriptionHotkey;
    return hotkeySettings.prettifyHotkey;
  };

  const openHotkeyModal = (target: HotkeyTarget): void => {
    setHotkeyTarget(target);
    setShowHotkeyModal(true);
  };

  const applyHotkey = async (newHotkey: string): Promise<void> => {
    setError('');
    try {
      const result = await window.electronAPI.setHotkey(hotkeyTarget, newHotkey);
      if (result.success) {
        setHotkeySettings(result);
      } else {
        setError(t('appSettings.saveFailed'));
      }
    } catch (hotkeyError: unknown) {
      setError(hotkeyError instanceof Error ? hotkeyError.message : String(hotkeyError));
    } finally {
      setShowHotkeyModal(false);
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

  const closeWindow = (): void => {
    void window.electronAPI.closeAppSettings();
  };

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
    closeWindow();
  };

  const proxyGeoipActive = Boolean(settings?.proxy.enabled && settings.proxy.geoip);
  const localeOptions = getCloakBrowserLocaleOptions(settings?.locale);
  const timezoneOptions = getCloakBrowserTimezoneOptions(settings?.timezone);
  const activePrettifyProviderSettings = prettifySettings ? getActivePrettifyProviderSettings(prettifySettings) : null;
  const activePrettifyModelOptions =
    prettifySettings && activePrettifyProviderSettings
      ? [
          ...(!activePrettifyProviderSettings.model ||
          prettifyModelOptions[prettifySettings.providerId].some(
            (option) => option.id === activePrettifyProviderSettings.model,
          )
            ? []
            : [
                {
                  id: activePrettifyProviderSettings.model,
                  name: activePrettifyProviderSettings.model,
                },
              ]),
          ...prettifyModelOptions[prettifySettings.providerId],
        ]
      : [];
  const selectedOllamaModelLoaded = isSelectedOllamaModelLoaded();
  const canUsePrettifyModelActions =
    prettifySettings?.providerId === 'ollama' && Boolean(activePrettifyProviderSettings?.model);
  const getPrettifyModelOptionLabel = (option: PrettifyModelOption): string => {
    const name = option.name || option.id;
    if (prettifySettings?.providerId !== 'ollama') return name;

    const loadedVramSize = formatByteSize(option.vramSizeBytes);
    if (loadedVramSize) {
      return `${name} (${t('prettify.modelVramLoaded', { size: loadedVramSize })})`;
    }

    const approximateVramSize = formatByteSize(option.sizeBytes);
    return approximateVramSize ? `${name} (${t('prettify.modelVramApprox', { size: approximateVramSize })})` : name;
  };

  return (
    <main className="settings-window-shell">
      <section className="settings-window-panel">
        <h1>{t('appSettings.title')}</h1>
        {(!settings ||
          !initialSettings ||
          !prettifySettings ||
          !initialPrettifySettings ||
          !textActionSettings ||
          !initialTextActionSettings ||
          !hotkeySettings) &&
          !error && <p className="modal-instruction">{t('loading.initializing')}</p>}

        {settings &&
          initialSettings &&
          prettifySettings &&
          initialPrettifySettings &&
          textActionSettings &&
          initialTextActionSettings &&
          hotkeySettings && (
            <div className="app-settings-body">
              <section className="settings-section">
                <h2>{t('appSettings.hotkeys')}</h2>

                <div className="settings-group hotkeys-section app-settings-hotkeys">
                  {HOTKEY_TARGETS.map((target) => (
                    <HotkeyRow
                      key={target}
                      label={t(`hotkey.${target}`)}
                      value={getHotkeyValue(target)}
                      onChangeClick={() => openHotkeyModal(target)}
                      enabled={
                        target === 'translate'
                          ? textActionSettings.translateEnabled
                          : target === 'prettify'
                            ? textActionSettings.prettifyEnabled
                            : undefined
                      }
                      onEnabledChange={
                        target === 'translate'
                          ? (enabled) => updateTextActionSetting('translateEnabled', enabled)
                          : target === 'prettify'
                            ? (enabled) => updateTextActionSetting('prettifyEnabled', enabled)
                            : undefined
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <h2>{t('appSettings.prettify')}</h2>

                <div className="settings-group">
                  <label className="settings-field">
                    <span>{t('prettify.provider')}</span>
                    {renderFieldError('prettifyProvider')}
                    <select
                      value={prettifySettings.providerId}
                      onChange={(event) =>
                        updatePrettifySetting(
                          'providerId',
                          event.target.value as PrettifyProviderId,
                          'prettifyProvider',
                        )
                      }
                    >
                      {PRETTIFY_PROVIDER_IDS.map((providerId) => (
                        <option key={providerId} value={providerId}>
                          {t(`prettify.provider.${providerId}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>{t('prettify.baseUrl')}</span>
                    {renderFieldError('prettifyBaseUrl')}
                    <input
                      type="url"
                      value={activePrettifyProviderSettings?.baseUrl || ''}
                      onChange={(event) =>
                        updatePrettifyProviderSetting('baseUrl', event.target.value, 'prettifyBaseUrl')
                      }
                    />
                  </label>
                  {prettifySettings.providerId === 'vllm' && (
                    <label className="settings-field">
                      <span>{t('prettify.vllmApiKey')}</span>
                      {renderFieldError('prettifyApiKey')}
                      <div className="settings-input-action">
                        <input
                          type="password"
                          value={prettifySettings.vllm.apiKey || ''}
                          placeholder={
                            prettifySettings.vllm.hasApiKey
                              ? t('prettify.vllmApiKeyStored')
                              : t('prettify.vllmApiKeyPlaceholder')
                          }
                          onChange={(event) => updateVllmApiKey(event.target.value)}
                        />
                        <button
                          type="button"
                          className="hotkey-btn"
                          disabled={!prettifySettings.vllm.hasApiKey && !prettifySettings.vllm.apiKey}
                          onClick={clearVllmApiKey}
                        >
                          {t('prettify.clearVllmApiKey')}
                        </button>
                      </div>
                    </label>
                  )}
                  <label className="settings-field">
                    <span>{t('prettify.model')}</span>
                    {renderFieldError('prettifyModel')}
                    <div
                      className={`settings-input-action${
                        prettifySettings.providerId === 'ollama' ? ' settings-model-action' : ''
                      }`}
                    >
                      <select
                        value={activePrettifyProviderSettings?.model || ''}
                        onChange={(event) =>
                          updatePrettifyProviderSetting('model', event.target.value, 'prettifyModel')
                        }
                      >
                        <option value="">{t('prettify.noModels')}</option>
                        {activePrettifyModelOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {getPrettifyModelOptionLabel(option)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="hotkey-btn"
                        disabled={isLoadingPrettifyModels}
                        onClick={() => void refreshPrettifyModels()}
                      >
                        {isLoadingPrettifyModels ? t('prettify.loadingModels') : t('prettify.refreshModels')}
                      </button>
                      {prettifySettings.providerId === 'ollama' && (
                        <div className="settings-model-actions-menu" ref={prettifyModelActionMenuRef}>
                          <button
                            type="button"
                            aria-expanded={isPrettifyModelActionMenuOpen}
                            aria-haspopup="menu"
                            aria-label={t('prettify.modelActions')}
                            className="hotkey-btn settings-menu-trigger"
                            disabled={isLoadingPrettifyModel || !canUsePrettifyModelActions}
                            title={t('prettify.modelActions')}
                            onClick={() => setIsPrettifyModelActionMenuOpen((current) => !current)}
                          >
                            ...
                          </button>
                          {isPrettifyModelActionMenuOpen && (
                            <div className="settings-menu-dropdown" role="menu">
                              <button
                                type="button"
                                className="settings-menu-item"
                                disabled={isLoadingPrettifyModel || selectedOllamaModelLoaded}
                                role="menuitem"
                                title={t('prettify.loadModelTitle')}
                                onClick={() => void loadSelectedOllamaModel()}
                              >
                                {t('prettify.loadModel')}
                              </button>
                              <button
                                type="button"
                                className="settings-menu-item"
                                disabled={isLoadingPrettifyModel || !selectedOllamaModelLoaded}
                                role="menuitem"
                                title={t('prettify.freeModelTitle')}
                                onClick={() => void unloadSelectedOllamaModel()}
                              >
                                {t('prettify.freeModel')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {prettifyModelError && <span className="settings-field-error">{prettifyModelError}</span>}
                    {prettifyModelLoadError && <span className="settings-field-error">{prettifyModelLoadError}</span>}
                    {prettifyModelLoadStatus && <span className="settings-field-hint">{prettifyModelLoadStatus}</span>}
                  </label>
                  <label className="settings-field">
                    <span>{t('prettify.temperature', { value: prettifySettings.temperature.toFixed(2) })}</span>
                    {renderFieldError('prettifyTemperature')}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={prettifySettings.temperature}
                      onChange={(event) =>
                        updatePrettifySetting('temperature', Number(event.target.value), 'prettifyTemperature')
                      }
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('prettify.prompt')}</span>
                    {renderFieldError('prettifyPrompt')}
                    <textarea
                      className="app-settings-prettify-prompt"
                      value={prettifySettings.prompt}
                      onChange={(event) => updatePrettifySetting('prompt', event.target.value, 'prettifyPrompt')}
                    />
                  </label>
                </div>
              </section>

              <section className="settings-section">
                <h2>{t('appSettings.cloakBrowser')}</h2>

                <div className="settings-group">
                  <h3>{t('appSettings.behavior')}</h3>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.humanize}
                      onChange={(event) => updateSetting('humanize', event.target.checked)}
                    />
                    <span>{t('appSettings.humanize')}</span>
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.humanPreset')}</span>
                    {renderFieldError('humanPreset')}
                    <select
                      value={settings.humanPreset}
                      onChange={(event) =>
                        updateSetting('humanPreset', event.target.value as typeof settings.humanPreset, 'humanPreset')
                      }
                    >
                      <option value="careful">{t('appSettings.humanPreset.careful')}</option>
                      <option value="default">{t('appSettings.humanPreset.default')}</option>
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.backgroundMode')}</span>
                    {renderFieldError('backgroundMode')}
                    <select
                      value={settings.backgroundMode}
                      onChange={(event) =>
                        updateSetting(
                          'backgroundMode',
                          event.target.value as typeof settings.backgroundMode,
                          'backgroundMode',
                        )
                      }
                    >
                      <option value="hidden">{t('appSettings.backgroundMode.hidden')}</option>
                      <option value="visible">{t('appSettings.backgroundMode.visible')}</option>
                    </select>
                  </label>
                </div>

                <div className="settings-group">
                  <h3>{t('appSettings.identity')}</h3>
                  <label className="settings-field">
                    <span>{t('appSettings.fingerprintSeed')}</span>
                    {renderFieldError('fingerprintSeed')}
                    <div className="settings-input-action">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={settings.fingerprintSeed}
                        onChange={(event) => updateSetting('fingerprintSeed', event.target.value, 'fingerprintSeed')}
                      />
                      <button
                        type="button"
                        className="hotkey-btn"
                        onClick={() => updateSetting('fingerprintSeed', generateFingerprintSeed(), 'fingerprintSeed')}
                      >
                        {t('appSettings.resetFingerprint')}
                      </button>
                    </div>
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.locale')}</span>
                    {renderFieldError('locale')}
                    <select
                      value={settings.locale}
                      disabled={proxyGeoipActive}
                      onChange={(event) => updateSetting('locale', event.target.value, 'locale')}
                    >
                      {localeOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.timezone')}</span>
                    {renderFieldError('timezone')}
                    <select
                      value={settings.timezone}
                      disabled={proxyGeoipActive}
                      onChange={(event) => updateSetting('timezone', event.target.value, 'timezone')}
                    >
                      {timezoneOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="settings-group">
                  <h3>{t('appSettings.proxy')}</h3>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.proxy.enabled}
                      onChange={(event) => updateProxySetting('enabled', event.target.checked)}
                    />
                    <span>{t('appSettings.proxyEnabled')}</span>
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.proxyServer')}</span>
                    {renderFieldError('proxyServer')}
                    <input
                      type="text"
                      value={settings.proxy.server}
                      disabled={!settings.proxy.enabled}
                      onChange={(event) => updateProxySetting('server', event.target.value, 'proxyServer')}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.proxyBypass')}</span>
                    {renderFieldError('proxyBypass')}
                    <input
                      type="text"
                      value={settings.proxy.bypass}
                      disabled={!settings.proxy.enabled}
                      onChange={(event) => updateProxySetting('bypass', event.target.value, 'proxyBypass')}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.proxyUsername')}</span>
                    {renderFieldError('proxyUsername')}
                    <input
                      type="text"
                      value={settings.proxy.username}
                      disabled={!settings.proxy.enabled}
                      onChange={(event) => updateProxySetting('username', event.target.value, 'proxyUsername')}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('appSettings.proxyPassword')}</span>
                    {renderFieldError('proxyPassword')}
                    <div className="settings-input-action">
                      <input
                        type="password"
                        value={settings.proxy.password}
                        disabled={!settings.proxy.enabled}
                        placeholder={
                          settings.proxy.hasPassword
                            ? t('appSettings.proxyPasswordSaved')
                            : t('appSettings.proxyPassword')
                        }
                        onChange={(event) => updateProxySetting('password', event.target.value, 'proxyPassword')}
                      />
                      <button
                        type="button"
                        className="hotkey-btn"
                        disabled={!settings.proxy.hasPassword && !settings.proxy.password}
                        onClick={clearProxyPassword}
                      >
                        {t('appSettings.clearProxyPassword')}
                      </button>
                    </div>
                  </label>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.proxy.geoip}
                      disabled={!settings.proxy.enabled}
                      onChange={(event) => updateProxySetting('geoip', event.target.checked)}
                    />
                    <span>{t('appSettings.proxyGeoip')}</span>
                  </label>
                </div>
              </section>
            </div>
          )}

        {error && <p className="settings-error">{error}</p>}
        <div className="modal-buttons settings-close-row">
          <button
            className="modal-btn confirm"
            disabled={
              isSaving ||
              !settings ||
              !initialSettings ||
              !prettifySettings ||
              !initialPrettifySettings ||
              !textActionSettings ||
              !initialTextActionSettings
            }
            onClick={saveSettings}
          >
            {t('appSettings.save')}
          </button>
          <button className="modal-btn cancel" disabled={isSaving} onClick={closeWindow}>
            {t('hotkey.cancel')}
          </button>
        </div>
      </section>
      {showHotkeyModal && (
        <HotkeyModal
          target={hotkeyTarget}
          platform={platform}
          onApply={applyHotkey}
          onClose={() => setShowHotkeyModal(false)}
        />
      )}
    </main>
  );
};

export default AppSettingsWindow;
