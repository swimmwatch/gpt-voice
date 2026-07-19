import { LoaderCircle } from 'lucide-react';
import type { JSX } from 'react';
import type { PrettifySettingsDraft } from '@renderer/appSettingsUtils';
import SearchableSelectInput from '@renderer/components/SearchableSelectInput';
import type { FieldErrorRenderer, TranslationFunction } from '@renderer/components/settings/types';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import type { CodexCliModelControls } from '@renderer/prettifyModelControl';
import {
  CLAUDE_CLI_PRETTIFY_EFFORT_VALUES,
  CODEX_CLI_PRETTIFY_REASONING_EFFORT_VALUES,
  CODEX_CLI_PRETTIFY_VERBOSITY_VALUES,
  DEFAULT_PRETTIFY_CLI_TIMEOUT_SECONDS,
  DEFAULT_PRETTIFY_MAX_OUTPUT_TOKENS,
  MAX_PRETTIFY_CLI_TIMEOUT_SECONDS,
  MIN_PRETTIFY_CLI_TIMEOUT_SECONDS,
  type ClaudeCliPrettifyEffort,
  type CodexCliPrettifyReasoningEffort,
  type CodexCliPrettifySettings,
  type CodexCliPrettifyVerbosity,
} from '@shared/prettifySettings';

function parseIntegerInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : fallback;
}

