import { createHash, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, readlink, realpath } from 'node:fs/promises';
import { userInfo } from 'node:os';
import path from 'node:path';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';
import { LinuxAlphaSmokeProcessJournal } from './LinuxAlphaSmokeProcessJournal';
import { LinuxOfflineArtifactInventory } from './LinuxOfflineArtifactInventory';
import { isRecord } from '../packaging/contracts';

import {
  LINUX_GPT_VOICE_PACKAGE,
  LinuxAlphaPackageVerifier,
  normalizeLinuxPackageSnapshot,
  type LinuxAlphaPackagePort,
  type LinuxPackageFileIdentity,
  type LinuxPackageSnapshot,
} from './LinuxAlphaPackageVerifier';
import {
  LINUX_ALPHA_SMOKE_EXECUTABLES,
  LINUX_ALPHA_SMOKE_MANUAL_INSTALL_EXECUTABLE,
  LinuxAlphaSmokeCommandRunner,
  type LinuxAlphaSmokeCommandPort,
} from './LinuxAlphaSmokeCommandRunner';
import { LinuxApplicationProcessVerifier } from './LinuxApplicationProcessVerifier';
import { LinuxAlphaSmokeCommandExitError } from './LinuxAlphaSmokeCommandExitError';
import { LinuxIsolatedApplicationSession } from './LinuxIsolatedApplicationSession';
import { LinuxSettingsBackup } from './LinuxSettingsBackup';
import {
  ALPHA_SMOKE_FIXTURE,
  ALPHA_SMOKE_MODEL_SELECTION,
  type AlphaSmokeAttempt,
  type AlphaSmokeCompletionEvidence,
} from './AlphaSmokeProtocol';
import type {
  AlphaSmokeExerciseEvidence,
  AlphaSmokePreparationEvidence,
  PlatformAlphaSmokeAdapter,
} from './PlatformAlphaSmokeAdapter';
import { conffilesFromDebianControlTar, DebianDataTarInventoryCollector } from './SafeDebianTarArchive';

const DEBIAN_ROOT_DIRECTORY_ENTRY = '/.';
const FIXTURE_PATH = path.resolve('tests/fixtures/local-whisper/alpha-smoke/smoke.wav');
const PACKAGE_QUERY_FORMAT = '${Package}\t${Version}\t${Architecture}\t${db:Status-Status}';
const ARCHIVE_QUERY_FORMAT = '${Package}\t${Version}\t${Architecture}';
const CONFFILES_QUERY_FORMAT = '${Conffiles}';
const ONLINE_APP_LAUNCH_INSTRUCTION =
  'Wait until the alpha application window is visible with its isolated profile. Do not use DevTools or a test-only mode.';
const CPU_UI_INSTRUCTION =
  'In the visible app, select Local Whisper, install the CPU runtime and base/full model, select CPU, pass the compatibility check, load it, record and stop the supplied non-private audio once, verify a non-empty result. Keep the model loaded for the runner observation.';
const CUDA_UI_INSTRUCTION =
  'In the visible app, install and select the RTX 50 CUDA runtime, pass the compatibility check, load it on the eligible CUDA device, record and stop the supplied non-private audio once, verify a non-empty result. Keep the model loaded for the runner observation.';
const OFFLINE_CUDA_UI_INSTRUCTION =
  'In the isolated-network app, repeat the visible CUDA load, recording and non-empty result without downloading any artifact. Keep the model loaded for the runner observation.';

export interface LinuxAlphaSmokeCheckpointPort {
  confirm(checkpoint: string, instruction?: string, deadlineEpochMilliseconds?: number): Promise<void>;
}

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_LINUX_${code}`);
}

function quotePosixShellArgument(value: string): string {
  return `'${value.replace(/'/gu, "'\\''")}'`;
}

