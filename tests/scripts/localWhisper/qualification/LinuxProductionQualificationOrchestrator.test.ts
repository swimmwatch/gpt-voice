import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { it } from 'node:test';

import { toLocalWhisperRevisionId } from '@shared/localWhisper';

import { writeCanonicalJson } from '../../../../scripts/local-whisper/packaging/fileIntegrity';
import {
  LinuxProductionQualificationOrchestrator,
  type LinuxProductionQualificationDependencies,
} from '../../../../scripts/local-whisper/qualification/LinuxProductionQualificationOrchestrator';
import type { LoadedLinuxQualificationEvidence } from '../../../../scripts/local-whisper/qualification/LinuxQualificationEvidenceLoader';
import type { QualifiedLinuxQualificationState } from '../../../../scripts/local-whisper/qualification/LinuxQualificationState';
import type { QualificationLinuxFoundation } from '../../../../scripts/local-whisper/qualification/QualificationInputProducer';
import type { QualificationLinuxResult } from '../../../../scripts/local-whisper/qualification/QualificationResultProducer';

const DIGEST = 'a'.repeat(64);
const SOURCE_COMMIT = 'b'.repeat(40);

function revision(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Test revision invalid');
  return parsed;
}

function loadedEvidence(root: string): LoadedLinuxQualificationEvidence {
  const runtimes = (['cpu', 'cuda'] as const).map((backend) => ({
    application: Object.freeze({ backend, packRevision: revision(`linux-x64-${backend}-v2.4.0`) }),
    bundle: Object.freeze({
      archivePath: path.join(root, `${backend}.tar.gz`),
      catalog: Object.freeze({
        backend,
        buildRevision: revision(`${backend}-build-v1`),
        packRevision: revision(`linux-x64-${backend}-v2.4.0`),
        expectedFiles: Object.freeze([]),
        prerequisites: Object.freeze([`${backend}-prerequisite`]),
        provenanceId: `${backend}-provenance`,
        sbomRevision: `${backend}-sbom-v1`,
        noticeIds: Object.freeze([`${backend}-notice`]),
        licenseIds: Object.freeze(['mit-license']),
      }),
    }),
    directEngine: Object.freeze({ backend, executablePath: path.join(root, `${backend}-engine`) }),
    directEngineBinarySha256: DIGEST,
    directEngineManifestDigest: DIGEST,
    platformArtifact: Object.freeze({
      artifactId: `qualification-runtime-${backend}`,
      revision: revision(`linux-x64-${backend}-v2.4.0`),
      backend,
      transferProfile: 'restricted-tar-gzip-v1' as const,
      sizeBytes: 1024,
      sha256: DIGEST,
      manifestDigest: DIGEST,
      signatureInputDigest: DIGEST,
      reproducibilityDigest: DIGEST,
    }),
    profileId: `linux-${backend}-profile-v1`,
    toolchainDigest: DIGEST,
  }));
  return Object.freeze({
    application: Object.freeze({
      models: Object.freeze([
        Object.freeze({
          family: 'base' as const,
          variant: 'full' as const,
          artifactRevision: revision('whisper-cpp-base-full-v1'),
          filePath: path.join(root, 'ggml-base.bin'),
          sizeBytes: 1024,
          sha256: DIGEST,
        }),
      ]),
      runtimes: Object.freeze(runtimes.map(({ application }) => application)),
      directEngines: Object.freeze(runtimes.map(({ directEngine }) => directEngine)),
      werFixtures: Object.freeze([]),
      performanceFixtures: Object.freeze([]),
      cpuThreads: 1,
    }),
    cachedModels: Object.freeze([]),
    candidateCorpus: Object.freeze({
      manifestDigest: DIGEST,
      noticeDigest: DIGEST,
      materializerDigest: DIGEST,
      performanceFixtureDigest: DIGEST,
    }),
    directEngineArtifacts: Object.freeze([]),
    modelNoticeDigest: DIGEST,
    modelSetManifestDigest: DIGEST,
    runtimes: Object.freeze(runtimes),
  });
}

function qualificationResult(foundation: QualificationLinuxFoundation): QualificationLinuxResult {
  return Object.freeze({
    branch: Object.freeze({
      ...foundation,
      measurementSeries: Object.freeze([]),
      platformResult: Object.freeze({ resultDigest: DIGEST }),
      evidenceIndex: Object.freeze({ indexDigest: DIGEST }),
    }),
    resultDigest: DIGEST,
    evidenceIndexDigest: DIGEST,
    sanitizedEvidenceDocuments: Object.freeze([Object.freeze({ id: 'linux-cpu-base-full', status: 'Pass' })]),
  });
}

