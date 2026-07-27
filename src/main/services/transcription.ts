import type { I18nService } from '../i18n';
import { createLogger } from '../logger';
import type { BaseVoiceProvider, TranscriptionResult } from '../providers/BaseVoiceProvider';
import { isBatchVoiceProvider } from '../providers/voiceProviderGuards';
import { type VoiceProviderAudit, type VoiceBatchAuditContext } from '../providers/voiceProviderAudit';
import {
  completeBatchTranscription,
  completeCachedTranscription,
  createTranscriptionCompletionSnapshot,
  readCachedTranscription,
  type TranscriptionCompletionDependencies,
} from './transcriptionCompletion';
import { presentNotificationError } from '@shared/notifications';
import { normalizeProviderAuditExceptionType } from '@main/providerAudit';

const log = createLogger('transcribe');

export interface TranscriptionBackgroundBrowser {
  ensure(): Promise<void>;
  getActiveProvider(): BaseVoiceProvider | null;
  isReady(): boolean;
}

export interface TranscriptionServiceDependencies extends TranscriptionCompletionDependencies {
  audit: VoiceProviderAudit;
  backgroundBrowserService: TranscriptionBackgroundBrowser;
  getRequestedAt: () => string;
  localization: Pick<I18nService, 'translate'>;
}

/** Owns one main-process batch transcription flow and its injected completion state. */
export class TranscriptionService {
  public constructor(private readonly dependencies: TranscriptionServiceDependencies) {}

  public transcribe = async (buffer: ArrayBuffer, mimeType: string): Promise<TranscriptionResult> => {
    const requestedAt = this.dependencies.getRequestedAt();
    let auditContext: VoiceBatchAuditContext | undefined;

    try {
      const providerBeforeEnsure = this.dependencies.backgroundBrowserService.getActiveProvider();
      if (providerBeforeEnsure) {
        const snapshot = createTranscriptionCompletionSnapshot(providerBeforeEnsure, requestedAt);
        const cachedText = readCachedTranscription(this.dependencies, snapshot, buffer, mimeType);
        if (cachedText) {
          return completeCachedTranscription(this.dependencies, snapshot, cachedText);
        }
      }

      await this.dependencies.backgroundBrowserService.ensure();
      const provider = this.dependencies.backgroundBrowserService.getActiveProvider();
      if (!provider) {
        return { success: false, error: this.dependencies.localization.translate('error.notLoggedIn') };
      }

      if (provider !== providerBeforeEnsure) {
        const snapshot = createTranscriptionCompletionSnapshot(provider, requestedAt);
        const cachedText = readCachedTranscription(this.dependencies, snapshot, buffer, mimeType);
        if (cachedText) {
          return completeCachedTranscription(this.dependencies, snapshot, cachedText);
        }
      }

      if (!this.dependencies.backgroundBrowserService.isReady() || !provider.isReady()) {
        return { success: false, error: this.dependencies.localization.translate('error.notLoggedIn') };
      }

      const batchProvider = isBatchVoiceProvider(provider) ? provider : null;
      if (batchProvider) {
        auditContext = this.dependencies.audit.startBatch(provider.info.id, buffer, mimeType);
      }
      const result =
        batchProvider && auditContext
          ? await batchProvider.transcribe(buffer, mimeType, auditContext)
          : await provider.transcribe(buffer, mimeType);
      if (auditContext) {
        this.dependencies.audit.terminalBatch(
          auditContext,
          'result',
          result.success ? 'success' : 'failure',
          result.success && result.text
            ? { resultLength: result.text.length }
            : {
                causeCode: 'unknown',
              },
        );
      }
      if (result.success && result.text) {
        completeBatchTranscription(
          this.dependencies,
          createTranscriptionCompletionSnapshot(provider, requestedAt),
          buffer,
          mimeType,
          result.text,
        );
      }

      return result;
    } catch (error: unknown) {
      if (auditContext) {
        this.dependencies.audit.terminalBatch(auditContext, 'submission', 'failure', {
          causeCode: 'unknown',
          exceptionType: normalizeProviderAuditExceptionType(error),
        });
      } else {
        log.error(
          'Transcription error:',
          presentNotificationError(error, { context: 'transcription' }).safeLogMetadata,
        );
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
