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
import { getOllamaModelAction, getPrettifyAdvancedSettingsSummary } from '@renderer/prettifySettingsViewState';
import {
  DEFAULT_PRETTIFY_MAX_OUTPUT_TOKENS,
  PRETTIFY_PROVIDER_IDS,
  getPrettifyBaseUrlValidationError,
  isPrettifyProviderBaseUrlLoopback,
  type PrettifyModelOption,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';

const EMPTY_MODEL_OPTION_VALUE = '__gpt_voice_empty_model__';

interface PrettifySectionProps {
  fieldError: FieldErrorRenderer;
  isLoadingModel: boolean;
  isLoadingModels: boolean;
  isModelActionMenuOpen: boolean;
  modelLoadError: string;
  modelLoadStatus: string;
  modelOptions: Record<PrettifyProviderId, PrettifyModelOption[]>;
  modelRefreshError: string;
  onBaseUrlChange: (value: string) => void;
  onClearVllmApiKey: () => void;
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
  onTopKChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onUnloadModel: () => void;
  onVllmApiKeyChange: (value: string) => void;
  prettifySettings: PrettifySettings;
  selectedOllamaModelLoaded: boolean;
  t: TranslationFunction;
}

function getActiveProviderSettings(settings: PrettifySettings) {
  return settings.providerId === 'vllm' ? settings.vllm : settings.ollama;
}

function parseIntegerInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : fallback;
}

