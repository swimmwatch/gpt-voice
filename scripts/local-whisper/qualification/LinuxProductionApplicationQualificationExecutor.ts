import { execFile, spawn, type SpawnOptions } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { availableParallelism, freemem } from 'node:os';
import * as path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { promisify } from 'node:util';

import { NodeArtifactHttpClient } from '@main/localWhisper/artifacts/NodeArtifactHttpClient';
import { NvidiaSmiHostInventory } from '@main/localWhisper/capability/NvidiaSmiHostInventory';
import { NvidiaSmiVramAvailability } from '@main/localWhisper/capability/NvidiaSmiVramAvailability';
import type { LocalWhisperCatalogTrustPolicy } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import { ProductionLocalWhisperEnvironmentFactory } from '@main/localWhisper/composition/createProductionLocalWhisperEnvironment';
import { toLocalWhisperArtifactId, toLocalWhisperRevisionId } from '@shared/localWhisper';

import { parseKeyringDocument } from '../packaging/contracts';
import { readCanonicalJson } from '../packaging/fileIntegrity';
import { DirectEngineQualificationRunner } from './DirectEngineQualificationRunner';
import type { QualificationTlsMaterial } from './EphemeralQualificationTlsIdentity';
import type { LoadedLinuxQualificationEvidence } from './LinuxQualificationEvidenceLoader';
import type { LinuxQualificationPackageBuildResult } from './LinuxQualificationPackageBuilder';
import { LinuxResourceSampler } from './LinuxResourceSampler';
import { ProductionApplicationQualificationRunner } from './ProductionApplicationQualificationRunner';
import { QualificationArtifactHttpClient } from './QualificationArtifactHttpClient';
import type { QualificationLinuxRowEvidence } from './QualificationResultProducer';
import {
  QualificationWorkerProtocolObserver,
  type QualificationWorkerProtocolObservation,
} from './QualificationWorkerProtocolObserver';

const execFileAsync = promisify(execFile);
const NVIDIA_SMI_MAXIMUM_BUFFER_BYTES = 16 * 1024;
const NVIDIA_SMI_TIMEOUT_MILLISECONDS = 10_000;
const MODEL_LAUNCH_ARGUMENT = '--local-whisper-model-launch-v1';

export interface LinuxApplicationQualificationExecutionInput {
  readonly bundleDirectory: string;
  readonly catalogDocument: Buffer;
  readonly input: {
    readonly privateRunRoot: string;
    readonly workspaceRoot: string;
  };
  readonly loaded: LoadedLinuxQualificationEvidence;
  readonly packages: LinuxQualificationPackageBuildResult;
  readonly predecessorPassed: boolean;
  readonly stopArtifactServer: () => Promise<void>;
  readonly tls: QualificationTlsMaterial;
}

export interface LinuxApplicationQualificationPort {
  readonly run: (
    input: LinuxApplicationQualificationExecutionInput,
  ) => Promise<readonly QualificationLinuxRowEvidence[]>;
}

function trustPolicy(keyringValue: unknown): LocalWhisperCatalogTrustPolicy {
  const keyring = parseKeyringDocument(keyringValue);
  if (keyring.purpose !== 'qualification') throw new Error('Qualification keyring purpose invalid');
  const appRevision = toLocalWhisperRevisionId(keyring.appRevision);
  if (!appRevision) throw new Error('Qualification app revision invalid');
  return Object.freeze({
    purpose: 'qualification',
    publicKeys: Object.freeze(
      keyring.publicKeys.map((entry) => {
        const keyId = toLocalWhisperArtifactId(entry.keyId);
        if (!keyId) throw new Error('Qualification key identity invalid');
        return Object.freeze({ keyId, publicKeyPem: entry.publicKeyPem });
      }),
    ),
    origins: Object.freeze(
      keyring.origins.map((entry) => {
        const id = toLocalWhisperArtifactId(entry.id);
        if (!id) throw new Error('Qualification origin identity invalid');
        return Object.freeze({ id, origin: entry.origin });
      }),
    ),
    appRevision,
    workerProtocolVersion: keyring.workerProtocolVersion,
  });
}

async function runNvidiaSmi(executablePath: string, arguments_: readonly string[]): Promise<string> {
  const result = await execFileAsync(executablePath, [...arguments_], {
    encoding: 'utf8',
    env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
    maxBuffer: NVIDIA_SMI_MAXIMUM_BUFFER_BYTES,
    timeout: NVIDIA_SMI_TIMEOUT_MILLISECONDS,
    windowsHide: true,
  });
  return result.stdout;
}

