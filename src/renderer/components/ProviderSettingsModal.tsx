import React, { useState } from 'react';
import { useI18n } from '../hooks/useI18n';
import type { OpenAIApiProviderSettings, ProviderInfo, ProviderSettings } from '../types';
import { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';
import { DEFAULT_OPENAI_API_PRETTIFY_MODEL } from '@shared/prettifySettings';

interface Props {
  provider: ProviderInfo;
  settings: ProviderSettings;
  onClose: () => void;
  onSaved: (settings: ProviderSettings) => void;
  onLogin: () => Promise<void>;
}

const LANGUAGE_OPTIONS: { value: OpenAIApiProviderSettings['language']; labelKey: string }[] = [
  { value: 'auto', labelKey: 'providerSettings.language.auto' },
  { value: 'en', labelKey: 'translate.english' },
  { value: 'ru', labelKey: 'translate.russian' },
  { value: 'uk', labelKey: 'translate.ukrainian' },
  { value: 'be', labelKey: 'translate.belarusian' },
];

const ProviderSettingsModal: React.FC<Props> = ({ provider, settings, onClose, onSaved, onLogin }) => {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState(settings.authType === 'apiKey' ? settings.language : 'auto');
  const [prompt, setPrompt] = useState(settings.authType === 'apiKey' ? settings.prompt : '');
  const [temperature, setTemperature] = useState(settings.authType === 'apiKey' ? settings.temperature : 0);
  const [prettifyModel, setPrettifyModel] = useState(
    settings.authType === 'apiKey' ? settings.prettifyModel : DEFAULT_OPENAI_API_PRETTIFY_MODEL,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const saveOpenAIApiSettings = async () => {
    setIsSaving(true);
    setError('');
    const result = await window.electronAPI.saveProviderSettings(provider.id, {
      apiKey,
      model: TRANSCRIPTION_MODEL_WHISPER_1,
      prettifyModel,
      language,
      prompt,
      temperature,
    });
    setIsSaving(false);
    if (result.success && result.settings) {
      onSaved(result.settings);
      onClose();
      return;
    }
    setError(result.error || t('providerSettings.saveFailed'));
  };

  const clearAuth = async () => {
    setIsSaving(true);
    setError('');
    const result = await window.electronAPI.clearProviderAuth(provider.id);
    setIsSaving(false);
    if (result.success && result.settings) {
      onSaved(result.settings);
      if (settings.authType === 'apiKey') {
        setApiKey('');
      }
      return;
    }
    setError(result.error || t('providerSettings.clearFailed'));
  };

  const login = async () => {
    setIsSaving(true);
    setError('');
    await onLogin();
    setIsSaving(false);
    const nextSettings = await window.electronAPI.getProviderSettings(provider.id);
    onSaved(nextSettings);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal provider-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('providerSettings.title', { provider: provider.name })}</h2>

        {settings.authType === 'browserSession' && (
          <div className="provider-settings-body">
            <div className="settings-row">
              <span className="settings-label">{t('providerSettings.sessionStatus')}</span>
              <span className={settings.hasSession ? 'settings-state good' : 'settings-state'}>
                {settings.hasSession ? t('providerSettings.sessionSaved') : t('providerSettings.sessionMissing')}
              </span>
            </div>
            <div className="modal-buttons">
              <button className="modal-btn confirm" disabled={isSaving} onClick={login}>
                {settings.hasSession ? t('providerSettings.relogin') : t('providerSettings.login')}
              </button>
              <button className="modal-btn cancel" disabled={isSaving || !settings.hasSession} onClick={clearAuth}>
                {t('providerSettings.clearSession')}
              </button>
            </div>
          </div>
        )}

        {settings.authType === 'apiKey' && (
          <div className="provider-settings-body">
            <label className="settings-field">
              <span>{t('providerSettings.apiKey')}</span>
              <input
                type="password"
                value={apiKey}
                placeholder={
                  settings.hasApiKey ? t('providerSettings.apiKeyStored') : t('providerSettings.apiKeyPlaceholder')
                }
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>{t('providerSettings.model')}</span>
              <select value={TRANSCRIPTION_MODEL_WHISPER_1} disabled>
                <option value={TRANSCRIPTION_MODEL_WHISPER_1}>{TRANSCRIPTION_MODEL_WHISPER_1}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('providerSettings.prettifyModel')}</span>
              <input value={prettifyModel} onChange={(event) => setPrettifyModel(event.target.value)} />
            </label>
            <label className="settings-field">
              <span>{t('providerSettings.language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>{t('providerSettings.prompt')}</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <label className="settings-field">
              <span>{t('providerSettings.temperature', { value: temperature.toFixed(2) })}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
              />
            </label>
            <div className="modal-buttons">
              <button className="modal-btn confirm" disabled={isSaving} onClick={saveOpenAIApiSettings}>
                {t('providerSettings.save')}
              </button>
              <button className="modal-btn cancel" disabled={isSaving || !settings.hasApiKey} onClick={clearAuth}>
                {t('providerSettings.clearKey')}
              </button>
            </div>
          </div>
        )}

        {error && <p className="settings-error">{error}</p>}
        <div className="modal-buttons settings-close-row">
          <button className="modal-btn cancel" disabled={isSaving} onClick={onClose}>
            {t('hotkey.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderSettingsModal;
