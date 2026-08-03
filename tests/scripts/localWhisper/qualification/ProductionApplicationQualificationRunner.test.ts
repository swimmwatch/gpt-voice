import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import { toLocalWhisperRevisionId } from '@shared/localWhisper';

import {
  ProductionApplicationQualificationRunner,
  type ProductionApplicationQualificationInput,
  type QualificationAudioFixture,
} from '../../../../scripts/local-whisper/qualification/ProductionApplicationQualificationRunner';

function revision(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid test revision');
  return parsed;
}

function models() {
  return LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map((model) =>
    Object.freeze({
      family: model.family,
      variant: model.variant,
      artifactRevision: revision(`whisper-cpp-${model.family}-${model.variant}-v1`),
      filePath: `/private/models/${model.file}`,
      sizeBytes: model.sizeBytes,
      sha256: model.sha256,
    }),
  );
}

function runner() {
  return new ProductionApplicationQualificationRunner({
    createEnvironment: () => Promise.reject(new Error('Environment must not be created in validation tests')),
    directEngine: { run: () => Promise.reject(new Error('Direct engine must not run in validation tests')) },
    resourceSampler: {
      start: () => ({ finish: () => Promise.reject(new Error('Sampler must not run in validation tests')) }),
    },
    killOwnedProcess: () => undefined,
    wait: () => Promise.resolve(),
  });
}

function input(
  werFixture: QualificationAudioFixture,
  performanceFixture: QualificationAudioFixture,
  stopArtifactServer: () => Promise<void>,
): ProductionApplicationQualificationInput {
  return {
    models: models(),
    runtimes: [
      { backend: 'cpu', packRevision: revision('linux-x64-cpu-v2.4.0') },
      { backend: 'cuda', packRevision: revision('linux-x64-cuda-v2.4.0') },
    ],
    directEngines: [
      { backend: 'cpu', executablePath: '/private/direct-engine/cpu' },
      { backend: 'cuda', executablePath: '/private/direct-engine/cuda', runtimeLibraryPath: '/private/cuda' },
    ],
    werFixtures: [werFixture],
    performanceFixtures: Array.from({ length: 5 }, (_value, index) => ({
      ...performanceFixture,
      id: `performance-${index + 1}`,
    })),
    cpuThreads: 8,
    predecessorPassed: true,
    stopArtifactServer,
  };
}

describe('ProductionApplicationQualificationRunner', () => {
  it('rejects a model identity outside the canonical six-row matrix before side effects', async () => {
    const fixture: QualificationAudioFixture = {
      id: 'fixture',
      filePath: '/private/fixture.wav',
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      durationNanoseconds: 60_000_000_000,
      language: 'en',
      locale: 'en_us',
      referenceText: 'fixture',
    };
    let stops = 0;
    const candidate = input(fixture, fixture, () => {
      stops += 1;
      return Promise.resolve();
    });
    const first = candidate.models[0];
    if (!first) throw new Error('Canonical model fixture is missing');

    await assert.rejects(
      runner().run({
        ...candidate,
        models: [{ ...first, sha256: 'b'.repeat(64) }, ...candidate.models.slice(1)],
      }),
      /input is incomplete/u,
    );
    assert.equal(stops, 0);
  });

  it('stops the single-use artifact server exactly once when fixture verification fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-application-runner-test-'));
    try {
      const filePath = path.join(root, 'fixture.wav');
      const bytes = Buffer.from('qualification fixture', 'utf8');
      await writeFile(filePath, bytes, { mode: 0o600 });
      const fixture: QualificationAudioFixture = {
        id: 'fixture',
        filePath,
        sizeBytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        durationNanoseconds: 60_000_000_000,
        language: 'en',
        locale: 'en_us',
        referenceText: 'fixture',
      };
      let stops = 0;
      const candidate = input(
        { ...fixture, sha256: 'c'.repeat(64) },
        fixture,
        () => {
          stops += 1;
          return Promise.resolve();
        },
      );

      await assert.rejects(runner().run(candidate), /audio fixture identity changed/u);
      assert.equal(stops, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('accepts exact fixture bytes through the public identity verifier', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-application-runner-test-'));
    try {
      const filePath = path.join(root, 'fixture.wav');
      const bytes = Buffer.from('exact qualification fixture', 'utf8');
      await writeFile(filePath, bytes, { mode: 0o600 });
      const fixture: QualificationAudioFixture = {
        id: 'fixture',
        filePath,
        sizeBytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        durationNanoseconds: 1,
        language: 'ru',
        locale: 'ru_ru',
        referenceText: 'пример',
      };

      await runner().verifyFixtureIdentities([fixture]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
