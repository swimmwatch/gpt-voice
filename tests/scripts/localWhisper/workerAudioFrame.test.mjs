import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { URL } from 'node:url';

import { audioFrame } from '../../../scripts/local-whisper/whisper-cpp-integration-core.mjs';

const nativeProtocolSource = readFileSync(
  new URL(
    '../../../runtime/local-whisper/whisper-cpp/include/local_whisper/whisper_cpp/worker_protocol.hpp',
    import.meta.url,
  ),
  'utf8',
);
const applicationProtocolSource = readFileSync(
  new URL('../../../src/shared/localWhisper/protocol.ts', import.meta.url),
  'utf8',
);

describe('worker audio frame fixture', () => {
  it('uses the same protocol version as the application and native audio reader', () => {
    const nativeVersion = nativeProtocolSource.match(/kWorkerProtocolVersion = (\d+)U;/u);
    const applicationVersion = applicationProtocolSource.match(
      /LOCAL_WHISPER_WORKER_PROTOCOL_VERSION = (\d+) as const;/u,
    );
    assert.ok(nativeVersion, 'Native worker protocol version must be explicit');
    assert.ok(applicationVersion, 'Application worker protocol version must be explicit');
    assert.equal(Number(nativeVersion[1]), Number(applicationVersion[1]));

    const frame = audioFrame('audio-contract', Buffer.from([0, 1]));
    assert.equal(frame[5], Number(nativeVersion[1]));
  });

  it('preserves the production audio envelope, request identity and payload', () => {
    const requestId = 'audio-contract';
    const request = Buffer.from(requestId, 'utf8');
    const audio = Buffer.from([0, 1, 2, 3]);
    const frame = audioFrame(requestId, audio);

    assert.equal(frame.readUInt32BE(0), frame.byteLength - 5);
    assert.equal(frame[4], 2);
    assert.equal(frame[6], 1);
    assert.equal(frame.readUInt32BE(7), 0);
    assert.equal(frame.readUInt16BE(11), request.byteLength);
    assert.deepEqual(frame.subarray(13, 13 + request.byteLength), request);
    assert.deepEqual(frame.subarray(13 + request.byteLength), audio);
  });
});
