/* eslint-disable max-classes-per-file -- The CLI provider module keeps its two sibling implementations together. */
import { t, type TranslationKey } from '@main/i18n';
import {
  CLAUDE_CLI_MODEL_ALIASES,
  ClaudeCliPrettifyAdapter,
  ClaudeCliPrettifyErrorCode,
  isValidClaudeCliModel,
} from '@main/services/prettifyClaudeCli';
import {
  CodexCliPrettifyAdapter,
  CodexCliPrettifyErrorCode,
  isValidCodexCliModel,
} from '@main/services/prettifyCodexCli';
import {
  BasePrettifyProvider,
  createOneShotExecution,
  type PreparePrettifyExecutionResult,
  type PrettifyProviderDependencies,
  type PrettifyProviderModelList,
  type PrettifyProviderRequest,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import type { PrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';
import type { PrettifyModelOption } from '@shared/prettifySettings';

const CLAUDE_CLI_ERROR_KEYS: Record<ClaudeCliPrettifyErrorCode, TranslationKey> = {
  [ClaudeCliPrettifyErrorCode.NotInstalled]: 'error.prettify.claudeCli.not-installed',
  [ClaudeCliPrettifyErrorCode.NotExecutable]: 'error.prettify.claudeCli.not-executable',
  [ClaudeCliPrettifyErrorCode.NotAuthenticated]: 'error.prettify.claudeCli.not-authenticated',
  [ClaudeCliPrettifyErrorCode.Unsupported]: 'error.prettify.claudeCli.unsupported',
  [ClaudeCliPrettifyErrorCode.Cancelled]: 'error.prettify.claudeCli.cancelled',
  [ClaudeCliPrettifyErrorCode.TimedOut]: 'error.prettify.claudeCli.timed-out',
  [ClaudeCliPrettifyErrorCode.OutputLimit]: 'error.prettify.claudeCli.output-limit',
  [ClaudeCliPrettifyErrorCode.NonzeroExit]: 'error.prettify.claudeCli.nonzero-exit',
  [ClaudeCliPrettifyErrorCode.ProcessFailed]: 'error.prettify.claudeCli.process-failed',
  [ClaudeCliPrettifyErrorCode.EmptyOutput]: 'error.prettify.claudeCli.empty-output',
  [ClaudeCliPrettifyErrorCode.MalformedOutput]: 'error.prettify.claudeCli.malformed-output',
  [ClaudeCliPrettifyErrorCode.InvalidModel]: 'error.prettify.claudeCli.invalid-model',
};

const CODEX_CLI_ERROR_KEYS: Record<CodexCliPrettifyErrorCode, TranslationKey> = {
  [CodexCliPrettifyErrorCode.NotInstalled]: 'error.prettify.codexCli.not-installed',
  [CodexCliPrettifyErrorCode.NotExecutable]: 'error.prettify.codexCli.not-executable',
  [CodexCliPrettifyErrorCode.NotAuthenticated]: 'error.prettify.codexCli.not-authenticated',
  [CodexCliPrettifyErrorCode.Unsupported]: 'error.prettify.codexCli.unsupported',
  [CodexCliPrettifyErrorCode.Cancelled]: 'error.prettify.codexCli.cancelled',
  [CodexCliPrettifyErrorCode.TimedOut]: 'error.prettify.codexCli.timed-out',
  [CodexCliPrettifyErrorCode.OutputLimit]: 'error.prettify.codexCli.output-limit',
  [CodexCliPrettifyErrorCode.NonzeroExit]: 'error.prettify.codexCli.nonzero-exit',
  [CodexCliPrettifyErrorCode.ProcessFailed]: 'error.prettify.codexCli.process-failed',
  [CodexCliPrettifyErrorCode.EmptyOutput]: 'error.prettify.codexCli.empty-output',
  [CodexCliPrettifyErrorCode.MalformedOutput]: 'error.prettify.codexCli.malformed-output',
  [CodexCliPrettifyErrorCode.InvalidModel]: 'error.prettify.codexCli.invalid-model',
  [CodexCliPrettifyErrorCode.SchemaUnavailable]: 'error.prettify.codexCli.schema-unavailable',
  [CodexCliPrettifyErrorCode.NoToolsUnavailable]: 'error.prettify.codexCli.no-tools-unavailable',
  [CodexCliPrettifyErrorCode.ModelDiscoveryFailed]: 'error.prettify.codexCli.model-discovery-failed',
};

const defaultClaudeCliAdapter = new ClaudeCliPrettifyAdapter();
const defaultCodexCliAdapter = new CodexCliPrettifyAdapter();

export function createCliFailure(
  providerId: 'claude-cli' | 'codex-cli',
  errorCode: ClaudeCliPrettifyErrorCode | CodexCliPrettifyErrorCode,
): Exclude<PreparePrettifyExecutionResult, { success: true }> {
  const key =
    providerId === 'claude-cli'
      ? CLAUDE_CLI_ERROR_KEYS[errorCode as ClaudeCliPrettifyErrorCode]
      : CODEX_CLI_ERROR_KEYS[errorCode as CodexCliPrettifyErrorCode];
  return { error: t(key), errorCode, success: false };
}

function getClaudeCliModelOptions(configuredModel: string): PrettifyModelOption[] {
  const models: PrettifyModelOption[] = CLAUDE_CLI_MODEL_ALIASES.map((id) => ({ id, name: id }));
  if (
    configuredModel &&
    isValidClaudeCliModel(configuredModel) &&
    !models.some((model) => model.id === configuredModel)
  ) {
    models.push({ id: configuredModel, name: configuredModel });
  }
  return models;
}

/** Capability-gated Claude CLI provider. */
export class ClaudeCliPrettifyProvider extends BasePrettifyProvider {
  public constructor() {
    super('claude-cli');
  }

  public async listModels(
    settings: PrettifySettingsWithSecret,
    deps: PrettifyProviderDependencies,
  ): Promise<PrettifyProviderModelList> {
    const prepared = await (deps.claudeCliAdapter ?? defaultClaudeCliAdapter).prepare({
      prompt: settings.prompt,
      settings: settings.claudeCli,
      signal: new AbortController().signal,
    });
    return {
      availability: prepared.success
        ? { status: 'available', capabilityVersion: prepared.prepared.capabilityVersion }
        : { status: 'unavailable', errorCode: prepared.error },
      models: getClaudeCliModelOptions(settings.claudeCli.model),
      source:
        settings.claudeCli.model && !(CLAUDE_CLI_MODEL_ALIASES as readonly string[]).includes(settings.claudeCli.model)
          ? 'configured-model'
          : 'known-aliases',
    };
  }

  public async prepare(
    settings: PrettifySettingsWithSecret,
    signal: AbortSignal,
    deps: PrettifyProviderDependencies,
  ): Promise<PreparePrettifyExecutionResult> {
    const result = await (deps.claudeCliAdapter ?? defaultClaudeCliAdapter).prepare({
      prompt: settings.prompt,
      settings: settings.claudeCli,
      signal,
    });
    if (!result.success) return createCliFailure('claude-cli', result.error);

    return {
      success: true,
      prepared: createOneShotExecution('claude-cli', result.prepared.cacheContext, async (text) => {
        const executed = await result.prepared.execute(text);
        return executed.success
          ? { success: true, text: executed.text }
          : createCliFailure('claude-cli', executed.error);
      }),
    };
  }

  public async prettify(
    { text, signal = new AbortController().signal, settings }: PrettifyProviderRequest,
    deps: PrettifyProviderDependencies,
  ): Promise<TextProcessingResult> {
    const prepared = await this.prepare(settings, signal, deps);
    return prepared.success ? prepared.prepared.execute(text) : prepared;
  }

  protected getConfiguredModel(settings: PrettifySettingsWithSecret): string {
    return settings.claudeCli.model;
  }
}

/** Capability-gated experimental Codex CLI provider. */
export class CodexCliPrettifyProvider extends BasePrettifyProvider {
  public constructor() {
    super('codex-cli');
  }

  public async listModels(
    settings: PrettifySettingsWithSecret,
    deps: PrettifyProviderDependencies,
  ): Promise<PrettifyProviderModelList> {
    const listed = await (deps.codexCliAdapter ?? defaultCodexCliAdapter).listModels({
      settings: settings.codexCli,
      signal: new AbortController().signal,
    });
    if (!listed.success) {
      return {
        availability: { status: 'unavailable', errorCode: listed.error },
        models: [],
        source: this.capabilities.modelSource,
      };
    }

    const models = listed.models.map((model) => ({
      id: model.id,
      name: model.name,
      reasoningEfforts: model.reasoningEfforts,
      verbosity: model.verbosity,
    }));
    const configuredModel = settings.codexCli.model;
    if (
      configuredModel &&
      isValidCodexCliModel(configuredModel) &&
      !models.some((model) => model.id === configuredModel)
    ) {
      models.push({ id: configuredModel, name: configuredModel, reasoningEfforts: [], verbosity: [] });
    }
    return {
      availability: { status: 'available', capabilityVersion: listed.capabilityVersion },
      models,
      source: listed.source,
    };
  }

  public async prepare(
    settings: PrettifySettingsWithSecret,
    signal: AbortSignal,
    deps: PrettifyProviderDependencies,
  ): Promise<PreparePrettifyExecutionResult> {
    const result = await (deps.codexCliAdapter ?? defaultCodexCliAdapter).prepare({
      prompt: settings.prompt,
      settings: settings.codexCli,
      signal,
    });
    if (!result.success) return createCliFailure('codex-cli', result.error);

    return {
      success: true,
      prepared: createOneShotExecution('codex-cli', result.prepared.cacheContext, async (text) => {
        const executed = await result.prepared.execute(text);
        return executed.success
          ? { success: true, text: executed.text }
          : createCliFailure('codex-cli', executed.error);
      }),
    };
  }

  public async prettify(
    { text, signal = new AbortController().signal, settings }: PrettifyProviderRequest,
    deps: PrettifyProviderDependencies,
  ): Promise<TextProcessingResult> {
    const prepared = await this.prepare(settings, signal, deps);
    return prepared.success ? prepared.prepared.execute(text) : prepared;
  }

  protected getConfiguredModel(settings: PrettifySettingsWithSecret): string {
    return settings.codexCli.model;
  }
}
