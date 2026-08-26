import {
  LOCAL_WHISPER_AUDIO_FRAME_KIND,
  LOCAL_WHISPER_CONTROL_FRAME_KIND,
  LOCAL_WHISPER_FRAME_HEADER_BYTES,
  LOCAL_WHISPER_FRAME_LENGTH_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  decodeLocalWhisperAudioFrame,
  decodeLocalWhisperControlFrame,
  type LocalWhisperWorkerAudioChunk,
  type LocalWhisperWorkerControlMessage,
} from '@shared/localWhisper';

import { LOCAL_WHISPER_MAX_AUDIO_BODY_BYTES, LOCAL_WHISPER_MAX_FRAME_BYTES } from './LocalWhisperSupervisorConstants';

export type LocalWhisperDecodedFrame =
  | { readonly kind: 'control'; readonly message: LocalWhisperWorkerControlMessage }
  | { readonly kind: 'audio'; readonly chunk: LocalWhisperWorkerAudioChunk };

/** Incrementally extracts bounded complete frames without buffering whole audio. */
export class LocalWhisperFrameCodec {
  private pending = new Uint8Array();

  public push(chunk: Uint8Array): readonly LocalWhisperDecodedFrame[] {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) return Object.freeze([]);
    if (this.pending.byteLength + chunk.byteLength > LOCAL_WHISPER_MAX_FRAME_BYTES * 2) {
      throw new Error('Local Whisper incoming frame buffer exceeded');
    }
    const combined = new Uint8Array(this.pending.byteLength + chunk.byteLength);
    combined.set(this.pending);
    combined.set(chunk, this.pending.byteLength);
    this.pending = combined;

    const frames: LocalWhisperDecodedFrame[] = [];
    while (this.pending.byteLength >= LOCAL_WHISPER_FRAME_HEADER_BYTES) {
      const view = new DataView(this.pending.buffer, this.pending.byteOffset, this.pending.byteLength);
      const bodyLength = view.getUint32(0, false);
      const kind = view.getUint8(LOCAL_WHISPER_FRAME_LENGTH_BYTES);
      const maximumBodyLength =
        kind === LOCAL_WHISPER_CONTROL_FRAME_KIND
          ? LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES
          : kind === LOCAL_WHISPER_AUDIO_FRAME_KIND
            ? LOCAL_WHISPER_MAX_AUDIO_BODY_BYTES
            : null;
      if (maximumBodyLength === null) throw new Error('Unknown Local Whisper frame kind');
      if (bodyLength > maximumBodyLength) throw new Error('Oversized Local Whisper frame');
      const frameLength = LOCAL_WHISPER_FRAME_HEADER_BYTES + bodyLength;
      if (this.pending.byteLength < frameLength) break;
      const frame = this.pending.slice(0, frameLength);
      this.pending = this.pending.slice(frameLength);
      frames.push(
        kind === LOCAL_WHISPER_CONTROL_FRAME_KIND
          ? Object.freeze({ kind: 'control', message: decodeLocalWhisperControlFrame(frame) })
          : Object.freeze({ kind: 'audio', chunk: decodeLocalWhisperAudioFrame(frame) }),
      );
    }
    return Object.freeze(frames);
  }

  public finish(): void {
    if (this.pending.byteLength !== 0) throw new Error('Truncated Local Whisper frame stream');
  }

  public reset(): void {
    this.pending = new Uint8Array();
  }

  public get pendingByteLength(): number {
    return this.pending.byteLength;
  }
}
