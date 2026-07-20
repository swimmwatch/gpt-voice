import { CheckCircle2, KeyRound, LogIn, Save, Trash2, X } from 'lucide-react';
import type { RefObject } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import { getProviderSettingsViewState } from '@renderer/providerSettingsViewState';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Spinner } from '@renderer/components/ui/spinner';
import { Textarea } from '@renderer/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';

const LANGUAGE_OPTIONS: Array<{ labelKey: string; value: OpenAIApiProviderSettings['language'] }> = [
  { labelKey: 'providerSettings.language.auto', value: 'auto' },
  { labelKey: 'translate.english', value: 'en' },
  { labelKey: 'translate.russian', value: 'ru' },
  { labelKey: 'translate.ukrainian', value: 'uk' },
  { labelKey: 'translate.belarusian', value: 'be' },
];

export interface ProviderSettingsModalViewProps {
  apiKey: string;
  clearAuthButtonRef?: RefObject<HTMLButtonElement | null>;
  error: string;
  isClearConfirmationOpen: boolean;
  isSaving: boolean;
  language: OpenAIApiProviderSettings['language'];
  onApiKeyChange: (value: string) => void;
  onClearAuthentication: () => void | Promise<void>;
  onClearConfirmationOpenChange: (open: boolean) => void;
  onClose: () => void;
  onLanguageChange: (value: OpenAIApiProviderSettings['language']) => void;
  onLogin: () => void | Promise<void>;
  onPromptChange: (value: string) => void;
  onSaveOpenAIApiSettings: () => void | Promise<void>;
  onTemperatureChange: (value: number) => void;
  prompt: string;
  provider: ProviderInfo;
  showCloseTooltip?: boolean;
  settings: ProviderSettings;
  temperature: number;
}

/**
 * Renders provider settings from explicit state and callbacks only.
 * The Electron wrapper owns persistence and focus restoration; Remotion supplies inert callbacks.
 */
export function ProviderSettingsModalView({
  apiKey,
  clearAuthButtonRef,
  error,
  isClearConfirmationOpen,
  isSaving,
  language,
  onApiKeyChange,
  onClearAuthentication,
  onClearConfirmationOpenChange,
  onClose,
  onLanguageChange,
  onLogin,
  onPromptChange,
  onSaveOpenAIApiSettings,
  onTemperatureChange,
  prompt,
  provider,
  showCloseTooltip = true,
  settings,
  temperature,
}: ProviderSettingsModalViewProps): React.JSX.Element {
  const { t } = useI18n();
  const viewState = getProviderSettingsViewState(settings, isSaving);
  const clearTitle = t(
    settings.authType === 'apiKey'
      ? 'providerSettings.clearKeyConfirmTitle'
      : 'providerSettings.clearSessionConfirmTitle',
  );

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !isSaving) onClose();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
            <div>
              <DialogTitle>{t('providerSettings.title', { provider: provider.name })}</DialogTitle>
              <DialogDescription>{t('providerSettings.description', { provider: provider.name })}</DialogDescription>
            </div>
            {showCloseTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t('dialog.close')}
                    disabled={isSaving}
                    onClick={onClose}
                    size="icon"
                    title={t('dialog.close')}
                    variant="ghost"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('dialog.close')}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                aria-label={t('dialog.close')}
                disabled={isSaving}
                onClick={onClose}
                size="icon"
                title={t('dialog.close')}
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </DialogHeader>

          {viewState.kind === 'browserSession' && settings.authType === 'browserSession' && (
            <section className="grid gap-4" data-slot="provider-session-settings">
              <div className="flex items-center justify-between gap-3 border-y border-border py-3">
                <span className="text-sm text-muted-foreground">{t('providerSettings.sessionStatus')}</span>
                <Badge variant={settings.hasSession ? 'success' : 'outline'}>
                  {settings.hasSession ? <CheckCircle2 aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                  {t(viewState.sessionStateLabelKey)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isSaving} onClick={() => void onLogin()} variant="primary">
                  {isSaving ? <Spinner label={t('login.loggingIn')} /> : <LogIn aria-hidden="true" />}
                  {isSaving ? t('login.loggingIn') : t(viewState.primaryActionLabelKey)}
                </Button>
                <Button
                  disabled={!viewState.canClearAuth || isSaving}
                  onClick={() => onClearConfirmationOpenChange(true)}
                  ref={clearAuthButtonRef}
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
                void onSaveOpenAIApiSettings();
              }}
            >
              <Field
                description={settings.hasApiKey ? t('providerSettings.apiKeyStored') : undefined}
                label={t('providerSettings.apiKey')}
              >
                <Input
                  autoComplete="off"
                  onChange={(event) => onApiKeyChange(event.target.value)}
                  placeholder={t('providerSettings.apiKeyPlaceholder')}
                  type="password"
                  value={apiKey}
                />
              </Field>
              <Field label={t('providerSettings.model')}>
                <Input disabled value={TRANSCRIPTION_MODEL_WHISPER_1} />
              </Field>
              <Field label={t('providerSettings.language')}>
                <Select onValueChange={onLanguageChange} value={language}>
                  <SelectTrigger aria-label={t('providerSettings.language')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('providerSettings.prompt')}>
                <Textarea onChange={(event) => onPromptChange(event.target.value)} rows={4} value={prompt} />
              </Field>
              <Field label={t('providerSettings.temperature', { value: temperature.toFixed(2) })}>
                <Slider
                  aria-label={t('providerSettings.temperature', { value: temperature.toFixed(2) })}
                  max={1}
                  min={0}
                  onValueChange={(value) => onTemperatureChange(value[0] ?? temperature)}
                  step={0.05}
                  value={[temperature]}
                />
              </Field>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  disabled={!viewState.canClearAuth || isSaving}
                  onClick={() => onClearConfirmationOpenChange(true)}
                  ref={clearAuthButtonRef}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  {t('providerSettings.clearKey')}
                </Button>
              </div>
              <DialogFooter>
                <Button disabled={isSaving} onClick={onClose} variant="outline">
                  {t('common.close')}
                </Button>
                <Button disabled={isSaving} type="submit" variant="primary">
                  {isSaving ? <Spinner label={t('providerSettings.saving')} /> : <Save aria-hidden="true" />}
                  {isSaving ? t('providerSettings.saving') : t(viewState.primaryActionLabelKey)}
                </Button>
              </DialogFooter>
            </form>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {viewState.kind === 'browserSession' && (
            <DialogFooter>
              <Button disabled={isSaving} onClick={onClose} variant="outline">
                {t('common.close')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isClearConfirmationOpen} onOpenChange={onClearConfirmationOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{clearTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t('providerSettings.clearConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t('common.keepEditing')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={() => void onClearAuthentication()} variant="destructive">
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
