import { CliProcessFailureCode, CliProcessRunner, type CliProcessResult } from '@main/services/prettifyCliRunner';
import {
  CLAUDE_CLI_PRETTIFY_MODEL_ALIASES,
  isValidClaudeCliPrettifyModel,
  type ClaudeCliPrettifyEffort,
  type ClaudeCliPrettifySettings,
} from '@shared/prettifySettings';

export const CLAUDE_CLI_EXECUTABLE_NAME = 'claude';
export const CLAUDE_CLI_MINIMUM_VERSION = '2.1.71';
export const CLAUDE_CLI_STDERR_LIMIT_BYTES = 16 * 1024;
export const CLAUDE_CLI_STDOUT_LIMIT_BYTES = 256 * 1024;
export const CLAUDE_CLI_MODEL_ALIASES = CLAUDE_CLI_PRETTIFY_MODEL_ALIASES;

const REQUIRED_CLAUDE_CLI_HELP_FLAGS = [
  '--print',
  '--input-format',
  '--output-format',
  '--json-schema',
  '--tools',
  '--disable-slash-commands',
  '--setting-sources',
  '--mcp-config',
  '--strict-mcp-config',
  '--no-chrome',
  '--no-session-persistence',
  '--permission-mode',
  '--system-prompt',
  '--model',
  '--fallback-model',
  '--effort',
] as const;

const CLAUDE_CLI_OUTPUT_SCHEMA = JSON.stringify({
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
  },
  required: ['text'],
  type: 'object',
});

export enum ClaudeCliPrettifyErrorCode {
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
}

export interface ClaudeCliAvailability {
  capabilityVersion: string;
  success: true;
}

export interface ClaudeCliUnavailable {
  error: ClaudeCliPrettifyErrorCode;
  success: false;
}

export type ClaudeCliAvailabilityResult = ClaudeCliAvailability | ClaudeCliUnavailable;

export interface ClaudeCliPrettifySuccess {
  capabilityVersion: string;
  success: true;
  text: string;
}

export interface ClaudeCliPrettifyFailure {
  error: ClaudeCliPrettifyErrorCode;
  success: false;
}

export type ClaudeCliPrettifyResult = ClaudeCliPrettifySuccess | ClaudeCliPrettifyFailure;

export interface ClaudeCliPreparedPrettify {
  cacheContext: readonly string[];
  capabilityVersion: string;
  execute(text: string): Promise<ClaudeCliPrettifyResult>;
}

export type ClaudeCliPrepareResult = { prepared: ClaudeCliPreparedPrettify; success: true } | ClaudeCliPrettifyFailure;

export interface ClaudeCliPrettifyInput {
  prompt: string;
  settings: ClaudeCliPrettifySettings;
  signal: AbortSignal;
  text: string;
}

export interface ClaudeCliAvailabilityInput {
  settings: ClaudeCliPrettifySettings;
  signal: AbortSignal;
}

export interface ClaudeCliPrepareInput extends ClaudeCliAvailabilityInput {
  prompt: string;
}

export interface ClaudeCliProcessRunner {
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

export interface ClaudeCliPrettifyAdapterDependencies {
  runner?: ClaudeCliProcessRunner;
}

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  value: string;
}

