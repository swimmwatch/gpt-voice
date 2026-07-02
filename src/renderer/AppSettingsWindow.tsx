import React, { useEffect, useState } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import {
  shouldWarnSocks5ProxyAuth,
  type CloakBrowserSettingsInput,
  type CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';

interface EditableCloakBrowserSettings extends Omit<CloakBrowserSettingsView, 'proxy'> {
  proxy: CloakBrowserSettingsView['proxy'] & {
    password: string;
    clearPassword: boolean;
  };
}

function createEditableSettings(settings: CloakBrowserSettingsView): EditableCloakBrowserSettings {
  return {
    ...settings,
    proxy: {
      ...settings.proxy,
      password: '',
      clearPassword: false,
    },
  };
}

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

const AppSettingsWindow: React.FC = () => {
  const { t } = useI18n();
  const [settings, setSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    window.electronAPI
      .getCloakBrowserSettings()
      .then((nextSettings) => {
        if (!disposed) {
          setSettings(createEditableSettings(nextSettings));
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
    if (!settings) return;

    setIsSaving(true);
    setError('');
    const input: CloakBrowserSettingsInput = {
      humanize: settings.humanize,
      humanPreset: settings.humanPreset,
      backgroundMode: settings.backgroundMode,
      fingerprintSeed: settings.fingerprintSeed,
      locale: settings.locale,
      timezone: settings.timezone,
      proxy: {
        enabled: settings.proxy.enabled,
        server: settings.proxy.server,
        bypass: settings.proxy.bypass,
        username: settings.proxy.username,
        password: settings.proxy.password,
        clearPassword: settings.proxy.clearPassword,
        geoip: settings.proxy.geoip,
      },
    };
    const result = await window.electronAPI.saveCloakBrowserSettings(input);
    setIsSaving(false);

    if (result.success && result.settings) {
      closeWindow();
      return;
    }

    if (result.settings) {
      setSettings(createEditableSettings(result.settings));
    }
    setError(result.error || t('appSettings.saveFailed'));
  };

  const proxyGeoipActive = Boolean(settings?.proxy.enabled && settings.proxy.geoip);
  const showSocks5ProxyAuthWarning = Boolean(settings && shouldWarnSocks5ProxyAuth(settings.proxy));

  return (
    <main className="settings-window-shell">
      <section className="settings-window-panel">
        <h1>{t('appSettings.title')}</h1>
        {!settings && !error && <p className="modal-instruction">{t('loading.initializing')}</p>}

        {settings && (
          <div className="app-settings-body">
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
          <button className="modal-btn confirm" disabled={isSaving || !settings} onClick={saveSettings}>
            {t('appSettings.save')}
          </button>
          <button className="modal-btn cancel" disabled={isSaving} onClick={closeWindow}>
            {t('hotkey.cancel')}
          </button>
        </div>
      </section>
    </main>
  );
};

export default AppSettingsWindow;
