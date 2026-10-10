import { spawn, type ChildProcess } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT } from '@main/localWhisper/development/LocalWhisperDevelopmentActivation';

import { EphemeralQualificationTlsIdentityFactory } from '../qualification/EphemeralQualificationTlsIdentity';
import { QualificationHttpsArtifactServer } from '../qualification/QualificationHttpsArtifactServer';
import { QualificationCommandRunner } from '../qualification/QualificationCommandRunner';
import { isSemanticVersion } from '../../semantic-version.mjs';
import { DevelopmentActivationDescriptorProducer } from './DevelopmentActivationDescriptorProducer';
import { DevelopmentResourceStager } from './DevelopmentResourceStager';
import {
  DEVELOPMENT_RUNTIME_ATTESTATION_FILE_NAME,
  DevelopmentRuntimeAttestationStore,
} from './DevelopmentRuntimeAttestationStore';
import {
  DevelopmentRuntimeInputLoader,
  resolveDevelopmentRuntimePlatform,
  type DevelopmentRuntimePlatformSelector,
} from './DevelopmentRuntimeInputs';

const APPLICATION_STATE_DIRECTORY_NAME = 'application-state';
const APPLICATION_CONFIGURATION_DIRECTORY_NAME = 'configuration';
const ELECTRON_USER_DATA_DIRECTORY_NAME = 'electron-user-data';
const DEVELOPMENT_ACTIVATION_FILE_PREFIX = 'development-activation-';

interface DevelopmentArtifactServer {
  readonly start: () => Promise<{ readonly origin: string }>;
  readonly stop: () => Promise<void>;
}

interface DevelopmentServerObject {
  readonly route: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface DevelopmentSessionDependencies {
  readonly descriptors: Pick<DevelopmentActivationDescriptorProducer, 'produce'>;
  readonly attestations: Pick<DevelopmentRuntimeAttestationStore, 'load'>;
  readonly resources: Pick<DevelopmentResourceStager, 'stage'>;
  readonly runtimes: Pick<DevelopmentRuntimeInputLoader, 'load'>;
  readonly tls: Pick<EphemeralQualificationTlsIdentityFactory, 'create'>;
  readonly command: Pick<QualificationCommandRunner, 'run'>;
  readonly createServer: (
    tls: { readonly certificatePem: string; readonly privateKeyPem: string },
    objects: readonly DevelopmentServerObject[],
  ) => DevelopmentArtifactServer;
  readonly electron: Pick<DevelopmentElectronRuntimeResolver, 'resolve'>;
  readonly launch: DevelopmentApplicationLauncher;
}

export interface DevelopmentApplicationSession {
  readonly waitForExit: () => Promise<void>;
  readonly terminate: () => void;
}

export type DevelopmentApplicationLauncher = (
  executable: string,
  arguments_: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
) => Promise<DevelopmentApplicationSession>;

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error('Local Whisper development application terminated by signal'));
      else if (code !== 0) reject(new Error('Local Whisper development application failed'));
      else resolve();
    });
  });
}

function assertOwnedSessionRoot(sessionsRoot: string, sessionRoot: string): void {
  const relative = path.relative(path.resolve(sessionsRoot), path.resolve(sessionRoot));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Local Whisper development session root escaped its owner');
  }
}

function assertOwnedApplicationStatePath(applicationStateRoot: string, ownedPath: string): void {
  const relative = path.relative(path.resolve(applicationStateRoot), path.resolve(ownedPath));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Local Whisper development application state path escaped its owner');
  }
}

/** Preserves the desktop environment while isolating Electron and app configuration from the regular profile. */
export function developmentElectronEnvironment(
  environment: Readonly<NodeJS.ProcessEnv>,
  configurationRoot?: string,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const sanitized = { ...environment };
  delete sanitized.ELECTRON_RUN_AS_NODE;
  if (!configurationRoot) return sanitized;
  if (!path.isAbsolute(configurationRoot)) {
    throw new Error('Local Whisper development configuration root must be absolute');
  }
  if (platform === 'win32') {
    sanitized.APPDATA = configurationRoot;
    sanitized.LOCALAPPDATA = configurationRoot;
  } else {
    sanitized.XDG_CONFIG_HOME = configurationRoot;
  }
  return sanitized;
}