interface ClaudeCliAuthStatus {
  loggedIn: boolean;
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

function parseAuthStatus(output: Uint8Array): ClaudeCliAuthStatus | null {
  try {
    const parsed: unknown = JSON.parse(decodeOutput(output));
    if (!isRecord(parsed) || typeof parsed.loggedIn !== 'boolean') return null;
    return { loggedIn: parsed.loggedIn };
  } catch {
    return null;
  }
}

function hasRequiredCapabilities(output: Uint8Array): boolean {
  const help = decodeOutput(output);
  return REQUIRED_CLAUDE_CLI_HELP_FLAGS.every((flag) => help.includes(flag));
}

function getConfiguredExecutablePath(settings: ClaudeCliPrettifySettings): string | undefined {
  return settings.executablePath || undefined;
}

function getTimeoutMs(settings: ClaudeCliPrettifySettings): number {
  return settings.timeoutSeconds * 1_000;
}

function mapRunnerFailure(result: Exclude<CliProcessResult, { success: true }>): ClaudeCliPrettifyErrorCode {
  if (result.failure === CliProcessFailureCode.NotFound) return ClaudeCliPrettifyErrorCode.NotInstalled;
  if (result.failure === CliProcessFailureCode.NotExecutable) return ClaudeCliPrettifyErrorCode.NotExecutable;
  if (result.failure === CliProcessFailureCode.Cancelled) return ClaudeCliPrettifyErrorCode.Cancelled;
  if (result.failure === CliProcessFailureCode.TimedOut) return ClaudeCliPrettifyErrorCode.TimedOut;
  if (result.failure === CliProcessFailureCode.StdoutLimit || result.failure === CliProcessFailureCode.StderrLimit) {
    return ClaudeCliPrettifyErrorCode.OutputLimit;
  }
  if (result.failure === CliProcessFailureCode.NonzeroExit) return ClaudeCliPrettifyErrorCode.NonzeroExit;
  return ClaudeCliPrettifyErrorCode.ProcessFailed;
}

function parseClaudeCliEnvelope(
  output: Uint8Array,
): { success: true; text: string } | { error: ClaudeCliPrettifyErrorCode; success: false } {
  try {
    const parsed: unknown = JSON.parse(decodeOutput(output));
    if (!isRecord(parsed) || !isRecord(parsed.structured_output) || typeof parsed.structured_output.text !== 'string') {
      return { error: ClaudeCliPrettifyErrorCode.MalformedOutput, success: false };
    }
    return parsed.structured_output.text.trim()
      ? { success: true, text: parsed.structured_output.text }
      : { error: ClaudeCliPrettifyErrorCode.EmptyOutput, success: false };
  } catch {
    return { error: ClaudeCliPrettifyErrorCode.MalformedOutput, success: false };
  }
}

export const isValidClaudeCliModel = isValidClaudeCliPrettifyModel;

function appendModelArguments(args: string[], settings: ClaudeCliPrettifySettings): boolean {
  if (settings.model) {
    if (!isValidClaudeCliModel(settings.model)) return false;
    args.push('--model', settings.model);
  }
  if (settings.fallbackModel && settings.fallbackModel !== settings.model) {
    if (!isValidClaudeCliModel(settings.fallbackModel)) return false;
    args.push('--fallback-model', settings.fallbackModel);
  }
  return true;
}

function appendEffortArgument(args: string[], effort: ClaudeCliPrettifyEffort): boolean {
  if (effort === 'default') return true;
  if (effort !== 'low' && effort !== 'medium' && effort !== 'high') return false;
  args.push('--effort', effort);
  return true;
}

export function buildClaudeCliPrettifyArguments(
  prompt: string,
  settings: ClaudeCliPrettifySettings,
): readonly string[] | null {
  const args = [
    '--print',
    '--input-format',
    'text',
    '--output-format',
    'json',
    '--json-schema',
    CLAUDE_CLI_OUTPUT_SCHEMA,
    '--tools',
    '',
    '--disable-slash-commands',
    '--setting-sources',
    '',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--strict-mcp-config',
    '--no-chrome',
    '--no-session-persistence',
    '--permission-mode',
    'dontAsk',
    '--system-prompt',
    prompt,
  ];
  if (!appendModelArguments(args, settings) || !appendEffortArgument(args, settings.effort)) return null;
  return args;
}

export function getClaudeCliPrettifyCacheContext(
  capabilityVersion: string,
  prompt: string,
  settings: ClaudeCliPrettifySettings,
): readonly string[] {
  return ['claude-cli', capabilityVersion, settings.model, settings.fallbackModel, settings.effort, prompt];
}

/** Executes Claude CLI preflight and isolated print-mode prettification. */
export class ClaudeCliPrettifyAdapter {
  private readonly runner: ClaudeCliProcessRunner;

  constructor(dependencies: ClaudeCliPrettifyAdapterDependencies = {}) {
    this.runner = dependencies.runner ?? new CliProcessRunner();
  }

