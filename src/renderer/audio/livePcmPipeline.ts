import { PcmFrameAccumulator } from './pcmFrameAccumulator';
import {
  LIVE_PCM_CHANNELS,
  LIVE_PCM_SAMPLE_RATE_HZ,
  concatenatePcmChunks,
  encodePcm16Samples,
  encodePcm16WavBytes,
  mixChannelsToMono,
} from './pcm16';
import { StreamingLinearResampler } from './streamingLinearResampler';

export interface LivePcmFinishResult {
  frames: Uint8Array[];
  finalChunk: Uint8Array;
  recordingWav: ArrayBuffer;
}

type LivePcmPipelineState = 'active' | 'paused' | 'finished' | 'cancelled';

/** Operation-local PCM pipeline with explicit pause, finish, and cancellation state. */
export class LivePcmPipeline {
  private readonly resampler: StreamingLinearResampler;
  private readonly framer = new PcmFrameAccumulator();
  private retainedChunks: Uint8Array[] = [];
  private state: LivePcmPipelineState = 'active';

  constructor(inputSampleRate: number) {
    this.resampler = new StreamingLinearResampler(inputSampleRate, LIVE_PCM_SAMPLE_RATE_HZ);
  }

  pushChannels(channels: readonly Float32Array[]): Uint8Array[] {
    if (this.state === 'paused' || this.state === 'cancelled') return [];
    if (this.state === 'finished') {
      throw new Error('Cannot add PCM after finish');
    }

    const frames = this.framer.push(encodePcm16Samples(this.resampler.push(mixChannelsToMono(channels))));
    this.retain(frames);
    return frames;
  }

  pause(): void {
    if (this.state === 'active') this.state = 'paused';
  }

  resume(): void {
    if (this.state === 'paused') this.state = 'active';
  }

  finish(): LivePcmFinishResult {
    if (this.state === 'cancelled') {
      throw new Error('Cannot finish cancelled PCM capture');
    }
    if (this.state === 'finished') {
      throw new Error('PCM capture is already finished');
    }

    const frames = this.framer.push(encodePcm16Samples(this.resampler.flush()));
    this.retain(frames);
    const finalChunk = this.framer.flush();
    if (finalChunk.byteLength > 0) this.retain([finalChunk]);

    const pcm = concatenatePcmChunks(this.retainedChunks);
    this.retainedChunks = [];
    this.state = 'finished';
    return {
      frames,
      finalChunk,
      recordingWav: encodePcm16WavBytes(pcm, LIVE_PCM_SAMPLE_RATE_HZ, LIVE_PCM_CHANNELS),
    };
  }

  cancel(): void {
    if (this.state === 'cancelled') return;
    this.state = 'cancelled';
    this.resampler.cancel();
    this.framer.cancel();
    this.retainedChunks = [];
  }

  get retainedPcmByteLength(): number {
    return this.retainedChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  }

  private retain(chunks: readonly Uint8Array[]): void {
    this.retainedChunks.push(...chunks.map((chunk) => chunk.slice()));
  }
}
