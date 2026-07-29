import { BaseVoiceProvider, type VoiceProviderInfo } from './BaseVoiceProvider';
import type { VoiceBatchAuditContext } from './voiceProviderAudit';

/** Primary transcription is a complete buffered request. */
export abstract class BatchVoiceProvider extends BaseVoiceProvider {
  abstract readonly info: VoiceProviderInfo & { readonly transcriptionMode: 'batch' };

  abstract override transcribe(
    buffer: ArrayBuffer,
    mimeType?: string,
    auditContext?: VoiceBatchAuditContext,
  ): ReturnType<BaseVoiceProvider['transcribe']>;
}
