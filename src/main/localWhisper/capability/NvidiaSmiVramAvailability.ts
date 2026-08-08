import { NvidiaSmiExecutableResolver, type NvidiaSmiCommandPort } from './NvidiaSmiHostInventory';

const NVIDIA_PCI_IDENTITY_PATTERN = /^(?:[\da-f]{4}|[\da-f]{8}):[\da-f]{2}:[\da-f]{2}\.[0-7]$/iu;
const NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS = 32;
const MEBIBYTE_BYTES = 1024 ** 2;

export type { NvidiaSmiCommandPort } from './NvidiaSmiHostInventory';

export interface NvidiaSmiVramAvailabilityDependencies {
  readonly platform: NodeJS.Platform;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly pathExists: (filePath: string) => boolean;
  readonly command: NvidiaSmiCommandPort;
}

/** Reads one selected NVIDIA device's free VRAM without using a shell or renderer-visible device identity. */
export class NvidiaSmiVramAvailability {
  private readonly executable: NvidiaSmiExecutableResolver;

  public constructor(private readonly dependencies: NvidiaSmiVramAvailabilityDependencies) {
    this.executable = new NvidiaSmiExecutableResolver(dependencies);
  }

  public async sample(nativeIdentity: string): Promise<number | null> {
    if (!NVIDIA_PCI_IDENTITY_PATTERN.test(nativeIdentity)) return null;
    const executablePath = this.executable.resolve();
    if (!executablePath) return null;
    try {
      const output = await this.dependencies.command.run(executablePath, [
        `--id=${nativeIdentity}`,
        '--query-gpu=memory.free',
        '--format=csv,noheader,nounits',
      ]);
      const normalized = output.trim();
      if (
        normalized.length === 0 ||
        normalized.length > NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS ||
        !/^\d+$/u.test(normalized)
      ) {
        return null;
      }
      const mebibytes = Number(normalized);
      const bytes = mebibytes * MEBIBYTE_BYTES;
      return Number.isSafeInteger(bytes) ? bytes : null;
    } catch {
      return null;
    }
  }
}
