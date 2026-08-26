import type { IpcMainInvokeEvent } from 'electron';

import {
  LOCAL_WHISPER_IPC_CHANNELS,
  LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
  LOCAL_WHISPER_PROVIDER_ID,
  LOCAL_WHISPER_RECOVERABLE_ARTIFACT_PROGRESS_STATES,
  createLocalWhisperRendererSafeFailure,
  isLocalWhisperMainResidencyCommand,
  isLocalWhisperSettingsCommand,
  type LocalWhisperArtifactId,
  type LocalWhisperFailureCode,
  type LocalWhisperMainResidencyAction,
  type LocalWhisperMainResidencyCommandResult,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperRevisionId,
  type LocalWhisperSettingsCommand,
  type LocalWhisperSettingsCommandResult,
} from '@shared/localWhisper';
import { MainInteractionLock } from '@shared/mainInteractionLock';

import type {
  LocalWhisperArtifactRemovalRequest,
  LocalWhisperSettingsTransaction,
} from '../coordinator/LocalWhisperCoordinatorTypes';
import type { LocalWhisperCommandAuditPort } from '../audit/LocalWhisperCommandAudit';
import type { LocalWhisperSnapshotService } from './LocalWhisperSnapshotService';
import type { LocalWhisperModelLoadFailureNotifier } from './LocalWhisperModelLoadFailureNotifier';

