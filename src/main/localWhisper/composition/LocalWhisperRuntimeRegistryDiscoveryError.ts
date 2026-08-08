import type { LocalWhisperFailureCode } from '@shared/localWhisper';

/** Stable content-free failure from authenticated runtime registry discovery. */
export class LocalWhisperRuntimeRegistryDiscoveryError extends Error {
  public constructor(public readonly code: LocalWhisperFailureCode) {
    super(code);
    this.name = 'LocalWhisperRuntimeRegistryDiscoveryError';
  }
}
