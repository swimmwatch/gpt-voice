import { hasLocalWhisperControlCharacter } from '@shared/localWhisper';

import {
  createLocalWhisperRegistryFingerprint,
  type LocalWhisperDeviceRegistry,
  type LocalWhisperDeviceRegistryEntry,
} from '../supervisor/LocalWhisperDeviceAuthority';
import type {
  LocalWhisperOwnedWorkerProcess,
  LocalWhisperWorkerLaunchAuthority,
  WorkerProcessOwnership,
} from '../supervisor/WorkerProcessOwnership';
import { LocalWhisperRuntimeRegistryDiscoveryError } from './LocalWhisperRuntimeRegistryDiscoveryError';
import { NativeRuntimeLogStreamDecoder, type NativeRuntimeLogRelay } from '../supervisor/NativeRuntimeLogStreamDecoder';

export { LocalWhisperRuntimeRegistryDiscoveryError } from './LocalWhisperRuntimeRegistryDiscoveryError';

const REGISTRY_DISCOVERY_TIMEOUT_MS = 30_000;
const REGISTRY_TERMINATION_TIMEOUT_MS = 5_000;
const MAX_REGISTRY_OUTPUT_BYTES = 128 * 1024;
const MAX_REGISTRY_ENTRIES = 256;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PCI_IDENTITY_PATTERN = /^(?:[a-f0-9]{4}|[a-f0-9]{8}):[a-f0-9]{2}:[a-f0-9]{2}\.[0-7]$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function parseEntry(value: unknown, backendId: string, expectedOrdinal: number): LocalWhisperDeviceRegistryEntry {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['ordinal', 'type', 'backendId', 'nativeIdentity']) ||
    value.ordinal !== expectedOrdinal ||
    (value.type !== 'gpu' && value.type !== 'igpu') ||
    value.backendId !== backendId ||
    typeof value.nativeIdentity !== 'string' ||
    !PCI_IDENTITY_PATTERN.test(value.nativeIdentity)
  ) {
    throw new LocalWhisperRuntimeRegistryDiscoveryError('DEVICE_PROOF_FAILED');
  }
  return Object.freeze({
    ordinal: expectedOrdinal,
    type: value.type,
    backendId,
    nativeIdentity: value.nativeIdentity,
  });
}

function parseRegistry(text: string, authority: LocalWhisperWorkerLaunchAuthority): LocalWhisperDeviceRegistry {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new LocalWhisperRuntimeRegistryDiscoveryError('DEVICE_PROOF_FAILED');
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schemaVersion', 'engineId', 'runtimeBuildDigest', 'backendId', 'entries']) ||
    value.schemaVersion !== 1 ||
    value.engineId !== authority.expectedHandshake.engine ||
    value.runtimeBuildDigest !== authority.expectedHandshake.runtimeBuildDigest ||
    typeof value.runtimeBuildDigest !== 'string' ||
    !SHA256_PATTERN.test(value.runtimeBuildDigest) ||
    value.backendId !== authority.expectedHandshake.backend ||
    typeof value.backendId !== 'string' ||
    hasLocalWhisperControlCharacter(value.backendId) ||
    !Array.isArray(value.entries) ||
    value.entries.length > MAX_REGISTRY_ENTRIES
  ) {
    throw new LocalWhisperRuntimeRegistryDiscoveryError('DEVICE_PROOF_FAILED');
  }
  if (
    (value.backendId === 'cpu' && value.entries.length !== 0) ||
    (value.backendId !== 'cpu' && value.entries.length === 0)
  ) {
    throw new LocalWhisperRuntimeRegistryDiscoveryError(
      value.backendId === 'cpu' ? 'DEVICE_PROOF_FAILED' : 'DEVICE_NOT_FOUND',
    );
  }
  const entries = Object.freeze(
    value.entries.map((entry, index) => parseEntry(entry, value.backendId as string, index)),
  );
  const registry = Object.freeze({
    engineId: authority.expectedHandshake.engine,
    runtimeBuildDigest: authority.expectedHandshake.runtimeBuildDigest,
    backendId: value.backendId,
    entries,
  });
  createLocalWhisperRegistryFingerprint(registry);
  return registry;
}

