import { BrainCircuit, HardDriveDownload, PowerOff, Settings } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import type { MainPrettifyCliConnectionState } from '@renderer/mainPrettifyCliConnection';
import {
  getMainPrettifyProviderViewState,
  MAIN_PRETTIFY_PROVIDER_LABEL_KEYS,
  type MainPrettifyHttpConnectionState,
} from '@renderer/mainPrettifyProvider';
import { ProviderStatusIndicator } from '@renderer/components/ProviderStatusIndicator';
import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import {
  isPrettifyProviderId,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';

interface MainPrettifyProviderBandProps {
  actionControl?: ReactNode;
  cliConnection: MainPrettifyCliConnectionState | null;
  connectionError: string;
  error: string;
  httpConnection: MainPrettifyHttpConnectionState | null;
  isModelActionRunning: boolean;
  isProviderChangesLocked: boolean;
  isProviderChangeSaving: boolean;
  ollamaModels: readonly PrettifyModelOption[];
  onModelAction: () => void;
  onOpenSettings: () => void;
  onProviderChange: (providerId: PrettifyProviderId) => void;
  settings: PrettifySettings;
}

const PRETTIFY_PROVIDER_GROUPS = [
  ['ollama', 'vllm'],
  ['claude-cli', 'codex-cli'],
] as const satisfies readonly (readonly PrettifyProviderId[])[];

/** Renders the permanent, provider-specific Prettify controls in the main command dock. */
function MainPrettifyProviderBand({
  actionControl,
  cliConnection,
  connectionError,
  error,
  httpConnection,
  isModelActionRunning,
  isProviderChangesLocked,
  isProviderChangeSaving,
  ollamaModels,
  onModelAction,
  onOpenSettings,
  onProviderChange,
  settings,
}: MainPrettifyProviderBandProps): React.JSX.Element {
  const { t } = useI18n();
  const viewState = getMainPrettifyProviderViewState(
    settings,
    ollamaModels,
    cliConnection,
    httpConnection,
    isProviderChangeSaving,
  );
  const hasModelAction = Boolean(viewState.ollamaControl);
  const model = viewState.model || t(viewState.modelFallbackKey);
  const providerSettingsLabel = t('mainDock.openPrettifySettings');
  const modelActionTitle = t(viewState.ollamaControl?.isLoaded ? 'prettify.freeModelTitle' : 'prettify.loadModelTitle');
  const providerConnectionTooltip = isProviderChangeSaving
    ? t('provider.connectionCheckingTooltip')
    : error ||
      connectionError ||
      (viewState.connection
        ? t(viewState.connection.tooltipKey ?? viewState.connection.valueKey ?? viewState.connection.labelKey)
        : '');
  const providerConnectionHasError = !isProviderChangeSaving && Boolean(error);

  return (
    <section className="command-dock-prettify-band" data-slot="prettify-provider-band">
      <div className="command-dock-prettify-layout" data-has-model-action={hasModelAction}>
        <BrainCircuit aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />

        <div className="command-dock-prettify-provider-field">
          <span className="command-dock-field-label">{t('mainDock.prettifyProviderLabel')}</span>
          <Select
            disabled={isProviderChangesLocked}
            onValueChange={(providerId) => {
              if (isProviderChangesLocked) return;
              if (isPrettifyProviderId(providerId)) onProviderChange(providerId);
            }}
            value={viewState.providerId}
          >
            <SelectTrigger aria-label={t('prettify.provider')} className="command-dock-prettify-provider-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRETTIFY_PROVIDER_GROUPS.map((group, groupIndex) => (
                <Fragment key={group[0]}>
                  {groupIndex > 0 && <SelectSeparator />}
                  <SelectGroup>
                    {group.map((providerId) => (
                      <SelectItem key={providerId} value={providerId}>
                        {t(MAIN_PRETTIFY_PROVIDER_LABEL_KEYS[providerId])}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="command-dock-prettify-summary">
          <span className="command-dock-model-label">{t('mainDock.prettifyModelLabel')}</span>
          <strong title={model}>{model}</strong>
        </div>

        {actionControl}

        <div className="command-dock-prettify-controls" data-has-model-action={hasModelAction}>
          {viewState.ollamaControl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-busy={isModelActionRunning || undefined}
                  aria-label={modelActionTitle}
                  className="command-dock-prettify-model-action"
                  disabled={isModelActionRunning || isProviderChangesLocked}
                  onClick={() => {
                    if (isModelActionRunning || isProviderChangesLocked) return;
                    onModelAction();
                  }}
                  size="icon"
                  title={modelActionTitle}
                  variant="outline"
                >
                  <Spinner
                    active={isModelActionRunning}
                    fallback={
                      viewState.ollamaControl.isLoaded ? (
                        <PowerOff aria-hidden="true" strokeWidth={1.75} />
                      ) : (
                        <HardDriveDownload aria-hidden="true" strokeWidth={1.75} />
                      )
                    }
                    label={modelActionTitle}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{modelActionTitle}</TooltipContent>
            </Tooltip>
          )}

          {viewState.connection && (
            <ProviderStatusIndicator
              className="command-dock-provider-state command-dock-prettify-connection"
              dataSlot="prettify-provider-connection"
              label={t(viewState.connection.labelKey)}
              loading={!providerConnectionHasError && viewState.connection.loading}
              role={providerConnectionHasError ? 'alert' : 'status'}
              tone={providerConnectionHasError ? 'error' : viewState.connection.tone}
              tooltip={providerConnectionTooltip}
            />
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={providerSettingsLabel}
                className="command-dock-prettify-settings-shortcut command-dock-settings-shortcut"
                disabled={isProviderChangesLocked}
                onClick={() => {
                  if (isProviderChangesLocked) return;
                  onOpenSettings();
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
        </div>
      </div>
    </section>
  );
}

export default MainPrettifyProviderBand;
