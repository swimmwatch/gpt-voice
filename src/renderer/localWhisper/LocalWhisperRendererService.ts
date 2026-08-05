import type { ElectronAPI } from '@renderer/types';
import {
  type LocalWhisperArtifactId,
  type LocalWhisperArtifactKind,
  type LocalWhisperArtifactReference,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperMainResidencyAction,
  type LocalWhisperMainResidencyCommandResult,
  type LocalWhisperPromptMutation,
  type LocalWhisperProviderSelectionResult,
  type LocalWhisperPublicSettings,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererSafeFailure,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperSettingsCommand,
  type LocalWhisperSettingsCommandResult,
} from '@shared/localWhisper';

type SettingsListener = (snapshot: LocalWhisperRendererSnapshot) => void;
type MainStatusListener = (snapshot: LocalWhisperMainStatusSnapshot) => void;
type MainResidencyListener = (state: LocalWhisperMainResidencyState) => void;

export type LocalWhisperMainResidencyFailure =
  { readonly kind: 'command'; readonly value: LocalWhisperRendererSafeFailure } | { readonly kind: 'transport' };

export interface LocalWhisperMainResidencyState {
  readonly pendingAction: LocalWhisperMainResidencyAction | null;
  readonly failure: LocalWhisperMainResidencyFailure | null;
  readonly failureSequence: number;
}

const INITIAL_MAIN_RESIDENCY_STATE: LocalWhisperMainResidencyState = Object.freeze({
  pendingAction: null,
  failure: null,
  failureSequence: 0,
});

interface ArtifactTarget {
  readonly artifactKind: LocalWhisperArtifactKind;
  readonly artifactId: LocalWhisperArtifactId;
  readonly artifactRevision: LocalWhisperRendererArtifact['revision'];
}

type RendererLocalWhisperApi = Pick<
  ElectronAPI,
  | 'getLocalWhisperSettingsSnapshot'
  | 'subscribeLocalWhisperSettings'
  | 'unsubscribeLocalWhisperSettings'
  | 'onLocalWhisperSettingsSnapshot'
  | 'runLocalWhisperSettingsCommand'
  | 'subscribeLocalWhisperMainStatus'
  | 'unsubscribeLocalWhisperMainStatus'
  | 'onLocalWhisperMainStatus'
  | 'runLocalWhisperMainResidencyCommand'
  | 'setActiveProvider'
>;

/** Reconciles revisioned Local Whisper renderer state and commits provider selection only after main success. */
export class LocalWhisperRendererService {
  private readonly settingsListeners = new Set<SettingsListener>();
  private readonly mainListeners = new Set<MainStatusListener>();
  private readonly mainResidencyListeners = new Set<MainResidencyListener>();
  private settingsSnapshot: LocalWhisperRendererSnapshot | null = null;
  private mainSnapshot: LocalWhisperMainStatusSnapshot | null = null;
  private mainResidencyStateValue = INITIAL_MAIN_RESIDENCY_STATE;
  private removeSettingsEvent: (() => void) | null = null;
  private removeMainEvent: (() => void) | null = null;
  private settingsSubscribed = false;
  private mainSubscribed = false;
  private disposed = false;

  public constructor(
    private readonly api: RendererLocalWhisperApi,
    private committedProviderIdValue: string | null,
  ) {}

  public get committedProviderId(): string | null {
    return this.committedProviderIdValue;
  }

  public get currentSettingsSnapshot(): LocalWhisperRendererSnapshot | null {
    return this.settingsSnapshot;
  }

  public get currentMainSnapshot(): LocalWhisperMainStatusSnapshot | null {
    return this.mainSnapshot;
  }

  public get mainResidencyState(): LocalWhisperMainResidencyState {
    return this.mainResidencyStateValue;
  }

  public async startSettings(): Promise<LocalWhisperRendererSnapshot> {
    this.assertActive();
    if (!this.settingsSubscribed) {
      this.removeSettingsEvent = this.api.onLocalWhisperSettingsSnapshot((snapshot) => this.acceptSettings(snapshot));
      const replay = await this.api.subscribeLocalWhisperSettings();
      this.settingsSubscribed = true;
      this.acceptSettings(replay);
    }
    if (!this.settingsSnapshot) this.acceptSettings(await this.api.getLocalWhisperSettingsSnapshot());
    return this.requireSettings();
  }