/** Resolves Electron through its package entrypoint so lazy binary installation remains supported. */
export class DevelopmentElectronRuntimeResolver {
  public async resolve(workspaceRoot: string): Promise<string> {
    const workspace = path.resolve(workspaceRoot);
    const executableName = process.platform === 'win32' ? 'electron.exe' : 'electron';
    const expectedExecutable = path.join(workspace, 'node_modules', 'electron', 'dist', executableName);
    let resolvedExecutable: unknown;
    try {
      const workspaceRequire = createRequire(path.join(workspace, 'package.json'));
      resolvedExecutable = workspaceRequire('electron');
    } catch {
      throw new Error('Local Whisper development Electron runtime unavailable');
    }
    if (resolvedExecutable !== expectedExecutable) {
      throw new Error('Local Whisper development Electron runtime unavailable');
    }
    const electronIdentity = await lstat(expectedExecutable).catch(() => null);
    if (
      !electronIdentity?.isFile() ||
      electronIdentity.isSymbolicLink() ||
      electronIdentity.size <= 0 ||
      (process.platform !== 'win32' && (electronIdentity.mode & 0o111) === 0)
    ) {
      throw new Error('Local Whisper development Electron runtime unavailable');
    }
    return expectedExecutable;
  }
}

/** Owns one normal-app development session and destroys only its ephemeral trust/server state. */
export class LocalWhisperDevelopmentSession {
  public constructor(private readonly dependencies: DevelopmentSessionDependencies) {}