export interface LocalWhisperIpcTransport {
  handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

export interface LocalWhisperIpcSenderCapability {
  readonly key: string;
  isCurrent(): boolean;
  send(channel: string, value: unknown): void;
  onInvalidated(listener: () => void): () => void;
}

export interface LocalWhisperIpcSenderAuthority {
  authorizeSettings(event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null;
  authorizeMain(event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null;
}

export interface LocalWhisperIpcCoordinatorPort {
  applySettingsTransaction(command: LocalWhisperSettingsTransaction): Promise<{
    readonly success: boolean;
    readonly error?: { readonly code: LocalWhisperFailureCode };
  }>;
  checkCompatibility(): Promise<{
    readonly success: boolean;
    readonly error?: { readonly code: LocalWhisperFailureCode };
  }>;
  loadNow(): Promise<{ readonly success: boolean; readonly error?: { readonly code: LocalWhisperFailureCode } }>;
  unload(): Promise<{ readonly success: boolean; readonly error?: { readonly code: LocalWhisperFailureCode } }>;
  removeArtifact(request: LocalWhisperArtifactRemovalRequest): Promise<{
    readonly success: boolean;
    readonly error?: { readonly code: LocalWhisperFailureCode };
  }>;
}

export interface LocalWhisperArtifactCommandPort {
  execute(
    command: Extract<
      LocalWhisperSettingsCommand,
      { readonly kind: 'download' | 'resume' | 'retry' | 'update' | 'cancelArtifact' }
    >,
  ): Promise<{
    readonly success: boolean;
    readonly operationId?: string;
    readonly code?: LocalWhisperFailureCode;
  }>;
}

export interface LocalWhisperManagedFolderPort {
  open(): Promise<{ readonly success: boolean; readonly code?: LocalWhisperFailureCode }>;
}

export interface LocalWhisperArtifactReferencePort {
  open(command: Extract<LocalWhisperSettingsCommand, { readonly kind: 'viewArtifactReference' }>): Promise<{
    readonly success: boolean;
    readonly code?: LocalWhisperFailureCode;
  }>;
}

export interface LocalWhisperIpcControllerDependencies {
  readonly audit: LocalWhisperCommandAuditPort;
  readonly transport: LocalWhisperIpcTransport;
  readonly authority: LocalWhisperIpcSenderAuthority;
  readonly coordinator: LocalWhisperIpcCoordinatorPort;
  readonly artifacts: LocalWhisperArtifactCommandPort;
  readonly managedFolder: LocalWhisperManagedFolderPort;
  readonly mainInteractionLock: MainInteractionLock;
  readonly modelLoadFailureNotifier: Pick<LocalWhisperModelLoadFailureNotifier, 'notify'>;
  readonly references: LocalWhisperArtifactReferencePort;
  readonly snapshots: LocalWhisperSnapshotService;
  readonly getActiveProviderId: () => string | null;
  readonly openSettings: () => void;
  readonly refreshSettingsFacts?: (configurationEpoch: number) => Promise<void>;
}

interface Subscriber {
  readonly capability: LocalWhisperIpcSenderCapability;
  readonly removeInvalidationListener: () => void;
}

/** Owns the two independently authorized Local Whisper renderer surfaces. */
export class LocalWhisperIpcController {
  private readonly registeredChannels = new Set<string>();
  private readonly settingsSubscribers = new Map<string, Subscriber>();
  private readonly mainSubscribers = new Map<string, Subscriber>();
  private readonly unsubscribeSnapshots: () => void;
  private registered = false;
  private disposed = false;

  public constructor(private readonly dependencies: LocalWhisperIpcControllerDependencies) {
    this.unsubscribeSnapshots = dependencies.snapshots.subscribe((snapshot) => this.publish(snapshot));
  }

  public register(): void {
    if (this.disposed) throw new Error('Local Whisper IPC controller disposed');
    if (this.registered) return;
    this.registered = true;

    this.handleSettings(LOCAL_WHISPER_IPC_CHANNELS.settingsQuery, async (_event, _capability, ...args) => {
      this.assertNoArguments(args);
      await this.refreshSettingsFacts();
      return this.dependencies.snapshots.snapshot;
    });
    this.handleSettings(LOCAL_WHISPER_IPC_CHANNELS.settingsSubscribe, async (_event, capability, ...args) => {
      this.assertNoArguments(args);
      this.addSubscriber(this.settingsSubscribers, capability);
      await this.refreshSettingsFacts();
      return this.dependencies.snapshots.snapshot;
    });
    this.handleSettings(LOCAL_WHISPER_IPC_CHANNELS.settingsUnsubscribe, (_event, capability, ...args) => {
      this.assertNoArguments(args);
      this.removeSubscriber(this.settingsSubscribers, capability.key);
      return { success: true } as const;
    });
    this.handleSettings(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, async (_event, _capability, ...args) => {
      return await this.executeSafely(args);
    });

    this.handleMain(LOCAL_WHISPER_IPC_CHANNELS.mainStatusQuery, (_event, _capability, ...args) => {
      this.assertNoArguments(args);
      return this.dependencies.snapshots.mainStatus;
    });
    this.handleMain(LOCAL_WHISPER_IPC_CHANNELS.mainStatusSubscribe, (_event, capability, ...args) => {
      this.assertNoArguments(args);
      this.addSubscriber(this.mainSubscribers, capability);
      return this.dependencies.snapshots.mainStatus;
    });
    this.handleMain(LOCAL_WHISPER_IPC_CHANNELS.mainStatusUnsubscribe, (_event, capability, ...args) => {
      this.assertNoArguments(args);
      this.removeSubscriber(this.mainSubscribers, capability.key);
      return { success: true } as const;
    });
    this.handleMain(LOCAL_WHISPER_IPC_CHANNELS.mainResidencyCommand, async (_event, _capability, ...args) => {
      return await this.executeMainResidencySafely(args);
    });
    this.handleMain(LOCAL_WHISPER_IPC_CHANNELS.mainOpenSettings, (_event, _capability, ...args) => {
      this.assertNoArguments(args);
      this.dependencies.openSettings();
      return { success: true } as const;
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeSnapshots();
    for (const channel of this.registeredChannels) this.dependencies.transport.removeHandler(channel);
    this.registeredChannels.clear();
    this.clearSubscribers(this.settingsSubscribers);
    this.clearSubscribers(this.mainSubscribers);
  }

  private handleSettings(
    channel: string,
    listener: (event: IpcMainInvokeEvent, capability: LocalWhisperIpcSenderCapability, ...args: unknown[]) => unknown,
  ): void {
    this.dependencies.transport.handle(channel, (event, ...args) => {
      const capability = this.dependencies.authority.authorizeSettings(event);
      if (!capability) throw new Error('Rejected Local Whisper settings IPC sender');
      return listener(event, capability, ...args);
    });
    this.registeredChannels.add(channel);
  }

  private handleMain(
    channel: string,
    listener: (event: IpcMainInvokeEvent, capability: LocalWhisperIpcSenderCapability, ...args: unknown[]) => unknown,
  ): void {
    this.dependencies.transport.handle(channel, (event, ...args) => {
      const capability = this.dependencies.authority.authorizeMain(event);
      if (!capability) throw new Error('Rejected Local Whisper main-status IPC sender');
      return listener(event, capability, ...args);
    });
    this.registeredChannels.add(channel);
  }

  private async executeSafely(args: readonly unknown[]): Promise<LocalWhisperSettingsCommandResult> {
    let commandKind: LocalWhisperSettingsCommand['kind'] | 'invalid' = 'invalid';
    try {
      if (args.length !== 1) return this.failure(commandKind, 'INVALID_SETTINGS');
      const value = args[0];
      if (!isLocalWhisperSettingsCommand(value)) return this.failure(commandKind, 'INVALID_SETTINGS');
      commandKind = value.kind;
      const result = await this.execute(value);
      try {
        this.dependencies.audit.record(value, result.snapshot, result);
      } catch {
        // Audit is diagnostic-only and cannot alter command results or lifecycle state.
      }
      return result;
    } catch {
      return this.failure(commandKind, 'OPERATION_CONFLICT');
    }
  }

  private async executeMainResidencySafely(args: readonly unknown[]): Promise<LocalWhisperMainResidencyCommandResult> {
    let commandKind: LocalWhisperMainResidencyAction | 'invalid' = 'invalid';
    try {
      if (args.length !== 1) return this.mainResidencyFailure(commandKind, 'INVALID_SETTINGS');
      const value = args[0];
      if (!isLocalWhisperMainResidencyCommand(value)) {
        return this.mainResidencyFailure(commandKind, 'INVALID_SETTINGS');
      }
      commandKind = value.kind;
      if (this.dependencies.mainInteractionLock.locked || this.dependencies.mainInteractionLock.operationActive) {
        return this.mainResidencyFailure(commandKind, 'OPERATION_CONFLICT');
      }
      if (this.dependencies.getActiveProviderId() !== LOCAL_WHISPER_PROVIDER_ID) {
        return this.mainResidencyFailure(commandKind, 'OPERATION_CONFLICT');
      }
      const snapshot = this.dependencies.snapshots.mainStatus;
      if (value.expectedSnapshotRevision !== snapshot.snapshotRevision) {
        return this.mainResidencyFailure(commandKind, 'STALE_CONFIGURATION');
      }
      if (!this.isMainResidencyActionAllowed(commandKind, snapshot)) {
        return this.mainResidencyFailure(commandKind, 'OPERATION_CONFLICT');
      }

      let coordinatorResult: {
        readonly success: boolean;
        readonly error?: { readonly code: LocalWhisperFailureCode };
      };
      try {
        coordinatorResult =
          commandKind === 'load'
            ? await this.dependencies.coordinator.loadNow()
            : await this.dependencies.coordinator.unload();
      } catch {
        coordinatorResult = { success: false, error: { code: 'OPERATION_CONFLICT' } };
      }
      if (commandKind === 'load' && !coordinatorResult.success) {
        this.notifyModelLoadFailure(coordinatorResult.error?.code ?? 'OPERATION_CONFLICT');
      }
      const result = coordinatorResult.success
        ? Object.freeze({
            success: true,
            command: commandKind,
            snapshot: this.dependencies.snapshots.mainStatus,
            failure: null,
          })
        : this.mainResidencyFailure(commandKind, coordinatorResult.error?.code ?? 'OPERATION_CONFLICT');
      try {
        this.dependencies.audit.record(value, this.dependencies.snapshots.snapshot, {
          success: result.success,
          ...(result.failure === null ? {} : { error: result.failure }),
        });
      } catch {
        // Audit is diagnostic-only and cannot alter command results or lifecycle state.
      }
      return result;
    } catch {
      return this.mainResidencyFailure(commandKind, 'OPERATION_CONFLICT');
    }
  }

  private assertNoArguments(args: readonly unknown[]): void {
    if (args.length !== 0) throw new Error('Rejected unexpected Local Whisper IPC arguments');
  }

  private isMainResidencyActionAllowed(
    action: LocalWhisperMainResidencyAction,
    snapshot: LocalWhisperMainStatusSnapshot,
  ): boolean {
    if (action === 'unload') {
      return snapshot.runtime.residency === 'Loaded' && snapshot.runtime.activity === 'Idle';
    }
    return (
      snapshot.runtime.residency === 'Unloaded' &&
      snapshot.runtime.runtimeSetup === 'Installed' &&
      snapshot.runtime.modelSetup === 'Installed' &&
      snapshot.runtime.canAttempt &&
      snapshot.runtime.blockingCode === null &&
      !snapshot.selectedButUnavailable
    );
  }

  private async refreshSettingsFacts(): Promise<void> {
    const refresh = this.dependencies.refreshSettingsFacts;
    if (!refresh) return;
    try {
      await refresh(this.dependencies.snapshots.snapshot.configurationEpoch);
    } catch {
      // Device enumeration is fail-closed and cannot make a settings query fail.
    }
  }

  private async execute(command: LocalWhisperSettingsCommand): Promise<LocalWhisperSettingsCommandResult> {
    const snapshot = this.dependencies.snapshots.snapshot;
    if ('expectedSnapshotRevision' in command && command.expectedSnapshotRevision !== snapshot.snapshotRevision) {
      return this.failure(command.kind, 'STALE_CONFIGURATION');
    }
    if ('expectedConfigurationEpoch' in command && !this.matchesExpectedState(command, snapshot)) {
      return this.failure(command.kind, 'STALE_CONFIGURATION');
    }
    if (
      'artifactId' in command &&
      !this.matchesArtifact(command.artifactId, command.artifactRevision, command.artifactKind)
    ) {
      return this.failure(command.kind, 'STALE_CONFIGURATION');
    }
    if (this.isArtifactActionCommand(command) && !this.isArtifactActionAllowed(command, snapshot)) {
      return this.failure(command.kind, 'STALE_CONFIGURATION');
    }

    if (command.kind === 'save' || command.kind === 'reset') {
      const transaction: LocalWhisperSettingsTransaction =
        command.kind === 'save'
          ? {
              kind: 'save',
              candidate: command.candidate,
              promptMutation: command.promptMutation,
              expectedConfigurationEpoch: command.expectedConfigurationEpoch,
              expectedInventoryEpoch: command.expectedInventoryEpoch,
            }
          : {
              kind: 'reset',
              expectedConfigurationEpoch: command.expectedConfigurationEpoch,
              expectedInventoryEpoch: command.expectedInventoryEpoch,
            };
      return this.fromCoordinator(
        command.kind,
        await this.dependencies.coordinator.applySettingsTransaction(transaction),
      );
    }
    if (command.kind === 'checkCompatibility') {
      return this.fromCoordinator(command.kind, await this.dependencies.coordinator.checkCompatibility());
    }
    if (command.kind === 'load') {
      const result = await this.dependencies.coordinator.loadNow();
      if (!result.success) this.notifyModelLoadFailure(result.error?.code ?? 'OPERATION_CONFLICT');
      return this.fromCoordinator(command.kind, result);
    }
    if (command.kind === 'unload')
      return this.fromCoordinator(command.kind, await this.dependencies.coordinator.unload());
    if (command.kind === 'remove') {
      return this.fromCoordinator(
        command.kind,
        await this.dependencies.coordinator.removeArtifact({
          kind: command.artifactKind,
          artifactId: command.artifactId,
          confirmed: command.confirmed,
          expectedConfigurationEpoch: command.expectedConfigurationEpoch,
          expectedInventoryEpoch: command.expectedInventoryEpoch,
        }),
      );
    }
    if (command.kind === 'openManagedFolder') {
      return this.fromPrivileged(command.kind, await this.dependencies.managedFolder.open());
    }
    if (command.kind === 'viewArtifactReference') {
      if (!this.matchesReference(command)) return this.failure(command.kind, 'STALE_CONFIGURATION');
      return this.fromPrivileged(command.kind, await this.dependencies.references.open(command));
    }
    if (!this.isArtifactLifecycleCommand(command)) return this.failure(command.kind, 'INVALID_SETTINGS');
    const result = await this.dependencies.artifacts.execute(command);
    if (!result.success) return this.failure(command.kind, result.code ?? 'OPERATION_CONFLICT');
    return Object.freeze({
      success: true,
      command: command.kind,
      snapshot: this.dependencies.snapshots.snapshot,
      ...(result.operationId === undefined ? {} : { operationId: result.operationId }),
    });
  }

  private matchesExpectedState(
    command: { readonly expectedConfigurationEpoch: number; readonly expectedInventoryEpoch: number },
    snapshot: LocalWhisperRendererSnapshot,
  ): boolean {
    return (
      command.expectedConfigurationEpoch === snapshot.configurationEpoch &&
      command.expectedInventoryEpoch === snapshot.inventoryEpoch
    );
  }

  private matchesArtifact(
    id: LocalWhisperArtifactId,
    revision: LocalWhisperRevisionId,
    kind: 'runtime' | 'model',
  ): boolean {
    return this.dependencies.snapshots.snapshot.artifacts.some(
      (artifact) => artifact.kind === kind && artifact.id === id && artifact.revision === revision,
    );
  }

  private isArtifactLifecycleCommand(
    command: LocalWhisperSettingsCommand,
  ): command is Extract<
    LocalWhisperSettingsCommand,
    { readonly kind: 'download' | 'resume' | 'retry' | 'update' | 'cancelArtifact' }
  > {
    return (
      command.kind === 'download' ||
      command.kind === 'resume' ||
      command.kind === 'retry' ||
      command.kind === 'update' ||
      command.kind === 'cancelArtifact'
    );
  }

  private isArtifactActionCommand(
    command: LocalWhisperSettingsCommand,
  ): command is Extract<
    LocalWhisperSettingsCommand,
    { readonly kind: 'download' | 'resume' | 'retry' | 'update' | 'cancelArtifact' | 'remove' }
  > {
    return this.isArtifactLifecycleCommand(command) || command.kind === 'remove';
  }

  private isArtifactActionAllowed(
    command: Extract<
      LocalWhisperSettingsCommand,
      { readonly kind: 'download' | 'resume' | 'retry' | 'update' | 'cancelArtifact' | 'remove' }
    >,
    snapshot: LocalWhisperRendererSnapshot,
  ): boolean {
    if (command.kind === 'cancelArtifact') {
      const progress = snapshot.progress.find((entry) => entry.operationId === command.operationId);
      return (
        progress !== undefined &&
        LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES.some((state) => state === progress.state) &&
        snapshot.artifacts.some((artifact) => artifact.id === progress.artifactId)
      );
    }
    if (command.kind === 'retry') {
      const progress = snapshot.progress.find((entry) => entry.artifactId === command.artifactId);
      if (
        progress?.failure?.retryable === true &&
        LOCAL_WHISPER_RECOVERABLE_ARTIFACT_PROGRESS_STATES.some((state) => state === progress.state)
      ) {
        return true;
      }
    }
    return snapshot.artifacts.some(
      (artifact) =>
        artifact.kind === command.artifactKind &&
        artifact.id === command.artifactId &&
        artifact.revision === command.artifactRevision &&
        artifact.actions.includes(command.kind),
    );
  }

  private matchesReference(
    command: Extract<LocalWhisperSettingsCommand, { readonly kind: 'viewArtifactReference' }>,
  ): boolean {
    const snapshot = this.dependencies.snapshots.snapshot;
    return (
      snapshot.catalogRevision === command.expectedCatalogRevision &&
      snapshot.artifacts.some(
        (artifact) =>
          artifact.kind === command.artifactKind &&
          artifact.id === command.artifactId &&
          artifact.revision === command.artifactRevision &&
          artifact.references.some(
            (reference) => reference.kind === command.referenceKind && reference.referenceId === command.referenceId,
          ),
      )
    );
  }

  private fromCoordinator(
    command: LocalWhisperSettingsCommand['kind'],
    result: { readonly success: boolean; readonly error?: { readonly code: LocalWhisperFailureCode } },
  ): LocalWhisperSettingsCommandResult {
    return result.success
      ? Object.freeze({ success: true, command, snapshot: this.dependencies.snapshots.snapshot })
      : this.failure(command, result.error?.code ?? 'OPERATION_CONFLICT');
  }

  private fromPrivileged(
    command: LocalWhisperSettingsCommand['kind'],
    result: { readonly success: boolean; readonly code?: LocalWhisperFailureCode },
  ): LocalWhisperSettingsCommandResult {
    return result.success
      ? Object.freeze({ success: true, command, snapshot: this.dependencies.snapshots.snapshot })
      : this.failure(command, result.code ?? 'OPERATION_CONFLICT');
  }

  private failure(
    command: LocalWhisperSettingsCommand['kind'] | 'invalid',
    code: LocalWhisperFailureCode,
  ): LocalWhisperSettingsCommandResult {
    return Object.freeze({
      success: false,
      command,
      snapshot: this.dependencies.snapshots.snapshot,
      error: createLocalWhisperRendererSafeFailure(code),
    });
  }

  private mainResidencyFailure(
    command: LocalWhisperMainResidencyAction | 'invalid',
    code: LocalWhisperFailureCode,
  ): LocalWhisperMainResidencyCommandResult {
    return Object.freeze({
      success: false,
      command,
      snapshot: this.dependencies.snapshots.mainStatus,
      failure: createLocalWhisperRendererSafeFailure(code),
    });
  }

  private notifyModelLoadFailure(code: LocalWhisperFailureCode): void {
    try {
      this.dependencies.modelLoadFailureNotifier.notify(code);
    } catch {
      // Notifications are observational and cannot change the trusted IPC result.
    }
  }

  private addSubscriber(subscribers: Map<string, Subscriber>, capability: LocalWhisperIpcSenderCapability): void {
    this.removeSubscriber(subscribers, capability.key);
    let invalidated = false;
    const removeInvalidationListener = capability.onInvalidated(() => {
      invalidated = true;
      this.removeSubscriber(subscribers, capability.key);
    });
    if (invalidated || !capability.isCurrent()) {
      try {
        removeInvalidationListener();
      } catch {
        // Stale sender cleanup cannot restore a subscription.
      }
      return;
    }
    subscribers.set(capability.key, { capability, removeInvalidationListener });
  }

  private removeSubscriber(subscribers: Map<string, Subscriber>, key: string): void {
    const subscriber = subscribers.get(key);
    if (!subscriber) return;
    subscribers.delete(key);
    try {
      subscriber.removeInvalidationListener();
    } catch {
      // Revocation is authoritative even if Electron listener cleanup races with destruction.
    }
  }

  private clearSubscribers(subscribers: Map<string, Subscriber>): void {
    for (const key of [...subscribers.keys()]) this.removeSubscriber(subscribers, key);
  }

  private publish(snapshot: LocalWhisperRendererSnapshot): void {
    this.publishTo(this.settingsSubscribers, LOCAL_WHISPER_IPC_CHANNELS.settingsChanged, snapshot);
    this.publishTo(
      this.mainSubscribers,
      LOCAL_WHISPER_IPC_CHANNELS.mainStatusChanged,
      this.dependencies.snapshots.mainStatus,
    );
  }

  private publishTo(subscribers: Map<string, Subscriber>, channel: string, value: unknown): void {
    for (const [key, subscriber] of [...subscribers.entries()]) {
      if (!subscriber.capability.isCurrent()) {
        this.removeSubscriber(subscribers, key);
        continue;
      }
      try {
        subscriber.capability.send(channel, value);
      } catch {
        this.removeSubscriber(subscribers, key);
      }
    }
  }
}
