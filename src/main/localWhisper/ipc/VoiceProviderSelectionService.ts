import { createLocalWhisperRendererSafeFailure, type LocalWhisperProviderSelectionResult } from '@shared/localWhisper';

export interface VoiceProviderSelectionConfigPort {
  getSnapshot(): { readonly provider: string };
  setProvider(providerId: string): void;
  save(): void;
}

export interface VoiceProviderSelectionRuntimePort {
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
}

/** Serializes provider switching and restores runtime/config before reporting any failure. */
export class VoiceProviderSelectionService {
  private switching = false;
  private committedProviderId: string;

  public constructor(private readonly dependencies: VoiceProviderSelectionServiceDependencies) {
    this.committedProviderId = dependencies.config.getSnapshot().provider;
  }

  public getCommittedProviderId(): string {
    return this.committedProviderId;
  }

  public async select(providerId: unknown): Promise<LocalWhisperProviderSelectionResult> {
    const previousProviderId = this.committedProviderId;
    if (!this.dependencies.registry.isKnownProviderId(providerId)) {
      return this.failure(previousProviderId, 'INVALID_SETTINGS');
    }
    if (this.switching) return this.failure(previousProviderId, 'OPERATION_CONFLICT');
    if (providerId === previousProviderId) return this.success(previousProviderId);

    this.switching = true;
    try {
      const status = await this.dependencies.runtime.switchProvider(providerId);
      if (status.error) {
        await this.rollback(previousProviderId);
        return this.failure(previousProviderId, 'OPERATION_CONFLICT');
      }
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

  private async rollback(previousProviderId: string): Promise<void> {
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

  private success(committedProviderId: string): LocalWhisperProviderSelectionResult {
    return Object.freeze({
      success: true,
      committedProviderId,
      readinessRevision: this.dependencies.getReadinessRevision(),
    });
  }

  private failure(
    committedProviderId: string,
    code: 'INVALID_SETTINGS' | 'OPERATION_CONFLICT',
  ): LocalWhisperProviderSelectionResult {
    return Object.freeze({
      success: false,
      committedProviderId,
      readinessRevision: this.dependencies.getReadinessRevision(),
      error: createLocalWhisperRendererSafeFailure(code),
    });
  }
}