/** Implements the native Linux boundary without package removal, downgrade, or settings restoration. */
export class LinuxAlphaSmokeAdapter implements PlatformAlphaSmokeAdapter, LinuxAlphaPackagePort {
  public readonly platform = 'linux' as const;
  private applicationSession: LinuxIsolatedApplicationSession | null = null;
  private processVerifier: LinuxApplicationProcessVerifier | null = null;
  private settingsBackup: LinuxSettingsBackup | null = null;
  private offlineLaunch: Readonly<{ processId: number; startTime: string }> | null = null;
  private onlineArtifactDigest: string | null = null;

  public constructor(
    private readonly dependencies: Readonly<{
      checkpoints: LinuxAlphaSmokeCheckpointPort;
      commands?: LinuxAlphaSmokeCommandPort;
      debPath: string;
      evidenceRoot: string;
      fixturePath?: string;
      settingsBackupRoot: string;
      settingsSourceRoot: string;
      workRoot: string;
      beginCleanup?: () => void;
      remainingMilliseconds?: () => number;
    }>,
  ) {}

  /** Proves the three operator-provided roots are empty and safe before public network access. */
  public async assertInitialRoots(): Promise<void> {
    this.assertSupportedHost();
    await Promise.all([
      this.assertOwnedRoot(this.dependencies.workRoot, true),
      this.assertOwnedRoot(this.dependencies.evidenceRoot, true),
      this.assertOwnedRoot(this.dependencies.settingsBackupRoot, true),
    ]);
    await this.assertDistinctRoots();
  }

  public async preflight(input: AlphaSmokeAttempt): Promise<AlphaSmokePreparationEvidence> {
    this.assertSupportedHost();
    await this.assertOwnedRoot(this.dependencies.workRoot, false);
    await this.assertOwnedRoot(this.dependencies.evidenceRoot, true);
    await this.assertOwnedRoot(this.dependencies.settingsBackupRoot, true);
    await this.assertDistinctRoots();
    await this.assertReleaseDirectory();
    await this.assertFixture();

    await this.assertNoActivePackageProcess();
    const settingsBackupStatus = await this.backup().create(input.attemptId);
    const packageDisposition = await this.packageVerifier(input).prepare();
    await this.confirm(
      input,
      'review-preflight',
      `Review the verified public alpha package proof and the normalized ${settingsBackupStatus} settings backup status. Confirm no GPT-Voice process is active.`,
    );
    return Object.freeze({ packageDisposition, settingsBackupStatus });
  }

  public async revalidateBeforeAttempt(input: AlphaSmokeAttempt): Promise<void> {
    if (input.packageDisposition === null) fail('PACKAGE_DISPOSITION_MISSING');
    await this.assertResumeRoots();
    await this.backup().verifyRetained(input.attemptId);
    await this.packageVerifier(input).revalidateBeforeAttempt(input.packageDisposition);
  }

  public async ensurePackageReady(input: AlphaSmokeAttempt): Promise<void> {
    if (input.packageDisposition === null) fail('PACKAGE_DISPOSITION_MISSING');
    await this.assertResumeRoots();
    await this.backup().verifyRetained(input.attemptId);
    await this.packageVerifier(input).ensureReady(input.packageDisposition);
    if (input.packageDisposition === 'exact-alpha') {
      await this.confirm(
        input,
        'reuse-exact-alpha',
        'Confirm the exact installed v2.4.0-alpha.1 package is being reused without a package command.',
      );
    }
  }

  public async exerciseCpu(input: AlphaSmokeAttempt): Promise<AlphaSmokeExerciseEvidence> {
    await this.backup().verifyRetained(input.attemptId);
    await this.packageVerifier(input).assertRetained();
    await this.applicationProcesses().registerApplication(await this.isolatedApplication().launchOnline());
    await this.persistOwnedProcesses(input);
    await this.confirm(input, 'launch-isolated-app', ONLINE_APP_LAUNCH_INSTRUCTION);
    await this.confirmCpuObservation(input);
    await this.assertRuntime(input, 'cpu');
    await this.applicationProcesses().assertNoOwnedGpuAllocation();
    await this.confirm(input, 'cpu-unloaded', 'Unload the CPU model after the runner observation.');
    await this.applicationProcesses().assertNoOwnedGpuAllocation();
    return Object.freeze({ backend: 'cpu', outcome: 'verified' });
  }

