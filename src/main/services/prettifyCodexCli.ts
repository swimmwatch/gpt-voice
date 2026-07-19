import { createHash } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { CliProcessFailureCode, CliProcessRunner, type CliProcessResult } from '@main/services/prettifyCliRunner';
import {
  isValidCodexCliPrettifyModel,
  type CodexCliPrettifyReasoningEffort,
  type CodexCliPrettifySettings,
  type CodexCliPrettifyVerbosity,
} from '@shared/prettifySettings';

export const CODEX_CLI_EXECUTABLE_NAME = 'codex';
export const CODEX_CLI_MINIMUM_VERSION = '0.144.3';
export const CODEX_CLI_STDERR_LIMIT_BYTES = 16 * 1024;
export const CODEX_CLI_STDOUT_LIMIT_BYTES = 256 * 1024;
export const CODEX_CLI_MODEL_CATALOG_STDOUT_LIMIT_BYTES = 512 * 1024;
export const CODEX_CLI_OUTPUT_SCHEMA_RELATIVE_PATH = 'prettify/codex-output.schema.json';
export const CODEX_CLI_OUTPUT_SCHEMA_SHA256 = 'c5d6a5a0eb318596d03edb9e697d124f9daa2cfd1b1928f4ae1b786d081a22f6';

const REQUIRED_CODEX_CLI_EXEC_HELP_FLAGS = [
  '--config',
  '--disable',
  '--ephemeral',
  '--ignore-rules',
  '--ignore-user-config',
  '--model',
  '--output-schema',
  '--sandbox',
  '--skip-git-repo-check',
  '--strict-config',
] as const;
const REQUIRED_CODEX_CLI_MODEL_HELP_FLAGS = ['--bundled'] as const;
const SUPPORTED_REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
const SUPPORTED_VERBOSITIES = ['low', 'medium', 'high'] as const;
const GPT_5_3_CODEX_SPARK_CAPABILITY = {
  id: 'gpt-5.3-codex-spark',
  name: 'GPT-5.3-Codex-Spark',
  reasoningEfforts: SUPPORTED_REASONING_EFFORTS,
  verbosity: SUPPORTED_VERBOSITIES,
} as const satisfies CodexCliModelCapability;
const REQUIRED_DISABLED_FEATURES = [
  'apps',
  'browser_use',
  'browser_use_external',
  'browser_use_full_cdp_access',
  'code_mode',
  'code_mode_host',
  'code_mode_only',
  'computer_use',
  'deferred_executor',
  'enable_mcp_apps',
  'hooks',
  'image_generation',
  'multi_agent',
  'multi_agent_v2',
  'plugins',
  'remote_plugin',
  'shell_tool',
  'skill_mcp_dependency_install',
  'standalone_web_search',
  'tool_call_mcp_elicitation',
  'unified_exec',
] as const;
const REQUIRED_CONFIG_OVERRIDES = [
  'approval_policy="never"',
  'mcp_servers={}',
  'model_reasoning_summary="none"',
  'web_search="disabled"',
] as const;

export enum CodexCliPrettifyErrorCode {
  NotInstalled = 'not-installed',
  NotExecutable = 'not-executable',
  NotAuthenticated = 'not-authenticated',
  Unsupported = 'unsupported',
  Cancelled = 'cancelled',
  TimedOut = 'timed-out',
  OutputLimit = 'output-limit',
  NonzeroExit = 'nonzero-exit',
  ProcessFailed = 'process-failed',
  EmptyOutput = 'empty-output',
  MalformedOutput = 'malformed-output',
  InvalidModel = 'invalid-model',
  SchemaUnavailable = 'schema-unavailable',
  NoToolsUnavailable = 'no-tools-unavailable',
  ModelDiscoveryFailed = 'model-discovery-failed',
}

export interface CodexCliAvailability {
  capabilityVersion: string;
  success: true;
}

export interface CodexCliUnavailable {
  error: CodexCliPrettifyErrorCode;
  success: false;
}

export type CodexCliAvailabilityResult = CodexCliAvailability | CodexCliUnavailable;

export interface CodexCliPrettifySuccess {
  capabilityVersion: string;
  success: true;
  text: string;
}

export interface CodexCliPrettifyFailure {
  error: CodexCliPrettifyErrorCode;
  success: false;
}