function parseOptionalIntegerInput(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function getModelOptionLabel(
  option: PrettifyModelOption,
  providerId: PrettifyProviderId,
  t: TranslationFunction,
): string {
  const name = option.name || option.id;
  if (providerId !== 'ollama') {
    return name;
  }

  const loadedVramSize = formatByteSize(option.vramSizeBytes);
  if (loadedVramSize) {
    return `${name} (${t('prettify.modelVramLoaded', { size: loadedVramSize })})`;
  }

  const approximateVramSize = formatByteSize(option.sizeBytes);
  return approximateVramSize ? `${name} (${t('prettify.modelVramApprox', { size: approximateVramSize })})` : name;
}

function PrettifySection({
  fieldError,
  isLoadingModel,
  isLoadingModels,
  isModelActionMenuOpen,
  modelLoadError,
  modelLoadStatus,
  modelOptions,
  modelRefreshError,
  onBaseUrlChange,
  onClearVllmApiKey,
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
  onTopKChange,
  onTopPChange,
  onUnloadModel,
  onVllmApiKeyChange,
  prettifySettings,
  selectedOllamaModelLoaded,
  t,
}: PrettifySectionProps): JSX.Element {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const activeProviderSettings = getActiveProviderSettings(prettifySettings);
  const providerError = fieldError('prettifyProvider');
  const baseUrlError = fieldError('prettifyBaseUrl');
  const apiKeyError = fieldError('prettifyApiKey');
  const modelError = fieldError('prettifyModel');
  const temperatureError = fieldError('prettifyTemperature');
  const topPError = fieldError('prettifyTopP');
  const topKError = fieldError('prettifyTopK');
  const minPError = fieldError('prettifyMinP');
  const repeatPenaltyError = fieldError('prettifyRepeatPenalty');
  const maxOutputTokensError = fieldError('prettifyMaxOutputTokens');
  const seedError = fieldError('prettifySeed');
  const promptError = fieldError('prettifyPrompt');
  const activeModelOptions = [
    ...(!activeProviderSettings.model ||
    modelOptions[prettifySettings.providerId].some((option) => option.id === activeProviderSettings.model)
      ? []
      : [
          {
            id: activeProviderSettings.model,
            name: activeProviderSettings.model,
          },
        ]),
    ...modelOptions[prettifySettings.providerId],
  ];
  const selectedModel = activeModelOptions.find((option) => option.id === activeProviderSettings.model);
  const selectedModelVramSize = formatByteSize(selectedModel?.vramSizeBytes ?? selectedModel?.sizeBytes);
  const selectedModelValue = activeProviderSettings.model || EMPTY_MODEL_OPTION_VALUE;
  const canUseModelActions = prettifySettings.providerId === 'ollama' && Boolean(activeProviderSettings.model);
  const ollamaModelAction = getOllamaModelAction(selectedOllamaModelLoaded);
  const advancedSummary = getPrettifyAdvancedSettingsSummary(prettifySettings);
  const advancedSummaryLabel = advancedSummary.usesDefaults
    ? t('prettify.advancedSummaryDefaults')
    : t('prettify.advancedSummaryCustom', { count: String(advancedSummary.customValueCount) });
  const showsRemotePrivacyNotice =
    !getPrettifyBaseUrlValidationError(activeProviderSettings.baseUrl) &&
    !isPrettifyProviderBaseUrlLoopback(activeProviderSettings.baseUrl);

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
                  {t(`prettify.provider.${providerId}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field error={baseUrlError} id="prettify-base-url" label={t('prettify.baseUrl')}>
          <Input
            onChange={(event) => onBaseUrlChange(event.target.value)}
            type="url"
            value={activeProviderSettings.baseUrl}
          />
        </Field>

        {showsRemotePrivacyNotice && (
          <Alert>
            <AlertDescription>{t('prettify.remoteProviderPrivacy')}</AlertDescription>
          </Alert>
        )}

        {prettifySettings.providerId === 'vllm' && (
          <Field error={apiKeyError} id="prettify-vllm-api-key" label={t('prettify.vllmApiKey')}>
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

        <Field error={modelError} id="prettify-model" label={t('prettify.model')} required>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <Select
              onValueChange={(value) => onModelChange(value === EMPTY_MODEL_OPTION_VALUE ? '' : value)}
              value={selectedModelValue}
            >
              <SelectTrigger aria-invalid={Boolean(modelError) || undefined} id="prettify-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_MODEL_OPTION_VALUE}>{t('prettify.noModels')}</SelectItem>
                {activeModelOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {getModelOptionLabel(option, prettifySettings.providerId, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {prettifySettings.providerId === 'ollama' && (
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

          {prettifySettings.providerId === 'ollama' && activeProviderSettings.model && (
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

        {modelRefreshError && (
          <Alert variant="destructive">
            <AlertDescription>{modelRefreshError}</AlertDescription>
          </Alert>
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

        <Field
          error={temperatureError}
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
              <div className="grid gap-4">
                <Field error={topPError} label={t('prettify.topP', { value: prettifySettings.topP.toFixed(2) })}>
                  <Slider
                    aria-label={t('prettify.topP', { value: prettifySettings.topP.toFixed(2) })}
                    max={1}
                    min={0.05}
                    onValueChange={([value]) => onTopPChange(value ?? prettifySettings.topP)}
                    step={0.05}
                    value={[prettifySettings.topP]}
                  />
                </Field>
                <Field error={minPError} label={t('prettify.minP', { value: prettifySettings.minP.toFixed(2) })}>
                  <Slider
                    aria-label={t('prettify.minP', { value: prettifySettings.minP.toFixed(2) })}
                    max={1}
                    min={0}
                    onValueChange={([value]) => onMinPChange(value ?? prettifySettings.minP)}
                    step={0.05}
                    value={[prettifySettings.minP]}
                  />
                </Field>
                <Field
                  error={repeatPenaltyError}
                  label={t('prettify.repeatPenalty', { value: prettifySettings.repeatPenalty.toFixed(2) })}
                >
                  <Slider
                    aria-label={t('prettify.repeatPenalty', { value: prettifySettings.repeatPenalty.toFixed(2) })}
                    max={1.5}
                    min={0.8}
                    onValueChange={([value]) => onRepeatPenaltyChange(value ?? prettifySettings.repeatPenalty)}
                    step={0.05}
                    value={[prettifySettings.repeatPenalty]}
                  />
                </Field>

                <div className="grid gap-4 min-[700px]:grid-cols-2">
                  <Field error={topKError} label={t('prettify.topK')}>
                    <Input
                      inputMode="numeric"
                      max="200"
                      min="1"
                      onChange={(event) => onTopKChange(parseIntegerInput(event.target.value, 40))}
                      step="1"
                      type="number"
                      value={prettifySettings.topK}
                    />
                  </Field>
                  <Field error={maxOutputTokensError} label={t('prettify.maxOutputTokens')}>
                    <Input
                      inputMode="numeric"
                      max="8192"
                      min="1"
                      onChange={(event) =>
                        onMaxOutputTokensChange(
                          parseIntegerInput(event.target.value, DEFAULT_PRETTIFY_MAX_OUTPUT_TOKENS),
                        )
                      }
                      step="1"
                      type="number"
                      value={prettifySettings.maxOutputTokens}
                    />
                  </Field>
                  <Field error={seedError} label={t('prettify.seed')}>
                    <Input
                      inputMode="numeric"
                      max="2147483647"
                      min="0"
                      onChange={(event) => onSeedChange(parseOptionalIntegerInput(event.target.value))}
                      step="1"
                      type="number"
                      value={prettifySettings.seed === null ? '' : prettifySettings.seed}
                    />
                  </Field>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Field error={promptError} label={t('prettify.prompt')} required>
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
