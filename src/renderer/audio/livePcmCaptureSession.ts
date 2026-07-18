import { LivePcmPipeline, type LivePcmFinishResult } from './livePcmPipeline';

export interface LivePcmCaptureCallbacks {
  onError?: (error: unknown) => void;
  onFrame: (frame: Uint8Array) => void;
}

export interface LivePcmCaptureResources {
  readonly inputSampleRate: number;
  close(): Promise<void>;
  disconnect(): void;
  setMessageHandler(handler: ((message: unknown) => void) | null): void;
  stopTracks(): void;
}

/** Owns one worklet capture operation and makes cleanup idempotent. */
export class LivePcmCaptureSession {
  private readonly resources: LivePcmCaptureResources;
  private readonly callbacks: LivePcmCaptureCallbacks;
  private readonly pipeline: LivePcmPipeline;
  private active = true;
  private releasePromise: Promise<void> | null = null;

  constructor(resources: LivePcmCaptureResources, callbacks: LivePcmCaptureCallbacks) {
    this.resources = resources;
    this.callbacks = callbacks;
    this.pipeline = new LivePcmPipeline(resources.inputSampleRate);
    resources.setMessageHandler((message) => this.handleMessage(message));
  }

  pause(): void {
    if (!this.active) return;
    this.pipeline.pause();
  }

  resume(): void {
    if (!this.active) return;
    this.pipeline.resume();
  }

  async finish(): Promise<LivePcmFinishResult> {
    if (!this.active) {
      throw new Error('PCM capture is no longer active');
    }
    this.active = false;
    try {
      const result = this.pipeline.finish();
      for (const frame of result.frames) this.callbacks.onFrame(frame);
      return result;
    } finally {
      await this.releaseResources();
    }
  }

  async cancel(): Promise<void> {
    if (this.active) {
      this.active = false;
      this.pipeline.cancel();
    }
    await this.releaseResources();
  }

  private handleMessage(message: unknown): void {
    if (!this.active) return;
    const channels = readSampleChannels(message);
    if (!channels) return;

    try {
      for (const frame of this.pipeline.pushChannels(channels)) this.callbacks.onFrame(frame);
    } catch (error: unknown) {
      try {
        this.callbacks.onError?.(error);
      } finally {
        void this.cancel();
      }
    }
  }

  private releaseResources(): Promise<void> {
    if (this.releasePromise) return this.releasePromise;

    runCleanup(() => this.resources.setMessageHandler(null));
    runCleanup(() => this.resources.disconnect());
    runCleanup(() => this.resources.stopTracks());
    this.releasePromise = Promise.resolve()
      .then(() => this.resources.close())
      .catch(() => undefined);
    return this.releasePromise;
  }
}

function readSampleChannels(message: unknown): Float32Array[] | null {
  if (!isRecord(message) || message.type !== 'samples' || !Array.isArray(message.channels)) return null;
  if (message.channels.length === 0) return null;

  const channels: Float32Array[] = [];
  for (const channel of message.channels) {
    if (!(channel instanceof Float32Array)) return null;
    channels.push(channel.slice());
  }
  return channels;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function runCleanup(action: () => void): void {
  try {
    action();
  } catch {
    // Continue releasing the remaining operation-owned resources.
  }
}
