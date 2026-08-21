import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it } from 'node:test';

import { encodeWorkerControlFrame } from '../../../scripts/local-whisper/worker-control-frame.mjs';

describe('worker control frame fixture', () => {
  it('encodes the production length, kind, and compact JSON body', () => {
    const frame = encodeWorkerControlFrame({ type: 'hello', protocolVersion: 1 });
    const body = Buffer.from('{"type":"hello","protocolVersion":1}', 'utf8');

    assert.equal(frame.readUInt32BE(0), body.byteLength);
    assert.equal(frame[4], 1);
    assert.deepEqual(frame.subarray(5), body);
  });
});
