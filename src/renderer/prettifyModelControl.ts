import {
  CLAUDE_CLI_PRETTIFY_MODEL_ALIASES,
  DEFAULT_CODEX_CLI_PRETTIFY_REASONING_EFFORT,
  DEFAULT_CODEX_CLI_PRETTIFY_VERBOSITY,
  getPrettifyProviderCapabilities,
  type CodexCliPrettifyReasoningEffort,
  type CodexCliPrettifySettings,
  type CodexCliPrettifyVerbosity,
  type PrettifyModelOption,
  type PrettifyModelSource,
  type PrettifyProviderAvailability,
  type PrettifyProviderId,
  type PrettifySettings,
} from '@shared/prettifySettings';

export type PrettifyModelCheckStatus = 'unchecked' | 'checking' | 'available' | 'unavailable';

export interface PrettifyProviderModelState {
  availability: PrettifyProviderAvailability;
  checkStatus: PrettifyModelCheckStatus;
  source: PrettifyModelSource;
}

export type PrettifyProviderModelStates = Record<PrettifyProviderId, PrettifyProviderModelState>;
export type PrettifyProviderModelOptions = Record<PrettifyProviderId, PrettifyModelOption[]>;

export interface CodexCliModelControls {
  reasoningEfforts: readonly CodexCliPrettifyReasoningEffort[];
  verbosity: readonly CodexCliPrettifyVerbosity[];
}

export interface OllamaModelControl {
  isLoaded: boolean;
  model: string;
  vramSizeBytes?: number;
}

export function shouldRefreshCliModelsOnOpen(
  providerId: PrettifyProviderId,
  checkStatus: PrettifyModelCheckStatus,
  isLoading: boolean,
  configuredModel: string,
  selectedModel?: PrettifyModelOption,
): boolean {
  if ((providerId !== 'claude-cli' && providerId !== 'codex-cli') || isLoading || checkStatus === 'checking') {
    return false;
  }
  if (checkStatus !== 'available') return true;
  if (providerId !== 'codex-cli' || !configuredModel) return false;
  return !selectedModel || selectedModel.reasoningEfforts === undefined || selectedModel.verbosity === undefined;
}

function appendConfiguredModel(models: readonly PrettifyModelOption[], configuredModel: string): PrettifyModelOption[] {
  const model = configuredModel.trim();
  if (!model || models.some((option) => option.id === model)) return [...models];
  return [{ id: model, name: model }, ...models];
}

export function createPrettifyProviderModelStates(): PrettifyProviderModelStates {
  return {
    ollama: {
      availability: { status: 'available' },
      checkStatus: 'unchecked',
      source: getPrettifyProviderCapabilities('ollama').modelSource,
    },
    vllm: {
      availability: { status: 'available' },
      checkStatus: 'unchecked',
      source: getPrettifyProviderCapabilities('vllm').modelSource,
    },
    'claude-cli': {
      availability: { status: 'unavailable' },
      checkStatus: 'unchecked',
      source: getPrettifyProviderCapabilities('claude-cli').modelSource,
    },
    'codex-cli': {
      availability: { status: 'unavailable' },
      checkStatus: 'unchecked',
      source: getPrettifyProviderCapabilities('codex-cli').modelSource,
    },
  };
}

export function createPrettifyProviderModelOptions(settings: PrettifySettings): PrettifyProviderModelOptions {
  const claudeAliases = CLAUDE_CLI_PRETTIFY_MODEL_ALIASES.map((id) => ({ id, name: id }));
  return {
    ollama: [],
    vllm: [],
    'claude-cli': appendConfiguredModel(claudeAliases, settings.claudeCli.model),
    'codex-cli': appendConfiguredModel([], settings.codexCli.model),
  };
}

export function mergePrettifyProviderModelOptions(
  models: readonly PrettifyModelOption[],
  configuredModel: string,
): PrettifyModelOption[] {
  return appendConfiguredModel(models, configuredModel);
}

function uniqueValues<Value extends string>(values: readonly Value[]): Value[] {
  return [...new Set(values)];
}

export function getCodexCliModelControls(
  model: string,
  models: readonly PrettifyModelOption[],
  useDiscoveredCapabilities: boolean,
): CodexCliModelControls {
  const selectedModel = useDiscoveredCapabilities ? models.find((option) => option.id === model) : undefined;
  return {
    reasoningEfforts: uniqueValues([
      DEFAULT_CODEX_CLI_PRETTIFY_REASONING_EFFORT,
      ...(selectedModel?.reasoningEfforts ?? []),
    ]),
    verbosity: uniqueValues([DEFAULT_CODEX_CLI_PRETTIFY_VERBOSITY, ...(selectedModel?.verbosity ?? [])]),
  };
}

export function normalizeCodexCliSettingsForModel(
  settings: CodexCliPrettifySettings,
  models: readonly PrettifyModelOption[],
  useDiscoveredCapabilities: boolean,
): CodexCliPrettifySettings {
  const controls = getCodexCliModelControls(settings.model, models, useDiscoveredCapabilities);
  return {
    ...settings,
    reasoningEffort: controls.reasoningEfforts.includes(settings.reasoningEffort)
      ? settings.reasoningEffort
      : DEFAULT_CODEX_CLI_PRETTIFY_REASONING_EFFORT,
    verbosity: controls.verbosity.includes(settings.verbosity)
      ? settings.verbosity
      : DEFAULT_CODEX_CLI_PRETTIFY_VERBOSITY,
  };
}

export function getOllamaModelControl(
  settings: PrettifySettings | null,
  models: readonly PrettifyModelOption[],
): OllamaModelControl | null {
  if (!settings || settings.providerId !== 'ollama' || !settings.ollama.model) {
    return null;
  }

  const selectedModel = models.find((model) => model.id === settings.ollama.model);
  return {
    isLoaded: Boolean(selectedModel?.isLoaded),
    model: settings.ollama.model,
    vramSizeBytes: selectedModel?.vramSizeBytes,
  };
}