function collectOutput(process: LocalWhisperOwnedWorkerProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const fail = (): void => reject(new LocalWhisperRuntimeRegistryDiscoveryError('DEVICE_PROOF_FAILED'));
    process.output.on('data', (chunk: Buffer) => {
      if (!(chunk instanceof Buffer)) {
        fail();
        return;
      }
      total += chunk.byteLength;
      if (total > MAX_REGISTRY_OUTPUT_BYTES) {
        fail();
        return;
      }
      chunks.push(chunk);
    });
    process.output.once('error', fail);
    process.output.once('end', () => {
      const bytes = Buffer.concat(chunks);
      if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] !== 0x0a) {
        fail();
        return;
      }
      const body = bytes.subarray(0, -1);
      if (body.includes(0x0a) || body.includes(0x0d) || body.includes(0)) {
        fail();
        return;
      }
      resolve(body.toString('utf8'));
    });
  });
}

/** Runs exact registry enumeration inside a one-use authenticated runtime worker. */
export class LocalWhisperRuntimeRegistryDiscovery {
  private active = false;
  private disposed = false;

  public constructor(
    private readonly ownership: WorkerProcessOwnership,
    private readonly nativeRuntimeLogRelay?: NativeRuntimeLogRelay,
  ) {}

  public async discover(
    authority: LocalWhisperWorkerLaunchAuthority,
    signal: AbortSignal,
  ): Promise<LocalWhisperDeviceRegistry> {
    if (this.disposed || this.active || authority.launchMode !== 'registry') {
      await authority.runtimeLease.release().catch(() => undefined);
      throw new LocalWhisperRuntimeRegistryDiscoveryError('OPERATION_CONFLICT');
    }
    if (signal.aborted) {
      await authority.runtimeLease.release().catch(() => undefined);
      throw new LocalWhisperRuntimeRegistryDiscoveryError('CANCELLED');
    }
    this.active = true;
    let process: LocalWhisperOwnedWorkerProcess | null = null;
    let exited = false;
    try {
      process = await this.ownership.launch(authority);
      const nativeLogDecoder = this.nativeRuntimeLogRelay
        ? new NativeRuntimeLogStreamDecoder({
            expectedProcessInstanceId: process.nativeRuntimeProcessInstanceId,
            onRecord: (record) => this.nativeRuntimeLogRelay?.accept(record),
          })
        : null;
      if (nativeLogDecoder) {
        process.stderr.on('data', (chunk: Buffer) => nativeLogDecoder.append(chunk));
        process.stderr.once('end', () => nativeLogDecoder.finish());
      } else {
        process.stderr.resume();
      }
      const output = collectOutput(process).then(
        (value) => Object.freeze({ success: true as const, value }),
        (error: unknown) => Object.freeze({ success: false as const, error }),
      );
      const abort = (): void => {
        void process?.requestTreeTermination().catch(() => undefined);
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        exited = await process.waitForExit(REGISTRY_DISCOVERY_TIMEOUT_MS);
      } finally {
        signal.removeEventListener('abort', abort);
      }
      if (!exited) {
        await process.requestTreeTermination().catch(() => undefined);
        exited = await process.waitForExit(REGISTRY_TERMINATION_TIMEOUT_MS).catch(() => false);
      }
      if (!exited) {
        process.closeOwnershipControl();
        await process.forceTreeTermination().catch(() => undefined);
        exited = await process.waitForExit(REGISTRY_TERMINATION_TIMEOUT_MS).catch(() => false);
      }
      if (!exited) {
        this.ownership.retainFailedOwnership();
        throw new LocalWhisperRuntimeRegistryDiscoveryError('CLEANUP_FAILED');
      }
      await this.ownership.releaseAfterConfirmedExit();
      if (signal.aborted) throw new LocalWhisperRuntimeRegistryDiscoveryError('CANCELLED');
      const collected = await output;
      if (!collected.success) throw collected.error;
      return parseRegistry(collected.value, authority);
    } catch (error) {
      if (process && exited) await this.ownership.releaseAfterConfirmedExit().catch(() => undefined);
      if (!process && !authority.runtimeLease.released) {
        await authority.runtimeLease.release().catch(() => undefined);
      }
      if (error instanceof LocalWhisperRuntimeRegistryDiscoveryError) throw error;
      throw new LocalWhisperRuntimeRegistryDiscoveryError('WORKER_START_FAILED');
    } finally {
      this.active = false;
    }
  }

  public dispose(): void {
    this.disposed = true;
  }
}
