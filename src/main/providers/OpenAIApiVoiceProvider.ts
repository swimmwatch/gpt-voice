import { StatusCodes } from 'http-status-codes';
import {
  BaseVoiceProvider,
  type PrettifyTextOptions,
  type TextProcessingResult,
  type TranscriptionResult,
  type VoiceProviderInfo,
} from './BaseVoiceProvider';
import { getAudioFileExtension } from './chatgptUtils';
import { getOpenAIApiSettingsWithSecret } from './openaiApiSettings';
import { OPENAI_API_PROVIDER_ID } from './openaiApiSettingsUtils';
import type { OpenAIApiSettingsWithSecret } from './openaiApiSettingsUtils';
import {
  buildOpenAIResponsesTextRequestBody,
  isUnsupportedOpenAIReasoningResponse,
  type OpenAIResponsesTextRequestBody,
} from './openaiResponsesUtils';
import { parseRateLimitedTranscribeResponse } from './transcriptionErrors';
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
const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const ERROR_RESPONSE_BODY_PREVIEW_CHARS = 300;

interface FetchResponseLike {
  status: number;
  text(): Promise<string>;
}

interface OpenAIApiVoiceProviderDependencies {
  fetch: (url: string, init: RequestInit) => Promise<FetchResponseLike>;
  getSettings: () => OpenAIApiSettingsWithSecret;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractOpenAIResponseText(value: unknown): string {
  if (!isRecord(value)) return '';

  if (typeof value.output_text === 'string') {
    return value.output_text.trim();
  }

  const output = value.output;
  if (Array.isArray(output)) {
    const text = output
      .map((item) => {
        if (!isRecord(item) || !Array.isArray(item.content)) return '';
        return item.content
          .map((contentItem) => {
            if (!isRecord(contentItem)) return '';
            if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') return contentItem.text;
            if (typeof contentItem.text === 'string') return contentItem.text;
            return '';
          })
          .join('');
      })
      .join('')
      .trim();
    if (text) return text;
  }

  return '';
}

export class OpenAIApiVoiceProvider extends BaseVoiceProvider {
  private readonly deps: OpenAIApiVoiceProviderDependencies;

  constructor(deps: Partial<OpenAIApiVoiceProviderDependencies> = {}) {
    super();
    this.deps = {
      fetch: deps.fetch || fetch,
      getSettings: deps.getSettings || getOpenAIApiSettingsWithSecret,
    };
  }

  readonly info: VoiceProviderInfo = {
    id: OPENAI_API_PROVIDER_ID,
    name: 'OpenAI API',
    authType: 'apiKey',
  };

  hasSession(): boolean {
    return Boolean(this.deps.getSettings().apiKey);
  }

  clearSession(): void {
    return undefined;
  }

  isReady(): boolean {
    return this.hasSession();
  }

  async transcribe(buffer: ArrayBuffer, mimeType = WEBM_OPUS_TRANSCRIPTION_MIME_TYPE): Promise<TranscriptionResult> {
    try {
      const settings = this.deps.getSettings();
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

      const response = await this.deps.fetch(TRANSCRIPTIONS_URL, {
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

  async prettifyText(text: string, options: PrettifyTextOptions): Promise<TextProcessingResult> {
    return this.processOpenAIText(text, options, {
      action: 'Prettify',
      emptyResultError: t('error.noPrettifyResult'),
      failureFallback: 'OpenAI API prettify failed',
      logMessage: 'Prettifying selected text with OpenAI API',
    });
  }

  private async processOpenAIText(
    text: string,
    options: PrettifyTextOptions,
    context: {
      action: string;
      emptyResultError: string;
      failureFallback: string;
      logMessage: string;
    },
  ): Promise<TextProcessingResult> {
    const cancellationError = t('status.prettifyCancelled');

    try {
      if (options.signal?.aborted) {
        return { success: false, error: cancellationError };
      }

      const settings = this.deps.getSettings();
      if (!settings.apiKey) {
        return { success: false, error: t('error.noAccessToken') };
      }

      log.info(`${context.logMessage}:`, {
        textLength: text.length,
        model: settings.prettifyModel,
        reasoning: options.reasoning,
      });

      const requestBody = buildOpenAIResponsesTextRequestBody({
        model: settings.prettifyModel,
        prompt: options.prompt,
        input: text,
        reasoning: options.reasoning,
      });
      let response = await this.fetchPrettifyResponse(settings.apiKey, requestBody, options.signal);
      let body = await response.text();

      if (requestBody.reasoning && isUnsupportedOpenAIReasoningResponse(response.status, body)) {
        log.info('Retrying OpenAI API prettify without reasoning after unsupported reasoning response');
        response = await this.fetchPrettifyResponse(
          settings.apiKey,
          {
            model: settings.prettifyModel,
            instructions: options.prompt,
            input: text,
          },
          options.signal,
        );
        body = await response.text();
      }

      if (response.status !== StatusCodes.OK) {
        return this.parseOpenAIErrorResponse(response.status, body, context.failureFallback);
      }

      return this.parseTextProcessingSuccessResponse(body, context.emptyResultError);
    } catch (error: unknown) {
      if (options.signal?.aborted) {
        return { success: false, error: cancellationError };
      }

      log.error(`${context.action} error:`, error instanceof Error ? error.message : error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private fetchPrettifyResponse(
    apiKey: string,
    body: OpenAIResponsesTextRequestBody,
    signal?: AbortSignal,
  ): Promise<FetchResponseLike> {
    return this.deps.fetch(RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify(body),
    });
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

  private parseTextProcessingSuccessResponse(body: string, emptyResultError: string): TextProcessingResult {
    let result: unknown;
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

    const text = extractOpenAIResponseText(result);
    if (!text) {
      return { success: false, error: emptyResultError };
    }

    return { success: true, text };
  }

  private parseOpenAIErrorResponse(status: number, body: string, fallback: string): TextProcessingResult {
    try {
      const result = JSON.parse(body) as { error?: { message?: string } };
      return {
        success: false,
        error: result.error?.message || `${fallback} with status ${status}`,
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
