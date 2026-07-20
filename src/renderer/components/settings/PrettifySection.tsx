import {
  ChevronDown,
  CircleHelp,
  LoaderCircle,
  MemoryStick,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, type JSX } from 'react';
import { formatByteSize } from '@renderer/byteFormatting';
import SearchableSelectInput from '@renderer/components/SearchableSelectInput';
import type { PrettifySettingsDraft } from '@renderer/appSettingsUtils';
import {
  ClaudeCliPrettifyPanel,
  CodexCliPrettifyPanel,
  HttpPrettifyPanel,
} from '@renderer/components/settings/PrettifyProviderPanels';
import type { FieldErrorRenderer, TranslationFunction } from '@renderer/components/settings/types';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Textarea } from '@renderer/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import {
  getCodexCliModelControls,
  normalizeCodexCliSettingsForModel,
  shouldRefreshCliModelsOnOpen,
  type PrettifyModelCheckStatus,
} from '@renderer/prettifyModelControl';
import { getOllamaModelAction, getPrettifyProviderSettingsViewState } from '@renderer/prettifySettingsViewState';
import {
  PRETTIFY_PROVIDER_IDS,
  getPrettifyBaseUrlValidationError,
  isPrettifyProviderBaseUrlLoopback,
  type ClaudeCliPrettifyEffort,
  type CodexCliPrettifyReasoningEffort,
  type CodexCliPrettifyVerbosity,
  type PrettifyModelOption,
  type PrettifyProviderAvailability,
  type PrettifyProviderId,
} from '@shared/prettifySettings';

const EMPTY_MODEL_OPTION_VALUE = '__gpt_voice_empty_model__';
const PROVIDER_LABEL_KEYS: Record<PrettifyProviderId, string> = {
  ollama: 'prettify.provider.ollama',
  vllm: 'prettify.provider.vllm',
  'claude-cli': 'prettify.provider.claudeCli',
  'codex-cli': 'prettify.provider.codexCli',
};

interface PrettifySectionProps {
  availability: PrettifyProviderAvailability;
  fieldError: FieldErrorRenderer;
  isLoadingModel: boolean;
  isLoadingModels: boolean;
  isModelActionMenuOpen: boolean;
  modelCheckStatus: PrettifyModelCheckStatus;
  modelLoadError: string;
  modelLoadStatus: string;
  modelOptions: readonly PrettifyModelOption[];
  modelRefreshError: string;
  onBaseUrlChange: (value: string) => void;
  onClaudeEffortChange: (value: ClaudeCliPrettifyEffort) => void;
  onClearVllmApiKey: () => void;
  onCodexReasoningEffortChange: (value: CodexCliPrettifyReasoningEffort) => void;
  onCodexVerbosityChange: (value: CodexCliPrettifyVerbosity) => void;
  onExecutablePathChange: (value: string) => void;
  onFallbackModelChange: (value: string) => void;
  onLoadModel: () => void;
  onMaxOutputTokensChange: (value: number) => void;
  onMinPChange: (value: number) => void;
  onModelActionMenuOpenChange: (open: boolean) => void;
  onModelChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onProviderChange: (providerId: PrettifyProviderId) => void;
  onRefreshModels: () => void;
  onRepeatPenaltyChange: (value: number) => void;
  onSeedChange: (value: number | null) => void;
  onTemperatureChange: (value: number) => void;
  onTimeoutChange: (value: number) => void;
  onTopKChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onUnloadModel: () => void;
  onVllmApiKeyChange: (value: string) => void;
  prettifySettings: PrettifySettingsDraft;
  selectedOllamaModelLoaded: boolean;
  t: TranslationFunction;
}

function getActiveModel(settings: PrettifySettingsDraft): string {
  switch (settings.providerId) {
    case 'ollama':
      return settings.ollama.model;
    case 'vllm':
      return settings.vllm.model;
    case 'claude-cli':
      return settings.claudeCli.model;
    case 'codex-cli':
      return settings.codexCli.model;
  }
}

function getModelOptionLabel(
  option: PrettifyModelOption,
  providerId: PrettifyProviderId,
  t: TranslationFunction,
): string {
  const name = option.name || option.id;
  if (providerId !== 'ollama') return name;
  const loadedVramSize = formatByteSize(option.vramSizeBytes);
  if (loadedVramSize) return `${name} (${t('prettify.modelVramLoaded', { size: loadedVramSize })})`;
  const approximateVramSize = formatByteSize(option.sizeBytes);
  return approximateVramSize ? `${name} (${t('prettify.modelVramApprox', { size: approximateVramSize })})` : name;
}

