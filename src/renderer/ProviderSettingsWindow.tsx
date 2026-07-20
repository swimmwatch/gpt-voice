import { useCallback, useEffect, useState, type JSX } from 'react';
import LoadingScreen from '@renderer/components/LoadingScreen';
import ProviderSettingsForm from '@renderer/components/ProviderSettingsForm';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { useI18n } from '@renderer/hooks/useI18n';
import {
  findSettingsProvider,
  getProviderSettingsWindowProviderId,
  isMatchingProviderSettings,
} from '@renderer/providerSettingsWindowState';
import type { ProviderInfo, ProviderSettings } from '@renderer/types';
import { useWindowStartupReady } from '@renderer/WindowStartupGate';

/** Loads one provider-bound settings snapshot and never follows the main window's active provider. */
function ProviderSettingsWindow(): JSX.Element {
  const { isReady: isI18nReady, t } = useI18n();
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useWindowStartupReady(isI18nReady && !isLoading);

  useEffect(() => {
    if (!isI18nReady) return undefined;

    let disposed = false;
    const loadProviderSettings = async (): Promise<void> => {
      try {
        const providerId = getProviderSettingsWindowProviderId(window.location.search);
        const providers = await window.electronAPI.getProviders();
        const requestedProvider = findSettingsProvider(providers, providerId);
        if (!requestedProvider) throw new Error('Provider settings are not available');

        const nextSettings = await window.electronAPI.getProviderSettings(requestedProvider.id);
        if (!isMatchingProviderSettings(nextSettings, requestedProvider.id)) {
          throw new Error('Provider settings response did not match the requested provider');
        }
        if (disposed) return;

        setProvider(requestedProvider);
        setSettings(nextSettings);
        document.title = t('providerSettings.title', { provider: requestedProvider.name });
      } catch {
        if (!disposed) {
          setLoadError(t('providerSettings.loadFailed'));
        }
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };

    void loadProviderSettings();
    return () => {
      disposed = true;
    };
  }, [isI18nReady, t]);

  const closeWindow = useCallback((): void => {
    void window.electronAPI.closeProviderSettings();
  }, []);

  const login = useCallback(async (): Promise<ProviderSettings> => {
    if (!provider) throw new Error(t('providerSettings.loadFailed'));

    const result = await window.electronAPI.providerLogin(provider.id);
    if (!result.success) throw new Error(result.error || t('status.loginFailed', { error: '' }));

    const nextSettings = result.settings ?? (await window.electronAPI.getProviderSettings(provider.id));
    if (!isMatchingProviderSettings(nextSettings, provider.id)) {
      throw new Error(t('providerSettings.loadFailed'));
    }
    setSettings(nextSettings);
    return nextSettings;
  }, [provider, t]);

  if (!isI18nReady || isLoading) return <LoadingScreen />;

  return (
    <main
      aria-busy={isLoading}
      className="h-full min-h-0 overflow-y-auto p-6 [-webkit-app-region:no-drag]"
      data-slot="provider-settings-window"
    >
      {provider && settings ? (
        <ProviderSettingsForm
          onClose={closeWindow}
          onLogin={login}
          onSaved={setSettings}
          provider={provider}
          settings={settings}
        />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>{loadError || t('providerSettings.loadFailed')}</AlertDescription>
        </Alert>
      )}
    </main>
  );
}

export default ProviderSettingsWindow;
