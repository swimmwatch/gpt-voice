import { StatusCodes } from 'http-status-codes';
import type { TranscriptionResult, VoiceProviderInfo } from './BaseVoiceProvider';
import { BatchVoiceProvider } from './BatchVoiceProvider';
import { getAudioFileExtension } from './chatgptUtils';
import { OPENAI_API_PROVIDER_ID } from './openaiApiSettingsUtils';
import type { OpenAIApiSettingsWithSecret } from './openaiApiSettingsUtils';
import { parseRateLimitedTranscribeResponse } from './transcriptionErrors';
import { t } from '../i18n';
import {
  DEFAULT_TRANSCRIPTION_MIME_TYPE,
  TRANSCRIPTION_UPLOAD_FILE_BASENAME,
  WEBM_OPUS_TRANSCRIPTION_MIME_TYPE,
} from '@shared/transcriptionConstants';
import type { VoiceProviderAudit, VoiceBatchAuditContext } from './voiceProviderAudit';
import { normalizeProviderAuditExceptionType } from '@main/providerAudit';

const TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const ERROR_RESPONSE_BODY_PREVIEW_CHARS = 300;

export interface FetchResponseLike {
  status: number;
  text(): Promise<string>;
}

export interface OpenAIApiVoiceProviderDependencies {
  audit: VoiceProviderAudit;
  fetch: (url: string, init: RequestInit) => Promise<FetchResponseLike>;
  getSettings: () => OpenAIApiSettingsWithSecret;
  writeClipboardText: (text: string) => void;
}

export const OPENAI_API_VOICE_PROVIDER_INFO = Object.freeze({
  id: OPENAI_API_PROVIDER_ID,
  name: 'OpenAI API',
  authType: 'apiKey',
  category: 'api',
  hasSettings: true,
  transcriptionMode: 'batch',
}) satisfies VoiceProviderInfo;

export const OPENAI_API_RENDERER_PROVIDER_INFO = OPENAI_API_VOICE_PROVIDER_INFO;

/** API-key provider for OpenAI's hosted audio transcription endpoint. */
export class OpenAIApiVoiceProvider extends BatchVoiceProvider {
  private readonly deps: OpenAIApiVoiceProviderDependencies;

  constructor(deps: OpenAIApiVoiceProviderDependencies) {
    super();
    this.deps = deps;
  }

  readonly info = OPENAI_API_VOICE_PROVIDER_INFO;

  hasSession(): boolean {
    return Boolean(this.deps.getSettings().apiKey);
  }

  clearSession(): void {
    return undefined;
  }

  isReady(): boolean {
    return this.hasSession();
  }

  getTranscriptionCacheContext(): readonly string[] {
    const settings = this.deps.getSettings();

    return [
      'model',
      settings.model,
      'language',
      settings.language,
      'prompt',
      settings.prompt,
      'temperature',
      String(settings.temperature),
    ];
  }

  /** Executes one audited OpenAI batch request without changing its public result. */
  async transcribe(
    buffer: ArrayBuffer,
    mimeType = WEBM_OPUS_TRANSCRIPTION_MIME_TYPE,
    auditContext?: VoiceBatchAuditContext,
  ): Promise<TranscriptionResult> {
    const audit = auditContext ?? this.deps.audit.startBatch(this.info.id, buffer, mimeType);
    audit.lifecycle.phaseCompleted('dispatch', this.deps.audit.createBatchMetadata(audit, { attemptCount: 1 }));
    audit.lifecycle.phaseEntered('configuration', this.deps.audit.createBatchMetadata(audit, { attemptCount: 1 }));

    try {
      const settings = this.deps.getSettings();
      if (!settings.apiKey) {
        this.deps.audit.terminalBatch(audit, 'configuration', 'failure', {
          attemptCount: 0,
          causeCode: 'not-configured',
        });
        return { success: false, error: t('error.noAccessToken') };
      }
      audit.lifecycle.phaseCompleted('configuration', this.deps.audit.createBatchMetadata(audit, { attemptCount: 1 }));
      audit.lifecycle.phaseEntered('validation', this.deps.audit.createBatchMetadata(audit, { attemptCount: 1 }));

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || DEFAULT_TRANSCRIPTION_MIME_TYPE });
      formData.append('file', blob, `${TRANSCRIPTION_UPLOAD_FILE_BASENAME}.${getAudioFileExtension(mimeType)}`);
      formData.append('model', settings.model);
      formData.append('response_format', 'json');
      formData.append('temperature', String(settings.temperature));

