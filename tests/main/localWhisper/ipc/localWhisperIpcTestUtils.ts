/* eslint-disable max-classes-per-file -- Focused transport, authority, coordinator, and port fakes share one IPC harness. */
import type { IpcMainInvokeEvent } from 'electron';

import type {
  LocalWhisperArtifactRemovalRequest,
  LocalWhisperCoordinatorSnapshot,
  LocalWhisperSettingsTransaction,
} from '@main/localWhisper/coordinator/LocalWhisperCoordinatorTypes';
import type {
  LocalWhisperArtifactCommandPort,
  LocalWhisperArtifactReferencePort,
  LocalWhisperIpcCoordinatorPort,
  LocalWhisperIpcSenderAuthority,
  LocalWhisperIpcSenderCapability,
  LocalWhisperIpcTransport,
  LocalWhisperManagedFolderPort,
} from '@main/localWhisper/ipc/LocalWhisperIpcController';
import {
  LocalWhisperSnapshotService,
  type LocalWhisperSnapshotFacts,
} from '@main/localWhisper/ipc/LocalWhisperSnapshotService';
import { StaticLocalWhisperSnapshotFacts } from '@main/localWhisper/ipc/StaticLocalWhisperSnapshotFacts';
import {
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperSettingsCommand,
} from '@shared/localWhisper';

export function revision(value: string) {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid test revision');
  return result;
}

export function artifactId(value: string) {
  const result = toLocalWhisperArtifactId(value);
  if (!result) throw new Error('Invalid test artifact ID');
  return result;
}

export const RUNTIME_REVISION = revision('runtime-cpu-v1');
export const MODEL_REVISION = revision('model-base-v1');
export const CATALOG_REVISION = revision('catalog-v1');
export const RUNTIME_ARTIFACT_ID = artifactId('runtime-artifact-v1');
export const MODEL_ARTIFACT_ID = artifactId('model-artifact-v1');
export const NOTICE_ID = artifactId('notice-v1');
export const PROVENANCE_ID = artifactId('provenance-v1');

export function coordinatorSnapshot(
  overrides: Partial<LocalWhisperCoordinatorSnapshot> = {},
): LocalWhisperCoordinatorSnapshot {
  return Object.freeze({
    snapshotRevision: 1,
    epochs: Object.freeze({ provider: 0, configuration: 2, inventory: 3, topology: 0, capability: 0, worker: 0 }),
    configured: true,
    settings: Object.freeze({
      schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
      engine: 'whisperCpp',
      runtimeRevision: RUNTIME_REVISION,
      model: Object.freeze({ family: 'base', revision: MODEL_REVISION, variant: 'full' }),
      language: 'auto',
      decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
      execution: Object.freeze({ target: 'cpu', backend: 'cpu', cpuThreads: 4 }),
    }),
    runtime: Object.freeze({
      supportTier: 'Production',
      runtimeSetup: 'Installed',
      modelSetup: 'Installed',
      capability: 'Validated',
      residency: 'Loaded',
      activity: 'Idle',
      operationalStatus: 'Ready',
      canAttempt: true,
      blockingCode: null,
    }),
    failure: null,
    hasInitialPrompt: true,
    selectedDeviceId: null,
    capabilityFingerprint: null,
    staleCause: null,
    resources: null,
    ...overrides,
  });
}

export function snapshotFacts(): LocalWhisperSnapshotFacts {
  return Object.freeze({
    catalogRevision: CATALOG_REVISION,
    options: Object.freeze([
      Object.freeze({
        group: 'modelFamily' as const,
        id: 'base',
        label: 'Base',
        available: true,
        tier: 'Production' as const,
        reason: null,
        selected: true,
        selectedButUnavailable: false,
        saved: true,
        default: false,
        recommended: true,
        remembered: true,
        compatibility: Object.freeze({
          target: null,
          backend: null,
          modelFamily: null,
          modelVariant: null,
          eligibleBackends: Object.freeze([]),
        }),
      }),
    ]),
    validationIssues: Object.freeze([]),
    host: Object.freeze({ label: 'Test CPU · 8 logical processors', logicalProcessorCount: 8 }),
    threadSelections: Object.freeze({ cpuThreads: 4, gpuCpuThreads: 'auto' }),
    memory: Object.freeze({ selectedEstimate: null, qualifiedPeak: null, exactEstimateUnavailable: true }),
    resources: null,
    storage: Object.freeze({ label: 'Local Whisper managed storage', installedArtifactCount: 2, installedBytes: 30 }),
    artifacts: Object.freeze([
      Object.freeze({
        kind: 'runtime' as const,
        id: RUNTIME_ARTIFACT_ID,
        revision: RUNTIME_REVISION,
        label: 'CPU runtime',
        state: 'Installed' as const,
        transferSizeBytes: 10,
        installedSizeBytes: 20,
        updateAvailable: false,
        actions: Object.freeze(['remove'] as const),
        references: Object.freeze([
          Object.freeze({
            kind: 'viewLicenseNotice' as const,
            artifactKind: 'runtime' as const,
            artifactId: RUNTIME_ARTIFACT_ID,
            artifactRevision: RUNTIME_REVISION,
            referenceId: NOTICE_ID,
            label: 'Runtime license',
          }),
          Object.freeze({
            kind: 'openProvenanceReference' as const,
            artifactKind: 'runtime' as const,
            artifactId: RUNTIME_ARTIFACT_ID,
            artifactRevision: RUNTIME_REVISION,
            referenceId: PROVENANCE_ID,
            label: 'Runtime provenance',
          }),
        ]),
      }),
      Object.freeze({
        kind: 'model' as const,
        id: MODEL_ARTIFACT_ID,
        revision: MODEL_REVISION,
        label: 'Base model',
        state: 'Missing' as const,
        transferSizeBytes: 10,
        installedSizeBytes: 0,
        updateAvailable: false,
        actions: Object.freeze(['download'] as const),
        references: Object.freeze([]),
      }),
    ]),
    progress: Object.freeze([
      Object.freeze({
        operationId: 'operation-id-0001',
        artifactId: MODEL_ARTIFACT_ID,
        action: 'download' as const,
        state: 'Downloading' as const,
        receivedBytes: 5,
        totalBytes: 10,
        queuedPosition: null,
        failure: null,
      }),
    ]),
    prerequisites: Object.freeze([]),
    lastValidatedAtMs: 10,
  });
}