/** Owns production application composition for one bounded Linux qualification run. */
export class LinuxProductionApplicationQualificationExecutor implements LinuxApplicationQualificationPort {
  public async run(
    execution: LinuxApplicationQualificationExecutionInput,
  ): Promise<readonly QualificationLinuxRowEvidence[]> {
    const keyringValue = await readCanonicalJson(path.join(execution.bundleDirectory, 'keyring.json'));
    const policy = trustPolicy(keyringValue);
    const delegate = new NodeArtifactHttpClient({
      trustedCertificateAuthorities: [execution.tls.certificatePem],
    });
    const artifactHttpClient = await QualificationArtifactHttpClient.create(execution.loaded.cachedModels, delegate);
    const configurationRoot = path.join(execution.input.privateRunRoot, 'application-config');
    const dataRoot = path.join(execution.input.privateRunRoot, 'application-data');
    const homeRoot = path.join(execution.input.privateRunRoot, 'application-home');
    await Promise.all([
      mkdir(configurationRoot, { recursive: true, mode: 0o700 }),
      mkdir(dataRoot, { recursive: true, mode: 0o700 }),
      mkdir(homeRoot, { recursive: true, mode: 0o700 }),
    ]);
    let requestSequence = 0;
    const sampler = new LinuxResourceSampler(
      path.join(execution.input.workspaceRoot, 'scripts/local-whisper/qualification/linux_resource_sampler.py'),
    );
    const nvidiaCommand = Object.freeze({ run: runNvidiaSmi });
    const nvidiaInventory = new NvidiaSmiHostInventory({
      platform: 'linux',
      environment: process.env,
      pathExists: fs.existsSync,
      command: nvidiaCommand,
    });
    const vramAvailability = new NvidiaSmiVramAvailability({
      platform: 'linux',
      environment: process.env,
      pathExists: fs.existsSync,
      command: nvidiaCommand,
    });
    let protocolObservation: QualificationWorkerProtocolObservation | null = null;
    const observedSpawn = ((command: string, arguments_: readonly string[], options: SpawnOptions) => {
      const child = spawn(command, arguments_, options);
      if (arguments_.includes(MODEL_LAUNCH_ARGUMENT) && child.stdout) {
        new QualificationWorkerProtocolObserver((observation) => {
          protocolObservation = observation;
        }).observe(child.stdout);
      }
      return child;
    }) as typeof spawn;
    const application = new ProductionApplicationQualificationRunner({
      createEnvironment: (onSessionProcessLaunched) =>
        new ProductionLocalWhisperEnvironmentFactory(
          {
            appRevision: policy.appRevision,
            architecture: 'x64',
            availableMemoryBytes: freemem,
            availableVramBytes: (nativeIdentity) => vramAvailability.sample(nativeIdentity),
            readNvidiaInventory: () => nvidiaInventory.read(),
            configurationRoot,
            environment: Object.freeze({
              HOME: homeRoot,
              XDG_DATA_HOME: dataRoot,
              LANG: 'C.UTF-8',
              LC_ALL: 'C.UTF-8',
              PATH: '/usr/bin:/bin',
            }),
            fileSystem: {
              chmodSync: fs.chmodSync,
              existsSync: fs.existsSync,
              mkdirSync: fs.mkdirSync,
              readFileSync: fs.readFileSync,
              renameSync: fs.renameSync,
              rmSync: fs.rmSync,
              unlinkSync: fs.unlinkSync,
              writeFileSync: fs.writeFileSync,
            },
            homeDirectory: () => homeRoot,
            logicalProcessorCount: availableParallelism(),
            nextRequestId: () => `qualification-request-${++requestSequence}`,
            now: Date.now,
            openPath: () => Promise.resolve(''),
            pid: process.pid,
            platform: 'linux',
            qualificationHooks: {
              artifactHttpClient,
              trustedCertificateAuthorities: [execution.tls.certificatePem],
              onSessionProcessLaunched: (event) => {
                if (event.backend !== 'cpu' && event.backend !== 'cuda') {
                  throw new Error('Qualification observed an unexpected worker backend');
                }
                onSessionProcessLaunched({
                  backend: event.backend,
                  crashOwnedTree: event.crashOwnedTree,
                  launchMode: event.launchMode,
                  pid: event.pid,
                });
              },
            },
            randomNonce: () => randomBytes(24).toString('base64url'),
            randomBytes: (size) => randomBytes(size),
            readFile: async (filePath) => await readFile(filePath),
            resourcesPath: execution.packages.resourcesPath,
            spawnProcess: observedSpawn,
          },
          {
            activationPurpose: 'qualification',
            document: execution.catalogDocument,
            trustPolicy: policy,
          },
        ).create(),
      directEngine: new DirectEngineQualificationRunner(sampler),
      resourceSampler: sampler,
      wait: async (milliseconds) => {
        await wait(milliseconds);
      },
    });
    try {
      return await application.run({
        ...execution.loaded.application,
        predecessorPassed: execution.predecessorPassed,
        stopArtifactServer: execution.stopArtifactServer,
      });
    } catch (error) {
      if (protocolObservation && error instanceof Error && error.message.includes('WORKER_PROTOCOL_VIOLATION')) {
        const observation: QualificationWorkerProtocolObservation = protocolObservation;
        throw new Error(
          `Qualification worker protocol diagnostic:${observation.stage}:${observation.messageType}:${observation.fieldNames.join(',')}`,
          { cause: error },
        );
      }
      throw error;
    }
  }
}
