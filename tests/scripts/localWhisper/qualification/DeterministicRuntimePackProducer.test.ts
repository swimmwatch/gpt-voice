import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';

import {
  DeterministicRuntimePackProducer,
  assertReproducibleRuntimePacks,
} from '@scripts/local-whisper/qualification/DeterministicRuntimePackProducer';
import { sha256Bytes, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';

let root = '';
let stageRoot = '';
const expectedWorkerMode = process.platform === 'win32' ? 0 : 0o500;

describe('DeterministicRuntimePackProducer', () => {
  before(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'local-whisper-runtime-pack-'));
    stageRoot = path.join(root, 'stage');
    await mkdir(path.join(stageRoot, 'bin'), { recursive: true, mode: 0o700 });
    const worker = Buffer.from('deterministic worker bytes\n');
    await writeFile(path.join(stageRoot, 'bin', 'worker'), worker, { mode: 0o500 });
    await chmod(path.join(stageRoot, 'bin', 'worker'), 0o500);
    for (const name of ['runtime-manifest.json', 'provenance.json', 'sbom.spdx.json']) {
      await writeCanonicalJson(path.join(stageRoot, name), { name, schemaVersion: 1 });
    }
    await writeFile(path.join(stageRoot, 'THIRD_PARTY_NOTICES.md'), 'notices\n', { mode: 0o400 });
    await writeCanonicalJson(path.join(stageRoot, 'expected-files.json'), {
      schemaId: 'local-whisper-expected-files-v1',
      files: [
        {
          id: 'worker',
          relativePath: 'bin/worker',
          mode: expectedWorkerMode,
          sizeBytes: worker.byteLength,
          sha256: sha256Bytes(worker),
        },
      ],
    });
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('produces byte-identical canonical single-member gzip archives in independent roots', async () => {
    const producer = new DeterministicRuntimePackProducer();
    const leftDirectory = path.join(root, 'left');
    const rightDirectory = path.join(root, 'right');
    const left = await producer.produce({ stageRoot, outputDirectory: leftDirectory, profileId: 'linux-cpu-v1' });
    const right = await producer.produce({ stageRoot, outputDirectory: rightDirectory, profileId: 'linux-cpu-v1' });

    await assertReproducibleRuntimePacks(left, right, leftDirectory, rightDirectory);
    const archive = await readFile(path.join(leftDirectory, left.archive.file));
    assert.deepEqual([...archive.subarray(0, 8)], [0x1f, 0x8b, 8, 0, 0, 0, 0, 0]);
    const tar = gunzipSync(archive);
    assert.equal(tar.subarray(0, 6).toString('ascii'), 'worker');
    assert.equal(
      tar.subarray(-1024).every((byte) => byte === 0),
      true,
    );
  });

  it('rejects changed staged bytes before archive production', async () => {
    await chmod(path.join(stageRoot, 'bin', 'worker'), 0o600);
    await writeFile(path.join(stageRoot, 'bin', 'worker'), 'changed\n', { mode: 0o500 });
    await chmod(path.join(stageRoot, 'bin', 'worker'), 0o500);
    await assert.rejects(
      new DeterministicRuntimePackProducer().produce({
        stageRoot,
        outputDirectory: path.join(root, 'changed'),
        profileId: 'linux-cpu-v1',
      }),
      /identity mismatch/u,
    );
  });
});
