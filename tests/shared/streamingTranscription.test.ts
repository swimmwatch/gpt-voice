import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isStreamingTranscriptionOperationId,
  isStreamingTranscriptionPcmChunk,
  isStreamingTranscriptionRecordingWav,
  isStreamingTranscriptionSequence,
  MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES,
  STREAMING_TRANSCRIPTION_IPC_CHANNELS,
} from '@shared/streamingTranscription';

describe('streaming transcription shared IPC contract', () => {
  it('publishes the four exact IPC channel names', () => {
    assert.deepEqual(STREAMING_TRANSCRIPTION_IPC_CHANNELS, {
      start: 'start-streaming-transcription',
      sendChunk: 'send-streaming-transcription-chunk',
      finish: 'finish-streaming-transcription',
      cancel: 'cancel-streaming-transcription',
    });
  });

  it('accepts only canonical UUID operation IDs', () => {
    assert.equal(isStreamingTranscriptionOperationId('00000000-0000-4000-8000-000000000001'), true);
    assert.equal(isStreamingTranscriptionOperationId('01923e4a-7b5c-7123-8abc-1234567890ab'), true);
    assert.equal(isStreamingTranscriptionOperationId('00000000-0000-4000-8000-00000000001'), false);
    assert.equal(isStreamingTranscriptionOperationId('00000000-0000-4000-7000-000000000001'), false);
    assert.equal(isStreamingTranscriptionOperationId('00000000-0000-9000-8000-000000000001'), false);
    assert.equal(isStreamingTranscriptionOperationId('00000000-0000-4000-8000-00000000000A'), false);
    assert.equal(isStreamingTranscriptionOperationId(1), false);
  });

  it('validates non-negative safe integer sequences', () => {
    assert.equal(isStreamingTranscriptionSequence(0), true);
    assert.equal(isStreamingTranscriptionSequence(Number.MAX_SAFE_INTEGER), true);
    assert.equal(isStreamingTranscriptionSequence(-1), false);
    assert.equal(isStreamingTranscriptionSequence(0.5), false);
    assert.equal(isStreamingTranscriptionSequence(Number.MAX_SAFE_INTEGER + 1), false);
    assert.equal(isStreamingTranscriptionSequence('0'), false);
  });

  it('enforces normal and final PCM fragment boundaries', () => {
    assert.equal(isStreamingTranscriptionPcmChunk(new Uint8Array(0), false), false);
    assert.equal(isStreamingTranscriptionPcmChunk(new Uint8Array(0), true), true);
    assert.equal(isStreamingTranscriptionPcmChunk(new Uint8Array(1), true), false);
    assert.equal(isStreamingTranscriptionPcmChunk(new Uint8Array(2), false), true);
    assert.equal(
      isStreamingTranscriptionPcmChunk(new Uint8Array(MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES), false),
      true,
    );
    assert.equal(
      isStreamingTranscriptionPcmChunk(new Uint8Array(MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES + 2), false),
      false,
    );
    assert.equal(isStreamingTranscriptionPcmChunk(new ArrayBuffer(2), false), false);
  });

  it('accepts ArrayBuffer WAV values without imposing a size limit', () => {
    assert.equal(isStreamingTranscriptionRecordingWav(new ArrayBuffer(0)), true);
    assert.equal(isStreamingTranscriptionRecordingWav(new ArrayBuffer(1_000_000)), true);
    assert.equal(isStreamingTranscriptionRecordingWav(new Uint8Array(0)), false);
  });
});
