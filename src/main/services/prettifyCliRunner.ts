import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { constants, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CLI_PROCESS_GRACE_PERIOD_MS = 1_000;
export const MAX_CLI_STDERR_EXCERPT_BYTES = 2 * 1024;

const COMMON_ENVIRONMENT_KEYS = ['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TMP', 'TEMP'] as const;
const LINUX_ENVIRONMENT_KEYS = [
  'HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
] as const;
const MACOS_ENVIRONMENT_KEYS = ['HOME'] as const;
const WINDOWS_ENVIRONMENT_KEYS = [
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
] as const;

const DEFAULT_WINDOWS_PATH_EXTENSIONS = ['.COM', '.EXE', '.BAT', '.CMD'];

export enum CliProcessFailureCode {
  NotFound = 'not-found',
  NotExecutable = 'not-executable',
  SpawnError = 'spawn-error',
  StdinEpipe = 'stdin-epipe',
  Cancelled = 'cancelled',
  TimedOut = 'timed-out',
  StdoutLimit = 'stdout-limit',
  StderrLimit = 'stderr-limit',
  NonzeroExit = 'nonzero-exit',
  SignalExit = 'signal-exit',
  ForcedTermination = 'forced-termination',
  CleanupFailure = 'cleanup-failure',
}

export enum CliProcessPhase {
  Preparation = 'preparation',
  Resolution = 'resolution',
  Spawn = 'spawn',
  Stdin = 'stdin',
  Running = 'running',
  Termination = 'termination',
  Completion = 'completion',
  Cleanup = 'cleanup',
}

export interface CliProcessDiagnostics {
  cleanup: 'clean' | 'failed';
  durationMs: number;
  executable: string;
  exitCode?: number | null;
  operation: string;
  phase: CliProcessPhase;
  signal?: NodeJS.Signals | null;
  stderrBytes: number;
  stdoutBytes: number;
}

export interface CliProcessSuccess {
  diagnostics: CliProcessDiagnostics;
  stdout: Uint8Array;
  success: true;
}

export interface CliProcessFailure {
  diagnostics: CliProcessDiagnostics;
  failure: CliProcessFailureCode;
  stderrExcerpt?: string;
  success: false;
}

export type CliProcessResult = CliProcessSuccess | CliProcessFailure;

export interface CliProcessRunInput {
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
}

export interface CliProcessClock {
  clearTimeout(handle: unknown): void;
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
}

export interface CliProcessFileSystem {
  access(filePath: string, mode: number): Promise<void>;
  mkdtemp(prefix: string): Promise<string>;
  removeDirectory(directory: string): Promise<void>;
  stat(filePath: string): Promise<{ isFile(): boolean }>;
}

export interface CliExecutableResolution {
  executable?: string;
  status: 'resolved' | 'not-executable' | 'not-found';
}

export interface CliExecutableResolverInput {
  configuredExecutablePath?: string;
  environment: NodeJS.ProcessEnv;
  executableName: string;
  platform: NodeJS.Platform;
}

export type CliExecutableResolver = (input: CliExecutableResolverInput) => Promise<CliExecutableResolution>;

export interface CliProcessTreeTerminator {
  force(process: ChildProcess): Promise<void>;
  graceful(process: ChildProcess): Promise<void>;
}

export interface CliProcessRunnerDependencies {
  clock?: CliProcessClock;
  environment?: NodeJS.ProcessEnv;
  executableResolver?: CliExecutableResolver;
  fileSystem?: CliProcessFileSystem;
  getTemporaryDirectory?: () => string;
  platform?: NodeJS.Platform;
  spawn?: (executable: string, args: string[], options: SpawnOptions) => ChildProcess;
  treeTerminator?: CliProcessTreeTerminator;
}

interface ExecutionOutcome {
  cleanupFailed?: boolean;
  diagnostics: Omit<CliProcessDiagnostics, 'cleanup'>;
  failure?: CliProcessFailureCode;
  stderrExcerpt?: string;
  stdout?: Uint8Array;
}

interface FailureDetails {
  exitCode?: number | null;
  failure: CliProcessFailureCode;
  phase: CliProcessPhase;
  signal?: NodeJS.Signals | null;
  stderrBytes?: number;
  stderrExcerpt?: string;
  stdoutBytes?: number;
}

const systemClock: CliProcessClock = {
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
};

const systemFileSystem: CliProcessFileSystem = {
  access: (filePath, mode) => fs.access(filePath, mode),
  mkdtemp: (prefix) => fs.mkdtemp(prefix),
  removeDirectory: (directory) => fs.rm(directory, { force: true, recursive: true }),
  stat: (filePath) => fs.stat(filePath),
};

function isSafeOperationLabel(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/u.test(value);
}

function isSafeExecutableName(value: string): boolean {
  return /^\w[\w.-]{0,127}$/u.test(value);
}

function isValidNonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validateRunInput(input: CliProcessRunInput): void {
  if (!isSafeExecutableName(input.executableName) || !isSafeOperationLabel(input.operationLabel)) {
    throw new TypeError('Invalid CLI process identity');
  }
  if (
    !isValidPositiveInteger(input.timeoutMs) ||
    !isValidNonnegativeInteger(input.stdoutLimitBytes) ||
    !isValidNonnegativeInteger(input.stderrLimitBytes)
  ) {
    throw new TypeError('Invalid CLI process limits');
  }
  if (!Array.isArray(input.args) || input.args.some((arg) => typeof arg !== 'string')) {
    throw new TypeError('Invalid CLI process arguments');
  }
  if (typeof input.stdin !== 'string' && !(input.stdin instanceof Uint8Array)) {
    throw new TypeError('Invalid CLI process input');
  }
}

function getEnvironmentKeys(platform: NodeJS.Platform): readonly string[] {
  if (platform === 'linux') return [...COMMON_ENVIRONMENT_KEYS, ...LINUX_ENVIRONMENT_KEYS];
  if (platform === 'darwin') return [...COMMON_ENVIRONMENT_KEYS, ...MACOS_ENVIRONMENT_KEYS];
  if (platform === 'win32') return [...COMMON_ENVIRONMENT_KEYS, ...WINDOWS_ENVIRONMENT_KEYS];
  return COMMON_ENVIRONMENT_KEYS;
}

export function createCliProcessEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};
  for (const key of getEnvironmentKeys(platform)) {
    const value = environment[key];
    if (typeof value === 'string') sanitized[key] = value;
  }
  return sanitized;
}

