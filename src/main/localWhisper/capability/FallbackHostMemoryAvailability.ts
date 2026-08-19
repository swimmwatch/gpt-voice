import type { HostResourceSample } from './HostResourceAvailability';
import { HostMemoryAvailability, type HostMemoryAvailabilityDependencies } from './HostMemoryAvailability';

/** Preserves the generic OS-memory fallback on hosts where Local Whisper is deferred. */
export class FallbackHostMemoryAvailability extends HostMemoryAvailability {
  public constructor(dependencies: HostMemoryAvailabilityDependencies) {
    super(dependencies.fallbackMemoryBytes);
  }

  public sample(): HostResourceSample {
    return this.fallbackSample();
  }
}