  public async checkAvailability(input: ClaudeCliAvailabilityInput): Promise<ClaudeCliAvailabilityResult> {
    const versionResult = await this.run(input.settings, input.signal, 'claude-cli-version', ['--version'], '');
    if (!versionResult.success) return { error: mapRunnerFailure(versionResult), success: false };

    const version = parseSemanticVersion(versionResult.stdout);
    const minimumVersion = parseSemanticVersion(Uint8Array.from(Buffer.from(CLAUDE_CLI_MINIMUM_VERSION)));
    if (!version || !minimumVersion || compareSemanticVersions(version, minimumVersion) < 0) {
      return { error: ClaudeCliPrettifyErrorCode.Unsupported, success: false };
    }

    const helpResult = await this.run(input.settings, input.signal, 'claude-cli-help', ['--help'], '');
    if (!helpResult.success) return { error: mapRunnerFailure(helpResult), success: false };
    if (!hasRequiredCapabilities(helpResult.stdout))
      return { error: ClaudeCliPrettifyErrorCode.Unsupported, success: false };

    const authResult = await this.run(
      input.settings,
      input.signal,
      'claude-cli-auth-status',
      ['auth', 'status', '--json'],
      '',
    );
    if (!authResult.success) {
      if (authResult.failure === CliProcessFailureCode.NonzeroExit) {
        return { error: ClaudeCliPrettifyErrorCode.NotAuthenticated, success: false };
      }
      return { error: mapRunnerFailure(authResult), success: false };
    }
    const authStatus = parseAuthStatus(authResult.stdout);
    if (!authStatus) return { error: ClaudeCliPrettifyErrorCode.ProcessFailed, success: false };
    if (!authStatus.loggedIn) return { error: ClaudeCliPrettifyErrorCode.NotAuthenticated, success: false };

    return { capabilityVersion: version.value, success: true };
  }

  public async prettify(input: ClaudeCliPrettifyInput): Promise<ClaudeCliPrettifyResult> {
    const prepared = await this.prepare(input);
    return prepared.success ? prepared.prepared.execute(input.text) : prepared;
  }

  public async prepare(input: ClaudeCliPrepareInput): Promise<ClaudeCliPrepareResult> {
    const availability = await this.checkAvailability(input);
    if (!availability.success) return availability;

    const args = buildClaudeCliPrettifyArguments(input.prompt, input.settings);
    if (!args) return { error: ClaudeCliPrettifyErrorCode.InvalidModel, success: false };

    let consumed = false;
    return {
      success: true,
      prepared: {
        cacheContext: getClaudeCliPrettifyCacheContext(availability.capabilityVersion, input.prompt, input.settings),
        capabilityVersion: availability.capabilityVersion,
        execute: async (text) => {
          if (consumed) return { error: ClaudeCliPrettifyErrorCode.ProcessFailed, success: false };
          consumed = true;
          const result = await this.run(input.settings, input.signal, 'claude-cli-prettify', args, text);
          if (!result.success) return { error: mapRunnerFailure(result), success: false };

          const envelope = parseClaudeCliEnvelope(result.stdout);
          if (!envelope.success) return envelope;
          return {
            capabilityVersion: availability.capabilityVersion,
            success: true,
            text: envelope.text,
          };
        },
      },
    };
  }

  private run(
    settings: ClaudeCliPrettifySettings,
    signal: AbortSignal,
    operationLabel: string,
    args: readonly string[],
    stdin: string,
  ): Promise<CliProcessResult> {
    return this.runner.run({
      args,
      configuredExecutablePath: getConfiguredExecutablePath(settings),
      executableName: CLAUDE_CLI_EXECUTABLE_NAME,
      includeStderrExcerpt: false,
      operationLabel,
      signal,
      stderrLimitBytes: CLAUDE_CLI_STDERR_LIMIT_BYTES,
      stdin,
      stdoutLimitBytes: CLAUDE_CLI_STDOUT_LIMIT_BYTES,
      timeoutMs: getTimeoutMs(settings),
    });
  }
}
