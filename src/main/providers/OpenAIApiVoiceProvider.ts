import { StatusCodes } from 'http-status-codes';
import { BaseVoiceProvider, type TranscriptionResult, type VoiceProviderInfo } from './BaseVoiceProvider';
import { getAudioFileExtension } from './chatgptUtils';
import { getOpenAIApiSettingsWithSecret } from './openaiApiSettings';
import { OPENAI_API_PROVIDER_ID } from './openaiApiSettingsUtils';
import { t } from '../i18n';
import { createLogger } from '../logger';
import { writeClipboardText } from '../electronRuntime';
import {
  DEFAULT_TRANSCRIPTION_MIME_TYPE,
  TRANSCRIPTION_UPLOAD_FILE_BASENAME,
  WEBM_OPUS_TRANSCRIPTION_MIME_TYPE,
} from '@shared/transcriptionConstants';

const log = createLogger('openai-api-provider');
const TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const ERROR_RESPONSE_BODY_PREVIEW_CHARS = 300;

export class OpenAIApiVoiceProvider extends BaseVoiceProvider {
  readonly info: VoiceProviderInfo = {
    id: OPENAI_API_PROVIDER_ID,
    name: 'OpenAI API',
    authType: 'apiKey',
  };

  hasSession(): boolean {
    return Boolean(getOpenAIApiSettingsWithSecret().apiKey);
  }

  clearSession(): void {
    return undefined;
  }

  isReady(): boolean {
    return this.hasSession();
  }

  async transcribe(buffer: ArrayBuffer, mimeType = WEBM_OPUS_TRANSCRIPTION_MIME_TYPE): Promise<TranscriptionResult> {
    try {
      const settings = getOpenAIApiSettingsWithSecret();
      if (!settings.apiKey) {
        return { success: false, error: t('error.noAccessToken') };
      }

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

      const response = await fetch(TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: formData,
      });
      const body = await response.text();

      if (response.status !== StatusCodes.OK) {
        return this.parseErrorResponse(response.status, body);
      }

      return this.parseSuccessResponse(body);
    } catch (error: unknown) {
      log.error('Transcribe error:', error instanceof Error ? error.message : error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private parseSuccessResponse(body: string): TranscriptionResult {
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(body);
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

    writeClipboardText(text);
    return { success: true, text };
  }

  private parseErrorResponse(status: number, body: string): TranscriptionResult {
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
}