  public async exerciseCuda(input: AlphaSmokeAttempt): Promise<AlphaSmokeExerciseEvidence> {
    await this.confirm(input, 'cuda-ui-complete', CUDA_UI_INSTRUCTION);
    await this.assertRuntime(input, 'cuda');
    await this.confirm(input, 'cuda-unloaded', 'Unload the CUDA model after the runner observation.');
    await this.applicationProcesses().assertNoOwnedGpuAllocation();
    await this.backup().verifyRetained(input.attemptId);
    await this.packageVerifier(input).assertInstalledEquivalent();
    this.onlineArtifactDigest = await this.artifactInventory().capture();
    return Object.freeze({ backend: 'cuda', outcome: 'verified' });
  }

  public async exerciseOfflineCuda(input: AlphaSmokeAttempt): Promise<AlphaSmokeExerciseEvidence> {
    if (this.onlineArtifactDigest === null) fail('OFFLINE_BASELINE_MISSING');
    if ((await this.artifactInventory().capture()) !== this.onlineArtifactDigest) fail('OFFLINE_ARTIFACTS_CHANGED');
    await this.confirm(
      input,
      'close-online-app',
      'Close the online alpha application window before continuing with the isolated-network restart.',
    );
    await this.assertNoActivePackageProcess();
    await this.applicationProcesses().assertOwnedProcessesExited();
    await this.backup().verifyRetained(input.attemptId);
    await this.packageVerifier(input).assertRetained();
    this.offlineLaunch = await this.isolatedApplication().launchOffline();
    await this.applicationProcesses().registerApplication(this.offlineLaunch);
    await this.persistOwnedProcesses(input);
    await this.confirm(input, 'offline-cuda-ui-complete', OFFLINE_CUDA_UI_INSTRUCTION);
    await this.applicationProcesses().assertOfflineNamespace(this.offlineLaunch);
    await this.assertRuntime(input, 'cuda');
    await this.confirm(input, 'offline-cuda-unloaded', 'Unload the CUDA model after the offline runner observation.');
    await this.applicationProcesses().assertNoOwnedGpuAllocation();
    if ((await this.artifactInventory().capture()) !== this.onlineArtifactDigest) fail('OFFLINE_ARTIFACTS_CHANGED');
    await this.packageVerifier(input).assertInstalledEquivalent();
    await this.backup().verifyRetained(input.attemptId);
    return Object.freeze({ backend: 'offline-cuda', outcome: 'verified' });
  }

