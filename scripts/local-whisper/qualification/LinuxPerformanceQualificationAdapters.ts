import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, type FileHandle } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { withVerifiedRegularFile } from '@scripts/security/verifiedRegularFile';

import { LinuxPerformanceResourceSampler } from './LinuxPerformanceResourceSampler';
import {
  parsePerformanceAttemptArtifactInstallationDiagnostic,
  type PerformanceAttemptArtifactInstallationDiagnostic,
} from './PerformanceAttemptDiagnosticProtocol';
import { qualificationCanonicalJson } from './QualificationContracts';
import {
  PerformanceCollectionError,
  type PerformanceAttemptRequest,
  type PerformanceAttemptProcessInput,
  type PerformanceAttemptProcessPort,
  type PerformanceAttemptProcessSession,
  type PerformanceCachePreparationInput,
  type PerformanceCachePreparationPort,
  type PerformanceCollectionPlatformPort,
  type PerformanceResourcePort,
  type PerformanceResourceProof,
  type PerformanceResourceSession,
  type PreparedPerformanceArtifact,
  type PreparedPerformanceInputs,
} from './PerformanceQualificationCollector';
import { PerformanceQualificationPrivateRoot } from './PerformanceQualificationCommand';
import type { FocusedPerformanceRunPlan } from './FocusedPerformanceQualification';
import type {
  PerformanceBackend,
  PerformancePrivateArtifact,
  PerformanceQualificationRunPlan,
} from './PerformanceQualification';

const execFileAsync = promisify(execFile);
const MAXIMUM_GIT_OUTPUT_BYTES = 64 * 1024;
const MAXIMUM_CACHE_HELPER_OUTPUT_BYTES = 4096;
const MAXIMUM_ATTEMPT_OUTPUT_BYTES = 1024 * 1024;
const MAXIMUM_ATTEMPT_DIAGNOSTIC_BYTES = 4 * 1024;
const CACHE_PREPARATION_TIMEOUT_MILLISECONDS = 60 * 60 * 1000;
const ATTEMPT_ARGUMENT = '--local-whisper-performance-qualification-v3';

function invalidInput(code = 'COLLECTION_INPUT_INVALID'): never {
  throw new PerformanceCollectionError(code);
}

async function digestVerifiedFile(filePath: string, identity: PerformancePrivateArtifact): Promise<void> {
  const invalidArtifact = (): never => invalidInput('ARTIFACT_IDENTITY_INVALID');
  const digest = await withVerifiedRegularFile(
    {
      filePath,
      invalid: invalidArtifact,
      maximumBytes: identity.sizeBytes,
      minimumBytes: identity.sizeBytes,
      unavailable: invalidArtifact,
    },
    async (file: FileHandle, expectedSize: number) => {
      const hash = createHash('sha256');
      let bytesRead = 0;
      try {
        for await (const chunk of file.createReadStream({ autoClose: false })) {
          const bytes = Buffer.from(chunk);
          bytesRead += bytes.byteLength;
          if (bytesRead > expectedSize) invalidArtifact();
          hash.update(bytes);
        }
      } catch (error) {
        if (error instanceof PerformanceCollectionError) throw error;
        invalidArtifact();
      }
      if (bytesRead !== expectedSize) invalidArtifact();
      return hash.digest('hex');
    },
  );
  if (digest !== identity.sha256) invalidArtifact();
}

class LinuxGitWorktreeInspector {
  public async verify(worktree: string, expectedCommit: string): Promise<void> {
    const environment = { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' };
    try {
      const revision = await execFileAsync('/usr/bin/git', ['-C', worktree, 'rev-parse', '--verify', 'HEAD'], {
        encoding: 'utf8',
        env: environment,
        maxBuffer: MAXIMUM_GIT_OUTPUT_BYTES,
        windowsHide: true,
      });
      const status = await execFileAsync(
        '/usr/bin/git',
        ['-C', worktree, 'status', '--porcelain=v1', '--untracked-files=all'],
        {
          encoding: 'utf8',
          env: environment,
          maxBuffer: MAXIMUM_GIT_OUTPUT_BYTES,
          windowsHide: true,
        },
      );
      if (
        revision.stderr !== '' ||
        revision.stdout.trim() !== expectedCommit ||
        status.stderr !== '' ||
        status.stdout !== ''
      ) {
        invalidInput('WORKTREE_IDENTITY_INVALID');
      }
    } catch (error) {
      if (error instanceof PerformanceCollectionError) throw error;
      invalidInput('WORKTREE_IDENTITY_INVALID');
    }
  }
}

/** Authenticates Linux worktrees and every root-contained artifact before and after collection. */
export class LinuxPerformanceCollectionPlatformAdapter implements PerformanceCollectionPlatformPort {
  private readonly git = new LinuxGitWorktreeInspector();

