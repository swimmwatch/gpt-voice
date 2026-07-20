import { BaseVoiceProvider, type VoiceProviderInfo } from './BaseVoiceProvider';

/** Primary transcription is a complete buffered request. */
export abstract class BatchVoiceProvider extends BaseVoiceProvider {
  abstract readonly info: VoiceProviderInfo & { readonly transcriptionMode: 'batch' };
}