  public async run(
    workspaceRoot: string,
    requestedPlatform: DevelopmentRuntimePlatformSelector = 'current',
  ): Promise<void> {
    const platform = resolveDevelopmentRuntimePlatform(requestedPlatform);
    const workspace = path.resolve(workspaceRoot);
    if (
      (process.platform !== 'linux' && process.platform !== 'win32') ||
      !path.isAbsolute(workspaceRoot) ||
      workspace === path.parse(workspace).root
    ) {
      throw new Error('Local Whisper development session requires a supported absolute workspace');
    }
    const packageValue = JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8')) as unknown;
    const version =
      typeof packageValue === 'object' && packageValue !== null && !Array.isArray(packageValue)
        ? (packageValue as Record<string, unknown>).version
        : undefined;
    if (
      typeof packageValue !== 'object' ||
      packageValue === null ||
      Array.isArray(packageValue) ||
      !isSemanticVersion(version)
    ) {
      throw new Error('Local Whisper development application revision invalid');
    }
    const appRevision = version;
    const electronExecutable = await this.dependencies.electron.resolve(workspace);
    const [runtimes, sourceCommit] = await Promise.all([
      this.dependencies.runtimes.load(workspace, platform),
      this.dependencies.command.run({
        command: process.platform === 'win32' ? 'git.exe' : '/usr/bin/git',
        arguments: ['rev-parse', 'HEAD'],
        cwd: workspace,
        environment:
          process.platform === 'win32'
            ? { ...process.env, LANG: 'C', LC_ALL: 'C' }
            : { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      }),
    ]);
    if (!/^[a-f\d]{40}$/u.test(sourceCommit)) throw new Error('Local Whisper development source identity invalid');

    const developmentRoot = path.join(workspace, '.cache', 'local-whisper', 'development');
    const sessionsRoot = path.join(developmentRoot, 'sessions');
    const applicationStateRoot = path.join(developmentRoot, APPLICATION_STATE_DIRECTORY_NAME);
    await Promise.all([
      mkdir(sessionsRoot, { recursive: true, mode: 0o700 }),
      mkdir(applicationStateRoot, { recursive: true, mode: 0o700 }),
    ]);
    const sessionRoot = await mkdtemp(path.join(sessionsRoot, 'session-'));
    assertOwnedSessionRoot(sessionsRoot, sessionRoot);
    const resourcesPath = path.join(sessionRoot, 'resources');
    const descriptorPath = path.join(
      sessionRoot,
      `${DEVELOPMENT_ACTIVATION_FILE_PREFIX}${path.basename(sessionRoot)}.json`,
    );
    const configurationRoot = path.join(applicationStateRoot, APPLICATION_CONFIGURATION_DIRECTORY_NAME);
    const userDataPath = path.join(applicationStateRoot, ELECTRON_USER_DATA_DIRECTORY_NAME);
    assertOwnedApplicationStatePath(applicationStateRoot, configurationRoot);
    assertOwnedApplicationStatePath(applicationStateRoot, userDataPath);
    let server: DevelopmentArtifactServer | null = null;
    let tls: Awaited<ReturnType<EphemeralQualificationTlsIdentityFactory['create']>> | null = null;
    let application: DevelopmentApplicationSession | null = null;
    const terminateApplication = (): void => application?.terminate();
    try {
      await Promise.all([
        this.dependencies.resources.stage(workspace, resourcesPath, platform),
        mkdir(configurationRoot, { recursive: true, mode: 0o700 }),
        mkdir(userDataPath, { recursive: true, mode: 0o700 }),
      ]);
      const runtimeAttestation = await this.dependencies.attestations.load(
        path.join(applicationStateRoot, DEVELOPMENT_RUNTIME_ATTESTATION_FILE_NAME),
        runtimes,
      );
      tls = await this.dependencies.tls.create(path.join(sessionRoot, 'trust'));
      server = this.dependencies.createServer(
        { certificatePem: tls.certificatePem, privateKeyPem: tls.privateKeyPem },
        runtimes.map((runtime) => ({
          route: `/runtime/${path.basename(runtime.archivePath)}`,
          filePath: runtime.archivePath,
          sizeBytes: runtime.archiveSizeBytes,
          sha256: runtime.archiveSha256,
        })),
      );
      const identity = await server.start();
      await this.dependencies.descriptors.produce({
        appRevision,
        certificatePem: tls.certificatePem,
        descriptorPath,
        platform,
        resourcesPath,
        runtimeAttestation,
        runtimeOrigin: identity.origin,
        runtimes,
        sourceCommit,
      });
      application = await this.dependencies.launch(
        electronExecutable,
        [
          `--user-data-dir=${userDataPath}`,
          workspace,
          `${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${descriptorPath}`,
        ],
        workspace,
        developmentElectronEnvironment(process.env, configurationRoot, platform),
      );
      process.once('SIGINT', terminateApplication);
      process.once('SIGTERM', terminateApplication);
      await application.waitForExit();
    } finally {
      process.off('SIGINT', terminateApplication);
      process.off('SIGTERM', terminateApplication);
      terminateApplication();
      await server?.stop().catch(() => undefined);
      await tls?.destroy().catch(() => undefined);
      assertOwnedSessionRoot(sessionsRoot, sessionRoot);
      await rm(sessionRoot, { recursive: true, force: true });
    }
  }
}

/** Composes the concrete normal Electron application development session. */
export function createLocalWhisperDevelopmentSession(
  applicationLauncher?: DevelopmentApplicationLauncher,
): LocalWhisperDevelopmentSession {
  return new LocalWhisperDevelopmentSession({
    descriptors: new DevelopmentActivationDescriptorProducer(),
    attestations: new DevelopmentRuntimeAttestationStore(),
    resources: new DevelopmentResourceStager(),
    runtimes: new DevelopmentRuntimeInputLoader(),
    tls: new EphemeralQualificationTlsIdentityFactory(),
    command: new QualificationCommandRunner(),
    electron: new DevelopmentElectronRuntimeResolver(),
    createServer: (tls, objects) => new QualificationHttpsArtifactServer(tls, objects),
    launch:
      applicationLauncher ??
      ((executable, arguments_, cwd, environment) => {
        const child = spawn(executable, [...arguments_], {
          cwd,
          env: environment,
          shell: false,
          stdio: 'inherit',
        });
        return Promise.resolve(
          Object.freeze({
            waitForExit: () => waitForExit(child),
            terminate: () => {
              if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
            },
          }),
        );
      }),
  });
}
