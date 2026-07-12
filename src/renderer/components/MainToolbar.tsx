import { AudioLines, Circle, CircleHelp, History, LogIn, Mic, Settings, Wrench } from 'lucide-react';
import { useI18n } from '@renderer/hooks/useI18n';
import { Button } from '@renderer/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Spinner } from '@renderer/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import type { ProviderAuthType, ProviderInfo } from '@renderer/types';

interface MainToolbarProps {
  activeProviderAuthType: ProviderAuthType;
  activeProviderId: string;
  activeProviderName: string;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  onOpenAbout: () => void;
  onOpenAppSettings: () => void;
  onOpenHistory: () => void;
  onOpenProviderSettings: () => void;
  onProviderChange: (providerId: string) => void;
  onProviderLogin: () => void;
  providers: ProviderInfo[];
}

/** Coordinates main-window provider controls, session actions, and status affordances. */
function MainToolbar({
  activeProviderAuthType,
  activeProviderId,
  activeProviderName,
  isLoggedIn,
  isLoggingIn,
  onOpenAbout,
  onOpenAppSettings,
  onOpenHistory,
  onOpenProviderSettings,
  onProviderChange,
  onProviderLogin,
  providers,
}: MainToolbarProps): React.JSX.Element {
  const { t } = useI18n();
  const providerActionLabel = t(activeProviderAuthType === 'apiKey' ? 'provider.configure' : 'provider.connect');
  const providerSettingsLabel = t('navigation.openProviderSettings', { provider: activeProviderName });

  return (
    <header className="command-dock-toolbar" data-slot="main-toolbar">
      <div className="command-dock-header-band">
        <AudioLines aria-hidden="true" className="command-dock-brand-icon" strokeWidth={1.75} />
        <div className="command-dock-brand">
          <strong>{t('mainDock.title')}</strong>
          <span>{t('mainDock.subtitle')}</span>
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
                className="command-dock-icon-button"
                onClick={onOpenAppSettings}
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
          <Select onValueChange={onProviderChange} value={activeProviderId}>
            <SelectTrigger aria-label={t('provider.label')} className="command-dock-provider-trigger">
              <SelectValue placeholder={t('provider.label')} />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoggedIn ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={providerSettingsLabel}
                className="command-dock-provider-state command-dock-provider-state-success"
                onClick={onOpenProviderSettings}
                title={providerSettingsLabel}
                type="button"
              >
                <Circle aria-hidden="true" fill="currentColor" strokeWidth={0} />
                <span>{t('provider.connected')}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{providerSettingsLabel}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={providerActionLabel}
                className="command-dock-provider-action"
                disabled={isLoggingIn}
                onClick={onProviderLogin}
                title={providerActionLabel}
                variant="outline"
              >
                {isLoggingIn ? <Spinner label={t('login.loggingIn')} /> : <LogIn aria-hidden="true" />}
                <span>{isLoggingIn ? t('login.loggingIn') : providerActionLabel}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{providerActionLabel}</TooltipContent>
          </Tooltip>
        )}

        {!isLoggedIn && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={providerSettingsLabel}
                className="command-dock-provider-settings-shortcut"
                onClick={onOpenProviderSettings}
                title={providerSettingsLabel}
                type="button"
              >
                <Wrench aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{providerSettingsLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}

export default MainToolbar;