function pathApiFor(platform: NodeJS.Platform): typeof path {
  return platform === 'win32' ? path.win32 : path;
}

function isAbsolutePath(filePath: string, platform: NodeJS.Platform): boolean {
  return pathApiFor(platform).isAbsolute(filePath);
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

async function inspectExecutable(
  filePath: string,
  fileSystem: CliProcessFileSystem,
): Promise<'executable' | 'not-executable' | 'not-found'> {
  try {
    const metadata = await fileSystem.stat(filePath);
    if (!metadata.isFile()) return 'not-executable';
    await fileSystem.access(filePath, constants.X_OK);
    return 'executable';
  } catch (error) {
    return isMissingFileError(error) ? 'not-found' : 'not-executable';
  }
}

function getWindowsPathExtensions(environment: NodeJS.ProcessEnv): string[] {
  const configured = environment.PATHEXT;
  const values = configured ? configured.split(';') : DEFAULT_WINDOWS_PATH_EXTENSIONS;
  return values
    .map((value) => value.trim())
    .filter((value) => /^\.\w+$/u.test(value))
    .map((value) => value.toUpperCase());
}

async function resolveExecutableFromPath(
  executableName: string,
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  fileSystem: CliProcessFileSystem,
): Promise<CliExecutableResolution> {
  const pathValue = environment.PATH;
  if (!pathValue) return { status: 'not-found' };

  const pathApi = pathApiFor(platform);
  const extensionCandidates =
    platform === 'win32' && !pathApi.extname(executableName)
      ? getWindowsPathExtensions(environment).map((extension) => `${executableName}${extension}`)
      : [executableName];
  let foundNonExecutable = false;

  for (const directory of pathValue.split(platform === 'win32' ? ';' : ':')) {
    if (!directory) continue;
    for (const candidateName of extensionCandidates) {
      const candidate = pathApi.join(directory, candidateName);
      const status = await inspectExecutable(candidate, fileSystem);
      if (status === 'executable') return { executable: candidate, status: 'resolved' };
      if (status === 'not-executable') foundNonExecutable = true;
    }
  }

  return { status: foundNonExecutable ? 'not-executable' : 'not-found' };
}

function createDefaultExecutableResolver(fileSystem: CliProcessFileSystem): CliExecutableResolver {
  return async ({ configuredExecutablePath, environment, executableName, platform }) => {
    const hasConfiguredPath =
      typeof configuredExecutablePath === 'string' && configuredExecutablePath.trim().length > 0;
    if (hasConfiguredPath) {
      if (!isAbsolutePath(configuredExecutablePath, platform)) return { status: 'not-executable' };
      const status = await inspectExecutable(configuredExecutablePath, fileSystem);
      return status === 'executable' ? { executable: configuredExecutablePath, status: 'resolved' } : { status };
    }
    return resolveExecutableFromPath(executableName, environment, platform, fileSystem);
  };
}

function sanitizeStderrToken(token: string): string {
  const schemeIndex = token.indexOf('://');
  if (schemeIndex >= 0) {
    const authority = token.slice(schemeIndex + 3).split('/')[0] ?? '';
    const accountSeparator = authority.lastIndexOf('@');
    if (accountSeparator > 0 && authority.slice(0, accountSeparator).includes(':')) return '[redacted]';
  }
  if (token.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(token)) return '[path]';
  if (token.includes('@')) return '[account]';
  return token;
}

function removeControlCharacters(text: string): string {
  return [...text]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 && character !== '\n' && character !== '\r' && character !== '\t' ? ' ' : character;
    })
    .join('');
}

