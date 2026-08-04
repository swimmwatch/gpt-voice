import { mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { BundleVerifier } from '../packaging/BundleVerifier';
import { parseKeyringDocument } from '../packaging/contracts';
import { readCanonicalJson, sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';
import {
  EphemeralQualificationTlsIdentityFactory,
  type QualificationTlsMaterial,
} from './EphemeralQualificationTlsIdentity';
import { LinuxQualificationEvidenceLoader } from './LinuxQualificationEvidenceLoader';
import {
  LinuxQualificationPackageBuilder,
  type LinuxQualificationPackageBuildResult,
} from './LinuxQualificationPackageBuilder';
import { LinuxQualificationStateProducer, type QualifiedLinuxQualificationState } from './LinuxQualificationState';
import { QualificationCommandRunner } from './QualificationCommandRunner';
import { LocalWhisperQualificationBundleProducer } from './QualificationBundleProducer';
import { LocalWhisperQualificationValidator } from './QualificationContracts';
import { QualificationHttpsArtifactServer } from './QualificationHttpsArtifactServer';
import { LinuxPredecessorAppImageExtractor } from './LinuxPredecessorAppImageExtractor';
import { LinuxPredecessorElectronSession } from './LinuxPredecessorElectronSession';
import { LinuxPredecessorQualifier, type LinuxPredecessorQualificationPort } from './LinuxPredecessorQualification';
import {
  LinuxQualificationHostIdentityProvider,
  qualificationToolIdentity,
  type LinuxQualificationHostIdentityPort,
} from './LinuxQualificationHostIdentityProvider';
import {
  LocalWhisperQualificationInputProducer,
  type QualificationLinuxFoundation,
  type QualificationLinuxPlatformSeed,
} from './QualificationInputProducer';
import {
  LinuxProductionApplicationQualificationExecutor,
  type LinuxApplicationQualificationPort,
} from './LinuxProductionApplicationQualificationExecutor';
import { LocalWhisperQualificationResultProducer, type QualificationLinuxResult } from './QualificationResultProducer';

const PREDECESSOR_SHA256 = '80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111';
const SEMVER_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;

export interface LinuxProductionQualificationInput {
  readonly cacheRoot: string;
  readonly candidateSemVer: string;
  readonly candidateWorktree: string;
  readonly freezeTimestampUtc: string;
  readonly predecessorAppImagePath: string;
  readonly privateRunRoot: string;
  readonly qualificationRoot: string;
  readonly sourceCommit: string;
  readonly workspaceRoot: string;
}

export interface LinuxProductionQualificationOutput {
  readonly foundation: QualificationLinuxFoundation;
  readonly packages: LinuxQualificationPackageBuildResult['packages'];
  readonly predecessorEvidenceDigest: string;
  readonly result: QualificationLinuxResult;
  readonly state: QualifiedLinuxQualificationState;
}

export interface QualificationGraphPorts {
  readonly input: Pick<LocalWhisperQualificationInputProducer, 'produceCandidate' | 'produceLinuxFoundation'>;
  readonly result: Pick<LocalWhisperQualificationResultProducer, 'produce'>;
  readonly state: Pick<LinuxQualificationStateProducer, 'produce'>;
}

export interface QualificationArtifactServerPort {
  readonly start: () => Promise<{
    readonly certificateSha256: string;
    readonly origin: string;
  }>;
  readonly stop: () => Promise<void>;
}

export interface QualificationRuntimeObject {
  readonly route: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface LinuxProductionQualificationDependencies {
  readonly application: LinuxApplicationQualificationPort;
  readonly bundleProducer: Pick<LocalWhisperQualificationBundleProducer, 'produce'>;
  readonly bundleVerifier: Pick<BundleVerifier, 'verify'>;
  readonly createArtifactServer: (
    tls: QualificationTlsMaterial,
    objects: readonly QualificationRuntimeObject[],
  ) => QualificationArtifactServerPort;
  readonly createGraph: (qualificationRoot: string) => QualificationGraphPorts;
  readonly evidenceLoader: Pick<LinuxQualificationEvidenceLoader, 'load'>;
  readonly hostIdentity: LinuxQualificationHostIdentityPort;
  readonly packageBuilder: Pick<LinuxQualificationPackageBuilder, 'build'>;
  readonly predecessor: LinuxPredecessorQualificationPort;
  readonly tlsFactory: Pick<EphemeralQualificationTlsIdentityFactory, 'create'>;
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function stringField(value: Readonly<Record<string, unknown>>, field: string, code: string): string {
  const result = value[field];
  if (typeof result !== 'string') throw new Error(code);
  return result;
}

async function writePrivateFoundation(root: string, foundation: QualificationLinuxFoundation): Promise<void> {
  const directory = path.join(root, 'frozen-inputs');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await Promise.all([
    writeCanonicalJson(path.join(directory, 'candidate-input.json'), foundation.candidateInput),
    writeCanonicalJson(path.join(directory, 'platform-input.json'), foundation.platformInput),
    writeCanonicalJson(path.join(directory, 'platform-graph.json'), foundation.platformGraph),
    ...foundation.profiles.map((profile) =>
      writeCanonicalJson(
        path.join(directory, `profile-${String(record(profile, 'Profile invalid').backend)}.json`),
        profile,
      ),
    ),
  ]);
}

async function writeSuccessfulEvidence(
  qualificationRoot: string,
  privateRunRoot: string,
  result: QualificationLinuxResult,
  state: QualifiedLinuxQualificationState,
): Promise<void> {
  const publicLinuxRoot = path.join(qualificationRoot, 'linux');
  const publicEvidenceRoot = path.join(publicLinuxRoot, 'evidence');
  const privateSeriesRoot = path.join(privateRunRoot, 'measurement-series');
  await Promise.all([
    mkdir(publicEvidenceRoot, { recursive: true, mode: 0o700 }),
    mkdir(privateSeriesRoot, { recursive: true, mode: 0o700 }),
  ]);
  const branch = result.branch;
  await Promise.all([
    writeCanonicalJson(path.join(qualificationRoot, 'candidate-input.json'), branch.candidateInput),
    writeCanonicalJson(path.join(publicLinuxRoot, 'platform-input.json'), branch.platformInput),
    writeCanonicalJson(path.join(publicLinuxRoot, 'platform-graph.json'), branch.platformGraph),
    writeCanonicalJson(path.join(publicLinuxRoot, 'platform-result.json'), branch.platformResult),
    writeCanonicalJson(path.join(publicLinuxRoot, 'evidence-index.json'), branch.evidenceIndex),
    ...branch.profiles.map((profile) =>
      writeCanonicalJson(
        path.join(publicLinuxRoot, `profile-${String(record(profile, 'Profile invalid').backend)}.json`),
        profile,
      ),
    ),
    ...result.sanitizedEvidenceDocuments.map((document) =>
      writeCanonicalJson(
        path.join(publicEvidenceRoot, `${stringField(document, 'id', 'Evidence ID invalid')}.json`),
        document,
      ),
    ),
    ...branch.measurementSeries.map((series) =>
      writeCanonicalJson(
        path.join(
          privateSeriesRoot,
          `${stringField(record(series, 'Series invalid'), 'rowId', 'Series ID invalid')}.json`,
        ),
        series,
      ),
    ),
  ]);
  await writeCanonicalJson(path.join(qualificationRoot, 'linux-state.json'), state);
}

/** Runs the exact forward-only Linux production-application qualification graph. */
export class LinuxProductionQualificationOrchestrator {
  public constructor(private readonly dependencies: LinuxProductionQualificationDependencies) {}

  public async run(input: LinuxProductionQualificationInput): Promise<LinuxProductionQualificationOutput> {
    this.validateInput(input);
    await mkdir(input.privateRunRoot, { recursive: false, mode: 0o700 });
    const graph = this.dependencies.createGraph(input.qualificationRoot);
    const source = await this.dependencies.hostIdentity.source(input);
    const loaded = await this.dependencies.evidenceLoader.load(input.cacheRoot, input.workspaceRoot);
    const candidateInput = graph.input.produceCandidate({
      candidateSemVer: input.candidateSemVer,
      freezeTimestampUtc: input.freezeTimestampUtc,
      source: source.candidate,
      modelNoticeDigest: loaded.modelNoticeDigest,
      corpus: loaded.candidateCorpus,
      sharedToolIdentities: source.sharedTools,
    });
    await writeCanonicalJson(path.join(input.privateRunRoot, 'candidate-input.json'), candidateInput);
    const predecessor = await this.dependencies.predecessor.run({
      appImagePath: input.predecessorAppImagePath,
      expectedSha256: PREDECESSOR_SHA256,
      privateRoot: path.join(input.privateRunRoot, 'predecessor'),
    });

    const tls = await this.dependencies.tlsFactory.create(path.join(input.privateRunRoot, 'private'));
    const runtimeObjects = loaded.runtimes.map(({ bundle, platformArtifact }) => ({
      route: `/runtime/${path.basename(bundle.archivePath)}`,
      filePath: bundle.archivePath,
      sizeBytes: platformArtifact.sizeBytes,
      sha256: platformArtifact.sha256,
    }));
    const server = this.dependencies.createArtifactServer(tls, runtimeObjects);
    let serverStopped = false;
    const stopServer = async (): Promise<void> => {
      if (serverStopped) return;
      serverStopped = true;
      await server.stop();
    };
    try {
      const serverIdentity = await server.start();
      if (serverIdentity.certificateSha256 !== tls.certificateSha256) {
        throw new Error('Qualification server certificate identity mismatch');
      }
      const baseModel = loaded.application.models.find(({ family }) => family === 'base');
      if (!baseModel) throw new Error('Qualification base model input missing');
      const bundle = await this.dependencies.bundleProducer.produce({
        outputDirectory: path.join(input.privateRunRoot, 'bundle'),
        catalog: {
          candidateSemVer: input.candidateSemVer,
          catalogRevision: `qualification-catalog-v${input.candidateSemVer}`,
          runtimeOriginId: 'qualification-runtime-origin',
          runtimeOrigin: serverIdentity.origin,
          sourceCommit: input.sourceCommit,
        },
        runtimes: loaded.runtimes.map(({ bundle: value }) => value),
        model: {
          filePath: baseModel.filePath,
          family: baseModel.family,
          variant: baseModel.variant,
          expectedSha256: baseModel.sha256,
          expectedSizeBytes: baseModel.sizeBytes,
        },
      });
      await this.dependencies.bundleVerifier.verify(bundle.bundleDirectory, {
        purpose: 'qualification',
        manifestSha256: bundle.bundleManifestSha256,
      });
      const packages = await this.dependencies.packageBuilder.build({
        bundleDirectory: bundle.bundleDirectory,
        bundleManifestSha256: bundle.bundleManifestSha256,
        candidateSemVer: input.candidateSemVer,
        freezeTimestampUtc: input.freezeTimestampUtc,
        sourceCommit: input.sourceCommit,
        worktree: input.candidateWorktree,
      });
      const keyringValue = await readCanonicalJson(path.join(bundle.bundleDirectory, 'keyring.json'));
      const keyring = parseKeyringDocument(keyringValue);
      const platformTools = await this.dependencies.hostIdentity.platformTools(
        input.candidateWorktree,
        source.sharedTools,
      );
      const os = await this.dependencies.hostIdentity.operatingSystem();
      const [cpuRuntime, cudaRuntime] = loaded.runtimes;
      if (
        !cpuRuntime ||
        cpuRuntime.application.backend !== 'cpu' ||
        !cudaRuntime ||
        cudaRuntime.application.backend !== 'cuda'
      ) {
        throw new Error('Qualification runtime order invalid');
      }
      const evidenceRoot = bundle.bundleDirectory;
      const platformSeed: QualificationLinuxPlatformSeed = {
        packages: packages.packages.map(({ filePath: _filePath, ...identity }) => identity),
        catalog: {
          purpose: 'qualification',
          payloadSchemaVersion: 2,
          revision: `qualification-catalog-v${input.candidateSemVer}`,
          catalogDigest: bundle.catalogSha256,
          keyringDigest: bundle.keyringSha256,
          temporaryKeyId: bundle.keyId,
          originIds: keyring.origins.map(({ id }) => id).sort((left, right) => left.localeCompare(right, 'en')),
        },
        runtimeArtifacts: loaded.runtimes.map(({ platformArtifact }) => platformArtifact),
        directEngineArtifacts: loaded.directEngineArtifacts,
        toolIdentities: platformTools,
        qualificationServer: {
          originId: 'qualification-runtime-origin',
          certificateSha256: serverIdentity.certificateSha256,
          objectDigests: loaded.runtimes.map(({ platformArtifact }) => platformArtifact.sha256).sort(),
        },
        platformEvidence: {
          noticesDigest: await sha256File(path.join(evidenceRoot, 'notices.json')),
          sbomDigest: await sha256File(path.join(evidenceRoot, 'sbom.spdx.json')),
          provenanceDigest: await sha256File(path.join(evidenceRoot, 'provenance.json')),
        },
        predecessor: {
          version: '2.3.0',
          fileName: 'GPT-Voice-2.3.0.AppImage',
          sha256: PREDECESSOR_SHA256,
        },
        profiles: {
          cpu: {
            profileId: cpuRuntime.profileId,
            osIdentity: os,
            hardwareClass: 'linux-x64-cpu-reference-class',
            runtimeRevision: cpuRuntime.application.packRevision,
            directEngineManifestDigest: cpuRuntime.directEngineManifestDigest,
            toolIdentities: [
              qualificationToolIdentity('cpu-toolchain', cpuRuntime.profileId, cpuRuntime.toolchainDigest),
            ],
          },
          cuda: {
            profileId: cudaRuntime.profileId,
            osIdentity: os,
            hardwareClass: 'linux-x64-nvidia-sm120a-reference-class',
            runtimeRevision: cudaRuntime.application.packRevision,
            directEngineManifestDigest: cudaRuntime.directEngineManifestDigest,
            toolIdentities: [
              qualificationToolIdentity('cuda-toolchain', cudaRuntime.profileId, cudaRuntime.toolchainDigest),
            ],
          },
        },
      };
      const foundation = graph.input.produceLinuxFoundation(candidateInput, platformSeed);
      await writePrivateFoundation(input.privateRunRoot, foundation);

      const catalogDocument = await readFile(path.join(bundle.bundleDirectory, 'catalog.json'));
      const rows = await this.dependencies.application.run({
        bundleDirectory: bundle.bundleDirectory,
        catalogDocument,
        input,
        loaded,
        packages,
        predecessorPassed: predecessor.passed,
        stopArtifactServer: stopServer,
        tls,
      });
      const result = graph.result.produce(foundation, rows, [
        Object.freeze({
          document: predecessor.sanitizedEvidence,
          evidenceClass: 'package',
          id: 'linux-predecessor-v2.3.0',
          sanitizedLabel: 'Linux predecessor AppImage compatibility',
        }),
      ]);
      const state = graph.state.produce({
        candidateSemVer: input.candidateSemVer,
        freezeTimestampUtc: input.freezeTimestampUtc,
        sourceCommit: input.sourceCommit,
        foundation,
        packages: packages.packages,
        predecessorEvidenceDigest: predecessor.sanitizedEvidenceDigest,
        result,
      });
      await writeSuccessfulEvidence(input.qualificationRoot, input.privateRunRoot, result, state);
      return Object.freeze({
        foundation,
        packages: packages.packages,
        predecessorEvidenceDigest: predecessor.sanitizedEvidenceDigest,
        result,
        state,
      });
    } finally {
      await stopServer().catch(() => undefined);
      await tls.destroy();
    }
  }

  private validateInput(input: LinuxProductionQualificationInput): void {
    const roots = [
      input.cacheRoot,
      input.candidateWorktree,
      input.predecessorAppImagePath,
      input.privateRunRoot,
      input.qualificationRoot,
      input.workspaceRoot,
    ];
    if (
      process.platform !== 'linux' ||
      roots.some((value) => !path.isAbsolute(value) || value.includes('\0')) ||
      path.resolve(input.privateRunRoot) === path.parse(path.resolve(input.privateRunRoot)).root ||
      path.resolve(input.workspaceRoot) !== path.resolve(input.candidateWorktree) ||
      !SEMVER_PATTERN.test(input.candidateSemVer) ||
      !TIMESTAMP_PATTERN.test(input.freezeTimestampUtc) ||
      !Number.isFinite(Date.parse(input.freezeTimestampUtc)) ||
      !COMMIT_PATTERN.test(input.sourceCommit)
    ) {
      throw new Error('Linux production qualification input invalid');
    }
  }
}

/** Composes the concrete adapters used by the Task 20 Linux qualification command. */
export function createLinuxProductionQualificationOrchestrator(): LinuxProductionQualificationOrchestrator {
  const commands = new QualificationCommandRunner();
  return new LinuxProductionQualificationOrchestrator({
    application: new LinuxProductionApplicationQualificationExecutor(),
    bundleProducer: new LocalWhisperQualificationBundleProducer(),
    bundleVerifier: new BundleVerifier(),
    createArtifactServer: (tls, objects) =>
      new QualificationHttpsArtifactServer(
        { certificatePem: tls.certificatePem, privateKeyPem: tls.privateKeyPem },
        objects,
      ),
    createGraph: (qualificationRoot) => {
      const validator = new LocalWhisperQualificationValidator(qualificationRoot);
      return Object.freeze({
        input: new LocalWhisperQualificationInputProducer(validator),
        result: new LocalWhisperQualificationResultProducer(validator),
        state: new LinuxQualificationStateProducer(validator),
      });
    },
    evidenceLoader: new LinuxQualificationEvidenceLoader(),
    hostIdentity: new LinuxQualificationHostIdentityProvider(commands),
    packageBuilder: new LinuxQualificationPackageBuilder(commands),
    predecessor: new LinuxPredecessorQualifier(
      new LinuxPredecessorElectronSession(),
      new LinuxPredecessorAppImageExtractor(),
    ),
    tlsFactory: new EphemeralQualificationTlsIdentityFactory(commands),
  });
}
