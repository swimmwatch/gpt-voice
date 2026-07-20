import { CheckCircle2, KeyRound, LogIn, Save, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import SearchableSelectInput from '@renderer/components/SearchableSelectInput';
import { useI18n } from '@renderer/hooks/useI18n';
import { getClaudeWebLanguageOptions, type ClaudeWebLanguageOption } from '@renderer/claudeWebLanguageOptions';
import { getOpenAIApiLanguageOptions } from '@renderer/openAIApiLanguageOptions';
import {
  getClaudeWebLanguageFormState,
  getClaudeWebLocaleSuggestion,
  getProviderSettingsViewState,
  type ClaudeWebLanguageFormState,
} from '@renderer/providerSettingsViewState';
import type { OpenAIApiProviderSettings, ProviderInfo, ProviderSettings } from '@renderer/types';
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
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Spinner } from '@renderer/components/ui/spinner';
import { Textarea } from '@renderer/components/ui/textarea';
import { CLAUDE_WEB_PROVIDER_ID, DEFAULT_CLAUDE_WEB_LANGUAGE } from '@shared/claudeWebSettings';
import { OPENAI_API_TRANSCRIPTION_MODELS } from '@shared/openaiApiTranscription';
import { presentNotificationError } from '@shared/notifications';

interface ProviderSettingsFormProps {
  onClose: () => void;
  onLogin: () => Promise<ProviderSettings>;
  onSaved: (settings: ProviderSettings) => void;
  provider: ProviderInfo;
  settings: ProviderSettings;
}

type Translate = (key: string, params?: Record<string, string>) => string;

const CLAUDE_WEB_RESPONSIVE_BUTTON_CLASS = 'h-auto max-w-full min-w-0 whitespace-normal break-words';

interface ClaudeWebLanguageSettingsFormProps {
  formState: ClaudeWebLanguageFormState;
  isSaving: boolean;
  language: string;
  languageOptions: readonly ClaudeWebLanguageOption[];
  localeSuggestion: string | null;
  onLanguageChange: (language: string) => void;
  onSave: () => void;
  t: Translate;
}

function ClaudeWebLanguageSettingsForm({
  formState,
  isSaving,
  language,
  languageOptions,
  localeSuggestion,
  onLanguageChange,
  onSave,
  t,
}: ClaudeWebLanguageSettingsFormProps): JSX.Element {
  const suggestionLabel = localeSuggestion
    ? t('providerSettings.claudeWeb.useLanguageSuggestion', { language: localeSuggestion })
    : '';

  return (
    <form
      className="grid min-w-0 gap-4"
      data-slot="provider-claude-settings"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <Field
        description={t('providerSettings.claudeWeb.languageDescription')}
        error={formState.isValid ? undefined : t('error.claudeWeb.invalid-settings')}
        label={t('providerSettings.claudeWeb.language')}
        required
      >
        <div className="flex flex-wrap items-start gap-2">
          <SearchableSelectInput
            ariaLabel={t('providerSettings.claudeWeb.language')}
            className="min-w-0 flex-1 basis-56"
            disabled={isSaving}
            emptyMessage={t('providerSettings.claudeWeb.noLanguageResults')}
            onValueChange={onLanguageChange}
            options={languageOptions}
            placeholder={t('providerSettings.claudeWeb.languageSearchPlaceholder')}
            toggleLabel={t('providerSettings.claudeWeb.showLanguageOptions')}
            value={language}
          />
          {localeSuggestion && (
            <Button
              aria-label={suggestionLabel}
              className={CLAUDE_WEB_RESPONSIVE_BUTTON_CLASS}
              disabled={isSaving || localeSuggestion === language}
              onClick={() => onLanguageChange(localeSuggestion)}
              type="button"
              variant="outline"
            >
              {suggestionLabel}
            </Button>
          )}
        </div>
      </Field>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          className={CLAUDE_WEB_RESPONSIVE_BUTTON_CLASS}
          disabled={isSaving || !formState.isDirty || !formState.isValid}
          type="submit"
          variant="primary"
        >
          {isSaving ? <Spinner label={t('providerSettings.saving')} /> : <Save aria-hidden="true" />}
          {isSaving ? t('providerSettings.saving') : t('providerSettings.save')}
        </Button>
      </div>
    </form>
  );
}