  public constructor(private readonly root: PerformanceQualificationPrivateRoot) {}

  public async prepare(plan: PerformanceQualificationRunPlan): Promise<PreparedPerformanceInputs> {
    if (process.platform !== 'linux' || plan.platform !== 'linux') {
      throw new PerformanceCollectionError('PLATFORM_ADAPTER_MISMATCH');
    }
    const parentWorktrees = Object.freeze({
      before: await this.root.resolveExistingDirectory(plan.worktrees.before.relativePath),
      after: await this.root.resolveExistingDirectory(plan.worktrees.after.relativePath),
    });
    await this.git.verify(parentWorktrees.before, plan.baselineCommit);
    await this.git.verify(parentWorktrees.after, plan.candidateCommit);
    const derivedSources = Object.freeze({
      before: await this.root.resolveExistingDirectory(plan.derivedSources.before.relativePath),
      after: await this.root.resolveExistingDirectory(plan.derivedSources.after.relativePath),
    });
    const prepared = Object.freeze({
      sourceProof: await this.prepareArtifact(plan.sourceProof),
      parentWorktrees,
      derivedSources,
      applications: Object.freeze({
        before: await this.prepareArtifact(plan.applicationArtifacts.before, true),
        after: await this.prepareArtifact(plan.applicationArtifacts.after, true),
      }),
      runtimes: Object.freeze({
        before: await this.prepareArtifact(plan.runtimeArtifacts.before),
        after: await this.prepareArtifact(plan.runtimeArtifacts.after),
      }),
      models: Object.freeze(
        await Promise.all(
          plan.models.map(async ({ family, variant, sha256, artifact }) =>
            Object.freeze({
              identity: Object.freeze({ family, variant, sha256 }),
              artifact: await this.prepareArtifact(artifact),
            }),
          ),
        ),
      ),
      inputFixture: await this.prepareArtifact(plan.inputFixture),
    });
    return prepared;
  }

  public async verifyUnchanged(
    plan: PerformanceQualificationRunPlan,
    inputs: PreparedPerformanceInputs,
  ): Promise<void> {
    await this.git.verify(inputs.parentWorktrees.before, plan.baselineCommit);
    await this.git.verify(inputs.parentWorktrees.after, plan.candidateCommit);
    const artifacts = [
      inputs.sourceProof,
      inputs.applications.before,
      inputs.applications.after,
      inputs.runtimes.before,
      inputs.runtimes.after,
      inputs.inputFixture,
      ...inputs.models.map(({ artifact }) => artifact),
    ];
    for (const artifact of artifacts) await digestVerifiedFile(artifact.absolutePath, artifact.identity);
  }

  /** Authenticates the single candidate graph used by the revision-7 focused collector. */
  public async prepareFocused(plan: FocusedPerformanceRunPlan): Promise<FocusedPreparedPerformanceInputs> {
    if (process.platform !== 'linux' || plan.platform !== 'linux') {
      throw new PerformanceCollectionError('PLATFORM_ADAPTER_MISMATCH');
    }
    // The reviewed derivation intentionally emits an archive tree, not a mutable Git worktree.
    const candidateSource = await this.root.resolveExistingDirectory(plan.candidateSource.relativePath);
    return Object.freeze({
      candidateSource,
      application: await this.prepareArtifact(plan.applicationArtifact, true),
      runtime: await this.prepareArtifact(plan.runtimeArtifact),
      model: await this.prepareArtifact(plan.model.artifact),
      inputFixture: await this.prepareArtifact(plan.inputFixture),
    });
  }

  public async verifyFocused(plan: FocusedPerformanceRunPlan, inputs: FocusedPreparedPerformanceInputs): Promise<void> {
    for (const artifact of [inputs.application, inputs.runtime, inputs.model, inputs.inputFixture]) {
      await digestVerifiedFile(artifact.absolutePath, artifact.identity);
    }
  }