export type CodexCliPrettifyResult = CodexCliPrettifySuccess | CodexCliPrettifyFailure;

export interface CodexCliModelCapability {
  id: string;
  name: string;
  reasoningEfforts: readonly CodexCliPrettifyReasoningEffort[];
  verbosity: readonly CodexCliPrettifyVerbosity[];
}

export interface CodexCliModelDiscoverySuccess {
  models: readonly CodexCliModelCapability[];
  source: 'catalog' | 'bundled' | 'configured-model';
  success: true;
}

export interface CodexCliModelDiscoveryFailure {
  error: CodexCliPrettifyErrorCode;
  success: false;
}

export type CodexCliModelDiscoveryResult = CodexCliModelDiscoverySuccess | CodexCliModelDiscoveryFailure;

export interface CodexCliPreparedPrettify {
  cacheContext: readonly string[];
  capabilityVersion: string;
  execute(text: string): Promise<CodexCliPrettifyResult>;
  models: readonly CodexCliModelCapability[];
  source: CodexCliModelDiscoverySuccess['source'];
}

export type CodexCliPrepareResult = { prepared: CodexCliPreparedPrettify; success: true } | CodexCliPrettifyFailure;

export interface CodexCliPrettifyInput {
  prompt: string;
  settings: CodexCliPrettifySettings;
  signal: AbortSignal;
  text: string;
}

export interface CodexCliAvailabilityInput {
  settings: CodexCliPrettifySettings;
  signal: AbortSignal;
}

export interface CodexCliPrepareInput extends CodexCliAvailabilityInput {
  prompt: string;
}

export interface CodexCliProcessRunner {
  run(input: {
    args: readonly string[];
    configuredExecutablePath?: string;
    executableName: string;
    includeStderrExcerpt?: boolean;
    operationLabel: string;
    signal: AbortSignal;
    stderrLimitBytes: number;
    stdin: string | Uint8Array;
    stdoutLimitBytes: number;
    timeoutMs: number;
  }): Promise<CliProcessResult>;
}

export interface CodexCliSchemaFileSystem {
  access(filePath: string, mode: number): Promise<void>;
  readFile(filePath: string): Promise<Uint8Array>;
  stat(filePath: string): Promise<{ isFile(): boolean }>;
}

export interface CodexCliOutputSchemaPathContext {
  isPackaged: boolean;
  mainDirectory: string;
  resourcesPath: string;
}

export interface CodexCliPrettifyAdapterDependencies {
  outputSchemaPathResolver?: () => string;
  runner?: CodexCliProcessRunner;
  schemaFileSystem?: CodexCliSchemaFileSystem;
}

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  value: string;
}

interface ParsedModelCatalog {
  models: readonly CodexCliModelCapability[];
}

const systemSchemaFileSystem: CodexCliSchemaFileSystem = {
  access: (filePath, mode) => fs.access(filePath, mode),
  readFile: (filePath) => fs.readFile(filePath),
  stat: (filePath) => fs.stat(filePath),
};

export function resolveCodexCliOutputSchemaPath(context: CodexCliOutputSchemaPathContext): string {
  const assetsDirectory = context.isPackaged
    ? path.join(context.resourcesPath, 'assets')
    : path.join(context.mainDirectory, '..', 'assets');
  return path.join(assetsDirectory, CODEX_CLI_OUTPUT_SCHEMA_RELATIVE_PATH);
}