/** Presents provider authentication settings and keeps each provider's editable state isolated. */
function ProviderSettingsForm({
  onClose,
  onLogin,
  onSaved,
  provider,
  settings,
}: ProviderSettingsFormProps): JSX.Element {
  const { locale, t } = useI18n();
  const [apiKey, setApiKey] = useState('');
  const [openAIApiModel, setOpenAIApiModel] = useState<OpenAIApiProviderSettings['model']>(
    settings.authType === 'apiKey' ? settings.model : OPENAI_API_TRANSCRIPTION_MODELS[0],
  );
  const [openAIApiLanguage, setOpenAIApiLanguage] = useState(
    settings.authType === 'apiKey' ? settings.language : 'auto',
  );
  const [claudeWebLanguage, setClaudeWebLanguage] = useState(
    settings.providerId === CLAUDE_WEB_PROVIDER_ID ? settings.language : DEFAULT_CLAUDE_WEB_LANGUAGE,
  );
  const [prompt, setPrompt] = useState(settings.authType === 'apiKey' ? settings.prompt : '');
  const [temperature, setTemperature] = useState(settings.authType === 'apiKey' ? settings.temperature : 0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isClearConfirmationOpen, setIsClearConfirmationOpen] = useState(false);
  const clearAuthButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewState = getProviderSettingsViewState(settings, isSaving);
  const claudeWebLanguageFormState =
    settings.providerId === CLAUDE_WEB_PROVIDER_ID ? getClaudeWebLanguageFormState(settings, claudeWebLanguage) : null;
  const localeSuggestion = getClaudeWebLocaleSuggestion(
    typeof navigator === 'undefined' ? undefined : navigator.language,
    locale,
  );
  const claudeWebLanguageOptions = useMemo(
    () => getClaudeWebLanguageOptions(locale, [claudeWebLanguage, localeSuggestion || '']),
    [claudeWebLanguage, locale, localeSuggestion],
  );
  const openAIApiLanguageOptions = useMemo(
    () => getOpenAIApiLanguageOptions(locale, t('providerSettings.language.auto')),
    [locale, t],
  );

  const showError = (cause: unknown, fallback: string): void => {
    setError(presentNotificationError(cause, { context: 'transcription', fallback, t }).userMessage);
  };

  const saveOpenAIApiSettings = async (): Promise<void> => {
    if (settings.authType !== 'apiKey') return;
    setIsSaving(true);
    setError('');
    try {
      const result = await window.electronAPI.saveProviderSettings(settings.providerId, {
        apiKey,
        language: openAIApiLanguage,
        model: openAIApiModel,
        prompt,
        temperature,
      });
      if (result.success && result.settings) {
        onSaved(result.settings);
        onClose();
        return;
      }
      showError(result.error, t('providerSettings.saveFailed'));
    } catch (saveError: unknown) {
      showError(saveError, t('providerSettings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveClaudeWebSettings = async (): Promise<void> => {
    if (settings.providerId !== CLAUDE_WEB_PROVIDER_ID || !claudeWebLanguageFormState?.isValid) return;
    setIsSaving(true);
    setError('');
    try {
      const result = await window.electronAPI.saveProviderSettings(CLAUDE_WEB_PROVIDER_ID, {
        language: claudeWebLanguage,
      });
      if (result.success && result.settings?.providerId === CLAUDE_WEB_PROVIDER_ID) {
        setClaudeWebLanguage(result.settings.language);
        onSaved(result.settings);
        onClose();
        return;
      }
      showError(result.error, t('providerSettings.saveFailed'));
    } catch (saveError: unknown) {
      showError(saveError, t('providerSettings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const clearAuth = async (): Promise<void> => {
    setIsSaving(true);
    setError('');
    try {
      const result = await window.electronAPI.clearProviderAuth(provider.id);
      if (result.success && result.settings) {
        onSaved(result.settings);
        setApiKey('');
        if (result.settings.providerId === CLAUDE_WEB_PROVIDER_ID) {
          setClaudeWebLanguage(result.settings.language);
        }
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
      const nextSettings = await onLogin();
      onSaved(nextSettings);
      if (nextSettings.providerId === CLAUDE_WEB_PROVIDER_ID) {
        setClaudeWebLanguage(nextSettings.language);
      }
    } catch (loginError: unknown) {
      showError(loginError, t('status.loginFailed', { error: '' }));
    } finally {
      setIsSaving(false);
    }
  };

  const restoreFocus = (element: HTMLElement | null): void => {
    window.requestAnimationFrame(() => element?.focus());
  };

  const handleClearConfirmationOpenChange = (open: boolean): void => {
    setIsClearConfirmationOpen(open);
    if (!open) {
      restoreFocus(clearAuthButtonRef.current);
    }
  };

  const handleClearDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClearConfirmationOpenChange(false);
    }
  };

  const clearTitle = t(
    settings.authType === 'apiKey'
      ? 'providerSettings.clearKeyConfirmTitle'
      : 'providerSettings.clearSessionConfirmTitle',
  );

  return (
    <>
      <div className="grid min-w-0 gap-5">
        <header className="grid gap-1">
          <h1 className="text-lg font-semibold text-foreground">
            {t('providerSettings.title', { provider: provider.name })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {settings.providerId === CLAUDE_WEB_PROVIDER_ID
              ? t('providerSettings.claudeWeb.description')
              : t('providerSettings.description', { provider: provider.name })}
          </p>
        </header>

        {viewState.kind === 'browserSession' && settings.authType === 'browserSession' && (
          <section className="grid min-w-0 gap-4" data-slot="provider-session-settings">
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
              <span className="text-sm text-muted-foreground">{t('providerSettings.sessionStatus')}</span>
              <Badge variant={settings.hasSession ? 'success' : 'outline'}>
                {settings.hasSession ? <CheckCircle2 aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                {t(viewState.sessionStateLabelKey)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className={
                  settings.providerId === CLAUDE_WEB_PROVIDER_ID ? CLAUDE_WEB_RESPONSIVE_BUTTON_CLASS : undefined
                }
                disabled={isSaving}
                onClick={() => void login()}
                variant="primary"
              >
                {isSaving ? <Spinner label={t('login.loggingIn')} /> : <LogIn aria-hidden="true" />}
                {isSaving ? t('login.loggingIn') : t(viewState.primaryActionLabelKey)}
              </Button>
              <Button
                className={
                  settings.providerId === CLAUDE_WEB_PROVIDER_ID ? CLAUDE_WEB_RESPONSIVE_BUTTON_CLASS : undefined
                }
                disabled={!viewState.canClearAuth || isSaving}
                onClick={() => setIsClearConfirmationOpen(true)}
                ref={clearAuthButtonRef}
                type="button"
                variant="destructive"
              >
                <Trash2 aria-hidden="true" />
                {t('providerSettings.clearSession')}
              </Button>
            </div>
          </section>
        )}

        {viewState.kind === 'apiKey' && settings.authType === 'apiKey' && (
          <form
            className="grid gap-4"
            data-slot="provider-api-settings"
            onSubmit={(event) => {
              event.preventDefault();
              void saveOpenAIApiSettings();
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
              <span className="text-sm text-muted-foreground">{t('providerSettings.apiKeyStatus')}</span>
              <Badge variant={settings.hasApiKey ? 'success' : 'outline'}>
                {settings.hasApiKey ? <CheckCircle2 aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                {t(settings.hasApiKey ? 'providerSettings.apiKeySaved' : 'providerSettings.apiKeyMissing')}
              </Badge>
            </div>
            <Field
              description={settings.hasApiKey ? t('providerSettings.apiKeyStored') : undefined}
              label={t('providerSettings.apiKey')}
            >
              <Input
                autoComplete="off"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={t(
                  settings.hasApiKey
                    ? 'providerSettings.apiKeyReplacePlaceholder'
                    : 'providerSettings.apiKeyPlaceholder',
                )}
                type="password"
                value={apiKey}
              />
            </Field>
            <Field label={t('providerSettings.model')}>
              <Select
                onValueChange={(value) => setOpenAIApiModel(value as OpenAIApiProviderSettings['model'])}
                value={openAIApiModel}
              >
                <SelectTrigger aria-label={t('providerSettings.model')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_API_TRANSCRIPTION_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('providerSettings.language')}>
              <SearchableSelectInput
                allowCustomValue={false}
                ariaLabel={t('providerSettings.language')}
                disabled={isSaving}
                emptyMessage={t('providerSettings.openAIApi.noLanguageResults')}
                onValueChange={(value) => setOpenAIApiLanguage(value as OpenAIApiProviderSettings['language'])}
                options={openAIApiLanguageOptions}
                placeholder={t('providerSettings.openAIApi.languageSearchPlaceholder')}
                toggleLabel={t('providerSettings.openAIApi.showLanguageOptions')}
                value={openAIApiLanguage}
              />
            </Field>
            <Field label={t('providerSettings.prompt')}>
              <Textarea onChange={(event) => setPrompt(event.target.value)} rows={4} value={prompt} />
            </Field>
            <Field label={t('providerSettings.temperature', { value: temperature.toFixed(2) })}>
              <Slider
                aria-label={t('providerSettings.temperature', { value: temperature.toFixed(2) })}
                max={1}
                min={0}
                onValueChange={(value) => setTemperature(value[0] ?? temperature)}
                step={0.05}
                value={[temperature]}
              />
            </Field>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                disabled={!viewState.canClearAuth || isSaving}
                onClick={() => setIsClearConfirmationOpen(true)}
                ref={clearAuthButtonRef}
                type="button"
                variant="destructive"
              >
                <Trash2 aria-hidden="true" />
                {t('providerSettings.clearKey')}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button disabled={isSaving} type="submit" variant="primary">
                {isSaving ? <Spinner label={t('providerSettings.saving')} /> : <Save aria-hidden="true" />}
                {isSaving ? t('providerSettings.saving') : t(viewState.primaryActionLabelKey)}
              </Button>
            </div>
          </form>
        )}

        {viewState.kind === 'browserSession' &&
          viewState.hasLanguageSetting &&
          settings.providerId === CLAUDE_WEB_PROVIDER_ID &&
          claudeWebLanguageFormState && (
            <ClaudeWebLanguageSettingsForm
              formState={claudeWebLanguageFormState}
              isSaving={isSaving}
              language={claudeWebLanguage}
              languageOptions={claudeWebLanguageOptions}
              localeSuggestion={localeSuggestion}
              onLanguageChange={setClaudeWebLanguage}
              onSave={() => void saveClaudeWebSettings()}
              t={t}
            />
          )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <AlertDialog open={isClearConfirmationOpen} onOpenChange={handleClearConfirmationOpenChange}>
        <AlertDialogContent onKeyDown={handleClearDialogKeyDown}>
          <AlertDialogHeader>
            <AlertDialogTitle>{clearTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t('providerSettings.clearConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t('common.keepEditing')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={() => void clearAuth()} variant="destructive">
                <Trash2 aria-hidden="true" />
                {t('providerSettings.clear')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ProviderSettingsForm;
