const LINUX_MEMINFO_PATH = '/proc/meminfo';
const KIBIBYTE_BYTES = 1024;
const LINUX_MEM_AVAILABLE_PATTERN = /^MemAvailable:\s+(\d+)\s+kB\s*$/mu;

export interface HostMemoryAvailabilityDependencies {
  readonly platform: NodeJS.Platform;
  readonly readFile: (filePath: string, encoding: BufferEncoding) => string;
  readonly fallbackMemoryBytes: () => number;
}

/** Samples RAM available to a new process without exposing host details to the renderer. */
export class HostMemoryAvailability {
  public constructor(private readonly dependencies: HostMemoryAvailabilityDependencies) {}

  public sample(): number {
    if (this.dependencies.platform === 'linux') {
      try {
        const availableBytes = this.readLinuxMemAvailableBytes(this.dependencies.readFile(LINUX_MEMINFO_PATH, 'utf8'));
        if (availableBytes !== null) return availableBytes;
      } catch {
        // Fall through to the platform fallback when procfs is unavailable.
      }
    }
    return this.fallbackMemoryBytes();
  }

  private readLinuxMemAvailableBytes(contents: string): number | null {
    const match = LINUX_MEM_AVAILABLE_PATTERN.exec(contents);
    if (!match?.[1]) return null;
    const kibibytes = Number(match[1]);
    if (!Number.isSafeInteger(kibibytes) || kibibytes < 0) return null;
    const bytes = kibibytes * KIBIBYTE_BYTES;
    return Number.isSafeInteger(bytes) ? bytes : null;
  }

  private fallbackMemoryBytes(): number {
    try {
      const bytes = Math.trunc(this.dependencies.fallbackMemoryBytes());
      return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : 0;
    } catch {
      return 0;
    }
  }
}