  public async startMainStatus(): Promise<LocalWhisperMainStatusSnapshot> {
    this.assertActive();
    if (!this.mainSubscribed) {
      this.removeMainEvent = this.api.onLocalWhisperMainStatus((snapshot) => this.acceptMain(snapshot));
      const replay = await this.api.subscribeLocalWhisperMainStatus();
      this.mainSubscribed = true;
      this.acceptMain(replay);
    }
    if (!this.mainSnapshot) throw new Error('Local Whisper main status unavailable');
    return this.mainSnapshot;
  }

  public subscribeSettings(listener: SettingsListener): () => void {
    this.settingsListeners.add(listener);
    if (this.settingsSnapshot) listener(this.settingsSnapshot);
    return () => this.settingsListeners.delete(listener);
  }

  public subscribeMainStatus(listener: MainStatusListener): () => void {
    this.mainListeners.add(listener);
    if (this.mainSnapshot) listener(this.mainSnapshot);
    return () => this.mainListeners.delete(listener);
  }

  public subscribeMainResidency(listener: MainResidencyListener): () => void {
    this.mainResidencyListeners.add(listener);
    listener(this.mainResidencyStateValue);
    return () => this.mainResidencyListeners.delete(listener);
  }

  public async runMainResidency(
    action: LocalWhisperMainResidencyAction,
  ): Promise<LocalWhisperMainResidencyCommandResult | null> {
    this.assertActive();
    if (this.mainResidencyStateValue.pendingAction !== null) return null;
    const snapshot = this.requireMain();
    this.publishMainResidency({
      pendingAction: action,
      failure: null,
      failureSequence: this.mainResidencyStateValue.failureSequence,
    });
    try {
      const result = await this.api.runLocalWhisperMainResidencyCommand({
        kind: action,
        expectedSnapshotRevision: snapshot.snapshotRevision,
      });
      if (result.command !== action) throw new Error('Mismatched Local Whisper main command response');
      const currentRevision = this.mainSnapshot?.snapshotRevision ?? 0;
      const accepted = result.snapshot.snapshotRevision >= currentRevision;
      if (result.snapshot.snapshotRevision > currentRevision) this.acceptMain(result.snapshot);
      this.publishMainResidency({
        pendingAction: null,
        failure: accepted && !result.success ? { kind: 'command', value: result.failure } : null,
        failureSequence:
          accepted && !result.success
            ? this.mainResidencyStateValue.failureSequence + 1
            : this.mainResidencyStateValue.failureSequence,
      });
      return result;
    } catch {
      this.publishMainResidency({
        pendingAction: null,
        failure: { kind: 'transport' },
        failureSequence: this.mainResidencyStateValue.failureSequence + 1,
      });
      return null;
    }
  }