      if (settings.language !== 'auto') {
        formData.append('language', settings.language);
      }
      if (settings.prompt) {
        formData.append('prompt', settings.prompt);
      }
      audit.lifecycle.phaseCompleted('validation', this.deps.audit.createBatchMetadata(audit, { attemptCount: 1 }));
      audit.lifecycle.phaseEntered('submission', this.deps.audit.createBatchMetadata(audit, { attemptCount: 1 }));

      const response = await this.deps.fetch(TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: formData,
      });
      const body = await response.text();
      audit.lifecycle.phaseCompleted(
        'submission',
        this.deps.audit.createBatchMetadata(audit, {
          attemptCount: 1,
          httpStatus: response.status,
        }),
      );

      if (response.status !== Number(StatusCodes.OK)) {
        const result = this.parseErrorResponse(response.status, body);
        this.deps.audit.terminalBatch(audit, 'result', 'failure', {
          attemptCount: 1,
          causeCode: response.status === Number(StatusCodes.TOO_MANY_REQUESTS) ? 'rate-limited' : 'request-failed',
          httpStatus: response.status,
        });
        return result;
      }

      audit.lifecycle.phaseEntered(
        'result',
        this.deps.audit.createBatchMetadata(audit, {
          attemptCount: 1,
          httpStatus: response.status,
        }),
      );
      const result = this.parseSuccessResponse(body);
      if (result.success && result.text) {
        this.deps.audit.terminalBatch(audit, 'result', 'success', {
          attemptCount: 1,
          httpStatus: response.status,
          resultLength: result.text.length,
        });
        return result;
      }

      this.deps.audit.terminalBatch(audit, 'result', 'failure', {
        attemptCount: 1,
        causeCode: this.classifySuccessFailure(body),
        httpStatus: response.status,
      });
      return result;
    } catch (error: unknown) {
      this.deps.audit.terminalBatch(audit, 'submission', 'failure', {
        attemptCount: 1,
        causeCode: 'connection-failed',
        exceptionType: normalizeProviderAuditExceptionType(error),
      });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private parseSuccessResponse(body: string): TranscriptionResult {
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        error: t('error.nonJsonResponse', {
          status: String(StatusCodes.OK),
          body: body.substring(0, ERROR_RESPONSE_BODY_PREVIEW_CHARS),
        }),
      };
    }

    const text = typeof result.text === 'string' ? result.text : '';
    if (!text) {
      return { success: false, error: t('error.noTranscription'), raw: JSON.stringify(result) };
    }

    this.deps.writeClipboardText(text);
    return { success: true, text };
  }

  private parseErrorResponse(status: number, body: string): TranscriptionResult {
    const rateLimited = parseRateLimitedTranscribeResponse({ status, body });
    if (rateLimited) {
      return rateLimited;
    }

    try {
      const result = JSON.parse(body) as { error?: { message?: string } };
      return {
        success: false,
        error: result.error?.message || `OpenAI API transcription failed with status ${status}`,
        raw: body,
      };
    } catch {
      return {
        success: false,
        error: t('error.nonJsonResponse', {
          status: String(status),
          body: body.substring(0, ERROR_RESPONSE_BODY_PREVIEW_CHARS),
        }),
      };
    }
  }

  private classifySuccessFailure(body: string): 'empty-result' | 'provider-contract-changed' | 'unexpected-response' {
    try {
      const result: unknown = JSON.parse(body);
      if (typeof result !== 'object' || result === null || Array.isArray(result)) {
        return 'provider-contract-changed';
      }
      return 'error' in result ? 'unexpected-response' : 'empty-result';
    } catch {
      return 'provider-contract-changed';
    }
  }
}
