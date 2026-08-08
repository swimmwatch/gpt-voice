import { AudioLines, CircleHelp, History, LogIn, Mic, Settings } from 'lucide-react';
import { Fragment } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import { ProviderStatusIndicator } from '@renderer/components/ProviderStatusIndicator';
import LocalWhisperMainStatusIndicator from '@renderer/localWhisper/components/LocalWhisperMainStatusIndicator';
import LocalWhisperMainResidencyControl from '@renderer/localWhisper/components/LocalWhisperMainResidencyControl';
import type { LocalWhisperMainResidencyFailure } from '@renderer/localWhisper/LocalWhisperRendererService';
import { Button } from '@renderer/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Spinner } from '@renderer/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { groupProvidersByCategory } from '@renderer/providerGrouping';
import { PROVIDER_CONNECTION_REASONS, type ProviderConnectionReason } from '@renderer/providerState';
import type { ProviderAuthType, ProviderInfo } from '@renderer/types';
import type { TranslationKey } from '@main/i18n';
import {
  LOCAL_WHISPER_PROVIDER_ID,
  type LocalWhisperMainResidencyAction,
  type LocalWhisperMainStatusSnapshot,
} from '@shared/localWhisper';

interface MainToolbarProps {
  activeProviderAuthType: ProviderAuthType | null;
  activeProviderHasSettings: boolean;
  activeProviderId: string | null;
  activeProviderName: string;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  isProviderChangesLocked: boolean;
  isVoiceProviderSwitching: boolean;
  localWhisperStatus: LocalWhisperMainStatusSnapshot | null;
  localWhisperPendingAction: LocalWhisperMainResidencyAction | null;
  localWhisperResidencyFailure: LocalWhisperMainResidencyFailure | null;
  localWhisperResidencyFailureSequence: number;
  onOpenAbout: () => void;
  onOpenAppSettings: () => void;
  onOpenHistory: () => void;
  onOpenProviderSettings: () => void;
  onLocalWhisperResidencyAction: (action: LocalWhisperMainResidencyAction) => void;
  onProviderChange: (providerId: string) => void;
  onProviderLogin: () => void;
  providerConnectionFailureTooltip: string;
  providerConnectionReason: ProviderConnectionReason;
  providers: ProviderInfo[];
}

export const VOICE_PROVIDER_CONNECTION_TOOLTIP_KEYS = {
  [PROVIDER_CONNECTION_REASONS.ApiConfigured]: 'status.providerConfigured',
  [PROVIDER_CONNECTION_REASONS.ApiNotConfigured]: 'status.providerNotConfigured',
  [PROVIDER_CONNECTION_REASONS.LocalRuntimeNotReady]: 'status.providerNotConfigured',
  [PROVIDER_CONNECTION_REASONS.LocalRuntimeReady]: 'status.providerConfigured',
  [PROVIDER_CONNECTION_REASONS.BrowserReady]: 'provider.connectionReadyTooltip',
  [PROVIDER_CONNECTION_REASONS.BrowserUnavailable]: 'provider.browserUnavailableTooltip',
  [PROVIDER_CONNECTION_REASONS.Checking]: 'provider.connectionCheckingTooltip',
  [PROVIDER_CONNECTION_REASONS.SessionExpired]: 'status.sessionExpired',
  [PROVIDER_CONNECTION_REASONS.SessionMissing]: 'provider.sessionMissingTooltip',
} as const satisfies Record<ProviderConnectionReason, TranslationKey>;