function safeStderrExcerpt(chunks: readonly Uint8Array[]): string | undefined {
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  const sanitized = removeControlCharacters(text)
    .replace(/\b(authorization|api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/giu, '$1=[redacted]')
    .split(/(\s+)/u)
    .map(sanitizeStderrToken)
    .join('')
    .trim();
  const bytes = Buffer.from(sanitized, 'utf8');
  return bytes.subarray(0, MAX_CLI_STDERR_EXCERPT_BYTES).toString('utf8') || undefined;
}

function concatenateChunks(chunks: readonly Uint8Array[]): Uint8Array {
  return Uint8Array.from(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

function isEpipe(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EPIPE');
}

function defaultTreeTerminator(platform: NodeJS.Platform): CliProcessTreeTerminator {
  const terminateUnixGroup = (child: ChildProcess, signal: NodeJS.Signals): void => {
    if (typeof child.pid === 'number') {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        // A child may exit between its close event and termination request.
      }
    }
    child.kill(signal);
  };

  return {
    graceful: (child) => {
      if (platform === 'win32') {
        child.kill('SIGTERM');
        return Promise.resolve();
      }
      terminateUnixGroup(child, 'SIGTERM');
      return Promise.resolve();
    },
    force: async (child) => {
      if (platform !== 'win32') {
        terminateUnixGroup(child, 'SIGKILL');
        return;
      }
      if (typeof child.pid !== 'number') return;
      await new Promise<void>((resolve) => {
        const taskkill = nodeSpawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
          shell: false,
          stdio: 'ignore',
          windowsHide: true,
        });
        taskkill.once('close', () => resolve());
        taskkill.once('error', () => resolve());
      });
    },
  };
}

