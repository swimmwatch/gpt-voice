import { Globe } from 'lucide-react';
import { useMemo } from 'react';
import type { TranslationKey } from '@main/i18n';
import { useI18n } from '@renderer/hooks/useI18n';
import { TRANSLATION_PROVIDER_OPTIONS, getTranslationLanguageOptions } from '@renderer/translationLanguageOptions';
import { ProviderStatusIndicator, type ProviderStatusTone } from '@renderer/components/ProviderStatusIndicator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import {
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionDetail,
  type TranslationProviderConnectionState,
  type TranslationProviderConnectionStatus,
  type TranslationProviderId,
  type TranslationSettings,
} from '@shared/translationProvider';

interface Props {
  connectionState: TranslationProviderConnectionState | null;
  error: string;
  isProviderChangesLocked: boolean;
  isProviderChangeSaving: boolean;
  isSaving: boolean;
  onProviderChange: (providerId: TranslationProviderId) => void;
  onTargetLanguageChange: (targetLanguage: string) => void;
  settings: TranslationSettings;
}

const TRANSLATION_CONNECTION_LABEL_KEYS: Record<TranslationProviderConnectionStatus, TranslationKey> = {
  [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking]: 'provider.connectionChecking',
  [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected]: 'provider.connected',
  [TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected]: 'provider.notConnected',
};

const TRANSLATION_CONNECTION_TOOLTIP_KEYS: Record<TranslationProviderConnectionDetail, TranslationKey> = {
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.Cancelled]: 'status.translationCancelled',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.CleanupFailed]: 'error.translationCleanupFailed',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.ConsentOrChallenge]: 'error.translationConsentOrChallenge',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.InvalidSettings]: 'error.translationUnsupportedSelection',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.NavigationFailed]: 'error.translationConnectionFailed',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.NotStarted]: 'translate.connectionNotStartedTooltip',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider]: 'provider.connectionCheckingTooltip',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.PageChanged]: 'error.translationPageChanged',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready]: 'provider.connectionReadyTooltip',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.TranslationDisabled]: 'translate.connectionDisabledTooltip',
  [TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure]: 'error.translationConnectionFailed',
};

const TRANSLATION_CONNECTION_TONES: Record<TranslationProviderConnectionStatus, ProviderStatusTone> = {
  [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking]: 'neutral',
  [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected]: 'success',
  [TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected]: 'error',
};

export interface TranslationProviderConnectionPresentation {
  readonly labelKey: TranslationKey;
  readonly loading: boolean;
  readonly tone: ProviderStatusTone;
  readonly tooltipKey: TranslationKey;
}

export function getTranslationProviderConnectionPresentation(
  connectionState: TranslationProviderConnectionState | null,
  settings: TranslationSettings,
  isProviderChangeSaving = false,
): TranslationProviderConnectionPresentation {
  if (isProviderChangeSaving) {
    return {
      labelKey: TRANSLATION_CONNECTION_LABEL_KEYS[TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking],
      loading: true,
      tone: TRANSLATION_CONNECTION_TONES[TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking],
      tooltipKey: TRANSLATION_CONNECTION_TOOLTIP_KEYS[TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider],
    };
  }
  const targetLanguage = settings.targetLanguageByProvider[settings.providerId];
  const connectionMatchesSelection =
    connectionState?.providerId === null ||
    (connectionState?.providerId === settings.providerId && connectionState.targetLanguage === targetLanguage);
  const status =
    connectionState && connectionMatchesSelection
      ? connectionState.status
      : TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking;
  const detail =
    connectionState && connectionMatchesSelection
      ? connectionState.detail
      : TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider;
  return {
    labelKey: TRANSLATION_CONNECTION_LABEL_KEYS[status],
    loading: status === TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking,
    tone: TRANSLATION_CONNECTION_TONES[status],
    tooltipKey: TRANSLATION_CONNECTION_TOOLTIP_KEYS[detail],
  };
}

/** Renders the compact main-window translation provider and target selectors. */
const TranslateSection = ({
  connectionState,
  error,
  isProviderChangesLocked,
  isProviderChangeSaving,
  isSaving,
  onProviderChange,
  onTargetLanguageChange,
  settings,
}: Props): React.JSX.Element => {
  const { locale, t } = useI18n();
  const languageOptions = useMemo(
    () => getTranslationLanguageOptions(settings.providerId, locale),
    [locale, settings.providerId],
  );
  const targetLanguage = settings.targetLanguageByProvider[settings.providerId];
  const connectionPresentation = getTranslationProviderConnectionPresentation(
    connectionState,
    settings,
    isProviderChangeSaving,
  );

  return (
    <section className="command-dock-language-band" data-slot="translate-section">
      <Globe aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />

      <div className="command-dock-language-field command-dock-language-target-field">
        <span className="command-dock-field-label">{t('translate.provider')}</span>
        <Select
          disabled={isSaving || isProviderChangesLocked}
          onValueChange={(providerId) => {
            if (TRANSLATION_PROVIDER_OPTIONS.some((option) => option.value === providerId)) {
              onProviderChange(providerId as TranslationProviderId);
            }
          }}
          value={settings.providerId}
        >
          <SelectTrigger
            aria-label={t('translate.provider')}
            className="command-dock-provider-trigger command-dock-translation-trigger"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="command-dock-translation-select-content">
            {TRANSLATION_PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="command-dock-language-field">
        <span className="command-dock-field-label">{t('translate.targetLanguage')}</span>
        <Select disabled={isSaving} onValueChange={onTargetLanguageChange} value={targetLanguage}>
          <SelectTrigger
            aria-label={t('translate.targetLanguage')}
            className="command-dock-provider-trigger command-dock-translation-trigger"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className="command-dock-translation-select-content"
            showScrollButtons={false}
            viewportClassName="command-dock-translation-select-viewport"
          >
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProviderStatusIndicator
        className="command-dock-provider-state command-dock-translation-connection"
        dataSlot="translation-provider-connection"
        label={t(connectionPresentation.labelKey)}
        loading={connectionPresentation.loading}
        tone={connectionPresentation.tone}
        tooltip={t(connectionPresentation.tooltipKey)}
      />

      {error && (
        <span className="command-dock-language-state is-error" data-slot="translation-settings-state" role="alert">
          {error}
        </span>
      )}
    </section>
  );
};

export default TranslateSection;