  private async prepareArtifact(
    identity: PerformancePrivateArtifact,
    executable = false,
  ): Promise<PreparedPerformanceArtifact> {
    const absolutePath = await this.root.resolveExistingFile(identity.relativePath);
    await digestVerifiedFile(absolutePath, identity);
    if (executable) {
      const metadata = await lstat(absolutePath).catch(() => invalidInput('APPLICATION_ARTIFACT_INVALID'));
      if ((metadata.mode & 0o111) === 0) invalidInput('APPLICATION_ARTIFACT_INVALID');
    }
    return Object.freeze({ absolutePath, identity });
  }
}

export interface FocusedPreparedPerformanceInputs {
  readonly candidateSource: string;
  readonly application: PreparedPerformanceArtifact;
  readonly runtime: PreparedPerformanceArtifact;
  readonly model: PreparedPerformanceArtifact;
  readonly inputFixture: PreparedPerformanceArtifact;
}

function killOwnedProcessGroup(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

class LinuxPerformanceAttemptProcessSession implements PerformanceAttemptProcessSession {
  public readonly rootPid: number;
  public readonly eventStream: NodeJS.ReadableStream;
  private readonly result: Promise<Buffer>;
  private diagnosticBytes = 0;
  private diagnosticPending = Buffer.alloc(0);
  private diagnosticOutputInvalid = false;
  private latestInstallationDiagnostic: PerformanceAttemptArtifactInstallationDiagnostic | null = null;

  public constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    request: PerformanceAttemptRequest,
    timeoutMilliseconds: number,
    signal?: AbortSignal,
  ) {
    if (!child.pid || child.pid <= 1) {
      killOwnedProcessGroup(child);
      throw new PerformanceCollectionError('ATTEMPT_PROCESS_FAILED');
    }
    const eventStream = child.stdio[3] as NodeJS.ReadableStream | null;
    if (!eventStream) {
      killOwnedProcessGroup(child);
      throw new PerformanceCollectionError('ATTEMPT_EVENT_CHANNEL_UNAVAILABLE');
    }
    const diagnosticStream = (
      child.stdio as readonly (NodeJS.ReadableStream | NodeJS.WritableStream | null)[]
    )[4] as NodeJS.ReadableStream | null;
    if (!diagnosticStream) {
      killOwnedProcessGroup(child);
      throw new PerformanceCollectionError('ATTEMPT_DIAGNOSTIC_CHANNEL_UNAVAILABLE');
    }
    this.rootPid = child.pid;
    this.eventStream = eventStream;
    this.result = new Promise<Buffer>((resolve, reject) => {
      const stdout: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let unexpectedStderr = false;
      let settled = false;
      const finish = (error: PerformanceCollectionError | null, output?: Buffer): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(exitPoll);
        signal?.removeEventListener('abort', abort);
        if (error) {
          killOwnedProcessGroup(child);
          reject(error);
        } else {
          resolve(output ?? Buffer.alloc(0));
        }
      };
      const finishOnExit = (code: number | null, exitSignal: NodeJS.Signals | null): void => {
        if (code === null && exitSignal === null) return;
        if (code !== 0 || exitSignal !== null || unexpectedStderr || !this.finishDiagnostics()) {
          finish(new PerformanceCollectionError('ATTEMPT_PROCESS_FAILED'));
          return;
        }
        // The application emits its bounded response before exiting. Do not wait for `close` or
        // `stdout.end`: a descendant can retain either auxiliary descriptor after the root exits.
        setImmediate(() => finish(null, Buffer.concat(stdout)));
      };
      const abort = (): void => finish(new PerformanceCollectionError('COLLECTION_CANCELLED'));
      const timer = setTimeout(
        () => finish(new PerformanceCollectionError(this.timeoutFailureCode())),
        timeoutMilliseconds,
      );
      timer.unref();
      const exitPoll = setInterval(() => finishOnExit(child.exitCode, child.signalCode), 100);
      exitPoll.unref();
      signal?.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', (chunk: Buffer | string) => {
        const bytes = Buffer.from(chunk);
        stdoutBytes += bytes.byteLength;
        if (stdoutBytes > MAXIMUM_ATTEMPT_OUTPUT_BYTES) {
          finish(new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID'));
          return;
        }
        stdout.push(bytes);
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrBytes += Buffer.byteLength(chunk);
        unexpectedStderr = true;
        if (stderrBytes > MAXIMUM_ATTEMPT_OUTPUT_BYTES) {
          finish(new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID'));
        }
      });
      diagnosticStream.on('data', (chunk: Buffer | string) => {
        if (!this.consumeDiagnostics(Buffer.from(chunk))) {
          finish(new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID'));
        }
      });
      diagnosticStream.once('error', () => finish(new PerformanceCollectionError('ATTEMPT_PROCESS_FAILED')));
      child.stdin.once('error', () => finish(new PerformanceCollectionError('ATTEMPT_PROCESS_FAILED')));
      child.once('error', () => finish(new PerformanceCollectionError('ATTEMPT_PROCESS_FAILED')));
      child.once('exit', finishOnExit);
    });
    if (signal?.aborted) killOwnedProcessGroup(child);
    child.stdin.end(`${qualificationCanonicalJson(request)}\n`);
  }

  public async complete(): Promise<Buffer> {
    return await this.result;
  }

  public async terminate(): Promise<void> {
    killOwnedProcessGroup(this.child);
    if (this.eventStream instanceof Readable) {
      this.eventStream.destroy();
    }
    await this.result.catch(() => undefined);
  }

  private consumeDiagnostics(chunk: Buffer): boolean {
    this.diagnosticBytes += chunk.byteLength;
    if (this.diagnosticBytes > MAXIMUM_ATTEMPT_DIAGNOSTIC_BYTES) return false;
    this.diagnosticPending = Buffer.concat([this.diagnosticPending, chunk]);
    while (true) {
      const newline = this.diagnosticPending.indexOf(0x0a);
      if (newline < 0) break;
      const frame = this.diagnosticPending.subarray(0, newline + 1);
      this.diagnosticPending = this.diagnosticPending.subarray(newline + 1);
      const diagnostic = parsePerformanceAttemptArtifactInstallationDiagnostic(frame);
      if (!diagnostic) {
        this.diagnosticOutputInvalid = true;
        return false;
      }
      this.latestInstallationDiagnostic = diagnostic;
    }
    return this.diagnosticPending.byteLength <= MAXIMUM_ATTEMPT_DIAGNOSTIC_BYTES;
  }

  private finishDiagnostics(): boolean {
    return !this.diagnosticOutputInvalid && this.diagnosticPending.byteLength === 0;
  }

  private timeoutFailureCode(): string {
    const diagnostic = this.latestInstallationDiagnostic;
    if (!diagnostic) return 'ATTEMPT_TIMEOUT';
    return `ATTEMPT_${diagnostic.artifactKind.toUpperCase()}_INSTALL_${diagnostic.stage
      .replace(/([A-Z])/gu, '_$1')
      .toUpperCase()}_TIMEOUT`;
  }
}

/** Launches one fixed-argument qualification executable in a new owned Linux process group. */
export class LinuxPerformanceAttemptProcessAdapter implements PerformanceAttemptProcessPort {
  public start(input: PerformanceAttemptProcessInput): PerformanceAttemptProcessSession {
    const child = spawn(input.executablePath, [ATTEMPT_ARGUMENT], {
      cwd: input.workingDirectory,
      detached: true,
      env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return new LinuxPerformanceAttemptProcessSession(child, input.request, input.timeoutMilliseconds, input.signal);
  }
}

async function runCacheHelper(
  scriptPath: string,
  input: PerformanceCachePreparationInput,
): Promise<Readonly<Record<string, unknown>>> {
  return await new Promise<Readonly<Record<string, unknown>>>((resolve, reject) => {
    const child = spawn('/usr/bin/python3', [scriptPath], {
      cwd: '/',
      env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const finish = (error: Error | null, value?: Readonly<Record<string, unknown>>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', abort);
      if (error) {
        child.kill('SIGKILL');
        reject(error);
      } else {
        resolve(value ?? {});
      }
    };
    const abort = (): void => finish(new PerformanceCollectionError('COLLECTION_CANCELLED'));
    const timer = setTimeout(
      () =>
        finish(
          new PerformanceCollectionError(
            input.cacheState === 'cold' ? 'COLD_CACHE_PROOF_UNAVAILABLE' : 'CACHE_PREPARATION_FAILED',
          ),
        ),
      CACHE_PREPARATION_TIMEOUT_MILLISECONDS,
    );
    timer.unref();
    input.signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.from(chunk);
      stdoutBytes += bytes.byteLength;
      if (stdoutBytes > MAXIMUM_CACHE_HELPER_OUTPUT_BYTES) {
        finish(new PerformanceCollectionError('CACHE_PREPARATION_FAILED'));
        return;
      }
      stdout.push(bytes);
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrBytes += Buffer.byteLength(chunk);
    });
    child.stdin.once('error', () => finish(new PerformanceCollectionError('CACHE_PREPARATION_FAILED')));
    child.once('error', () => finish(new PerformanceCollectionError('CACHE_PREPARATION_FAILED')));
    child.once('close', (code, signal) => {
      if (code !== 0 || signal !== null || stderrBytes !== 0) {
        finish(
          new PerformanceCollectionError(
            input.cacheState === 'cold' ? 'COLD_CACHE_PROOF_UNAVAILABLE' : 'CACHE_PREPARATION_FAILED',
          ),
        );
        return;
      }
      try {
        const bytes = Buffer.concat(stdout);
        if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] !== 0x0a) throw new Error('invalid');
        const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid');
        finish(null, value as Readonly<Record<string, unknown>>);
      } catch {
        finish(new PerformanceCollectionError('CACHE_PREPARATION_FAILED'));
      }
    });
    if (input.signal?.aborted) abort();
    child.stdin.end(
      `${JSON.stringify({
        schemaVersion: 1,
        cacheState: input.cacheState,
        inputSetDigest: input.inputSetDigest,
        files: input.files.map(({ absolutePath, identity }) => ({
          path: absolutePath,
          sizeBytes: identity.sizeBytes,
          sha256: identity.sha256,
        })),
      })}\n`,
    );
  });
}

/** Uses bounded reads or file-scoped POSIX advice; it never drops global caches. */
export class LinuxPerformanceCachePreparationAdapter implements PerformanceCachePreparationPort {
  public constructor(private readonly scriptPath: string) {}