/** Runs one non-shell CLI operation with an isolated process boundary. */
export class CliProcessRunner {
  private readonly clock: CliProcessClock;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly executableResolver: CliExecutableResolver;
  private readonly fileSystem: CliProcessFileSystem;
  private readonly getTemporaryDirectory: () => string;
  private readonly platform: NodeJS.Platform;
  private readonly spawn: (executable: string, args: string[], options: SpawnOptions) => ChildProcess;
  private readonly treeTerminator: CliProcessTreeTerminator;

  constructor(dependencies: CliProcessRunnerDependencies = {}) {
    this.clock = dependencies.clock ?? systemClock;
    this.environment = dependencies.environment ?? process.env;
    this.fileSystem = dependencies.fileSystem ?? systemFileSystem;
    this.executableResolver = dependencies.executableResolver ?? createDefaultExecutableResolver(this.fileSystem);
    this.getTemporaryDirectory = dependencies.getTemporaryDirectory ?? os.tmpdir;
    this.platform = dependencies.platform ?? process.platform;
    this.spawn = dependencies.spawn ?? ((executable, args, options) => nodeSpawn(executable, args, options));
    this.treeTerminator = dependencies.treeTerminator ?? defaultTreeTerminator(this.platform);
  }

  public async run(input: CliProcessRunInput): Promise<CliProcessResult> {
    validateRunInput(input);
    const startedAt = this.clock.now();
    const environment = createCliProcessEnvironment(this.environment, this.platform);
    let temporaryDirectory: string | null = null;
    let outcome: ExecutionOutcome;

    try {
      temporaryDirectory = await this.fileSystem.mkdtemp(path.join(this.getTemporaryDirectory(), 'gpt-voice-cli-'));
      if (input.signal.aborted) {
        outcome = this.createFailure(input, startedAt, {
          failure: CliProcessFailureCode.Cancelled,
          phase: CliProcessPhase.Preparation,
        });
      } else {
        const resolved = await this.executableResolver({
          configuredExecutablePath: input.configuredExecutablePath,
          environment,
          executableName: input.executableName,
          platform: this.platform,
        });
        if (resolved.status !== 'resolved' || !resolved.executable) {
          outcome = this.createFailure(input, startedAt, {
            failure:
              resolved.status === 'not-found' ? CliProcessFailureCode.NotFound : CliProcessFailureCode.NotExecutable,
            phase: CliProcessPhase.Resolution,
          });
        } else {
          outcome = await this.runChild(input, resolved.executable, environment, temporaryDirectory, startedAt);
        }
      }
    } catch {
      outcome = this.createFailure(input, startedAt, {
        failure: CliProcessFailureCode.SpawnError,
        phase: CliProcessPhase.Preparation,
      });
    }

    let cleanupFailed = outcome.cleanupFailed ?? false;
    if (temporaryDirectory) {
      try {
        await this.fileSystem.removeDirectory(temporaryDirectory);
      } catch {
        cleanupFailed = true;
      }
    }

    const diagnostics: CliProcessDiagnostics = {
      ...outcome.diagnostics,
      cleanup: cleanupFailed ? 'failed' : 'clean',
    };
    if (cleanupFailed && !outcome.failure) {
      return {
        diagnostics: { ...diagnostics, phase: CliProcessPhase.Cleanup },
        failure: CliProcessFailureCode.CleanupFailure,
        success: false,
      };
    }
    if (outcome.failure) {
      return {
        diagnostics,
        failure: outcome.failure,
        ...(outcome.stderrExcerpt ? { stderrExcerpt: outcome.stderrExcerpt } : {}),
        success: false,
      };
    }
    return { diagnostics, stdout: outcome.stdout ?? new Uint8Array(), success: true };
  }