export class FakeCoordinator implements LocalWhisperIpcCoordinatorPort {
  public settingsCalls: LocalWhisperSettingsTransaction[] = [];
  public checkCalls = 0;
  public loadCalls = 0;
  public unloadCalls = 0;
  public removeCalls: LocalWhisperArtifactRemovalRequest[] = [];
  private readonly listeners = new Set<(snapshot: LocalWhisperCoordinatorSnapshot) => void>();

  public constructor(public snapshot = coordinatorSnapshot()) {}

  public subscribe(listener: (snapshot: LocalWhisperCoordinatorSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  public emit(snapshot: LocalWhisperCoordinatorSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of [...this.listeners]) listener(snapshot);
  }

  public applySettingsTransaction(command: LocalWhisperSettingsTransaction) {
    this.settingsCalls.push(command);
    return Promise.resolve({ success: true as const });
  }

  public checkCompatibility() {
    this.checkCalls += 1;
    return Promise.resolve({ success: true as const });
  }

  public loadNow() {
    this.loadCalls += 1;
    return Promise.resolve({ success: true as const });
  }

  public unload() {
    this.unloadCalls += 1;
    return Promise.resolve({ success: true as const });
  }

  public removeArtifact(request: LocalWhisperArtifactRemovalRequest) {
    this.removeCalls.push(request);
    return Promise.resolve({ success: true as const });
  }
}

export class FakeTransport implements LocalWhisperIpcTransport {
  public readonly handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  public readonly removed: string[] = [];

  public handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }

  public invoke(channel: string, event: IpcMainInvokeEvent, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`Missing handler: ${channel}`);
    return Promise.resolve(handler(event, ...args));
  }
}

export class FakeCapability implements LocalWhisperIpcSenderCapability {
  public current = true;
  public invalidateDuringRegistration = false;
  public sendAttempts = 0;
  public throwOnSend = false;
  public readonly sent: { readonly channel: string; readonly value: unknown }[] = [];
  private readonly invalidationListeners = new Set<() => void>();

  public constructor(public readonly key: string) {}

  public isCurrent(): boolean {
    return this.current;
  }

  public get invalidationListenerCount(): number {
    return this.invalidationListeners.size;
  }

  public send(channel: string, value: unknown): void {
    this.sendAttempts += 1;
    if (this.throwOnSend) throw new Error('synthetic IPC send failure');
    this.sent.push({ channel, value });
  }

  public onInvalidated(listener: () => void): () => void {
    if (!this.current) {
      listener();
      return () => undefined;
    }
    this.invalidationListeners.add(listener);
    if (this.invalidateDuringRegistration) this.invalidate();
    return () => this.invalidationListeners.delete(listener);
  }

  public invalidate(): void {
    if (!this.current) return;
    this.current = false;
    for (const listener of [...this.invalidationListeners]) listener();
    this.invalidationListeners.clear();
  }
}

export interface FakeEvent extends IpcMainInvokeEvent {
  readonly role: 'settings' | 'main' | 'foreign';
}

export function fakeEvent(role: FakeEvent['role']): FakeEvent {
  return { role } as FakeEvent;
}

export class FakeAuthority implements LocalWhisperIpcSenderAuthority {
  public readonly settings = new FakeCapability('settings-capability');
  public readonly main = new FakeCapability('main-capability');

  public authorizeSettings(event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null {
    return (event as FakeEvent).role === 'settings' ? this.settings : null;
  }

  public authorizeMain(event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null {
    return (event as FakeEvent).role === 'main' ? this.main : null;
  }
}

export class FakePrivilegedPorts {
  public readonly artifactCommands: LocalWhisperSettingsCommand[] = [];
  public throwArtifactError = false;
  public folderCalls = 0;
  public readonly referenceCommands: LocalWhisperSettingsCommand[] = [];

  public readonly artifacts: LocalWhisperArtifactCommandPort = {
    execute: (command) => {
      this.artifactCommands.push(command);
      if (this.throwArtifactError) throw new Error('private artifact adapter detail');
      return Promise.resolve({ success: true, operationId: 'operation-id-0001' });
    },
  };

  public readonly folder: LocalWhisperManagedFolderPort = {
    open: () => {
      this.folderCalls += 1;
      return Promise.resolve({ success: true });
    },
  };

  public readonly references: LocalWhisperArtifactReferencePort = {
    open: (command) => {
      this.referenceCommands.push(command);
      return Promise.resolve({ success: true });
    },
  };
}

export function createSnapshotService(
  coordinator: FakeCoordinator,
  facts: LocalWhisperSnapshotFacts = snapshotFacts(),
): LocalWhisperSnapshotService {
  return new LocalWhisperSnapshotService(coordinator, new StaticLocalWhisperSnapshotFacts(facts));
}
