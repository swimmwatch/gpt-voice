import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LOCAL_WHISPER_CONTROL_FRAME_KIND,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  encodeLocalWhisperControlFrame,
} from '@shared/localWhisper';
import { LocalWhisperFrameCodec } from '@main/localWhisper/supervisor/LocalWhisperFrameCodec';

const HELLO = { type: 'hello', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION } as const;

test('incremental codec handles fragmented and coalesced frames', () => {
  const frame = encodeLocalWhisperControlFrame(HELLO);
  const codec = new LocalWhisperFrameCodec();
  assert.deepEqual(codec.push(frame.subarray(0, 3)), []);
  assert.equal(codec.pendingByteLength, 3);
  const decoded = codec.push(frame.subarray(3));
  assert.equal(decoded.length, 1);
  assert.deepEqual(decoded[0], { kind: 'control', message: HELLO });

  const combined = new Uint8Array(frame.byteLength * 2);
  combined.set(frame);
  combined.set(frame, frame.byteLength);
  assert.equal(codec.push(combined).length, 2);
  codec.finish();
});

test('incremental codec rejects unknown, oversized, and truncated frames before allocation', () => {
  const unknown = new Uint8Array([0, 0, 0, 0, 0x7f]);
  assert.throws(() => new LocalWhisperFrameCodec().push(unknown), /Unknown/u);

  const oversized = new Uint8Array([0, 0x20, 0, 1, LOCAL_WHISPER_CONTROL_FRAME_KIND]);
  assert.throws(() => new LocalWhisperFrameCodec().push(oversized), /Oversized/u);

  const codec = new LocalWhisperFrameCodec();
  codec.push(encodeLocalWhisperControlFrame(HELLO).subarray(0, 6));
  assert.throws(() => codec.finish(), /Truncated/u);
});
