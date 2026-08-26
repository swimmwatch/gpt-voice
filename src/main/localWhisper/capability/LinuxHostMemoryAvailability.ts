import type { HostResourceSample } from './HostResourceAvailability';
import { HostMemoryAvailability } from './HostMemoryAvailability';

const LINUX_MEMINFO_PATH = '/proc/meminfo';
const KIBIBYTE_BYTES = 1024;
const LINUX_MEM_AVAILABLE_PATTERN = /^MemAvailable:\s+(\d+)\s+kB\s*$/mu;

export interface LinuxHostMemoryAvailabilityDependencies {
  readonly readFile: (filePath: string, encoding: BufferEncoding) => string;
  readonly fallbackMemoryBytes: () => number;
}

/** Samples Linux MemAvailable and falls back to the injected OS memory source. */
export class LinuxHostMemoryAvailability extends HostMemoryAvailability {
  public constructor(private readonly dependencies: LinuxHostMemoryAvailabilityDependencies) {
    super(dependencies.fallbackMemoryBytes);
  }

  public sample(): HostResourceSample {
    try {
      const availableBytes = this.readLinuxMemAvailableBytes(this.dependencies.readFile(LINUX_MEMINFO_PATH, 'utf8'));
      if (availableBytes !== null) return this.available(availableBytes);
    } catch {
      // Fall through to the platform fallback when procfs is unavailable.
    }
    return this.fallbackSample();
  }

  private readLinuxMemAvailableBytes(contents: string): number | null {
    const match = LINUX_MEM_AVAILABLE_PATTERN.exec(contents);
    if (!match?.[1]) return null;
    const kibibytes = Number(match[1]);
    if (!Number.isSafeInteger(kibibytes) || kibibytes < 0) return null;
    const bytes = kibibytes * KIBIBYTE_BYTES;
    return Number.isSafeInteger(bytes) ? bytes : null;
  }
}
