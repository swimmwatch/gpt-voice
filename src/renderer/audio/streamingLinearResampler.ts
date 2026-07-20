const SOURCE_POSITION_EPSILON = 1e-9;

/** Stateful linear resampling whose output positions are independent of input block boundaries. */
export class StreamingLinearResampler {
  private readonly sourceSampleRate: number;
  private readonly targetSampleRate: number;
  private sourceSampleCount = 0;
  private outputSampleCount = 0;
  private previousSample = 0;
  private hasPreviousSample = false;
  private finished = false;

  constructor(sourceSampleRate: number, targetSampleRate: number) {
    if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
      throw new Error(`Invalid source sample rate: ${sourceSampleRate}`);
    }
    if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
      throw new Error(`Invalid target sample rate: ${targetSampleRate}`);
    }
    this.sourceSampleRate = sourceSampleRate;
    this.targetSampleRate = targetSampleRate;
  }

  push(samples: Float32Array): Float32Array {
    if (this.finished) {
      throw new Error('Cannot resample after flush');
    }
    if (samples.length === 0) return new Float32Array();

    const blockStart = this.sourceSampleCount;
    const lastSourceIndex = blockStart + samples.length - 1;
    const output: number[] = [];

    while (true) {
      const position = this.getNextSourcePosition();
      const { fraction, lowerIndex, upperIndex } = splitSourcePosition(position);
      if (lowerIndex > lastSourceIndex || upperIndex > lastSourceIndex) break;

      const lowerSample = this.readSample(lowerIndex, blockStart, samples);
      const upperSample = this.readSample(upperIndex, blockStart, samples);
      output.push(lowerSample + (upperSample - lowerSample) * fraction);
      this.outputSampleCount += 1;
    }

    this.sourceSampleCount += samples.length;
    this.previousSample = sanitizeSample(samples[samples.length - 1]);
    this.hasPreviousSample = true;
    return Float32Array.from(output);
  }

  flush(): Float32Array {
    if (this.finished) return new Float32Array();
    this.finished = true;
    if (!this.hasPreviousSample) return new Float32Array();

    const output: number[] = [];
    while (this.getNextSourcePosition() < this.sourceSampleCount - SOURCE_POSITION_EPSILON) {
      output.push(this.previousSample);
      this.outputSampleCount += 1;
    }
    return Float32Array.from(output);
  }

  cancel(): void {
    this.finished = true;
    this.sourceSampleCount = 0;
    this.outputSampleCount = 0;
    this.previousSample = 0;
    this.hasPreviousSample = false;
  }

  private getNextSourcePosition(): number {
    return (this.outputSampleCount * this.sourceSampleRate) / this.targetSampleRate;
  }

  private readSample(globalIndex: number, blockStart: number, samples: Float32Array): number {
    if (globalIndex === blockStart - 1 && this.hasPreviousSample) {
      return this.previousSample;
    }
    const localIndex = globalIndex - blockStart;
    if (localIndex < 0 || localIndex >= samples.length) {
      throw new Error('Resampler source position is outside the retained boundary');
    }
    return sanitizeSample(samples[localIndex]);
  }
}

function splitSourcePosition(position: number): { fraction: number; lowerIndex: number; upperIndex: number } {
  const nearestInteger = Math.round(position);
  if (Math.abs(position - nearestInteger) <= SOURCE_POSITION_EPSILON) {
    return { fraction: 0, lowerIndex: nearestInteger, upperIndex: nearestInteger };
  }
  const lowerIndex = Math.floor(position);
  return { fraction: position - lowerIndex, lowerIndex, upperIndex: lowerIndex + 1 };
}

function sanitizeSample(sample: number | undefined): number {
  return Number.isFinite(sample) ? (sample ?? 0) : 0;
}