  public async prepare(input: PerformanceCachePreparationInput): Promise<void> {
    const result = await runCacheHelper(this.scriptPath, input);
    if (
      Object.keys(result).sort().join('|') !== 'cacheState|inputSetDigest|schemaVersion|status' ||
      result.schemaVersion !== 1 ||
      result.status !== 'prepared' ||
      result.cacheState !== input.cacheState ||
      result.inputSetDigest !== input.inputSetDigest
    ) {
      throw new PerformanceCollectionError('CACHE_PREPARATION_FAILED');
    }
  }
}

class LinuxPerformanceResourceSession implements PerformanceResourceSession {
  public constructor(private readonly session: ReturnType<LinuxPerformanceResourceSampler['start']>) {}

  public async finish(): Promise<PerformanceResourceProof> {
    await this.session.ready;
    return await this.session.finish();
  }

  public terminate(): void {
    this.session.terminate();
  }
}

export class LinuxPerformanceResourceAdapter implements PerformanceResourcePort {
  public constructor(private readonly sampler: LinuxPerformanceResourceSampler) {}

  public start(input: Parameters<PerformanceResourcePort['start']>[0]): PerformanceResourceSession {
    return new LinuxPerformanceResourceSession(
      this.sampler.start({
        rootPid: input.rootPid,
        backend: input.backend,
        expectedMainExecutableSha256: input.expectedExecutableSha256,
        eventStream: input.eventStream,
        completionTimeoutMilliseconds: input.completionTimeoutMilliseconds,
      }),
    );
  }
}

/** Deterministic cache fixture that is valid only for a contract-only run plan. */
export class ContractOnlyPerformanceCacheAdapter implements PerformanceCachePreparationPort {
  public async prepare(input: PerformanceCachePreparationInput): Promise<void> {
    if (input.signal?.aborted) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
  }
}

class ContractOnlyPerformanceResourceSession implements PerformanceResourceSession {
  public constructor(
    private readonly input: Readonly<{
      readonly rootPid: number;
      readonly backend: PerformanceBackend;
      readonly expectedExecutableSha256: string;
      readonly requiredResourceIds: readonly PerformanceResourceProof['resources'][number]['id'][];
    }>,
  ) {}

