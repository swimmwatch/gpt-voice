import { win32 as windowsPath } from 'node:path';

const NVIDIA_PCI_IDENTITY_PATTERN = /^[\da-f]{4}:[\da-f]{2}:[\da-f]{2}\.[0-7]$/iu;
const NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS = 32;
const MEBIBYTE_BYTES = 1024 ** 2;

export interface NvidiaSmiCommandPort {
  run(executablePath: string, arguments_: readonly string[]): Promise<string>;
}

export interface NvidiaSmiVramAvailabilityDependencies {
  readonly platform: NodeJS.Platform;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly pathExists: (filePath: string) => boolean;
  readonly command: NvidiaSmiCommandPort;
}

/** Reads one selected NVIDIA device's free VRAM without using a shell or renderer-visible device identity. */
export class NvidiaSmiVramAvailability {
  public constructor(private readonly dependencies: NvidiaSmiVramAvailabilityDependencies) {}

  public async sample(nativeIdentity: string): Promise<number | null> {
    if (!NVIDIA_PCI_IDENTITY_PATTERN.test(nativeIdentity)) return null;
    const executablePath = this.resolveExecutablePath();
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

  private resolveExecutablePath(): string | null {
    const candidates =
      this.dependencies.platform === 'linux'
        ? ['/usr/bin/nvidia-smi']
        : this.dependencies.platform === 'win32'
          ? this.windowsCandidates()
          : [];
    return candidates.find((candidate) => this.dependencies.pathExists(candidate)) ?? null;
  }

  private windowsCandidates(): readonly string[] {
    const windowsRoot = this.dependencies.environment.SystemRoot ?? this.dependencies.environment.WINDIR;
    const programFiles = this.dependencies.environment.ProgramW6432 ?? this.dependencies.environment.ProgramFiles;
    return Object.freeze([
      ...(windowsRoot ? [windowsPath.join(windowsRoot, 'System32', 'nvidia-smi.exe')] : []),
      ...(programFiles ? [windowsPath.join(programFiles, 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe')] : []),
    ]);
  }
}