/** Edits capability-scoped prettify settings without exposing unsupported controls. */
// eslint-disable-next-line complexity -- Mutually exclusive capability branches keep unsupported controls out of the DOM.
function PrettifySection({
  availability,
  fieldError,
  isLoadingModel,
  isLoadingModels,
  isModelActionMenuOpen,
  modelCheckStatus,
  modelLoadError,
  modelLoadStatus,
  modelOptions,
  modelRefreshError,
  onBaseUrlChange,
  onClaudeEffortChange,
  onClearVllmApiKey,
  onCodexReasoningEffortChange,
  onCodexVerbosityChange,
  onExecutablePathChange,
  onFallbackModelChange,
  onLoadModel,
  onMaxOutputTokensChange,
  onMinPChange,
  onModelActionMenuOpenChange,
  onModelChange,
  onPromptChange,
  onProviderChange,
  onRefreshModels,
  onRepeatPenaltyChange,
  onSeedChange,
  onTemperatureChange,
  onTimeoutChange,
  onTopKChange,
  onTopPChange,
  onUnloadModel,
  onVllmApiKeyChange,
  prettifySettings,
  selectedOllamaModelLoaded,
  t,
}: PrettifySectionProps): JSX.Element {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const viewState = getPrettifyProviderSettingsViewState(prettifySettings, availability);
  const { capabilities } = viewState;
  const isCliProvider = prettifySettings.providerId === 'claude-cli' || prettifySettings.providerId === 'codex-cli';
  const activeModel = getActiveModel(prettifySettings);
  const selectedModel = modelOptions.find((option) => option.id === activeModel);
  const selectedModelVramSize = formatByteSize(selectedModel?.vramSizeBytes ?? selectedModel?.sizeBytes);
  const searchableModelOptions = modelOptions.map((option) => ({
    label: option.name || option.id,
    value: option.id,
  }));
  const codexControls = getCodexCliModelControls(
    prettifySettings.codexCli.model,
    modelOptions,
    modelCheckStatus === 'available',
  );
  const displayedCodexSettings = normalizeCodexCliSettingsForModel(
    prettifySettings.codexCli,
    modelOptions,
    modelCheckStatus === 'available',
  );
  const refreshCliModelsOnOpen = (): void => {
    if (
      shouldRefreshCliModelsOnOpen(
        prettifySettings.providerId,
        modelCheckStatus,
        isLoadingModels,
        activeModel,
        selectedModel,
      )
    ) {
      onRefreshModels();
    }
  };
  const canUseModelActions = capabilities.modelLifecycle && Boolean(activeModel);
  const ollamaModelAction = getOllamaModelAction(selectedOllamaModelLoaded);
  const advancedSummaryLabel = viewState.advancedSettings.usesDefaults
    ? t('prettify.advancedSummaryDefaults')
    : t('prettify.advancedSummaryCustom', {
        count: String(viewState.advancedSettings.customValueCount),
      });
  const activeHttpSettings =
    prettifySettings.providerId === 'ollama'
      ? prettifySettings.ollama
      : prettifySettings.providerId === 'vllm'
        ? prettifySettings.vllm
        : null;
  const showsRemotePrivacyNotice =
    activeHttpSettings !== null &&
    !getPrettifyBaseUrlValidationError(activeHttpSettings.baseUrl) &&
    !isPrettifyProviderBaseUrlLoopback(activeHttpSettings.baseUrl);
  const providerError = fieldError('prettifyProvider');
  const modelError = fieldError('prettifyModel');
  const cliStatusText =
    modelCheckStatus === 'checking'
      ? t('prettify.cli.statusChecking')
      : modelCheckStatus === 'available'
        ? t('prettify.cli.statusAvailable')
        : modelCheckStatus === 'unavailable'
          ? modelRefreshError || t('prettify.cli.statusUnavailable')
          : t('prettify.cli.statusUnchecked');

  return (
    <section aria-labelledby="prettify-heading" className="grid gap-5 pb-4">
      <h2 className="text-base font-semibold text-foreground" id="prettify-heading">
        {t('appSettings.prettify')}
      </h2>

      <div className="grid gap-4">
        <Field error={providerError} id="prettify-provider" label={t('prettify.provider')}>
          <Select
            onValueChange={(value) => onProviderChange(value as PrettifyProviderId)}
            value={prettifySettings.providerId}
          >
            <SelectTrigger aria-invalid={Boolean(providerError) || undefined} id="prettify-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRETTIFY_PROVIDER_IDS.map((providerId) => (
                <SelectItem key={providerId} value={providerId}>
                  {t(PROVIDER_LABEL_KEYS[providerId])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {showsRemotePrivacyNotice && (
          <Alert>
            <AlertDescription>{t('prettify.remoteProviderPrivacy')}</AlertDescription>
          </Alert>
        )}
        {prettifySettings.providerId === 'claude-cli' && (
          <Alert>
            <AlertDescription>{t('prettify.claudeCli.privacy')}</AlertDescription>
          </Alert>
        )}
        {prettifySettings.providerId === 'codex-cli' && (
          <>
            <Alert variant="warning">
              <AlertDescription>
                <span className="font-medium text-foreground">{t('prettify.codexCli.experimental')}. </span>
                {t('prettify.codexCli.experimentalHelp')}
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertDescription>{t('prettify.codexCli.privacy')}</AlertDescription>
            </Alert>
          </>
        )}

        {capabilities.baseUrl && activeHttpSettings && (
          <Field error={fieldError('prettifyBaseUrl')} id="prettify-base-url" label={t('prettify.baseUrl')}>
            <Input
              onChange={(event) => onBaseUrlChange(event.target.value)}
              type="url"
              value={activeHttpSettings.baseUrl}
            />
          </Field>
        )}

        {capabilities.apiKey && prettifySettings.providerId === 'vllm' && (
          <Field error={fieldError('prettifyApiKey')} id="prettify-vllm-api-key" label={t('prettify.vllmApiKey')}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Input
                onChange={(event) => onVllmApiKeyChange(event.target.value)}
                placeholder={
                  prettifySettings.vllm.hasApiKey ? t('prettify.vllmApiKeyStored') : t('prettify.vllmApiKeyPlaceholder')
                }
                type="password"
                value={prettifySettings.vllm.apiKey || ''}
              />
              <Button
                disabled={!prettifySettings.vllm.hasApiKey && !prettifySettings.vllm.apiKey}
                onClick={onClearVllmApiKey}
                size="sm"
                variant="outline"
              >
                {t('prettify.clearVllmApiKey')}
              </Button>
            </div>
          </Field>
        )}

        {isCliProvider && (
          <Field
            description={t('prettify.cli.executablePathHelp')}
            error={fieldError('prettifyExecutablePath')}
            id="prettify-cli-executable-path"
            label={t('prettify.cli.executablePath')}
          >
            <Input
              autoCapitalize="none"
              autoComplete="off"
              onChange={(event) => onExecutablePathChange(event.target.value)}
              spellCheck={false}
              value={
                prettifySettings.providerId === 'claude-cli'
                  ? prettifySettings.claudeCli.executablePath
                  : prettifySettings.codexCli.executablePath
              }
            />
          </Field>
        )}

        <Field
          description={isCliProvider ? t('prettify.cli.modelHelp') : undefined}
          error={modelError}
          id="prettify-model"
          label={isCliProvider ? t('prettify.cli.model') : t('prettify.model')}
          required={capabilities.httpGenerationControls}
        >
          <div
            className={
              capabilities.modelLifecycle
                ? 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2'
                : 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2'
            }
          >
            {isCliProvider ? (
              <SearchableSelectInput
                ariaLabel={t('prettify.cli.model')}
                emptyMessage={t(isLoadingModels ? 'prettify.loadingModels' : 'prettify.noModels')}
                onOpen={refreshCliModelsOnOpen}
                onValueChange={onModelChange}
                options={searchableModelOptions}
                placeholder={t('prettify.providerDefault')}
                toggleLabel={t('prettify.cli.showModelOptions')}
                value={activeModel}
              />
            ) : (
              <Select
                onValueChange={(value) => onModelChange(value === EMPTY_MODEL_OPTION_VALUE ? '' : value)}
                value={activeModel || EMPTY_MODEL_OPTION_VALUE}
              >
                <SelectTrigger aria-invalid={Boolean(modelError) || undefined} id="prettify-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_MODEL_OPTION_VALUE}>{t('prettify.noModels')}</SelectItem>
                  {modelOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {getModelOptionLabel(option, prettifySettings.providerId, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={t('prettify.refreshModels')}
                  disabled={isLoadingModels}
                  onClick={onRefreshModels}
                  size="icon"
                  title={t('prettify.refreshModels')}
                  variant="outline"
                >
                  {isLoadingModels ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <RefreshCw aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isLoadingModels ? t('prettify.loadingModels') : t('prettify.refreshModels')}
              </TooltipContent>
            </Tooltip>

            {capabilities.modelLifecycle && prettifySettings.providerId === 'ollama' && (
              <DropdownMenu onOpenChange={onModelActionMenuOpenChange} open={isModelActionMenuOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={t('prettify.modelActions')}
                        disabled={isLoadingModel || !canUseModelActions}
                        size="icon"
                        title={t('prettify.modelActions')}
                        variant="outline"
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t('prettify.modelActions')}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('prettify.modelActions')}</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={isLoadingModel}
                    onSelect={ollamaModelAction === 'load' ? onLoadModel : onUnloadModel}
                    title={t(ollamaModelAction === 'load' ? 'prettify.loadModelTitle' : 'prettify.freeModelTitle')}
                  >
                    {t(ollamaModelAction === 'load' ? 'prettify.loadModel' : 'prettify.freeModel')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {prettifySettings.providerId === 'ollama' && activeModel && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={selectedOllamaModelLoaded ? 'success' : 'outline'}>
                {selectedOllamaModelLoaded ? <MemoryStick aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
                {t(selectedOllamaModelLoaded ? 'modelMemory.loaded' : 'modelMemory.notLoaded')}
              </Badge>
              {selectedModelVramSize && (
                <span className="text-xs text-muted-foreground">
                  {t('prettify.modelVramApprox', { size: selectedModelVramSize })}
                </span>
              )}
            </div>
          )}
        </Field>

        {isCliProvider ? (
          <Alert variant={modelCheckStatus === 'unavailable' ? 'destructive' : 'info'}>
            <AlertDescription>{cliStatusText}</AlertDescription>
          </Alert>
        ) : (
          modelRefreshError && (
            <Alert variant="destructive">
              <AlertDescription>{modelRefreshError}</AlertDescription>
            </Alert>
          )
        )}
        {modelLoadError && (
          <Alert variant="destructive">
            <AlertDescription>{modelLoadError}</AlertDescription>
          </Alert>
        )}
        {modelLoadStatus && (
          <Alert>
            <AlertDescription>{modelLoadStatus}</AlertDescription>
          </Alert>
        )}

        {capabilities.httpGenerationControls && (
          <Field
            error={fieldError('prettifyTemperature')}
            label={t('prettify.temperature', { value: prettifySettings.temperature.toFixed(2) })}
          >
            <Slider
              aria-label={t('prettify.temperature', { value: prettifySettings.temperature.toFixed(2) })}
              max={1}
              min={0}
              onValueChange={([value]) => onTemperatureChange(value ?? prettifySettings.temperature)}
              step={0.05}
              value={[prettifySettings.temperature]}
            />
          </Field>
        )}

        <Collapsible onOpenChange={setIsAdvancedOpen} open={isAdvancedOpen}>
          <div className="border-y border-border py-2">
            <CollapsibleTrigger asChild>
              <Button aria-expanded={isAdvancedOpen} className="w-full justify-between px-1" variant="ghost">
                <span className="flex min-w-0 items-center gap-2 text-left">
                  <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{t('prettify.advancedGeneration')}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {advancedSummaryLabel}
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition-transform duration-[var(--duration-fast)] ${isAdvancedOpen ? 'rotate-180' : ''}`}
                  />
                </span>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="pt-4">
              {capabilities.httpGenerationControls && (
                <HttpPrettifyPanel
                  fieldError={fieldError}
                  onMaxOutputTokensChange={onMaxOutputTokensChange}
                  onMinPChange={onMinPChange}
                  onRepeatPenaltyChange={onRepeatPenaltyChange}
                  onSeedChange={onSeedChange}
                  onTopKChange={onTopKChange}
                  onTopPChange={onTopPChange}
                  settings={prettifySettings}
                  t={t}
                />
              )}

              {prettifySettings.providerId === 'claude-cli' && (
                <ClaudeCliPrettifyPanel
                  fieldError={fieldError}
                  isLoadingModels={isLoadingModels}
                  modelOptions={searchableModelOptions}
                  onEffortChange={onClaudeEffortChange}
                  onFallbackModelChange={onFallbackModelChange}
                  onModelsOpen={refreshCliModelsOnOpen}
                  onTimeoutChange={onTimeoutChange}
                  settings={prettifySettings.claudeCli}
                  t={t}
                />
              )}

              {prettifySettings.providerId === 'codex-cli' && (
                <CodexCliPrettifyPanel
                  controls={codexControls}
                  displayedSettings={displayedCodexSettings}
                  fieldError={fieldError}
                  isLoadingModels={isLoadingModels}
                  onModelsOpen={refreshCliModelsOnOpen}
                  onReasoningEffortChange={onCodexReasoningEffortChange}
                  onTimeoutChange={onTimeoutChange}
                  onVerbosityChange={onCodexVerbosityChange}
                  t={t}
                />
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Field error={fieldError('prettifyPrompt')} label={t('prettify.prompt')} required>
          <Textarea
            className="min-h-40"
            onChange={(event) => onPromptChange(event.target.value)}
            value={prettifySettings.prompt}
          />
        </Field>
      </div>
    </section>
  );
}

export default PrettifySection;
