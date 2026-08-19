import type { HostResourceSample } from './HostResourceAvailability';
import { HostMemoryAvailability, type HostMemoryAvailabilityDependencies } from './HostMemoryAvailability';

/** Samples Windows memory through the injected Node OS adapter. */
export class WindowsHostMemoryAvailability extends HostMemoryAvailability {
  public constructor(dependencies: HostMemoryAvailabilityDependencies) {
    super(dependencies.fallbackMemoryBytes);
  }

  public sample(): HostResourceSample {
    return this.fallbackSample();
  }
}
