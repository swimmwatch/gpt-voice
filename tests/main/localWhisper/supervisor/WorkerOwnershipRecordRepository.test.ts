import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { FileWorkerOwnershipRecordStore } from '@main/localWhisper/supervisor/WorkerOwnershipRecordRepository';
import type { LocalWhisperWorkerOwnershipRecord } from '@main/localWhisper/supervisor/WorkerProcessOwnership';

function record(): LocalWhisperWorkerOwnershipRecord {
  return {
    appInstanceNonce: 'ownership_nonce_1234',
    configurationEpoch: 7,
    executableIdentity: {
      deviceOrVolumeId: '1',
      fileId: '2',
      linkCount: 1,
      mode: 0o500,
      parentFileId: '3',
      sizeBytes: 4096,
      type: 'regular',
    },
    pid: 4242,
    processStartIdentity: 'fixture-process-start',
    runtimeBuildDigest: 'a'.repeat(64),
    runtimeIdentityKey: 'fixture-runtime-identity',
  };
}

function harness() {
  const directory = mkdtempSync(resolve(tmpdir(), 'gpt-voice-worker-ownership-'));
  const filePath = resolve(directory, 'ownership.json');
  let temporaryNumber = 0;
  const store = new FileWorkerOwnershipRecordStore({
    filePath,
    fileSystem: fs,
    temporaryPath: () => resolve(directory, `ownership-${(temporaryNumber += 1)}.tmp`),
  });
  return { directory, filePath, store };
}

test('ownership record store writes private atomic state and removes only an exact record', async () => {
  const value = harness();
  try {
    assert.deepEqual(await value.store.read(), { kind: 'missing' });
    const expected = record();
    await value.store.write(expected);
    assert.deepEqual(await value.store.read(), { kind: 'valid', record: expected });
    assert.equal(fs.statSync(value.filePath).mode & 0o777, process.platform === 'win32' ? 0o666 : 0o600);

    await assert.rejects(value.store.remove({ ...expected, processStartIdentity: 'different-process' }), /changed/u);
    assert.equal(fs.existsSync(value.filePath), true);
    await value.store.remove(expected);
    assert.deepEqual(await value.store.read(), { kind: 'missing' });
  } finally {
    rmSync(value.directory, { force: true, recursive: true });
  }
});

test('ownership record store rejects malformed, oversized, unknown, and unsafe records', async () => {
  const value = harness();
  try {
    fs.writeFileSync(value.filePath, '{"unknown":true}\n', { mode: 0o600 });
    assert.deepEqual(await value.store.read(), { kind: 'invalid' });
    fs.writeFileSync(value.filePath, Buffer.alloc(16 * 1024 + 1, 0x20));
    assert.deepEqual(await value.store.read(), { kind: 'invalid' });
    await assert.rejects(
      value.store.write({
        ...record(),
        executableIdentity: { ...record().executableIdentity, mode: 0o1000 },
      }),
      /Invalid/u,
    );
  } finally {
    rmSync(value.directory, { force: true, recursive: true });
  }
});

test('ownership record store requires a same-directory non-target temporary path', async () => {
  const value = harness();
  const invalidStore = new FileWorkerOwnershipRecordStore({
    filePath: value.filePath,
    fileSystem: fs,
    temporaryPath: () => resolve(tmpdir(), 'outside-worker-ownership.tmp'),
  });
  try {
    await assert.rejects(invalidStore.write(record()), /temporary path/u);
    assert.equal(fs.existsSync(value.filePath), false);
  } finally {
    rmSync(value.directory, { force: true, recursive: true });
  }
});
