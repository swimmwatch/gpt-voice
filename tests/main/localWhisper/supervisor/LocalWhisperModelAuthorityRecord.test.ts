import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  LocalWhisperModelAuthorityReplayGuard,
  decodeLocalWhisperModelAuthorityRecord,
  encodeLocalWhisperModelAuthorityRecord,
} from '@main/localWhisper/supervisor/LocalWhisperModelAuthorityRecord';

interface AuthorityManifest {
  readonly authority: readonly { readonly binaryFile: string; readonly name: string }[];
}

const FIXTURE_ROOT = 'tests/fixtures/local-whisper/protocol/v1';

test('fixed-width authority records round-trip every checked-in hop', () => {
  const manifest = JSON.parse(readFileSync(`${FIXTURE_ROOT}/manifest.json`, 'utf8')) as AuthorityManifest;
  for (const vector of manifest.authority) {
    const bytes = readFileSync(`${FIXTURE_ROOT}/${vector.binaryFile}`);
    const record = decodeLocalWhisperModelAuthorityRecord(bytes);
    assert.deepEqual(Buffer.from(encodeLocalWhisperModelAuthorityRecord(record)), bytes, vector.name);
  }
});

test('authority records reject truncation, trailing bytes, domains, carriers, and replay', () => {
  const manifest = JSON.parse(readFileSync(`${FIXTURE_ROOT}/manifest.json`, 'utf8')) as AuthorityManifest;
  const requestVector = manifest.authority.find((value) => value.name === 'request');
  const transferVector = manifest.authority.find((value) => value.name === 'linux-hop-2');
  assert.ok(requestVector && transferVector);
  const request = readFileSync(`${FIXTURE_ROOT}/${requestVector.binaryFile}`);
  const transfer = readFileSync(`${FIXTURE_ROOT}/${transferVector.binaryFile}`);
  assert.throws(() => decodeLocalWhisperModelAuthorityRecord(request.subarray(0, -1)));
  assert.throws(() => decodeLocalWhisperModelAuthorityRecord(Uint8Array.from([...request, 0])));
  const changedDomain = new Uint8Array(request);
  changedDomain[0] = 0;
  assert.throws(() => decodeLocalWhisperModelAuthorityRecord(changedDomain));
  const changedCarrier = new Uint8Array(transfer);
  changedCarrier[227] = 2;
  assert.throws(() => decodeLocalWhisperModelAuthorityRecord(changedCarrier));

  const record = decodeLocalWhisperModelAuthorityRecord(request);
  const replay = new LocalWhisperModelAuthorityReplayGuard();
  assert.equal(replay.consume(record.binding.operationNonce), true);
  assert.equal(replay.consume(record.binding.operationNonce), false);
});
