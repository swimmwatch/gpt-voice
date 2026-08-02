import {
  LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE,
  LOCAL_WHISPER_MODEL_FAMILIES,
  isLocalWhisperRendererSnapshot,
  type LocalWhisperArtifactProgress,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererMemoryFacts,
  type LocalWhisperRendererOption,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperRevisionId,
  type LocalWhisperSettingsValidationIssue,
} from '@shared/localWhisper';

import type {
  LocalWhisperCoordinatorSnapshot,
  LocalWhisperCoordinatorSnapshotListener,
} from '../coordinator/LocalWhisperCoordinatorTypes';

export interface LocalWhisperSnapshotFacts {
  readonly catalogRevision: LocalWhisperRevisionId | null;
  readonly options: readonly LocalWhisperRendererOption[];
  readonly validationIssues: readonly LocalWhisperSettingsValidationIssue[];
  readonly host: LocalWhisperRendererSnapshot['host'];
  readonly memory: Omit<LocalWhisperRendererMemoryFacts, 'approximateFamilies'>;
  readonly storage: LocalWhisperRendererSnapshot['storage'];
  readonly artifacts: readonly LocalWhisperRendererArtifact[];
  readonly progress: readonly LocalWhisperArtifactProgress[];
  readonly prerequisites: LocalWhisperRendererSnapshot['prerequisites'];
  readonly lastValidatedAtMs: number | null;
}

export interface LocalWhisperSnapshotFactsPort {
  readonly snapshot: LocalWhisperSnapshotFacts;
  subscribe(listener: (facts: LocalWhisperSnapshotFacts) => void): () => void;
}

export interface LocalWhisperSnapshotCoordinatorPort {
  readonly snapshot: LocalWhisperCoordinatorSnapshot;
  subscribe(listener: LocalWhisperCoordinatorSnapshotListener): () => void;
}

export type LocalWhisperRendererSnapshotListener = (snapshot: LocalWhisperRendererSnapshot) => void;

function cloneAndFreeze<T>(value: T): T {
  return Object.freeze(structuredClone(value));
}

/** Projects the sole coordinator state plus catalog/inventory facts into one prompt-free renderer snapshot. */
export class LocalWhisperSnapshotService {
  private readonly listeners = new Set<LocalWhisperRendererSnapshotListener>();
  private coordinatorSnapshot: LocalWhisperCoordinatorSnapshot;
  private factsSnapshot: LocalWhisperSnapshotFacts;
  private snapshotValue: LocalWhisperRendererSnapshot;
  private snapshotRevision = 0;
  private disposed = false;
  private readonly unsubscribeCoordinator: () => void;
  private readonly unsubscribeFacts: () => void;

  public constructor(coordinator: LocalWhisperSnapshotCoordinatorPort, facts: LocalWhisperSnapshotFactsPort) {
    this.coordinatorSnapshot = coordinator.snapshot;
    this.factsSnapshot = facts.snapshot;
    this.snapshotValue = this.project();
    this.unsubscribeCoordinator = coordinator.subscribe((snapshot) => {
      this.coordinatorSnapshot = snapshot;
      this.refresh();
    });
    this.unsubscribeFacts = facts.subscribe((snapshot) => {
      this.factsSnapshot = snapshot;
      this.refresh();
    });
  }

  public get snapshot(): LocalWhisperRendererSnapshot {
    return this.snapshotValue;
  }

  public get mainStatus(): LocalWhisperMainStatusSnapshot {
    const snapshot = this.snapshotValue;
    return Object.freeze({
      providerId: 'local-whisper',
      snapshotRevision: snapshot.snapshotRevision,
      runtime: snapshot.runtime,
      failure: snapshot.failure,
      selectedButUnavailable: snapshot.options.some((option) => option.selectedButUnavailable),
    });
  }

  public subscribe(listener: LocalWhisperRendererSnapshotListener): () => void {
    if (this.disposed) throw new Error('Local Whisper snapshot service disposed');
    this.listeners.add(listener);
    listener(this.snapshotValue);
    return () => this.listeners.delete(listener);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeCoordinator();
    this.unsubscribeFacts();
    this.listeners.clear();
  }

  private refresh(): void {
    if (this.disposed) return;
    this.snapshotValue = this.project();
    for (const listener of [...this.listeners]) listener(this.snapshotValue);
  }

  private project(): LocalWhisperRendererSnapshot {
    if (this.snapshotRevision === Number.MAX_SAFE_INTEGER) {
      throw new Error('Local Whisper snapshot revision exhausted');
    }
    this.snapshotRevision += 1;
    const coordinator = this.coordinatorSnapshot;
    const facts = this.factsSnapshot;
    const candidate: LocalWhisperRendererSnapshot = {
      snapshotRevision: this.snapshotRevision,
      configurationEpoch: coordinator.epochs.configuration,
      inventoryEpoch: coordinator.epochs.inventory,
      catalogRevision: facts.catalogRevision,
      settings: cloneAndFreeze(coordinator.settings),
      hasInitialPrompt: coordinator.hasInitialPrompt,
      selectedDeviceId: coordinator.selectedDeviceId,
      host: cloneAndFreeze(facts.host),
      options: cloneAndFreeze(facts.options),
      validationIssues: cloneAndFreeze(facts.validationIssues),
      memory: Object.freeze({
        approximateFamilies: Object.freeze(
          LOCAL_WHISPER_MODEL_FAMILIES.map((family) => LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[family]),
        ),
        ...cloneAndFreeze(facts.memory),
      }),
      resources: coordinator.resources === null ? null : cloneAndFreeze(coordinator.resources),
      storage: cloneAndFreeze(facts.storage),
      artifacts: cloneAndFreeze(facts.artifacts),
      progress: cloneAndFreeze(facts.progress),
      runtime: cloneAndFreeze(coordinator.runtime),
      failure: coordinator.failure === null ? null : cloneAndFreeze(coordinator.failure),
      prerequisites: cloneAndFreeze(facts.prerequisites),
      lastValidatedAtMs: facts.lastValidatedAtMs,
    };
    if (!isLocalWhisperRendererSnapshot(candidate)) {
      throw new Error('Unsafe Local Whisper renderer snapshot projection');
    }
    return Object.freeze(candidate);
  }
}