function resolveDefaultCodexCliOutputSchemaPath(): string {
  return resolveCodexCliOutputSchemaPath({
    isPackaged: app.isPackaged,
    mainDirectory: __dirname,
    resourcesPath: process.resourcesPath,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeOutput(output: Uint8Array): string {
  return new TextDecoder().decode(output);
}

function parseSemanticVersion(output: Uint8Array): SemanticVersion | null {
  const match = /\b(\d+)\.(\d+)\.(\d+)\b/u.exec(decodeOutput(output));
  if (!match) return null;
  const [major, minor, patch] = match.slice(1).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, value: `${major}.${minor}.${patch}` };
}

function compareSemanticVersions(left: SemanticVersion, right: SemanticVersion): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function hasRequiredFlags(output: Uint8Array, flags: readonly string[]): boolean {
  const help = decodeOutput(output);
  return flags.every((flag) => help.includes(flag));
}

function hasRequiredDisableFeatures(output: Uint8Array): boolean {
  const features = new Map<string, string>();
  for (const line of decodeOutput(output).split(/\r?\n/u)) {
    const fields = line.trim().split(/\s+/u);
    const enabled = fields[fields.length - 1];
    const feature = fields[0];
    if (feature && fields.length >= 3 && (enabled === 'true' || enabled === 'false')) {
      features.set(feature, fields.slice(1, -1).join(' '));
    }
  }
  return REQUIRED_DISABLED_FEATURES.every((feature) => {
    const status = features.get(feature);
    return Boolean(status && status !== 'removed');
  });
}

function getConfiguredExecutablePath(settings: CodexCliPrettifySettings): string | undefined {
  return settings.executablePath || undefined;
}

function getTimeoutMs(settings: CodexCliPrettifySettings): number {
  return settings.timeoutSeconds * 1_000;
}

function mapRunnerFailure(result: Exclude<CliProcessResult, { success: true }>): CodexCliPrettifyErrorCode {
  if (result.failure === CliProcessFailureCode.NotFound) return CodexCliPrettifyErrorCode.NotInstalled;
  if (result.failure === CliProcessFailureCode.NotExecutable) return CodexCliPrettifyErrorCode.NotExecutable;
  if (result.failure === CliProcessFailureCode.Cancelled) return CodexCliPrettifyErrorCode.Cancelled;
  if (result.failure === CliProcessFailureCode.TimedOut) return CodexCliPrettifyErrorCode.TimedOut;
  if (result.failure === CliProcessFailureCode.StdoutLimit || result.failure === CliProcessFailureCode.StderrLimit) {
    return CodexCliPrettifyErrorCode.OutputLimit;
  }
  if (result.failure === CliProcessFailureCode.NonzeroExit) return CodexCliPrettifyErrorCode.NonzeroExit;
  return CodexCliPrettifyErrorCode.ProcessFailed;
}

function getTerminalModelDiscoveryError(
  result: CliProcessResult,
): CodexCliPrettifyErrorCode.Cancelled | CodexCliPrettifyErrorCode.TimedOut | null {
  if (result.success) return null;
  const error = mapRunnerFailure(result);
  return error === CodexCliPrettifyErrorCode.Cancelled || error === CodexCliPrettifyErrorCode.TimedOut ? error : null;
}

function isSupportedReasoningEffort(value: unknown): value is CodexCliPrettifyReasoningEffort {
  return typeof value === 'string' && (SUPPORTED_REASONING_EFFORTS as readonly string[]).includes(value);
}

function isSupportedVerbosity(value: unknown): value is CodexCliPrettifyVerbosity {
  return typeof value === 'string' && (SUPPORTED_VERBOSITIES as readonly string[]).includes(value);
}

function parseReasoningEfforts(value: unknown): readonly CodexCliPrettifyReasoningEffort[] | null {
  if (!Array.isArray(value)) return null;
  const efforts: CodexCliPrettifyReasoningEffort[] = [];
  const items: unknown[] = value;
  for (const item of items) {
    const effort: unknown = isRecord(item) ? item.effort : item;
    if (typeof effort !== 'string') return null;
    if (isSupportedReasoningEffort(effort) && !efforts.includes(effort)) efforts.push(effort);
  }
  return efforts;
}

function parseVerbosity(value: unknown): readonly CodexCliPrettifyVerbosity[] | null {
  if (value === true) return SUPPORTED_VERBOSITIES;
  if (value === false) return [];
  if (!Array.isArray(value) || !value.every(isSupportedVerbosity)) return null;
  return value;
}

function parseCatalogModel(value: unknown): CodexCliModelCapability | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : typeof value.slug === 'string' ? value.slug : null;
  const name = typeof value.display_name === 'string' ? value.display_name : null;
  const reasoningEfforts = parseReasoningEfforts(value.supported_reasoning_levels);
  const verbosity = parseVerbosity(value.support_verbosity);
  if (!id || !name || !reasoningEfforts || !verbosity) return null;
  return { id, name, reasoningEfforts, verbosity };
}

function parseModelCatalog(output: Uint8Array): ParsedModelCatalog | null {
  try {
    const parsed: unknown = JSON.parse(decodeOutput(output));
    if (!isRecord(parsed) || !Array.isArray(parsed.models)) return null;
    const models = parsed.models.map(parseCatalogModel);
    if (models.some((model) => model === null)) return null;
    return { models: models as CodexCliModelCapability[] };
  } catch {
    return null;
  }
}

function getKnownConfiguredModelCapability(model: string): CodexCliModelCapability | null {
  return model === GPT_5_3_CODEX_SPARK_CAPABILITY.id ? GPT_5_3_CODEX_SPARK_CAPABILITY : null;
}

function appendKnownConfiguredModelCapability(
  models: readonly CodexCliModelCapability[],
  configuredModel: string,
): readonly CodexCliModelCapability[] {
  if (!configuredModel || models.some((model) => model.id === configuredModel)) return models;
  const knownCapability = getKnownConfiguredModelCapability(configuredModel);
  return knownCapability ? [...models, knownCapability] : models;
}

function parseCodexCliEnvelope(
  output: Uint8Array,
): { success: true; text: string } | { error: CodexCliPrettifyErrorCode; success: false } {
  try {
    const parsed: unknown = JSON.parse(decodeOutput(output));
    if (!isRecord(parsed) || typeof parsed.text !== 'string') {
      return { error: CodexCliPrettifyErrorCode.MalformedOutput, success: false };
    }
    return parsed.text.trim()
      ? { success: true, text: parsed.text }
      : { error: CodexCliPrettifyErrorCode.EmptyOutput, success: false };
  } catch {
    return { error: CodexCliPrettifyErrorCode.MalformedOutput, success: false };
  }
}

export const isValidCodexCliModel = isValidCodexCliPrettifyModel;

function findModelCapability(
  configuredModel: string,
  models: readonly CodexCliModelCapability[],
): CodexCliModelCapability | undefined {
  return models.find((model) => model.id === configuredModel);
}

function appendModelSettings(
  args: string[],
  settings: CodexCliPrettifySettings,
  modelCapability?: CodexCliModelCapability,
): boolean {
  if (settings.model) {
    if (!isValidCodexCliModel(settings.model)) return false;
    args.push('--model', settings.model);
  }

  if (settings.reasoningEffort !== 'default') {
    if (!modelCapability?.reasoningEfforts.includes(settings.reasoningEffort)) return false;
    args.push('--config', `model_reasoning_effort="${settings.reasoningEffort}"`);
  }

  if (settings.verbosity !== 'low') {
    if (!modelCapability?.verbosity.includes(settings.verbosity)) return false;
    args.push('--config', `model_verbosity="${settings.verbosity}"`);
  } else if (modelCapability?.verbosity.includes('low')) {
    args.push('--config', 'model_verbosity="low"');
  }

  return true;
}

/**
 * Builds the fixed, fail-closed Codex invocation. The schema path is supplied
 * by the privileged caller; Task 14 will provide packaged path resolution.
 */
export function buildCodexCliPrettifyArguments(
  prompt: string,
  outputSchemaPath: string,
  settings: CodexCliPrettifySettings,
  modelCapability?: CodexCliModelCapability,
): readonly string[] | null {
  if (!path.isAbsolute(outputSchemaPath)) return null;

  const args = [
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--strict-config',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--output-schema',
    outputSchemaPath,
    '--color',
    'never',
  ];
  for (const config of REQUIRED_CONFIG_OVERRIDES) args.push('--config', config);
  for (const feature of REQUIRED_DISABLED_FEATURES) args.push('--disable', feature);
  if (!appendModelSettings(args, settings, modelCapability)) return null;
  args.push(prompt);
  return args;
}

export function getCodexCliPrettifyCacheContext(
  capabilityVersion: string,
  prompt: string,
  settings: CodexCliPrettifySettings,
): readonly string[] {
  return ['codex-cli', capabilityVersion, settings.model, settings.reasoningEffort, settings.verbosity, prompt];
}

/** Executes the internal, capability-gated Codex CLI Prettify contract. */
export class CodexCliPrettifyAdapter {
  private readonly outputSchemaPathResolver: () => string;
  private readonly runner: CodexCliProcessRunner;
  private readonly schemaFileSystem: CodexCliSchemaFileSystem;

  constructor(dependencies: CodexCliPrettifyAdapterDependencies = {}) {
    this.outputSchemaPathResolver = dependencies.outputSchemaPathResolver ?? resolveDefaultCodexCliOutputSchemaPath;
    this.runner = dependencies.runner ?? new CliProcessRunner();
    this.schemaFileSystem = dependencies.schemaFileSystem ?? systemSchemaFileSystem;
  }

  public async checkAvailability(input: CodexCliAvailabilityInput): Promise<CodexCliAvailabilityResult> {
    const versionResult = await this.run(input.settings, input.signal, 'codex-cli-version', ['--version'], '');
    if (!versionResult.success) return { error: mapRunnerFailure(versionResult), success: false };

    const version = parseSemanticVersion(versionResult.stdout);
    const minimumVersion = parseSemanticVersion(Uint8Array.from(Buffer.from(CODEX_CLI_MINIMUM_VERSION)));
    if (!version || !minimumVersion || compareSemanticVersions(version, minimumVersion) < 0) {
      return { error: CodexCliPrettifyErrorCode.Unsupported, success: false };
    }

    const execHelpResult = await this.run(input.settings, input.signal, 'codex-cli-exec-help', ['exec', '--help'], '');
    if (!execHelpResult.success) return { error: mapRunnerFailure(execHelpResult), success: false };
    if (!hasRequiredFlags(execHelpResult.stdout, REQUIRED_CODEX_CLI_EXEC_HELP_FLAGS)) {
      return { error: CodexCliPrettifyErrorCode.Unsupported, success: false };
    }

    const modelHelpResult = await this.run(
      input.settings,
      input.signal,
      'codex-cli-model-help',
      ['debug', 'models', '--help'],
      '',
    );
    if (!modelHelpResult.success) return { error: mapRunnerFailure(modelHelpResult), success: false };
    if (!hasRequiredFlags(modelHelpResult.stdout, REQUIRED_CODEX_CLI_MODEL_HELP_FLAGS)) {
      return { error: CodexCliPrettifyErrorCode.Unsupported, success: false };
    }

    const featuresResult = await this.run(input.settings, input.signal, 'codex-cli-features', ['features', 'list'], '');
    if (!featuresResult.success) return { error: mapRunnerFailure(featuresResult), success: false };
    if (!hasRequiredDisableFeatures(featuresResult.stdout)) {
      return { error: CodexCliPrettifyErrorCode.NoToolsUnavailable, success: false };
    }

    const authResult = await this.run(input.settings, input.signal, 'codex-cli-login-status', ['login', 'status'], '');
    if (!authResult.success) {
      if (authResult.failure === CliProcessFailureCode.NonzeroExit) {
        return { error: CodexCliPrettifyErrorCode.NotAuthenticated, success: false };
      }
      return { error: mapRunnerFailure(authResult), success: false };
    }

    return { capabilityVersion: version.value, success: true };
  }

  public async discoverModels(
    settings: CodexCliPrettifySettings,
    signal: AbortSignal,
  ): Promise<CodexCliModelDiscoveryResult> {
    const primaryResult = await this.run(
      settings,
      signal,
      'codex-cli-models',
      ['debug', 'models'],
      '',
      CODEX_CLI_MODEL_CATALOG_STDOUT_LIMIT_BYTES,
    );
    if (primaryResult.success) {
      const catalog = parseModelCatalog(primaryResult.stdout);
      if (catalog) {
        return {
          models: appendKnownConfiguredModelCapability(catalog.models, settings.model),
          source: 'catalog',
          success: true,
        };
      }
    }
    const primaryTerminalError = getTerminalModelDiscoveryError(primaryResult);
    if (primaryTerminalError) return { error: primaryTerminalError, success: false };

    const bundledResult = await this.run(
      settings,
      signal,
      'codex-cli-bundled-models',
      ['debug', 'models', '--bundled'],
      '',
      CODEX_CLI_MODEL_CATALOG_STDOUT_LIMIT_BYTES,
    );
    if (bundledResult.success) {
      const catalog = parseModelCatalog(bundledResult.stdout);
      if (catalog) {
        return {
          models: appendKnownConfiguredModelCapability(catalog.models, settings.model),
          source: 'bundled',
          success: true,
        };
      }
    }
    const bundledTerminalError = getTerminalModelDiscoveryError(bundledResult);
    if (bundledTerminalError) return { error: bundledTerminalError, success: false };

    if (settings.model && isValidCodexCliModel(settings.model)) {
      const knownCapability = getKnownConfiguredModelCapability(settings.model);
      return {
        models: [knownCapability ?? { id: settings.model, name: settings.model, reasoningEfforts: [], verbosity: [] }],
        source: 'configured-model',
        success: true,
      };
    }

    const failedResult = primaryResult.success ? bundledResult : primaryResult;
    const mappedError = failedResult.success ? null : mapRunnerFailure(failedResult);
    return {
      error:
        mappedError === CodexCliPrettifyErrorCode.Cancelled || mappedError === CodexCliPrettifyErrorCode.TimedOut
          ? mappedError
          : CodexCliPrettifyErrorCode.ModelDiscoveryFailed,
      success: false,
    };
  }

  public async prettify(input: CodexCliPrettifyInput): Promise<CodexCliPrettifyResult> {
    const prepared = await this.prepare(input);
    return prepared.success ? prepared.prepared.execute(input.text) : prepared;
  }

  public async prepare(input: CodexCliPrepareInput): Promise<CodexCliPrepareResult> {
    const availability = await this.checkAvailability(input);
    if (!availability.success) return availability;
    if (input.settings.model && !isValidCodexCliModel(input.settings.model)) {
      return { error: CodexCliPrettifyErrorCode.InvalidModel, success: false };
    }

    const outputSchemaPath = this.resolveOutputSchemaPath();
    if (!outputSchemaPath || !(await this.hasValidSchema(outputSchemaPath))) {
      return { error: CodexCliPrettifyErrorCode.SchemaUnavailable, success: false };
    }

    const discovered = await this.discoverModels(input.settings, input.signal);
    if (!discovered.success) return discovered;
    const modelCapability = input.settings.model
      ? findModelCapability(input.settings.model, discovered.models)
      : undefined;
    const args = buildCodexCliPrettifyArguments(input.prompt, outputSchemaPath, input.settings, modelCapability);
    if (!args) return { error: CodexCliPrettifyErrorCode.InvalidModel, success: false };

    let consumed = false;
    return {
      success: true,
      prepared: {
        cacheContext: getCodexCliPrettifyCacheContext(availability.capabilityVersion, input.prompt, input.settings),
        capabilityVersion: availability.capabilityVersion,
        execute: async (text) => {
          if (consumed) return { error: CodexCliPrettifyErrorCode.ProcessFailed, success: false };
          consumed = true;
          const result = await this.run(input.settings, input.signal, 'codex-cli-prettify', args, text);
          if (!result.success) return { error: mapRunnerFailure(result), success: false };

          const envelope = parseCodexCliEnvelope(result.stdout);
          if (!envelope.success) return envelope;
          return {
            capabilityVersion: availability.capabilityVersion,
            success: true,
            text: envelope.text,
          };
        },
        models: discovered.models,
        source: discovered.source,
      },
    };
  }

  private async hasValidSchema(outputSchemaPath: string): Promise<boolean> {
    if (!path.isAbsolute(outputSchemaPath)) return false;
    try {
      const metadata = await this.schemaFileSystem.stat(outputSchemaPath);
      if (!metadata.isFile()) return false;
      await this.schemaFileSystem.access(outputSchemaPath, constants.R_OK);
      const contents = await this.schemaFileSystem.readFile(outputSchemaPath);
      return createHash('sha256').update(contents).digest('hex') === CODEX_CLI_OUTPUT_SCHEMA_SHA256;
    } catch {
      return false;
    }
  }

  private resolveOutputSchemaPath(): string | null {
    try {
      return this.outputSchemaPathResolver();
    } catch {
      return null;
    }
  }

  private run(
    settings: CodexCliPrettifySettings,
    signal: AbortSignal,
    operationLabel: string,
    args: readonly string[],
    stdin: string,
    stdoutLimitBytes = CODEX_CLI_STDOUT_LIMIT_BYTES,
  ): Promise<CliProcessResult> {
    return this.runner.run({
      args,
      configuredExecutablePath: getConfiguredExecutablePath(settings),
      executableName: CODEX_CLI_EXECUTABLE_NAME,
      includeStderrExcerpt: false,
      operationLabel,
      signal,
      stderrLimitBytes: CODEX_CLI_STDERR_LIMIT_BYTES,
      stdin,
      stdoutLimitBytes,
      timeoutMs: getTimeoutMs(settings),
    });
  }
}
