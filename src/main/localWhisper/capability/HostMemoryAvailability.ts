import {
  availableHostResourceBytes,
  HostResourceAvailability,
  HostResourceKind,
  HostResourceUnavailableReason,
  type HostResourceSample,
} from './HostResourceAvailability';

export interface HostMemoryAvailabilityDependencies {
  readonly fallbackMemoryBytes: () => number;
}

/** Samples RAM available to a new process without exposing host details to the renderer. */
export abstract class HostMemoryAvailability extends HostResourceAvailability<void, HostResourceSample> {
  protected constructor(private readonly fallbackMemoryBytes: () => number) {
    super(HostResourceKind.Ram);
  }

  public abstract sample(): HostResourceSample;

  public availableBytes(): number {
    return availableHostResourceBytes(this.sample()) ?? 0;
  }

  protected fallbackSample(): HostResourceSample {
    try {
      return this.available(Math.trunc(this.fallbackMemoryBytes()));
    } catch {
      return this.unavailable(HostResourceUnavailableReason.SourceUnavailable);
    }
  }
}
