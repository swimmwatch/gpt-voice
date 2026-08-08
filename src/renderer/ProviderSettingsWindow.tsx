import { useCallback, useEffect, useState, type JSX } from 'react';
import { useDesktopApi } from '@renderer/DesktopApiProvider';
import LoadingScreen from '@renderer/components/LoadingScreen';
import ProviderSettingsForm from '@renderer/components/ProviderSettingsForm';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { useI18n } from '@renderer/hooks/useI18n';
import LocalWhisperSettingsPage from '@renderer/localWhisper/LocalWhisperSettingsPage';
import {
  findSettingsProvider,
  getProviderSettingsWindowProviderId,
  isMatchingProviderSettings,
} from '@renderer/providerSettingsWindowState';
import type { ProviderInfo, ProviderSettings } from '@renderer/types';
import { useWindowStartupReady } from '@renderer/WindowStartupGate';
import { LOCAL_WHISPER_PROVIDER_ID } from '@shared/localWhisper';

/** Loads one provider-bound settings snapshot and never follows the main window's active provider. */
function ProviderSettingsWindow(): JSX.Element {
  const desktopApi = useDesktopApi();
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
        const providers = await desktopApi.getProviders();
        const requestedProvider = findSettingsProvider(providers, providerId);
        if (!requestedProvider) throw new Error('Provider settings are not available');

        if (requestedProvider.id === LOCAL_WHISPER_PROVIDER_ID) {
          if (disposed) return;
          setProvider(requestedProvider);
          document.title = t('providerSettings.title', { provider: requestedProvider.name });
          return;
        }

        const nextSettings = await desktopApi.getProviderSettings(requestedProvider.id);
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
  }, [desktopApi, isI18nReady, t]);

  const closeWindow = useCallback((): void => {
    void desktopApi.closeProviderSettings();
  }, [desktopApi]);

  const login = useCallback(async (): Promise<ProviderSettings> => {
    if (!provider) throw new Error(t('providerSettings.loadFailed'));

    const result = await desktopApi.providerLogin(provider.id);
    if (!result.success) throw new Error(result.error || t('status.loginFailed', { error: '' }));

    const nextSettings = result.settings ?? (await desktopApi.getProviderSettings(provider.id));
    if (!isMatchingProviderSettings(nextSettings, provider.id)) {
      throw new Error(t('providerSettings.loadFailed'));
    }
    setSettings(nextSettings);
    return nextSettings;
  }, [desktopApi, provider, t]);

  if (!isI18nReady || isLoading) return <LoadingScreen />;

  return (
    <main
      aria-busy={isLoading}
      className={
        provider?.id === LOCAL_WHISPER_PROVIDER_ID
          ? 'h-full min-h-0 overflow-y-auto bg-background [scrollbar-gutter:stable] [-webkit-app-region:no-drag]'
          : 'h-full min-h-0 overflow-y-auto p-4 sm:p-6 [-webkit-app-region:no-drag]'
      }
      data-slot="provider-settings-window"
    >
      {provider?.id === LOCAL_WHISPER_PROVIDER_ID ? (
        <div className="mx-auto w-full max-w-[912px] min-w-0">
          <LocalWhisperSettingsPage desktopApi={desktopApi} />
        </div>
      ) : provider && settings ? (
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
