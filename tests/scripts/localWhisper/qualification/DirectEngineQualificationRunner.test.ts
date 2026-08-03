import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { sha256Bytes } from '../../../../scripts/local-whisper/packaging/fileIntegrity';
import { DirectEngineQualificationRunner } from '../../../../scripts/local-whisper/qualification/DirectEngineQualificationRunner';
import { LinuxResourceSampler } from '../../../../scripts/local-whisper/qualification/LinuxResourceSampler';

describe('DirectEngineQualificationRunner', () => {
  it('passes exact inherited descriptors and returns only bounded transcript/resource evidence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-direct-runner-'));
    try {
      const model = Buffer.from('model bytes');
      const wav = Buffer.from('wav bytes');
      const modelPath = path.join(root, 'model.bin');
      const wavPath = path.join(root, 'audio.wav');
      await Promise.all([writeFile(modelPath, model), writeFile(wavPath, wav)]);
      const result = await new DirectEngineQualificationRunner(
        new LinuxResourceSampler(path.resolve('scripts/local-whisper/qualification/linux_resource_sampler.py')),
        10_000,
      ).run({
        executablePath: process.execPath,
        executableArguments: [path.resolve('tests/fixtures/local-whisper/qualification/direct-engine-fixture.mjs')],
        modelPath,
        modelSizeBytes: model.byteLength,
        modelSha256: sha256Bytes(model),
        wavPath,
        wavSizeBytes: wav.byteLength,
        wavSha256: sha256Bytes(wav),
        family: 'tiny',
        variant: 'full',
        language: 'en',
        cpuThreads: 1,
        backend: 'cpu',
        selectedOrdinal: null,
      });
      assert.equal(result.transcript, 'bounded qualification transcript');
      assert.equal(result.resources.cpuGpuInitialization, 'absent');
      assert.equal(result.resources.samples[result.resources.samples.length - 1]?.ownedProcessCount, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects changed file identities and backend/device mismatch before launch', async () => {
    const runner = new DirectEngineQualificationRunner(
      new LinuxResourceSampler(path.resolve('scripts/local-whisper/qualification/linux_resource_sampler.py')),
    );
    await assert.rejects(
      runner.run({
        executablePath: process.execPath,
        modelPath: '/missing/model',
        modelSizeBytes: 1,
        modelSha256: '0'.repeat(64),
        wavPath: '/missing/wav',
        wavSizeBytes: 1,
        wavSha256: '0'.repeat(64),
        family: 'tiny',
        variant: 'full',
        language: 'en',
        cpuThreads: 1,
        backend: 'cpu',
        selectedOrdinal: 0,
      }),
      /request is invalid/u,
    );
  });
});
