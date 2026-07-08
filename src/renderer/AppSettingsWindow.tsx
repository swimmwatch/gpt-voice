import React, { useEffect, useState } from 'react';
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
import { useI18n } from '@renderer/hooks/useI18n';
import { HOTKEY_TARGETS, type HotkeySettings, type HotkeyTarget } from '@shared/hotkeys';
import { PRETTIFY_REASONING_VALUES, type PrettifyReasoning, type PrettifySettings } from '@shared/prettifySettings';
import type { TextActionSettings } from '@shared/textActionSettings';

const log = rendererLog.scope('app-settings');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

const AppSettingsWindow: React.FC = () => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [prettifySettings, setPrettifySettings] = useState<PrettifySettings | null>(null);
  const [initialPrettifySettings, setInitialPrettifySettings] = useState<PrettifySettings | null>(null);
  const [textActionSettings, setTextActionSettings] = useState<TextActionSettings | null>(null);
  const [initialTextActionSettings, setInitialTextActionSettings] = useState<TextActionSettings | null>(null);
  const [hotkeySettings, setHotkeySettings] = useState<HotkeySettings | null>(null);
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
    setPrettifySettings((current) => (current ? { ...current, [key]: value } : current));
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
    if (target === 'promptCompression') return hotkeySettings.promptCompressionHotkey;
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
                            : target === 'promptCompression'
                              ? textActionSettings.promptCompressionEnabled
                              : undefined
                      }
                      onEnabledChange={
                        target === 'translate'
                          ? (enabled) => updateTextActionSetting('translateEnabled', enabled)
                          : target === 'prettify'
                            ? (enabled) => updateTextActionSetting('prettifyEnabled', enabled)
                            : target === 'promptCompression'
                              ? (enabled) => updateTextActionSetting('promptCompressionEnabled', enabled)
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
                    <span>{t('prettify.prompt')}</span>
                    {renderFieldError('prettifyPrompt')}
                    <textarea
                      className="app-settings-prettify-prompt"
                      value={prettifySettings.prompt}
                      onChange={(event) => updatePrettifySetting('prompt', event.target.value, 'prettifyPrompt')}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('prettify.reasoning')}</span>
                    {renderFieldError('prettifyReasoning')}
                    <select
                      value={prettifySettings.reasoning}
                      onChange={(event) =>
                        updatePrettifySetting('reasoning', event.target.value as PrettifyReasoning, 'prettifyReasoning')
                      }
                    >
                      {PRETTIFY_REASONING_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {t(`prettify.reasoning.${value}`)}
                        </option>
                      ))}
                    </select>
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
