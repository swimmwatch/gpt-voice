import { BrainCircuit, Circle, Gauge, LoaderCircle, Settings } from 'lucide-react';
import { Fragment } from 'react';
import { useI18n } from '@renderer/hooks/useI18n';
import { getMainPrettifyProviderViewState, MAIN_PRETTIFY_PROVIDER_LABEL_KEYS } from '@renderer/mainPrettifyProvider';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import {
  isPrettifyProviderId,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';

interface MainPrettifyProviderBandProps {
  error: string;
  isModelActionRunning: boolean;
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
  error,
  isModelActionRunning,
  isProviderChangeSaving,
  ollamaModels,
  onModelAction,
  onOpenSettings,
  onProviderChange,
  settings,
}: MainPrettifyProviderBandProps): React.JSX.Element {
  const { t } = useI18n();
  const viewState = getMainPrettifyProviderViewState(settings, ollamaModels);
  const hasModelAction = Boolean(viewState.ollamaControl);
  const model = viewState.model || t(viewState.modelFallbackKey);
  const providerSettingsLabel = t('mainDock.openPrettifySettings');
  const modelActionLabel = t(viewState.ollamaControl?.isLoaded ? 'mainDock.prettifyFree' : 'mainDock.prettifyLoad');
  const modelActionTitle = t(viewState.ollamaControl?.isLoaded ? 'prettify.freeModelTitle' : 'prettify.loadModelTitle');

  return (
    <section className="command-dock-prettify-band" data-slot="prettify-provider-band">
      <div className="command-dock-prettify-layout" data-has-model-action={hasModelAction}>
        <BrainCircuit aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />

        <div className="command-dock-prettify-provider-field">
          <span className="command-dock-field-label">{t('mainDock.prettifyProviderLabel')}</span>
          <Select
            disabled={isProviderChangeSaving}
            onValueChange={(providerId) => {
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
          <span
            className={`command-dock-prettify-state ${error ? 'is-error' : `is-${viewState.status.tone}`}`}
            data-slot="prettify-provider-state"
            role={error ? 'alert' : 'status'}
            title={error || undefined}
          >
            <Circle aria-hidden="true" fill="currentColor" strokeWidth={0} />
            <span>
              {error || (
                <>
                  {t(viewState.status.labelKey)}
                  {viewState.status.valueKey ? `: ${t(viewState.status.valueKey)}` : ''}
                </>
              )}
            </span>
          </span>
        </div>

        {viewState.ollamaControl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={modelActionTitle}
                className="command-dock-prettify-model-action"
                disabled={isModelActionRunning}
                onClick={onModelAction}
                title={modelActionTitle}
                variant="outline"
              >
                {isModelActionRunning ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Gauge aria-hidden="true" strokeWidth={1.75} />
                )}
                <span>{isModelActionRunning ? t('prettify.loadingModel') : modelActionLabel}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{modelActionTitle}</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={providerSettingsLabel}
              className="command-dock-prettify-settings-shortcut"
              onClick={onOpenSettings}
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
    </section>
  );
}

export default MainPrettifyProviderBand;
