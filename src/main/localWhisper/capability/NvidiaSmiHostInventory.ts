import { win32 as windowsPath } from 'node:path';

import type { LocalWhisperFailureCode } from '@shared/localWhisper';

const NVIDIA_PCI_IDENTITY_PATTERN = /^(?:[\da-f]{4}|[\da-f]{8}):[\da-f]{2}:[\da-f]{2}\.[0-7]$/iu;
const NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS = 4_096;
const NVIDIA_SMI_MAXIMUM_DEVICE_COUNT = 16;
const MEBIBYTE_BYTES = 1024 ** 2;

export interface NvidiaSmiCommandPort {
  run(executablePath: string, arguments_: readonly string[]): Promise<string>;
}

export interface NvidiaSmiExecutableResolverDependencies {
  readonly platform: NodeJS.Platform;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly pathExists: (filePath: string) => boolean;
}

export interface NvidiaSmiHostInventoryDependencies extends NvidiaSmiExecutableResolverDependencies {
  readonly command: NvidiaSmiCommandPort;
}

interface NvidiaDriverVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

interface NvidiaComputeCapability {
  readonly major: number;
  readonly minor: number;
}

/** Private, bounded host evidence. It must never cross the renderer/preload boundary. */
export interface NvidiaHostInventoryDevice {
  readonly nativeIdentity: string;
  readonly driverVersion: NvidiaDriverVersion;
  readonly computeCapability: NvidiaComputeCapability;
  readonly totalVramBytes: number;
  readonly available: true;
}

export type NvidiaHostInventoryResult =
  | { readonly available: true; readonly devices: readonly NvidiaHostInventoryDevice[] }
  | { readonly available: false; readonly reason: LocalWhisperFailureCode };

function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseDriverVersion(value: string): NvidiaDriverVersion | null {
  const match = /^(\d{1,4})\.(\d{1,4})(?:\.(\d{1,4}))?$/u.exec(value);
  if (!match) return null;
  const major = parseNonNegativeInteger(match[1]);
  const minor = parseNonNegativeInteger(match[2]);
  const patch = parseNonNegativeInteger(match[3] ?? '0');
  if (major === null || minor === null || patch === null) return null;
  return Object.freeze({ major, minor, patch });
}

function parseComputeCapability(value: string): NvidiaComputeCapability | null {
  const match = /^(\d{1,2})\.(\d{1,2})$/u.exec(value);
  if (!match) return null;
  const major = parseNonNegativeInteger(match[1]);
  const minor = parseNonNegativeInteger(match[2]);
  if (major === null || minor === null) return null;
  return Object.freeze({ major, minor });
}

function parseDevice(line: string): NvidiaHostInventoryDevice | null {
  const fields = line.split(',').map((field) => field.trim());
  if (fields.length !== 4) return null;
  const [nativeIdentity, capability, driver, totalMebibytes] = fields;
  if (!nativeIdentity || !NVIDIA_PCI_IDENTITY_PATTERN.test(nativeIdentity)) return null;
  const computeCapability = parseComputeCapability(capability ?? '');
  const driverVersion = parseDriverVersion(driver ?? '');
  const mebibytes = parseNonNegativeInteger(totalMebibytes ?? '');
  const totalVramBytes = mebibytes === null ? null : mebibytes * MEBIBYTE_BYTES;
  if (
    computeCapability === null ||
    driverVersion === null ||
    totalVramBytes === null ||
    !Number.isSafeInteger(totalVramBytes) ||
    totalVramBytes <= 0
  ) {
    return null;
  }
  return Object.freeze({
    nativeIdentity: nativeIdentity.toLowerCase(),
    computeCapability,
    driverVersion,
    totalVramBytes,
    available: true,
  });
}

function unavailable(reason: LocalWhisperFailureCode): NvidiaHostInventoryResult {
  return Object.freeze({ available: false, reason });
}

/** Resolves only reviewed system-owned NVIDIA management executable locations. */
export class NvidiaSmiExecutableResolver {
  public constructor(private readonly dependencies: NvidiaSmiExecutableResolverDependencies) {}

  public resolve(): string | null {
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

/** Obtains one fail-closed, shell-free NVIDIA inventory before CUDA runtime acquisition. */
export class NvidiaSmiHostInventory {
  private readonly executable: NvidiaSmiExecutableResolver;

  public constructor(private readonly dependencies: NvidiaSmiHostInventoryDependencies) {
    this.executable = new NvidiaSmiExecutableResolver(dependencies);
  }

  public async read(): Promise<NvidiaHostInventoryResult> {
    const executablePath = this.executable.resolve();
    if (!executablePath) return unavailable('DEVICE_NOT_FOUND');
    try {
      const output = await this.dependencies.command.run(executablePath, [
        '--query-gpu=pci.bus_id,compute_cap,driver_version,memory.total',
        '--format=csv,noheader,nounits',
      ]);
      if (output.length === 0 || output.length > NVIDIA_SMI_MAXIMUM_OUTPUT_CHARACTERS) {
        return unavailable('DEVICE_NOT_FOUND');
      }
      const lines = output.trim().split('\n');
      if (lines.length === 0 || lines.length > NVIDIA_SMI_MAXIMUM_DEVICE_COUNT) return unavailable('DEVICE_NOT_FOUND');
      const devices = lines.map((line) => parseDevice(line));
      if (devices.some((device) => device === null)) return unavailable('DEVICE_NOT_FOUND');
      const parsed = devices as NvidiaHostInventoryDevice[];
      const identities = parsed.map(({ nativeIdentity }) => nativeIdentity);
      if (
        new Set(identities).size !== identities.length ||
        identities.some((identity, index) => index > 0 && identity <= (identities[index - 1] ?? ''))
      ) {
        return unavailable('DEVICE_NOT_FOUND');
      }
      return Object.freeze({ available: true, devices: Object.freeze(parsed) });
    } catch {
      return unavailable('DEVICE_NOT_FOUND');
    }
  }
}
