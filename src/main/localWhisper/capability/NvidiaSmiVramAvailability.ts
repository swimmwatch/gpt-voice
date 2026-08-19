import {
  availableHostResourceBytes,
  HostResourceAvailability,
  HostResourceKind,
  HostResourceUnavailableReason,
  type HostResourceSample,
} from './HostResourceAvailability';
import { NvidiaSmiExecutableResolver, type NvidiaSmiCommandPort } from './NvidiaSmiHostInventory';

const NVIDIA_PCI_IDENTITY_PATTERN = /^(?:[\da-f]{4}|[\da-f]{8}):[\da-f]{2}:[\da-f]{2}\.[0-7]$/iu;
const NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS = 32;
const MEBIBYTE_BYTES = 1024 ** 2;

/** Reads one selected NVIDIA device's free VRAM without using a shell or renderer-visible device identity. */
export class NvidiaSmiVramAvailability extends HostResourceAvailability<string, Promise<HostResourceSample>> {
  public constructor(
    private readonly command: NvidiaSmiCommandPort,
    private readonly executable: NvidiaSmiExecutableResolver,
  ) {
    super(HostResourceKind.Vram);
  }

  public async sample(nativeIdentity: string): Promise<HostResourceSample> {
    if (!NVIDIA_PCI_IDENTITY_PATTERN.test(nativeIdentity)) {
      return this.unavailable(HostResourceUnavailableReason.InvalidRequest);
    }
    const executablePath = this.executable.resolve();
    if (!executablePath) return this.unavailable(HostResourceUnavailableReason.SourceUnavailable);
    try {
      const output = await this.command.run(executablePath, [
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
        return this.unavailable(HostResourceUnavailableReason.InvalidValue);
      }
      const mebibytes = Number(normalized);
      const bytes = mebibytes * MEBIBYTE_BYTES;
      return this.available(bytes);
    } catch {
      return this.unavailable(HostResourceUnavailableReason.CommandFailed);
    }
  }

  public async availableBytes(nativeIdentity: string): Promise<number | null> {
    return availableHostResourceBytes(await this.sample(nativeIdentity));
  }
}