it('coordinates one injected Linux qualification graph and releases ephemeral resources', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-orchestrator-test-'));
  let serverStops = 0;
  let tlsDestroys = 0;
  let applicationRuns = 0;
  try {
    const privateRunRoot = path.join(root, 'private-run');
    const qualificationRoot = path.join(root, 'qualification');
    const candidateInput = Object.freeze({ candidateInputDigest: DIGEST });
    const foundation: QualificationLinuxFoundation = Object.freeze({
      candidateInput,
      platformInput: Object.freeze({ platformInputDigest: DIGEST }),
      profiles: Object.freeze([]),
      platformGraph: Object.freeze({ platformGraphDigest: DIGEST }),
    });
    const result = qualificationResult(foundation);
    const state: QualifiedLinuxQualificationState = Object.freeze({
      schemaVersion: 2,
      specificationRevision: 10,
      platform: 'linux',
      activationState: 'FailClosed',
      candidateState: 'Frozen',
      profileState: 'Pass',
      previousPackageState: 'Pass',
      fixtureDigest: DIGEST,
      representativeWindowsExecution: 'NotRun',
      candidateSemVer: '2.4.0',
      freezeTimestampUtc: '2026-08-03T12:00:00Z',
      sourceCommit: SOURCE_COMMIT,
      candidateInputDigest: DIGEST,
      platformInputDigest: DIGEST,
      profileDigests: Object.freeze([DIGEST, DIGEST]),
      platformGraphDigest: DIGEST,
      resultDigest: DIGEST,
      evidenceIndexDigest: DIGEST,
      predecessorEvidenceDigest: DIGEST,
      packageDigests: Object.freeze([DIGEST, DIGEST, DIGEST]),
      reasonCodes: Object.freeze([]),
    });
    const loaded = loadedEvidence(root);
    const dependencies: LinuxProductionQualificationDependencies = {
      application: {
        run: async ({ stopArtifactServer }) => {
          applicationRuns += 1;
          await stopArtifactServer();
          return Object.freeze([]);
        },
      },
      bundleProducer: {
        produce: async ({ outputDirectory }) => {
          await mkdir(outputDirectory, { recursive: true });
          await writeCanonicalJson(path.join(outputDirectory, 'catalog.json'), { purpose: 'qualification' });
          await writeCanonicalJson(path.join(outputDirectory, 'keyring.json'), {
            schemaVersion: 1,
            purpose: 'qualification',
            appRevision: 'app-v2.4.0',
            workerProtocolVersion: 1,
            publicKeys: [],
            origins: [{ id: 'qualification-runtime-origin', origin: 'https://127.0.0.1:4443' }],
          });
          await Promise.all(
            ['notices.json', 'sbom.spdx.json', 'provenance.json'].map((fileName) =>
              writeCanonicalJson(path.join(outputDirectory, fileName), { id: fileName }),
            ),
          );
          return Object.freeze({
            bundleDirectory: outputDirectory,
            bundleManifestSha256: DIGEST,
            catalogSha256: DIGEST,
            keyId: 'qualification-test-key',
            keyringSha256: DIGEST,
          });
        },
      },
      bundleVerifier: { verify: () => Promise.resolve(undefined as never) },
      createArtifactServer: () => ({
        start: () => Promise.resolve({ certificateSha256: DIGEST, origin: 'https://127.0.0.1:4443' }),
        stop: () => {
          serverStops += 1;
          return Promise.resolve();
        },
      }),
      createGraph: () => ({
        input: {
          produceCandidate: () => candidateInput,
          produceLinuxFoundation: () => foundation,
        },
        result: { produce: () => result },
        state: { produce: () => state },
      }),
      evidenceLoader: { load: () => Promise.resolve(loaded) },
      hostIdentity: {
        source: () =>
          Promise.resolve({
            candidate: Object.freeze({
              commit: SOURCE_COMMIT,
              treeDigest: DIGEST,
              sharedSourceManifestDigest: DIGEST,
              patchLockDigest: DIGEST,
            }),
            sharedTools: Object.freeze([{ id: 'git', version: '2.0.0', sha256: DIGEST }]),
          }),
        operatingSystem: () => Promise.resolve('linux-test-x64'),
        platformTools: (_worktree, sharedTools) => Promise.resolve(sharedTools),
      },
      packageBuilder: {
        build: () =>
          Promise.resolve({
            packages: Object.freeze(
              (['AppImage', 'deb', 'rpm'] as const).map((format) => ({
                format,
                fileName: `candidate.${format}`,
                filePath: path.join(root, `candidate.${format}`),
                sizeBytes: 1024,
                sha256: DIGEST,
              })),
            ),
            resourcesPath: path.join(root, 'resources'),
          }),
      },
      predecessor: {
        run: () =>
          Promise.resolve({
            passed: true,
            sanitizedEvidence: Object.freeze({
              id: 'linux-predecessor-v2.3.0',
              platform: 'linux',
              status: 'Pass',
            }),
            sanitizedEvidenceDigest: DIGEST,
          }),
      },
      tlsFactory: {
        create: () =>
          Promise.resolve({
            certificatePem: 'test-certificate',
            certificateSha256: DIGEST,
            privateKeyPem: 'test-private-key',
            destroy: () => {
              tlsDestroys += 1;
              return Promise.resolve();
            },
          }),
      },
    };
    const output = await new LinuxProductionQualificationOrchestrator(dependencies).run({
      cacheRoot: path.join(root, 'cache'),
      candidateSemVer: '2.4.0',
      candidateWorktree: path.join(root, 'candidate-worktree'),
      freezeTimestampUtc: '2026-08-03T12:00:00Z',
      predecessorAppImagePath: path.join(root, 'GPT-Voice-2.3.0.AppImage'),
      privateRunRoot,
      qualificationRoot,
      sourceCommit: SOURCE_COMMIT,
      workspaceRoot: path.join(root, 'candidate-worktree'),
    });

    assert.equal(output.predecessorEvidenceDigest, DIGEST);
    assert.equal(output.state.candidateState, 'Frozen');
    assert.equal(applicationRuns, 1);
    assert.equal(serverStops, 1);
    assert.equal(tlsDestroys, 1);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(qualificationRoot, 'linux', 'evidence', 'linux-cpu-base-full.json'), 'utf8')),
      { id: 'linux-cpu-base-full', status: 'Pass' },
    );
    assert.deepEqual(JSON.parse(await readFile(path.join(qualificationRoot, 'linux-state.json'), 'utf8')), state);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
