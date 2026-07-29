import type { BaseVoiceProvider } from './BaseVoiceProvider';
import type { VoiceProviderAudit } from './voiceProviderAudit';
import { VoiceProviderFactory } from './voiceProviderFactory';
import { isBatchVoiceProvider, isStreamingVoiceProvider } from './voiceProviderGuards';
import { PROVIDER_AUDIT_PROVIDER_MAPPINGS, type VoiceProviderAuditId } from '@main/providerAudit/mappings';
import { isRendererSafeVoiceProviderInfo, type RendererSafeVoiceProviderInfo } from '@shared/voiceProvider';

const VOICE_PROVIDER_IDS = Object.freeze(Object.keys(PROVIDER_AUDIT_PROVIDER_MAPPINGS.voice) as VoiceProviderAuditId[]);

/** Owns exhaustive Voice registration, validation, and audited creation. */
export class VoiceProviderRegistry {
  public constructor(
    private readonly factory: VoiceProviderFactory,
    private readonly audit: VoiceProviderAudit,
  ) {}

  public isKnownProviderId(providerId: unknown): providerId is VoiceProviderAuditId {
    return this.audit.isKnownProviderId(providerId);
  }

  public getAvailableProviders(): RendererSafeVoiceProviderInfo[] {
    return VOICE_PROVIDER_IDS.map((providerId) => {
      const info: unknown = this.factory.getProviderInfo(providerId);
      if (!isRendererSafeVoiceProviderInfo(info)) {
        throw new Error(`Invalid renderer-safe metadata for voice provider: ${providerId}`);
      }
      return info;
    });
  }

  public createProvider(providerId: string): BaseVoiceProvider {
    const auditContext = this.audit.startOperation(providerId, 'initialize', 'validation');
    if (!this.isKnownProviderId(providerId)) {
      auditContext.lifecycle.terminal(
        'validation',
        'failure',
        this.audit.createMetadata({
          causeCode: 'not-configured',
          durationMs: 0,
        }),
      );
      throw new Error(`Unknown voice provider: ${providerId}`);
    }

    auditContext.lifecycle.phaseCompleted('validation');
    auditContext.lifecycle.phaseEntered('dispatch');
    try {
      const provider = this.factory.create(providerId);
      this.assertProviderContract(provider, providerId);
      auditContext.lifecycle.phaseCompleted('dispatch');
      auditContext.lifecycle.terminal(
        'dispatch',
        'success',
        this.audit.createMetadata({
          durationMs: this.audit.durationMs(auditContext),
          transcriptionMode: provider.info.transcriptionMode,
        }),
      );
      return provider;
    } catch (error: unknown) {
      this.audit.terminalException(auditContext, 'dispatch', error);
      throw error;
    }
  }

  private assertProviderContract(provider: BaseVoiceProvider, registeredId: VoiceProviderAuditId): void {
    if (!isBatchVoiceProvider(provider) && !isStreamingVoiceProvider(provider)) {
      throw new TypeError('Voice provider class does not match its transcription mode');
    }
    if (provider.info.id !== registeredId) {
      throw new TypeError('Voice provider metadata does not match its registry entry');
    }
  }
}