  public async finish(): Promise<PerformanceResourceProof> {
    return Object.freeze({
      resources: Object.freeze(this.input.requiredResourceIds.map((id) => Object.freeze({ id, peakBytes: 1024 }))),
      roleRegistrations: Object.freeze(
        (['main', 'guard', 'worker'] as const).map((role, index) =>
          Object.freeze({
            role,
            pid: this.input.rootPid + index,
            processStartIdentity: `fixture-${String(this.input.rootPid)}-${role}`,
            executableSha256: this.input.expectedExecutableSha256,
          }),
        ),
      ),
      processSettlementProof: 'ownedProcessTreeSettled',
      unownedProcessAttribution: 0,
      unownedGpuAttribution: this.input.backend === 'cpu' ? 'notApplicable' : 0,
      identityChanges: 0,
      lateRoleRegistrations: 0,
      liveOwnedProcessesAfterSettlement: 0,
    });
  }

  public terminate(): void {}
}

/** Deterministic resource fixture that cannot be composed for representative evidence. */
export class ContractOnlyPerformanceResourceAdapter implements PerformanceResourcePort {
  public start(input: Parameters<PerformanceResourcePort['start']>[0]): PerformanceResourceSession {
    return new ContractOnlyPerformanceResourceSession(input);
  }
}