function parseOptionalIntegerInput(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

interface HttpPrettifyPanelProps {
  fieldError: FieldErrorRenderer;
  onMaxOutputTokensChange: (value: number) => void;
  onMinPChange: (value: number) => void;
  onRepeatPenaltyChange: (value: number) => void;
  onSeedChange: (value: number | null) => void;
  onTopKChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  settings: PrettifySettingsDraft;
  t: TranslationFunction;
}

/** Renders HTTP generation controls shared by Ollama and vLLM. */
export function HttpPrettifyPanel({
  fieldError,
  onMaxOutputTokensChange,
  onMinPChange,
  onRepeatPenaltyChange,
  onSeedChange,
  onTopKChange,
  onTopPChange,
  settings,
  t,
}: HttpPrettifyPanelProps): JSX.Element {
  return (
    <div className="grid gap-4">
      <Field error={fieldError('prettifyTopP')} label={t('prettify.topP', { value: settings.topP.toFixed(2) })}>
        <Slider
          aria-label={t('prettify.topP', { value: settings.topP.toFixed(2) })}
          max={1}
          min={0.05}
          onValueChange={([value]) => onTopPChange(value ?? settings.topP)}
          step={0.05}
          value={[settings.topP]}
        />
      </Field>
      <Field error={fieldError('prettifyMinP')} label={t('prettify.minP', { value: settings.minP.toFixed(2) })}>
        <Slider
          aria-label={t('prettify.minP', { value: settings.minP.toFixed(2) })}
          max={1}
          min={0}
          onValueChange={([value]) => onMinPChange(value ?? settings.minP)}
          step={0.05}
          value={[settings.minP]}
        />
      </Field>
      <Field
        error={fieldError('prettifyRepeatPenalty')}
        label={t('prettify.repeatPenalty', { value: settings.repeatPenalty.toFixed(2) })}
      >
        <Slider
          aria-label={t('prettify.repeatPenalty', { value: settings.repeatPenalty.toFixed(2) })}
          max={1.5}
          min={0.8}
          onValueChange={([value]) => onRepeatPenaltyChange(value ?? settings.repeatPenalty)}
          step={0.05}
          value={[settings.repeatPenalty]}
        />
      </Field>
      <div className="grid gap-4 min-[700px]:grid-cols-2">
        <Field error={fieldError('prettifyTopK')} label={t('prettify.topK')}>
          <Input
            inputMode="numeric"
            max="200"
            min="1"
            onChange={(event) => onTopKChange(parseIntegerInput(event.target.value, 40))}
            step="1"
            type="number"
            value={settings.topK}
          />
        </Field>
        <Field error={fieldError('prettifyMaxOutputTokens')} label={t('prettify.maxOutputTokens')}>
          <Input
            inputMode="numeric"
            max="8192"
            min="1"
            onChange={(event) =>
              onMaxOutputTokensChange(parseIntegerInput(event.target.value, DEFAULT_PRETTIFY_MAX_OUTPUT_TOKENS))
            }
            step="1"
            type="number"
            value={settings.maxOutputTokens}
          />
        </Field>
        <Field error={fieldError('prettifySeed')} label={t('prettify.seed')}>
          <Input
            inputMode="numeric"
            max="2147483647"
            min="0"
            onChange={(event) => onSeedChange(parseOptionalIntegerInput(event.target.value))}
            step="1"
            type="number"
            value={settings.seed === null ? '' : settings.seed}
          />
        </Field>
      </div>
    </div>
  );
}

interface ClaudeCliPrettifyPanelProps {
  fieldError: FieldErrorRenderer;
  isLoadingModels: boolean;
  modelOptions: Array<{ label: string; value: string }>;
  onEffortChange: (value: ClaudeCliPrettifyEffort) => void;
  onFallbackModelChange: (value: string) => void;
  onModelsOpen: () => void;
  onTimeoutChange: (value: number) => void;
  settings: PrettifySettingsDraft['claudeCli'];
  t: TranslationFunction;
}

/** Renders Claude CLI fallback, effort, and timeout controls. */
export function ClaudeCliPrettifyPanel({
  fieldError,
  isLoadingModels,
  modelOptions,
  onEffortChange,
  onFallbackModelChange,
  onModelsOpen,
  onTimeoutChange,
  settings,
  t,
}: ClaudeCliPrettifyPanelProps): JSX.Element {
  return (
    <div className="grid gap-4">
      <Field
        description={t('prettify.claudeCli.fallbackModelHelp')}
        error={fieldError('prettifyFallbackModel')}
        label={t('prettify.claudeCli.fallbackModel')}
      >
        <SearchableSelectInput
          ariaLabel={t('prettify.claudeCli.fallbackModel')}
          emptyMessage={t(isLoadingModels ? 'prettify.loadingModels' : 'prettify.noModels')}
          onOpen={onModelsOpen}
          onValueChange={onFallbackModelChange}
          options={modelOptions}
          placeholder={t('prettify.providerDefault')}
          toggleLabel={t('prettify.cli.showModelOptions')}
          value={settings.fallbackModel}
        />
      </Field>
      <Field
        description={t('prettify.claudeCli.effortHelp')}
        error={fieldError('prettifyEffort')}
        label={t('prettify.claudeCli.effort')}
      >
        <Select onValueChange={(value) => onEffortChange(value as ClaudeCliPrettifyEffort)} value={settings.effort}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLAUDE_CLI_PRETTIFY_EFFORT_VALUES.map((effort) => (
              <SelectItem key={effort} value={effort}>
                {t(`prettify.claudeCli.effort.${effort}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <CliTimeoutField
        fieldError={fieldError}
        onTimeoutChange={onTimeoutChange}
        t={t}
        value={settings.timeoutSeconds}
      />
    </div>
  );
}

interface CodexCliPrettifyPanelProps {
  controls: CodexCliModelControls;
  displayedSettings: CodexCliPrettifySettings;
  fieldError: FieldErrorRenderer;
  isLoadingModels: boolean;
  onModelsOpen: () => void;
  onReasoningEffortChange: (value: CodexCliPrettifyReasoningEffort) => void;
  onTimeoutChange: (value: number) => void;
  onVerbosityChange: (value: CodexCliPrettifyVerbosity) => void;
  t: TranslationFunction;
}

/** Renders capability-filtered Codex CLI reasoning, verbosity, and timeout controls. */
export function CodexCliPrettifyPanel({
  controls,
  displayedSettings,
  fieldError,
  isLoadingModels,
  onModelsOpen,
  onReasoningEffortChange,
  onTimeoutChange,
  onVerbosityChange,
  t,
}: CodexCliPrettifyPanelProps): JSX.Element {
  return (
    <div className="grid gap-4">
      <Field
        description={t('prettify.codexCli.reasoningEffortHelp')}
        error={fieldError('prettifyReasoningEffort')}
        label={t('prettify.codexCli.reasoningEffort')}
      >
        <Select
          onOpenChange={(open) => {
            if (open) onModelsOpen();
          }}
          onValueChange={(value) => onReasoningEffortChange(value as CodexCliPrettifyReasoningEffort)}
          value={displayedSettings.reasoningEffort}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <ModelsLoadingStatus isLoading={isLoadingModels} t={t} />
            {CODEX_CLI_PRETTIFY_REASONING_EFFORT_VALUES.filter((effort) =>
              controls.reasoningEfforts.includes(effort),
            ).map((effort) => (
              <SelectItem key={effort} value={effort}>
                {t(`prettify.codexCli.reasoningEffort.${effort}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        description={t('prettify.codexCli.verbosityHelp')}
        error={fieldError('prettifyVerbosity')}
        label={t('prettify.codexCli.verbosity')}
      >
        <Select
          onOpenChange={(open) => {
            if (open) onModelsOpen();
          }}
          onValueChange={(value) => onVerbosityChange(value as CodexCliPrettifyVerbosity)}
          value={displayedSettings.verbosity}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <ModelsLoadingStatus isLoading={isLoadingModels} t={t} />
            {CODEX_CLI_PRETTIFY_VERBOSITY_VALUES.filter((verbosity) => controls.verbosity.includes(verbosity)).map(
              (verbosity) => (
                <SelectItem key={verbosity} value={verbosity}>
                  {t(`prettify.codexCli.verbosity.${verbosity}`)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </Field>
      <CliTimeoutField
        fieldError={fieldError}
        onTimeoutChange={onTimeoutChange}
        t={t}
        value={displayedSettings.timeoutSeconds}
      />
    </div>
  );
}

function ModelsLoadingStatus({ isLoading, t }: { isLoading: boolean; t: TranslationFunction }): JSX.Element | null {
  if (!isLoading) return null;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      <span>{t('prettify.loadingModels')}</span>
    </div>
  );
}

function CliTimeoutField({
  fieldError,
  onTimeoutChange,
  t,
  value,
}: {
  fieldError: FieldErrorRenderer;
  onTimeoutChange: (value: number) => void;
  t: TranslationFunction;
  value: number;
}): JSX.Element {
  return (
    <Field
      description={t('prettify.cli.timeoutHelp')}
      error={fieldError('prettifyTimeout')}
      label={t('prettify.cli.timeout')}
    >
      <Input
        inputMode="numeric"
        max={MAX_PRETTIFY_CLI_TIMEOUT_SECONDS}
        min={MIN_PRETTIFY_CLI_TIMEOUT_SECONDS}
        onChange={(event) =>
          onTimeoutChange(parseIntegerInput(event.target.value, DEFAULT_PRETTIFY_CLI_TIMEOUT_SECONDS))
        }
        step="1"
        type="number"
        value={value}
      />
    </Field>
  );
}