/** Coordinates main-window provider controls, session actions, and status affordances. */
function MainToolbar({
  activeProviderAuthType,
  activeProviderHasSettings,
  activeProviderId,
  activeProviderName,
  isLoggedIn,
  isLoggingIn,
  isProviderChangesLocked,
  isVoiceProviderSwitching,
  localWhisperStatus,
  localWhisperPendingAction,
  localWhisperResidencyFailure,
  localWhisperResidencyFailureSequence,
  onOpenAbout,
  onOpenAppSettings,
  onOpenHistory,
  onOpenProviderSettings,
  onLocalWhisperResidencyAction,
  onProviderChange,
  onProviderLogin,
  providerConnectionFailureTooltip,
  providerConnectionReason,
  providers,
}: MainToolbarProps): React.JSX.Element {
  const { t } = useI18n();
  const isLocalWhisperProvider = activeProviderId === LOCAL_WHISPER_PROVIDER_ID;
  const providerActionLabel = t(activeProviderAuthType === 'apiKey' ? 'provider.configure' : 'provider.connect');
  const providerSettingsLabel = t('navigation.openProviderSettings', { provider: activeProviderName });
  const providerStatusTooltip =
    providerConnectionFailureTooltip ||
    t(VOICE_PROVIDER_CONNECTION_TOOLTIP_KEYS[providerConnectionReason], {
      provider: activeProviderName,
    });
  const providerGroups = groupProvidersByCategory(providers);

  return (
    <header className="command-dock-toolbar" data-slot="main-toolbar">
      <div className="command-dock-header-band">
        <AudioLines aria-hidden="true" className="command-dock-brand-icon" strokeWidth={1.75} />
        <div className="command-dock-brand">
          <strong>{t('mainDock.subtitle')}</strong>
          <span>{t('mainDock.title')}</span>
        </div>
        <div className="command-dock-header-actions" data-slot="main-toolbar-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('navigation.openAbout')}
                className="command-dock-icon-button"
                onClick={onOpenAbout}
                size="icon"
                title={t('navigation.openAbout')}
                variant="outline"
              >
                <CircleHelp aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('navigation.openAbout')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('navigation.openHistory')}
                className="command-dock-icon-button"
                onClick={onOpenHistory}
                size="icon"
                title={t('navigation.openHistory')}
                variant="outline"
              >
                <History aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('navigation.openHistory')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('navigation.openAppSettings')}
                className="command-dock-icon-button command-dock-settings-shortcut"
                disabled={isProviderChangesLocked}
                onClick={() => {
                  if (isProviderChangesLocked) return;
                  onOpenAppSettings();
                }}
                size="icon"
                title={t('navigation.openAppSettings')}
                variant="outline"
              >
                <Settings aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('navigation.openAppSettings')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="command-dock-provider-band">
        <Mic aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />
        <div className="command-dock-provider-field">
          <span className="command-dock-field-label">{t('mainDock.providerLabel')}</span>
          <Select
            disabled={isProviderChangesLocked}
            onValueChange={(providerId) => {
              if (isProviderChangesLocked) return;
              onProviderChange(providerId);
            }}
            value={activeProviderId ?? undefined}
          >
            <SelectTrigger aria-label={t('provider.label')} className="command-dock-provider-trigger">
              <SelectValue placeholder={t(activeProviderId === null ? 'startup.selectProvider' : 'provider.label')} />
            </SelectTrigger>
            <SelectContent>
              {providerGroups.map((group, groupIndex) => (
                <Fragment key={group.category}>
                  {groupIndex > 0 && <SelectSeparator />}
                  <SelectGroup data-provider-category={group.category}>
                    {group.providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="command-dock-provider-controls"
          data-has-settings={activeProviderHasSettings}
          data-local-whisper={isLocalWhisperProvider}
          data-slot="provider-controls"
        >
          {activeProviderId !== null &&
            (isVoiceProviderSwitching ? (
              <ProviderStatusIndicator
                className="command-dock-provider-state"
                dataSlot="voice-provider-connection"
                label={t('provider.connectionChecking')}
                loading
                tone="neutral"
                tooltip={t('provider.connectionCheckingTooltip')}
              />
            ) : isLocalWhisperProvider ? (
              <>
                <LocalWhisperMainStatusIndicator
                  connectedLabel={t('provider.connected')}
                  notConnectedLabel={t('provider.notConnected')}
                  snapshot={localWhisperStatus}
                />
                <LocalWhisperMainResidencyControl
                  disabled={isProviderChangesLocked}
                  failure={localWhisperResidencyFailure}
                  failureSequence={localWhisperResidencyFailureSequence}
                  onAction={onLocalWhisperResidencyAction}
                  pendingAction={localWhisperPendingAction}
                  snapshot={localWhisperStatus}
                />
              </>
            ) : isLoggedIn ? (
              <ProviderStatusIndicator
                className="command-dock-provider-state command-dock-provider-state-success"
                dataSlot="voice-provider-connection"
                label={t('provider.connected')}
                tone="success"
                tooltip={providerStatusTooltip}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={providerActionLabel}
                    className="command-dock-provider-action"
                    data-icon-only
                    disabled={isLoggingIn || isProviderChangesLocked}
                    onClick={() => {
                      if (isLoggingIn || isProviderChangesLocked) return;
                      onProviderLogin();
                    }}
                    size="icon"
                    variant="outline"
                  >
                    {isLoggingIn ? <Spinner label={t('login.loggingIn')} /> : <LogIn aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{providerStatusTooltip}</TooltipContent>
              </Tooltip>
            ))}

          {activeProviderId !== null && activeProviderHasSettings && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={providerSettingsLabel}
                  className="command-dock-provider-settings-shortcut command-dock-settings-shortcut"
                  disabled={isProviderChangesLocked}
                  onClick={() => {
                    if (isProviderChangesLocked) return;
                    onOpenProviderSettings();
                  }}
                  size="icon"
                  title={providerSettingsLabel}
                  variant="outline"
                >
                  <Settings aria-hidden="true" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{providerSettingsLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
}

export default MainToolbar;
