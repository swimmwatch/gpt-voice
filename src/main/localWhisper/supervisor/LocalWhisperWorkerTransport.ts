import type { Readable, Writable } from 'node:stream';

import {
  encodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  isLocalWhisperWorkerClientMessage,
  isLocalWhisperWorkerServerMessage,
  type LocalWhisperWorkerAudioChunk,
  type LocalWhisperWorkerClientMessage,
  type LocalWhisperWorkerServerMessage,
} from '@shared/localWhisper';

import { LocalWhisperFrameCodec } from './LocalWhisperFrameCodec';
import {
  LOCAL_WHISPER_MAX_FRAMES_PER_CHUNK,
  LOCAL_WHISPER_MAX_OUTGOING_QUEUE_BYTES,
} from './LocalWhisperSupervisorConstants';

export type LocalWhisperTransportTerminalCause = 'inputClosed' | 'protocolViolation' | 'streamError';

export interface LocalWhisperWorkerTransportStreams {
  readonly input: Writable;
  readonly output: Readable;
}

export interface LocalWhisperWorkerTransportCallbacks {
  readonly onMessage: (message: LocalWhisperWorkerServerMessage) => void;
  readonly onTerminal: (cause: LocalWhisperTransportTerminalCause) => void;
}

/** Owns bounded framed worker I/O and serializes writes to preserve backpressure. */
export class LocalWhisperWorkerTransport {
  private readonly codec = new LocalWhisperFrameCodec();
  private disposed = false;
  private terminal = false;
  private queuedBytes = 0;
  private writeChain: Promise<void> = Promise.resolve();

  public constructor(
    private readonly streams: LocalWhisperWorkerTransportStreams,
    private readonly callbacks: LocalWhisperWorkerTransportCallbacks,
  ) {
    streams.output.on('data', this.onData);
    streams.output.once('end', this.onEnd);
    streams.output.once('error', this.onOutputError);
    streams.input.once('error', this.onInputError);
  }

  public sendControl(message: LocalWhisperWorkerClientMessage): Promise<void> {
    if (!isLocalWhisperWorkerClientMessage(message)) {
      return Promise.reject(new Error('Invalid Local Whisper client message'));
    }
    return this.enqueue(encodeLocalWhisperControlFrame(message));
  }

  public sendAudio(chunk: LocalWhisperWorkerAudioChunk): Promise<void> {
    return this.enqueue(encodeLocalWhisperAudioFrame(chunk));
  }

  public async endInput(): Promise<void> {
    await this.writeChain;
    if (this.disposed || this.streams.input.destroyed) return;
    await new Promise<void>((resolve) => this.streams.input.end(resolve));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.streams.output.off('data', this.onData);
    this.streams.output.off('end', this.onEnd);
    this.streams.output.off('error', this.onOutputError);
    this.streams.input.off('error', this.onInputError);
    this.codec.reset();
  }

  public get outgoingQueueBytes(): number {
    return this.queuedBytes;
  }

  private enqueue(frame: Uint8Array): Promise<void> {
    if (this.disposed || this.terminal) {
      return Promise.reject(new Error('Local Whisper transport is closed'));
    }
    if (this.queuedBytes + frame.byteLength > LOCAL_WHISPER_MAX_OUTGOING_QUEUE_BYTES) {
      return Promise.reject(new Error('Local Whisper outgoing queue exceeded'));
    }
    this.queuedBytes += frame.byteLength;
    const operation = this.writeChain.then(() => this.write(frame));
    this.writeChain = operation.catch(() => undefined);
    return operation.finally(() => {
      this.queuedBytes -= frame.byteLength;
    });
  }

  private write(frame: Uint8Array): Promise<void> {
    if (this.disposed || this.terminal || this.streams.input.destroyed) {
      return Promise.reject(new Error('Local Whisper transport is closed'));
    }
    return new Promise<void>((resolve, reject) => {
      this.streams.input.write(frame, (error) => {
        if (error) {
          reject(new Error('Local Whisper worker input failed'));
          return;
        }
        resolve();
      });
    });
  }

  private readonly onData = (chunk: Buffer): void => {
    if (this.disposed || this.terminal) return;
    try {
      const frames = this.codec.push(chunk);
      if (frames.length > LOCAL_WHISPER_MAX_FRAMES_PER_CHUNK) {
        throw new Error('Local Whisper stdout frame flood');
      }
      for (const frame of frames) {
        if (frame.kind !== 'control' || !isLocalWhisperWorkerServerMessage(frame.message)) {
          throw new Error('Unexpected Local Whisper worker frame');
        }
        this.callbacks.onMessage(frame.message);
      }
    } catch {
      this.finish('protocolViolation');
    }
  };

  private readonly onEnd = (): void => {
    if (this.disposed || this.terminal) return;
    try {
      this.codec.finish();
      this.finish('inputClosed');
    } catch {
      this.finish('protocolViolation');
    }
  };

  private readonly onOutputError = (): void => this.finish('streamError');
  private readonly onInputError = (): void => this.finish('streamError');

  private finish(cause: LocalWhisperTransportTerminalCause): void {
    if (this.terminal || this.disposed) return;
    this.terminal = true;
    this.callbacks.onTerminal(cause);
  }
}