  public async finalize(input: AlphaSmokeAttempt): Promise<AlphaSmokeCompletionEvidence> {
    this.dependencies.beginCleanup?.();
    await this.assertResumeRoots();
    if (this.applicationSession === null) {
      const groups = await new LinuxAlphaSmokeProcessJournal(this.dependencies.evidenceRoot).read(input);
      if (groups.length > 0) {
        await this.isolatedApplication().restoreOwnedGroups(groups);
        await this.applicationProcesses().restoreOwnedGroups(groups);
      }
    }
    await this.applicationSession?.shutdown(this.cleanupRemaining());
    await this.applicationProcesses().assertOwnedProcessesExited();
    await this.assertNoActivePackageProcess();
    await this.packageVerifier(input).assertRetained();
    await this.backup().verifyRetained(input.attemptId);
    const marker = await this.readPrivateDocument(this.dependencies.evidenceRoot, 'control/work-root-identity.json');
    if (
      marker.attemptId !== input.attemptId ||
      !Number.isSafeInteger(marker.device) ||
      !Number.isSafeInteger(marker.inode)
    )
      fail('WORK_ROOT_IDENTITY_INVALID');
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.dependencies.workRoot);
    try {
      await filesystem.clearDisposableRoot({ device: Number(marker.device), inode: Number(marker.inode) }, () =>
        this.cleanupRemaining(),
      );
    } finally {
      await filesystem.dispose();
    }
    return Object.freeze({ packageStatus: 'retained-alpha', settingsBackupStatus: 'retained-private' });
  }

  public async observeCompletion(input: AlphaSmokeAttempt): Promise<AlphaSmokeCompletionEvidence> {
    const packageStatus = await this.packageVerifier(input).observeStatus();
    let settingsBackupStatus: AlphaSmokeCompletionEvidence['settingsBackupStatus'] = 'retained-private';
    try {
      await this.backup().verifyRetained(input.attemptId);
    } catch {
      settingsBackupStatus = 'integrity-failed';
    }
    return Object.freeze({ packageStatus, settingsBackupStatus });
  }

  public async assertNoActivePackageProcess(): Promise<void> {
    await this.applicationProcesses().assertNoActiveApplicationProcess();
  }

  public async captureInstalledPackage(expectedArchive: LinuxPackageSnapshot): Promise<LinuxPackageSnapshot | null> {
    let metadata: readonly string[];
    try {
      metadata = (
        await this.command().run(LINUX_ALPHA_SMOKE_EXECUTABLES.dpkgQuery, [
          '--show',
          `--showformat=${PACKAGE_QUERY_FORMAT}`,
          LINUX_GPT_VOICE_PACKAGE.name,
        ])
      ).split('\t');
    } catch (error) {
      if (error instanceof LinuxAlphaSmokeCommandExitError && error.exitCode === 1 && error.signal === null) {
        return null;
      }
      throw error;
    }
    if (metadata.length !== 4 || metadata.some((value) => value.length === 0)) fail('PACKAGE_QUERY_INVALID');
    const listedFiles = (
      await this.command().run(LINUX_ALPHA_SMOKE_EXECUTABLES.dpkgQuery, ['-L', LINUX_GPT_VOICE_PACKAGE.name])
    )
      .split('\n')
      .filter((value) => value.length > 0 && value !== DEBIAN_ROOT_DIRECTORY_ENTRY);
    const expectedFiles = new Map(expectedArchive.files.map((file) => [file.path, file] as const));
    const files = await Promise.all(
      listedFiles.map(
        async (filePath) => await this.captureInstalledFile(filePath, expectedFiles.get(filePath) ?? null),
      ),
    );
    const conffiles = (
      await this.command().run(LINUX_ALPHA_SMOKE_EXECUTABLES.dpkgQuery, [
        '--show',
        `--showformat=${CONFFILES_QUERY_FORMAT}`,
        LINUX_GPT_VOICE_PACKAGE.name,
      ])
    )
      .split('\n')
      .map((line) => line.trim().split(/\s+/u)[0] ?? '')
      .filter((value) => value.length > 0)
      .sort((left, right) => left.localeCompare(right, 'en'));
    return normalizeLinuxPackageSnapshot({
      architecture: metadata[2],
      conffiles,
      files: files.filter((file): file is NonNullable<typeof file> => file !== null),
      name: metadata[0],
      status: metadata[3],
      version: metadata[1],
    });
  }

  public async inspectPackageArchive(packagePath: string): Promise<LinuxPackageSnapshot> {
    const metadata = (
      await this.command().run(LINUX_ALPHA_SMOKE_EXECUTABLES.dpkgDeb, [
        `--showformat=${ARCHIVE_QUERY_FORMAT}`,
        '--show',
        packagePath,
      ])
    ).split('\t');
    if (metadata.length !== 3 || metadata.some((value) => value.length === 0)) {
      fail('PACKAGE_ARCHIVE_METADATA_INVALID');
    }
    const dataTar = new DebianDataTarInventoryCollector();
    await this.command().runStreaming(LINUX_ALPHA_SMOKE_EXECUTABLES.dpkgDeb, ['--fsys-tarfile', packagePath], (chunk) =>
      dataTar.write(chunk),
    );
    const controlTar = await this.command().runBytes(LINUX_ALPHA_SMOKE_EXECUTABLES.dpkgDeb, [
      '--ctrl-tarfile',
      packagePath,
    ]);
    return normalizeLinuxPackageSnapshot({
      architecture: metadata[2],
      conffiles: conffilesFromDebianControlTar(controlTar),
      files: dataTar.finish(),
      name: metadata[0],
      status: 'installed',
      version: metadata[1],
    });
  }

  public async requestAlphaInstallation(packagePath: string, deadlineEpochMilliseconds: number): Promise<void> {
    if (packagePath !== this.dependencies.debPath) fail('PACKAGE_INSTALL_PATH_INVALID');
    await this.dependencies.checkpoints.confirm(
      'install-alpha-deb',
      `Run this exact command in another terminal, then return here:\n${LINUX_ALPHA_SMOKE_MANUAL_INSTALL_EXECUTABLE} --install -- ${quotePosixShellArgument(packagePath)}`,
      deadlineEpochMilliseconds,
    );
  }

  private packageVerifier(input: AlphaSmokeAttempt): LinuxAlphaPackageVerifier {
    return new LinuxAlphaPackageVerifier({
      debPath: this.dependencies.debPath,
      deadlineEpochMilliseconds: input.deadlineEpochMilliseconds,
      expectedDeb: input.input.packageAsset,
      port: this,
    });
  }

  private async confirm(input: AlphaSmokeAttempt, checkpoint: string, instruction: string): Promise<void> {
    await this.dependencies.checkpoints.confirm(checkpoint, instruction, input.deadlineEpochMilliseconds);
  }

  private async readPrivateDocument(root: string, relative: string): Promise<Record<string, unknown>> {
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(root);
    try {
      const handle = await filesystem.openRegularFile(relative, 64 * 1024);
      try {
        const value: unknown = JSON.parse(await handle.readFile('utf8'));
        await filesystem.revalidate();
        if (!isRecord(value)) fail('PRIVATE_DOCUMENT_INVALID');
        return value;
      } finally {
        await handle.close();
      }
    } finally {
      await filesystem.dispose();
    }
  }

  private async assertRuntime(input: AlphaSmokeAttempt, backend: 'cpu' | 'cuda'): Promise<void> {
    const bindings = await this.readPrivateDocument(this.dependencies.evidenceRoot, 'control/runtime-bindings.json');
    const target = backend === 'cpu' ? 'cpu' : 'sm_120a-real';
    if (bindings.inputDigest !== input.input.platformSmokeInputDigest || !isRecord(bindings.runtimes))
      fail('RUNTIME_BINDINGS_INVALID');
    const expected = bindings.runtimes[`linux:${target}`];
    if (
      !isRecord(expected) ||
      typeof expected.workerSha256 !== 'string' ||
      !/^[a-f\d]{64}$/u.test(expected.workerSha256) ||
      typeof expected.runtimeBuildDigest !== 'string' ||
      !/^[a-f\d]{64}$/u.test(expected.runtimeBuildDigest) ||
      typeof expected.runtimeIdentityKey !== 'string'
    )
      fail('RUNTIME_BINDINGS_INVALID');
    const profile = 'profile/config/GPT-Voice/local-whisper';
    const ownership = await this.readPrivateDocument(
      this.dependencies.workRoot,
      `${profile}/worker-session-ownership.json`,
    );
    if (
      !Number.isSafeInteger(ownership.pid) ||
      Number(ownership.pid) <= 0 ||
      typeof ownership.processStartIdentity !== 'string' ||
      typeof ownership.runtimeBuildDigest !== 'string' ||
      typeof ownership.runtimeIdentityKey !== 'string'
    )
      fail('WORKER_RUNTIME_INVALID');
    const worker = await this.applicationProcesses().assertWorkerRuntime(
      {
        pid: Number(ownership.pid),
        processStartIdentity: ownership.processStartIdentity,
        runtimeBuildDigest: ownership.runtimeBuildDigest,
        runtimeIdentityKey: ownership.runtimeIdentityKey,
      },
      {
        workerSha256: expected.workerSha256,
        runtimeBuildDigest: expected.runtimeBuildDigest,
        runtimeIdentityKey: expected.runtimeIdentityKey,
      },
    );
    const settings = await this.readPrivateDocument(this.dependencies.workRoot, `${profile}/settings.json`);
    if (
      !isRecord(settings.settings) ||
      !isRecord(settings.settings.execution) ||
      settings.settings.execution.backend !== backend
    )
      fail('SELECTED_BACKEND_INVALID');
    if (
      !isRecord(settings.settings.model) ||
      settings.settings.model.family !== ALPHA_SMOKE_MODEL_SELECTION.family ||
      settings.settings.model.variant !== ALPHA_SMOKE_MODEL_SELECTION.variant
    )
      fail('SELECTED_MODEL_INVALID');
    if (backend === 'cuda') {
      if (typeof settings.settings.execution.deviceId !== 'string') fail('SELECTED_DEVICE_INVALID');
      const identity = await this.readPrivateDocument(this.dependencies.workRoot, `${profile}/device-identity.json`);
      const uuid = await this.applicationProcesses().selectedGpuUuid(settings.settings.execution.deviceId, identity);
      await this.applicationProcesses().assertSelectedGpuAllocation(uuid, worker);
    }
    await this.persistOwnedProcesses(input);
  }

  private async persistOwnedProcesses(input: AlphaSmokeAttempt): Promise<void> {
    const groups = await this.isolatedApplication().snapshotOwnedGroups();
    await new LinuxAlphaSmokeProcessJournal(this.dependencies.evidenceRoot).write(input, groups);
  }

  private async confirmCpuObservation(input: AlphaSmokeAttempt): Promise<void> {
    let pending = true;
    let failure: unknown = null;
    const observation = (async () => {
      while (pending) {
        try {
          await this.applicationProcesses().assertNoOwnedGpuAllocation();
        } catch (error) {
          failure = error;
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    })();
    try {
      await this.confirm(input, 'cpu-ui-complete', CPU_UI_INSTRUCTION);
    } finally {
      pending = false;
      await observation;
    }
    if (failure !== null)
      throw failure instanceof Error ? failure : new Error('ALPHA_SMOKE_LINUX_CPU_OBSERVATION_FAILED');
  }

  private backup(): LinuxSettingsBackup {
    this.settingsBackup ??= new LinuxSettingsBackup({
      backupRoot: this.dependencies.settingsBackupRoot,
      sourceRoot: this.dependencies.settingsSourceRoot,
    });
    return this.settingsBackup;
  }

  private artifactInventory(): LinuxOfflineArtifactInventory {
    return new LinuxOfflineArtifactInventory(this.dependencies.workRoot, () => {
      if (this.dependencies.remainingMilliseconds && this.dependencies.remainingMilliseconds() <= 0)
        fail('DEADLINE_EXHAUSTED');
    });
  }

  private cleanupRemaining(): number {
    const remaining = this.dependencies.remainingMilliseconds?.() ?? 60_000;
    if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('ALPHA_SMOKE_CLEANUP_DEADLINE_EXHAUSTED');
    return Math.min(60_000, remaining);
  }

  private applicationProcesses(): LinuxApplicationProcessVerifier {
    this.processVerifier ??= new LinuxApplicationProcessVerifier({ commands: this.command() });
    return this.processVerifier;
  }

  private isolatedApplication(): LinuxIsolatedApplicationSession {
    this.applicationSession ??= new LinuxIsolatedApplicationSession({ workRoot: this.dependencies.workRoot });
    return this.applicationSession;
  }

  private command(): LinuxAlphaSmokeCommandPort {
    return this.dependencies.commands ?? new LinuxAlphaSmokeCommandRunner();
  }

  private assertSupportedHost(): void {
    if (process.platform !== 'linux' || process.arch !== 'x64') fail('HOST_UNSUPPORTED');
  }

  private async assertFixture(): Promise<void> {
    const fixture = this.dependencies.fixturePath ?? FIXTURE_PATH;
    const handle = await open(fixture, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch(() => {
      throw new Error('ALPHA_SMOKE_FIXTURE_UNAVAILABLE');
    });
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size !== ALPHA_SMOKE_FIXTURE.length) {
        throw new Error('ALPHA_SMOKE_FIXTURE_UNAVAILABLE');
      }
      const bytes = await handle.readFile();
      const openedAfter = await handle.stat();
      const linkedAfter = await lstat(fixture);
      const hash = createHash('sha256').update(bytes).digest();
      const expected = Buffer.from(ALPHA_SMOKE_FIXTURE.sha256, 'hex');
      if (
        !linkedAfter.isFile() ||
        before.dev !== linkedAfter.dev ||
        before.ino !== linkedAfter.ino ||
        before.size !== linkedAfter.size ||
        before.mtimeMs !== linkedAfter.mtimeMs ||
        before.ctimeMs !== linkedAfter.ctimeMs ||
        before.size !== openedAfter.size ||
        before.mtimeMs !== openedAfter.mtimeMs ||
        before.ctimeMs !== openedAfter.ctimeMs ||
        bytes.length !== ALPHA_SMOKE_FIXTURE.length ||
        hash.length !== expected.length ||
        !timingSafeEqual(hash, expected)
      ) {
        throw new Error('ALPHA_SMOKE_FIXTURE_INVALID');
      }
    } finally {
      await handle.close();
    }
  }

  private async assertResumeRoots(): Promise<void> {
    await Promise.all([
      this.assertOwnedRoot(this.dependencies.workRoot, false),
      this.assertOwnedRoot(this.dependencies.evidenceRoot, false),
      this.assertOwnedRoot(this.dependencies.settingsBackupRoot, false),
    ]);
    const entries = await readdir(this.dependencies.evidenceRoot, { withFileTypes: true });
    if (
      entries.some(
        (entry) =>
          !['control', 'platform-smoke-result.json', 'evidence-index.json'].includes(entry.name) ||
          (entry.name === 'control' ? !entry.isDirectory() : !entry.isFile()),
      )
    )
      fail('ROOT_INVALID');
    const evidence = await LinuxAlphaSmokeFilesystem.openRoot(this.dependencies.evidenceRoot);
    try {
      if (entries.some((entry) => entry.name === 'control')) await evidence.openChildDirectory('control');
    } finally {
      await evidence.dispose();
    }
    await this.assertDistinctRoots();
  }

  private async assertDistinctRoots(): Promise<void> {
    const roots = [this.dependencies.workRoot, this.dependencies.evidenceRoot, this.dependencies.settingsBackupRoot];
    const canonicalRoots = await Promise.all(
      roots.map(async (root) => {
        const canonical = await realpath(root);
        if (canonical !== path.resolve(root)) fail('ROOT_ALIAS_INVALID');
        return canonical;
      }),
    );
    for (const [index, root] of canonicalRoots.entries()) {
      for (const candidate of canonicalRoots.slice(index + 1)) {
        const relative = path.relative(root, candidate);
        const inverse = path.relative(candidate, root);
        if (
          relative === '' ||
          (!relative.startsWith('..') && !path.isAbsolute(relative)) ||
          (!inverse.startsWith('..') && !path.isAbsolute(inverse))
        ) {
          fail('ROOTS_OVERLAP');
        }
      }
    }
  }

  private async assertOwnedRoot(root: string, expectEmpty: boolean): Promise<void> {
    const metadata = await lstat(root).catch(() => null);
    const identity = userInfo();
    if (
      identity.uid === 0 ||
      !metadata ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.uid !== identity.uid ||
      (metadata.mode & 0o777) !== 0o700 ||
      root === path.parse(root).root ||
      (expectEmpty && (await readdir(root)).length !== 0)
    ) {
      fail('ROOT_INVALID');
    }
  }

  private async assertReleaseDirectory(): Promise<void> {
    const entries = await readdir(this.dependencies.workRoot);
    if (entries.length !== 1 || entries[0] !== 'release') fail('WORK_ROOT_INVALID');
    const releaseRoot = path.join(this.dependencies.workRoot, 'release');
    const metadata = await lstat(releaseRoot).catch(() => null);
    const identity = userInfo();
    if (
      !metadata ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.uid !== identity.uid ||
      (metadata.mode & 0o777) !== 0o700
    ) {
      fail('WORK_ROOT_INVALID');
    }
  }

  private async captureInstalledFile(
    filePath: string,
    expected: LinuxPackageFileIdentity | null,
  ): Promise<LinuxPackageSnapshot['files'][number] | null> {
    if (!path.isAbsolute(filePath) || filePath.includes('\0') || path.resolve(filePath) !== filePath) {
      fail('PACKAGE_FILE_PATH_INVALID');
    }
    if (expected?.kind === 'file') {
      const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const metadata = await handle.stat();
        if (!metadata.isFile()) fail('PACKAGE_FILE_TYPE_INVALID');
        const hash = createHash('sha256');
        for await (const chunk of handle.createReadStream({ autoClose: false })) {
          if (!Buffer.isBuffer(chunk)) fail('PACKAGE_FILE_IDENTITY_CHANGED');
          hash.update(chunk);
        }
        const openedAfter = await handle.stat();
        const linkedAfter = await lstat(filePath);
        if (
          !linkedAfter.isFile() ||
          openedAfter.size !== metadata.size ||
          openedAfter.mtimeMs !== metadata.mtimeMs ||
          openedAfter.ctimeMs !== metadata.ctimeMs ||
          linkedAfter.dev !== metadata.dev ||
          linkedAfter.ino !== metadata.ino ||
          linkedAfter.size !== metadata.size ||
          linkedAfter.mtimeMs !== metadata.mtimeMs ||
          linkedAfter.ctimeMs !== metadata.ctimeMs ||
          linkedAfter.mode !== metadata.mode
        ) {
          fail('PACKAGE_FILE_IDENTITY_CHANGED');
        }
        return Object.freeze({
          kind: 'file' as const,
          mode: metadata.mode & 0o7777,
          path: filePath,
          value: hash.digest('hex'),
        });
      } finally {
        await handle.close();
      }
    }
    const metadata = await lstat(filePath).catch(() => null);
    if (!metadata) fail('PACKAGE_FILE_MISSING');
    if (metadata.isDirectory()) {
      if (expected !== null) fail('PACKAGE_FILE_TYPE_INVALID');
      return null;
    }
    if (expected === null) fail('PACKAGE_INVENTORY_UNEXPECTED_FILE');
    if (metadata.isSymbolicLink() && expected.kind === 'symlink') {
      const target = await readlink(filePath);
      if (target.length === 0 || target.includes('\0')) fail('PACKAGE_FILE_LINK_INVALID');
      const linkedAfter = await lstat(filePath);
      if (
        !linkedAfter.isSymbolicLink() ||
        linkedAfter.dev !== metadata.dev ||
        linkedAfter.ino !== metadata.ino ||
        linkedAfter.mtimeMs !== metadata.mtimeMs ||
        linkedAfter.ctimeMs !== metadata.ctimeMs
      ) {
        fail('PACKAGE_FILE_IDENTITY_CHANGED');
      }
      return Object.freeze({ kind: 'symlink' as const, mode: metadata.mode & 0o7777, path: filePath, value: target });
    }
    fail('PACKAGE_FILE_TYPE_INVALID');
  }
}