  private createFailure(
    input: CliProcessRunInput,
    startedAt: number,
    { exitCode, failure, phase, signal, stderrBytes = 0, stderrExcerpt, stdoutBytes = 0 }: FailureDetails,
  ): ExecutionOutcome {
    return {
      diagnostics: {
        durationMs: Math.max(0, this.clock.now() - startedAt),
        executable: input.executableName,
        ...(exitCode !== undefined ? { exitCode } : {}),
        operation: input.operationLabel,
        phase,
        ...(signal !== undefined ? { signal } : {}),
        stderrBytes,
        stdoutBytes,
      },
      failure,
      ...(stderrExcerpt ? { stderrExcerpt } : {}),
    };
  }

  /** Runs one spawned child and resolves after its terminal process lifecycle. */
  private runChild(
    input: CliProcessRunInput,
    executable: string,
    environment: NodeJS.ProcessEnv,
    directory: string,
    startedAt: number,
  ): Promise<ExecutionOutcome> {
    return new Promise((resolve) => {
      let child: ChildProcess;
      try {
        child = this.spawn(executable, [...input.args], {
          cwd: directory,
          detached: this.platform !== 'win32',
          env: environment,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch {
        resolve(
          this.createFailure(input, startedAt, {
            failure: CliProcessFailureCode.SpawnError,
            phase: CliProcessPhase.Spawn,
          }),
        );
        return;
      }

      const stdoutChunks: Uint8Array[] = [];
      const stderrExcerptChunks: Uint8Array[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let terminal: ExecutionOutcome | null = null;
      let settled = false;
      let terminationStarted = false;
      let forceTimer: unknown = null;
      let timeoutTimer: unknown = null;
      let terminationCleanupFailed = false;

      const captureStderr = (chunk: Uint8Array): void => {
        if (!input.includeStderrExcerpt) return;
        const retained = stderrExcerptChunks.reduce((total, item) => total + item.byteLength, 0);
        if (retained >= MAX_CLI_STDERR_EXCERPT_BYTES) return;
        stderrExcerptChunks.push(Uint8Array.from(chunk.subarray(0, MAX_CLI_STDERR_EXCERPT_BYTES - retained)));
      };

      const removeListeners = (): void => {
        child.removeListener('close', onClose);
        child.removeListener('error', onProcessError);
        child.stdout?.removeListener('data', onStdoutData);
        child.stdout?.removeListener('error', onOutputError);
        child.stderr?.removeListener('data', onStderrData);
        child.stderr?.removeListener('error', onOutputError);
        child.stdin?.removeListener('error', onStdinError);
        input.signal.removeEventListener('abort', onAbort);
      };

      const settle = (): void => {
        if (settled) return;
        settled = true;
        if (forceTimer !== null) this.clock.clearTimeout(forceTimer);
        if (timeoutTimer !== null) this.clock.clearTimeout(timeoutTimer);
        removeListeners();
        resolve(
          terminal ??
            this.createFailure(input, startedAt, {
              failure: CliProcessFailureCode.ForcedTermination,
              phase: CliProcessPhase.Termination,
            }),
        );
      };

      const requestTermination = (): void => {
        if (terminationStarted || settled) return;
        terminationStarted = true;
        void this.treeTerminator.graceful(child).catch(() => {
          terminationCleanupFailed = true;
        });
        forceTimer = this.clock.setTimeout(() => {
          forceTimer = null;
          void this.treeTerminator
            .force(child)
            .catch(() => {
              terminationCleanupFailed = true;
            })
            .finally(settle);
        }, CLI_PROCESS_GRACE_PERIOD_MS);
      };

      const setFailure = (failure: CliProcessFailureCode, phase: CliProcessPhase): void => {
        if (terminal) return;
        terminal = this.createFailure(input, startedAt, {
          failure,
          phase,
          stderrBytes,
          stderrExcerpt: safeStderrExcerpt(stderrExcerptChunks),
          stdoutBytes,
        });
        requestTermination();
      };

      const onStdoutData = (value: Buffer | Uint8Array | string): void => {
        if (terminal) return;
        const chunk = Uint8Array.from(typeof value === 'string' ? Buffer.from(value) : value);
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > input.stdoutLimitBytes) {
          setFailure(CliProcessFailureCode.StdoutLimit, CliProcessPhase.Running);
          return;
        }
        stdoutChunks.push(chunk);
      };

      const onStderrData = (value: Buffer | Uint8Array | string): void => {
        if (terminal) return;
        const chunk = Uint8Array.from(typeof value === 'string' ? Buffer.from(value) : value);
        stderrBytes += chunk.byteLength;
        captureStderr(chunk);
        if (stderrBytes > input.stderrLimitBytes)
          setFailure(CliProcessFailureCode.StderrLimit, CliProcessPhase.Running);
      };

      const onOutputError = (): void => setFailure(CliProcessFailureCode.SpawnError, CliProcessPhase.Running);
      const onStdinError = (error: unknown): void =>
        setFailure(
          isEpipe(error) ? CliProcessFailureCode.StdinEpipe : CliProcessFailureCode.SpawnError,
          CliProcessPhase.Stdin,
        );
      const onAbort = (): void => setFailure(CliProcessFailureCode.Cancelled, CliProcessPhase.Termination);
      const onProcessError = (): void => {
        if (!terminal) {
          terminal = this.createFailure(input, startedAt, {
            failure: CliProcessFailureCode.SpawnError,
            phase: CliProcessPhase.Spawn,
            stderrBytes,
            stdoutBytes,
          });
        }
        settle();
      };
      const onClose = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
        if (!terminal) {
          if (signal) {
            terminal = this.createFailure(input, startedAt, {
              exitCode,
              failure: CliProcessFailureCode.SignalExit,
              phase: CliProcessPhase.Completion,
              signal,
              stderrBytes,
              stderrExcerpt: safeStderrExcerpt(stderrExcerptChunks),
              stdoutBytes,
            });
          } else if (exitCode !== 0) {
            terminal = this.createFailure(input, startedAt, {
              exitCode,
              failure: CliProcessFailureCode.NonzeroExit,
              phase: CliProcessPhase.Completion,
              signal: null,
              stderrBytes,
              stderrExcerpt: safeStderrExcerpt(stderrExcerptChunks),
              stdoutBytes,
            });
          } else {
            terminal = {
              diagnostics: {
                durationMs: Math.max(0, this.clock.now() - startedAt),
                executable: input.executableName,
                exitCode,
                operation: input.operationLabel,
                phase: CliProcessPhase.Completion,
                signal,
                stderrBytes,
                stdoutBytes,
              },
              stdout: concatenateChunks(stdoutChunks),
            };
          }
        }
        if (terminationCleanupFailed && terminal) {
          terminal.cleanupFailed = true;
          terminal.diagnostics.phase = CliProcessPhase.Termination;
        }
        settle();
      };

      child.once('close', onClose);
      child.once('error', onProcessError);
      child.stdout?.on('data', onStdoutData);
      child.stdout?.once('error', onOutputError);
      child.stderr?.on('data', onStderrData);
      child.stderr?.once('error', onOutputError);
      child.stdin?.once('error', onStdinError);
      input.signal.addEventListener('abort', onAbort, { once: true });
      timeoutTimer = this.clock.setTimeout(
        () => setFailure(CliProcessFailureCode.TimedOut, CliProcessPhase.Termination),
        input.timeoutMs,
      );

      if (input.signal.aborted) {
        onAbort();
        return;
      }
      if (!child.stdin) {
        setFailure(CliProcessFailureCode.SpawnError, CliProcessPhase.Stdin);
        return;
      }
      try {
        child.stdin.end(input.stdin);
      } catch (error) {
        onStdinError(error);
      }
    });
  }
}
