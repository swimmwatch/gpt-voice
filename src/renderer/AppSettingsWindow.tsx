import React, { useEffect, useState } from 'react';
import HotkeyModal from '@renderer/components/HotkeyModal';
import HotkeyRow from '@renderer/components/HotkeyRow';
import {
  createEditableSettings,
  saveAppSettingsState,
  type AppSettingsSaveResult,
  type EditableCloakBrowserSettings,
} from '@renderer/appSettingsUtils';
import { useI18n } from '@renderer/hooks/useI18n';
import { shouldWarnSocks5ProxyAuth } from '@shared/cloakBrowserSettings';
import type { HotkeySettings, HotkeyTarget } from '@shared/hotkeys';
import { PRETTIFY_REASONING_VALUES, type PrettifyReasoning, type PrettifySettings } from '@shared/prettifySettings';

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

const AppSettingsWindow: React.FC = () => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [prettifySettings, setPrettifySettings] = useState<PrettifySettings | null>(null);
  const [initialPrettifySettings, setInitialPrettifySettings] = useState<PrettifySettings | null>(null);
  const [hotkeySettings, setHotkeySettings] = useState<HotkeySettings | null>(null);
  const [hotkeyTarget, setHotkeyTarget] = useState<HotkeyTarget>('record');
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform>('linux');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    Promise.all([
      window.electronAPI.getCloakBrowserSettings(),
      window.electronAPI.getPrettifySettings(),
      window.electronAPI.getHotkey(),
      window.electronAPI.getPlatform(),
    ])
      .then(([nextSettings, nextPrettifySettings, nextHotkeySettings, nextPlatform]) => {
        if (!disposed) {
          const editableSettings = createEditableSettings(nextSettings);
          setSettings(editableSettings);
          setInitialSettings(editableSettings);
          setPrettifySettings(nextPrettifySettings);
          setInitialPrettifySettings(nextPrettifySettings);
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
  ): void => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateProxySetting = <Key extends keyof EditableCloakBrowserSettings['proxy']>(
    key: Key,
    value: EditableCloakBrowserSettings['proxy'][Key],
  ): void => {
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

  const updatePrettifySetting = <Key extends keyof PrettifySettings>(key: Key, value: PrettifySettings[Key]): void => {
    setPrettifySettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const getHotkeyValue = (target: HotkeyTarget): string => {
    if (!hotkeySettings) return '';
    if (target === 'record') return hotkeySettings.hotkey;
    if (target === 'stop') return hotkeySettings.stopHotkey;
    if (target === 'cancel') return hotkeySettings.cancelHotkey;
    if (target === 'translate') return hotkeySettings.translateHotkey;
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
    if (!settings || !initialSettings || !prettifySettings || !initialPrettifySettings) return;

    setIsSaving(true);
    setError('');

    let saveResult: AppSettingsSaveResult;
    try {
      saveResult = await saveAppSettingsState(
        {
          settings,
          initialSettings,
          prettifySettings,
          initialPrettifySettings,
        },
        {
          saveCloakBrowserSettings: window.electronAPI.saveCloakBrowserSettings,
          setPrettifySettings: window.electronAPI.setPrettifySettings,
        },
      );
    } catch (saveError: unknown) {
      setIsSaving(false);
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      return;
    }
    if (saveResult.prettifySettings) {
      setPrettifySettings(saveResult.prettifySettings);
      if (saveResult.prettifySettingsSaved) {
        setInitialPrettifySettings(saveResult.prettifySettings);
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
      setError(saveResult.error || t('appSettings.saveFailed'));
      return;
    }
    closeWindow();
  };

  const proxyGeoipActive = Boolean(settings?.proxy.enabled && settings.proxy.geoip);
  const showSocks5ProxyAuthWarning = Boolean(settings && shouldWarnSocks5ProxyAuth(settings.proxy));

  return (
    <main className="settings-window-shell">
      <section className="settings-window-panel">
        <h1>{t('appSettings.title')}</h1>
        {(!settings || !initialSettings || !prettifySettings || !initialPrettifySettings || !hotkeySettings) &&
          !error && <p className="modal-instruction">{t('loading.initializing')}</p>}

        {settings && initialSettings && prettifySettings && initialPrettifySettings && hotkeySettings && (
          <div className="app-settings-body">
            <section className="settings-section">
              <h2>{t('appSettings.hotkeys')}</h2>

              <div className="settings-group hotkeys-section app-settings-hotkeys">
                {(['record', 'stop', 'cancel', 'translate', 'prettify'] as const).map((target) => (
                  <HotkeyRow
                    key={target}
                    label={t(`hotkey.${target}`)}
                    value={getHotkeyValue(target)}
                    onChangeClick={() => openHotkeyModal(target)}
                  />
                ))}
              </div>
            </section>

            <section className="settings-section">
              <h2>{t('appSettings.prettify')}</h2>

              <div className="settings-group">
                <label className="settings-field">
                  <span>{t('prettify.prompt')}</span>
                  <textarea
                    className="app-settings-prettify-prompt"
                    value={prettifySettings.prompt}
                    onChange={(event) => updatePrettifySetting('prompt', event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>{t('prettify.reasoning')}</span>
                  <select
                    value={prettifySettings.reasoning}
                    onChange={(event) => updatePrettifySetting('reasoning', event.target.value as PrettifyReasoning)}
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
                  <select
                    value={settings.humanPreset}
                    onChange={(event) =>
                      updateSetting('humanPreset', event.target.value as typeof settings.humanPreset)
                    }
                  >
                    <option value="careful">{t('appSettings.humanPreset.careful')}</option>
                    <option value="default">{t('appSettings.humanPreset.default')}</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>{t('appSettings.backgroundMode')}</span>
                  <select
                    value={settings.backgroundMode}
                    onChange={(event) =>
                      updateSetting('backgroundMode', event.target.value as typeof settings.backgroundMode)
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
                  <div className="settings-input-action">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={settings.fingerprintSeed}
                      onChange={(event) => updateSetting('fingerprintSeed', event.target.value)}
                    />
                    <button
                      type="button"
                      className="hotkey-btn"
                      onClick={() => updateSetting('fingerprintSeed', generateFingerprintSeed())}
                    >
                      {t('appSettings.resetFingerprint')}
                    </button>
                  </div>
                </label>
                <label className="settings-field">
                  <span>{t('appSettings.locale')}</span>
                  <input
                    type="text"
                    value={settings.locale}
                    disabled={proxyGeoipActive}
                    onChange={(event) => updateSetting('locale', event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>{t('appSettings.timezone')}</span>
                  <input
                    type="text"
                    value={settings.timezone}
                    disabled={proxyGeoipActive}
                    onChange={(event) => updateSetting('timezone', event.target.value)}
                  />
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
                  <input
                    type="text"
                    value={settings.proxy.server}
                    disabled={!settings.proxy.enabled}
                    onChange={(event) => updateProxySetting('server', event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>{t('appSettings.proxyBypass')}</span>
                  <input
                    type="text"
                    value={settings.proxy.bypass}
                    disabled={!settings.proxy.enabled}
                    onChange={(event) => updateProxySetting('bypass', event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>{t('appSettings.proxyUsername')}</span>
                  <input
                    type="text"
                    value={settings.proxy.username}
                    disabled={!settings.proxy.enabled}
                    onChange={(event) => updateProxySetting('username', event.target.value)}
                  />
                </label>
                <label className="settings-field">
                  <span>{t('appSettings.proxyPassword')}</span>
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
                      onChange={(event) => updateProxySetting('password', event.target.value)}
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
                {showSocks5ProxyAuthWarning && (
                  <p className="settings-warning">{t('appSettings.proxySocks5AuthWarning')}</p>
                )}
              </div>
            </section>
          </div>
        )}

        {error && <p className="settings-error">{error}</p>}
        <div className="modal-buttons settings-close-row">
          <button
            className="modal-btn confirm"
            disabled={isSaving || !settings || !initialSettings || !prettifySettings || !initialPrettifySettings}
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
