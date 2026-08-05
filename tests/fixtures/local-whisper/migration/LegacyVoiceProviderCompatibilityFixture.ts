import { VoiceProviderSelectionService } from '@main/localWhisper/ipc/VoiceProviderSelectionService';
import { INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT } from '@shared/localWhisper';

const LEGACY_PROVIDER_IDS = ['chatgpt', 'openai-api', 'claude-web'] as const;

/** Current-code model of the immediately preceding provider registry; it is not real-binary evidence. */
export class LegacyVoiceProviderCompatibilityFixture {
  private provider: string | null = 'local-whisper';
  private readinessRevision = 0;
  public saveCount = 0;
  public localExecutionCount = 0;
  public localDeletionCount = 0;
  public readonly namespaces = new Map<string, string>([
    ['local-whisper/settings', 'private-settings'],
    ['local-whisper/inventory', 'immutable-inventory'],
    ['local-whisper/device-salt', 'private-device-salt'],
  ]);
  public readonly selection: VoiceProviderSelectionService;

  public constructor() {
    this.selection = new VoiceProviderSelectionService({
      config: {
        getSnapshot: () => ({ provider: this.provider }),
        setProvider: (providerId) => {
          this.provider = providerId;
        },
        save: () => {
          this.saveCount += 1;
        },
      },
      registry: {
        isKnownProviderId: (providerId: unknown): providerId is string =>
          typeof providerId === 'string' &&
          LEGACY_PROVIDER_IDS.includes(providerId as (typeof LEGACY_PROVIDER_IDS)[number]),
      },
      runtime: {
        clearProvider: async () => {
          this.provider = null;
          return {};
        },
        switchProvider: async (providerId) => {
          if (!LEGACY_PROVIDER_IDS.includes(providerId as (typeof LEGACY_PROVIDER_IDS)[number])) {
            return { error: 'unknown legacy provider' };
          }
          this.provider = providerId;
          this.readinessRevision += 1;
          return {};
        },
      },
      localWhisper: {
        getReadinessSnapshot: () => ({ snapshot: INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT, failure: null }),
      },
      getReadinessRevision: () => this.readinessRevision,
    });
  }

  public get selectedProviderId(): string {
    if (this.provider === null) throw new Error('Legacy fixture has no selected provider');
    return this.provider;
  }

  public get availableProviderIds(): readonly string[] {
    return LEGACY_PROVIDER_IDS;
  }
}
