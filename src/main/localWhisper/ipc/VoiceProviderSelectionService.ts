import {
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperFailureCode,
  type LocalWhisperProviderSelectionResult,
} from '@shared/localWhisper';
import type { MainInteractionLock } from '@shared/mainInteractionLock';

export interface VoiceProviderSelectionConfigPort {
  getSnapshot(): { readonly provider: string | null };
  setProvider(providerId: string | null): void;
  save(): void;
}

export interface VoiceProviderSelectionRuntimePort {
  clearProvider(): Promise<{ readonly error?: string }>;
  switchProvider(providerId: string): Promise<{ readonly error?: string }>;
}

export interface VoiceProviderSelectionRegistryPort {
  isKnownProviderId(providerId: unknown): providerId is string;
}

export interface VoiceProviderSelectionServiceDependencies {
  readonly config: VoiceProviderSelectionConfigPort;
  readonly runtime: VoiceProviderSelectionRuntimePort;
  readonly registry: VoiceProviderSelectionRegistryPort;
  readonly getReadinessRevision: () => number;
  readonly mainInteractionLock: Pick<MainInteractionLock, 'locked' | 'operationActive'>;
}

/** Serializes provider switching while the renderer presents the resulting runtime status. */
export class VoiceProviderSelectionService {
  private switching = false;
  private committedProviderId: string | null;

  public constructor(private readonly dependencies: VoiceProviderSelectionServiceDependencies) {
    this.committedProviderId = dependencies.config.getSnapshot().provider;
  }

  public getCommittedProviderId(): string | null {
    return this.committedProviderId;
  }

  public async select(providerId: unknown): Promise<LocalWhisperProviderSelectionResult> {
    const previousProviderId = this.committedProviderId;
    if (this.dependencies.mainInteractionLock.locked || this.dependencies.mainInteractionLock.operationActive) {
      return this.failure(previousProviderId, 'OPERATION_CONFLICT');
    }
    if (!this.dependencies.registry.isKnownProviderId(providerId)) {
      return this.failure(previousProviderId, 'INVALID_SETTINGS');
    }
    if (this.switching) return this.failure(previousProviderId, 'OPERATION_CONFLICT');
    if (providerId === previousProviderId) return this.success(previousProviderId);
    this.switching = true;
    try {
      await this.dependencies.runtime.switchProvider(providerId);
      try {
        this.dependencies.config.save();
      } catch {
        await this.rollback(previousProviderId);
        return this.failure(previousProviderId, 'INVALID_SETTINGS');
      }
      this.committedProviderId = providerId;
      return this.success(providerId);
    } catch {
      await this.rollback(previousProviderId);
      return this.failure(previousProviderId, 'OPERATION_CONFLICT');
    } finally {
      this.switching = false;
    }
  }

  private async rollback(previousProviderId: string | null): Promise<void> {
    if (previousProviderId === null) {
      try {
        const status = await this.dependencies.runtime.clearProvider();
        if (status.error) this.dependencies.config.setProvider(null);
      } catch {
        this.dependencies.config.setProvider(null);
      }
      this.committedProviderId = null;
      try {
        this.dependencies.config.save();
      } catch {
        // Memory remains on the explicit no-provider authority when persistence is unavailable.
      }
      return;
    }
    try {
      const status = await this.dependencies.runtime.switchProvider(previousProviderId);
      if (status.error) this.dependencies.config.setProvider(previousProviderId);
    } catch {
      this.dependencies.config.setProvider(previousProviderId);
    }
    this.committedProviderId = previousProviderId;
    try {
      this.dependencies.config.save();
    } catch {
      // Memory remains on previous authority; a failed new save never authorizes the candidate.
    }
  }

  private success(committedProviderId: string | null): LocalWhisperProviderSelectionResult {
    return Object.freeze({
      success: true,
      committedProviderId,
      readinessRevision: this.dependencies.getReadinessRevision(),
    });
  }

  private failure(
    committedProviderId: string | null,
    code: LocalWhisperFailureCode,
  ): LocalWhisperProviderSelectionResult {
    return Object.freeze({
      success: false,
      committedProviderId,
      readinessRevision: this.dependencies.getReadinessRevision(),
      error: createLocalWhisperRendererSafeFailure(code),
    });
  }
}