  public save(
    candidate: LocalWhisperPublicSettings,
    promptMutation: LocalWhisperPromptMutation,
  ): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind: 'save', candidate, promptMutation, ...expected }));
  }

  public reset(): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind: 'reset', ...expected }));
  }

  public checkCompatibility(): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind: 'checkCompatibility', ...expected }));
  }

  public load(): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind: 'load', ...expected }));
  }

  public unload(): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind: 'unload', ...expected }));
  }

  public download(target: ArtifactTarget): Promise<LocalWhisperSettingsCommandResult> {
    return this.runArtifact('download', target);
  }

  public resume(target: ArtifactTarget): Promise<LocalWhisperSettingsCommandResult> {
    return this.runArtifact('resume', target);
  }

  public retry(target: ArtifactTarget): Promise<LocalWhisperSettingsCommandResult> {
    return this.runArtifact('retry', target);
  }

  public update(target: ArtifactTarget): Promise<LocalWhisperSettingsCommandResult> {
    return this.runArtifact('update', target);
  }

  public cancelArtifact(operationId: string): Promise<LocalWhisperSettingsCommandResult> {
    return this.run({ kind: 'cancelArtifact', operationId });
  }

  public remove(target: ArtifactTarget, confirmed: boolean): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind: 'remove', ...target, confirmed, ...expected }));
  }

  public openManagedFolder(): Promise<LocalWhisperSettingsCommandResult> {
    return this.run({ kind: 'openManagedFolder', expectedSnapshotRevision: this.requireSettings().snapshotRevision });
  }

  public viewArtifactReference(reference: LocalWhisperArtifactReference): Promise<LocalWhisperSettingsCommandResult> {
    const snapshot = this.requireSettings();
    if (!snapshot.catalogRevision) throw new Error('Local Whisper catalog unavailable');
    return this.run({
      kind: 'viewArtifactReference',
      referenceKind: reference.kind,
      artifactKind: reference.artifactKind,
      artifactId: reference.artifactId,
      artifactRevision: reference.artifactRevision,
      referenceId: reference.referenceId,
      expectedCatalogRevision: snapshot.catalogRevision,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    });
  }

  public async selectProvider(providerId: string): Promise<LocalWhisperProviderSelectionResult> {
    this.assertActive();
    const result = await this.api.setActiveProvider(providerId);
    if (result.success) this.committedProviderIdValue = result.committedProviderId;
    return result;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.removeSettingsEvent?.();
    this.removeMainEvent?.();
    this.removeSettingsEvent = null;
    this.removeMainEvent = null;
    const cleanups: Promise<unknown>[] = [];
    if (this.settingsSubscribed) cleanups.push(this.api.unsubscribeLocalWhisperSettings());
    if (this.mainSubscribed) cleanups.push(this.api.unsubscribeLocalWhisperMainStatus());
    this.settingsSubscribed = false;
    this.mainSubscribed = false;
    this.settingsListeners.clear();
    this.mainListeners.clear();
    this.mainResidencyListeners.clear();
    await Promise.allSettled(cleanups);
  }

  private runArtifact(
    kind: 'download' | 'resume' | 'retry' | 'update',
    target: ArtifactTarget,
  ): Promise<LocalWhisperSettingsCommandResult> {
    return this.runWithExpected((expected) => ({ kind, ...target, ...expected }));
  }

  private runWithExpected(
    create: (expected: {
      readonly expectedSnapshotRevision: number;
      readonly expectedConfigurationEpoch: number;
      readonly expectedInventoryEpoch: number;
    }) => LocalWhisperSettingsCommand,
  ): Promise<LocalWhisperSettingsCommandResult> {
    const snapshot = this.requireSettings();
    return this.run(
      create({
        expectedSnapshotRevision: snapshot.snapshotRevision,
        expectedConfigurationEpoch: snapshot.configurationEpoch,
        expectedInventoryEpoch: snapshot.inventoryEpoch,
      }),
    );
  }

  private async run(command: LocalWhisperSettingsCommand): Promise<LocalWhisperSettingsCommandResult> {
    this.assertActive();
    const result = await this.api.runLocalWhisperSettingsCommand(command);
    this.acceptSettings(result.snapshot);
    return result;
  }

  private acceptSettings(snapshot: LocalWhisperRendererSnapshot): void {
    if (this.disposed || (this.settingsSnapshot && snapshot.snapshotRevision <= this.settingsSnapshot.snapshotRevision))
      return;
    this.settingsSnapshot = snapshot;
    for (const listener of [...this.settingsListeners]) listener(snapshot);
  }

  private acceptMain(snapshot: LocalWhisperMainStatusSnapshot): void {
    if (this.disposed || (this.mainSnapshot && snapshot.snapshotRevision <= this.mainSnapshot.snapshotRevision)) return;
    this.mainSnapshot = snapshot;
    if (this.mainResidencyStateValue.failure !== null) {
      this.publishMainResidency({
        pendingAction: this.mainResidencyStateValue.pendingAction,
        failure: null,
        failureSequence: this.mainResidencyStateValue.failureSequence,
      });
    }
    for (const listener of [...this.mainListeners]) listener(snapshot);
  }

  private publishMainResidency(state: LocalWhisperMainResidencyState): void {
    this.mainResidencyStateValue = Object.freeze(state);
    if (this.disposed) return;
    for (const listener of [...this.mainResidencyListeners]) listener(this.mainResidencyStateValue);
  }

  private requireSettings(): LocalWhisperRendererSnapshot {
    this.assertActive();
    if (!this.settingsSnapshot) throw new Error('Local Whisper settings snapshot unavailable');
    return this.settingsSnapshot;
  }

  private requireMain(): LocalWhisperMainStatusSnapshot {
    this.assertActive();
    if (!this.mainSnapshot) throw new Error('Local Whisper main status unavailable');
    return this.mainSnapshot;
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Local Whisper renderer service disposed');
  }
}
