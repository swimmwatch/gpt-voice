import { useRef, useState, type JSX } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import { ProviderSettingsModalView } from '@renderer/components/ProviderSettingsModalView';
import type { ProviderInfo, ProviderSettings } from '@renderer/types';
import { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';
import { presentNotificationError } from '@shared/notifications';

interface ProviderSettingsModalProps {
  onClose: () => void;
  onLogin: () => Promise<void>;
  onSaved: (settings: ProviderSettings) => void;
  provider: ProviderInfo;
  settings: ProviderSettings;
}

/** Owns Electron-backed provider actions while the shared view renders explicit state. */
function ProviderSettingsModal({
  onClose,
  onLogin,
  onSaved,
  provider,
  settings,
}: ProviderSettingsModalProps): JSX.Element {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState(settings.authType === 'apiKey' ? settings.language : 'auto');
  const [prompt, setPrompt] = useState(settings.authType === 'apiKey' ? settings.prompt : '');
  const [temperature, setTemperature] = useState(settings.authType === 'apiKey' ? settings.temperature : 0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const initialFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const clearAuthButtonRef = useRef<HTMLButtonElement | null>(null);

  const showError = (cause: unknown, fallback: string): void => {
    setError(presentNotificationError(cause, { context: 'transcription', fallback, t }).userMessage);
  };

  const closeModal = (): void => {
    onClose();
    window.requestAnimationFrame(() => initialFocusRef.current?.focus());
  };

  const saveOpenAIApiSettings = async (): Promise<void> => {
    setIsSaving(true);
    setError('');
    try {
      const result = await window.electronAPI.saveProviderSettings(provider.id, {
        apiKey,
        language,
        model: TRANSCRIPTION_MODEL_WHISPER_1,
        prompt,
        temperature,
      });
      if (result.success && result.settings) {
        onSaved(result.settings);
        closeModal();
        return;
      }
      showError(result.error, t('providerSettings.saveFailed'));
    } catch (saveError: unknown) {
      showError(saveError, t('providerSettings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const clearAuthentication = async (): Promise<void> => {
    setIsSaving(true);
    setError('');
    try {
      const result = await window.electronAPI.clearProviderAuth(provider.id);
      if (result.success && result.settings) {
        onSaved(result.settings);
        setApiKey('');
        return;
      }
      showError(result.error, t('providerSettings.clearFailed'));
    } catch (clearError: unknown) {
      showError(clearError, t('providerSettings.clearFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const login = async (): Promise<void> => {
    setIsSaving(true);
    setError('');
    try {
      await onLogin();
      onSaved(await window.electronAPI.getProviderSettings(provider.id));
    } catch (loginError: unknown) {
      showError(loginError, t('status.loginFailed', { error: '' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearConfirmationOpenChange = (open: boolean): void => {
    setIsClearConfirmationOpen(open);
    if (!open) window.requestAnimationFrame(() => clearAuthButtonRef.current?.focus());
  };

  return (
    <ProviderSettingsModalView
      apiKey={apiKey}
      clearAuthButtonRef={clearAuthButtonRef}
      error={error}
      isClearConfirmationOpen={isClearConfirmationOpen}
      isSaving={isSaving}
      language={language}
      onApiKeyChange={setApiKey}
      onClearAuthentication={clearAuthentication}
      onClearConfirmationOpenChange={handleClearConfirmationOpenChange}
      onClose={closeModal}
      onLanguageChange={setLanguage}
      onLogin={login}
      onPromptChange={setPrompt}
      onSaveOpenAIApiSettings={saveOpenAIApiSettings}
      onTemperatureChange={setTemperature}
      prompt={prompt}
      provider={provider}
      settings={settings}
      temperature={temperature}
    />
  );
}

export default ProviderSettingsModal;
