export enum HostResourcePlatform {
  Linux = 'linux',
  Windows = 'win32',
  Other = 'other',
}

export enum HostResourceKind {
  Ram = 'ram',
  Vram = 'vram',
}

export enum HostResourceAvailabilityStatus {
  Available = 'available',
  Unavailable = 'unavailable',
}

export enum HostResourceUnavailableReason {
  CommandFailed = 'command-failed',
  InvalidRequest = 'invalid-request',
  InvalidValue = 'invalid-value',
  SourceUnavailable = 'source-unavailable',
  UnsupportedPlatform = 'unsupported-platform',
}

export type HostResourceSample =
  | {
      readonly status: HostResourceAvailabilityStatus.Available;
      readonly bytes: number;
    }
  | {
      readonly status: HostResourceAvailabilityStatus.Unavailable;
      readonly reason: HostResourceUnavailableReason;
    };

const HOST_RESOURCE_PLATFORM_BY_NODE_PLATFORM: Readonly<Record<string, HostResourcePlatform>> = Object.freeze({
  [HostResourcePlatform.Linux]: HostResourcePlatform.Linux,
  [HostResourcePlatform.Windows]: HostResourcePlatform.Windows,
});

export function resolveHostResourcePlatform(platform: NodeJS.Platform): HostResourcePlatform {
  return HOST_RESOURCE_PLATFORM_BY_NODE_PLATFORM[platform] ?? HostResourcePlatform.Other;
}

/** Owns the common result validation for one host-resource sampling strategy. */
export abstract class HostResourceAvailability<
  TRequest,
  TSample extends HostResourceSample | Promise<HostResourceSample>,
> {
  protected constructor(public readonly kind: HostResourceKind) {}

  public abstract sample(request: TRequest): TSample;

  protected available(bytes: number): HostResourceSample {
    return Number.isSafeInteger(bytes) && bytes >= 0
      ? Object.freeze({ status: HostResourceAvailabilityStatus.Available, bytes })
      : this.unavailable(HostResourceUnavailableReason.InvalidValue);
  }

  protected unavailable(reason: HostResourceUnavailableReason): HostResourceSample {
    return Object.freeze({ status: HostResourceAvailabilityStatus.Unavailable, reason });
  }
}

export function availableHostResourceBytes(sample: HostResourceSample): number | null {
  return sample.status === HostResourceAvailabilityStatus.Available ? sample.bytes : null;
}
