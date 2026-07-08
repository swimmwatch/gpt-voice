import { compress, type CompressResult } from 'headroom-ai';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';

const log = createLogger('prompt-compression');
const HEADROOM_COMPRESSION_TIMEOUT_MS = 30000;

type OpenAIPromptMessage = {
  role: 'user';
  content: string;
};

export interface PromptCompressionResult {
  success: boolean;
  text?: string;
  fallback?: boolean;
  error?: string;
}

export interface PromptCompressionDependencies {
  compressMessages: (
    messages: OpenAIPromptMessage[],
    options: {
      timeout: number;
      fallback: boolean;
      retries: number;
      stack: string;
    },
  ) => Promise<CompressResult>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface CompressedPrompt {
  text: string;
  fallback: boolean;
}

function extractCompressedPromptText(result: CompressResult): string {
  const firstMessage = result.messages[0] as { content?: unknown } | undefined;
  const content = firstMessage?.content;
  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }
  return '';
}

async function compressPromptInput(
  text: string,
  deps: PromptCompressionDependencies,
  signal?: AbortSignal,
): Promise<CompressedPrompt> {
  if (signal?.aborted) {
    return { text, fallback: true };
  }

  try {
    const result = await deps.compressMessages(
      [
        {
          role: 'user',
          content: text,
        },
      ],
      {
        timeout: HEADROOM_COMPRESSION_TIMEOUT_MS,
        fallback: true,
        retries: 1,
        stack: 'gpt-voice',
      },
    );
    const compressedText = extractCompressedPromptText(result);
    const fallback = !result.compressed;
    log.info('Headroom prompt compression completed:', {
      sourceLength: text.length,
      compressedLength: compressedText.length,
      tokensBefore: result.tokensBefore,
      tokensAfter: result.tokensAfter,
      tokensSaved: result.tokensSaved,
      compressed: result.compressed,
      fallback,
    });
    return { text: compressedText, fallback };
  } catch (error: unknown) {
    log.warn('Headroom prompt compression failed:', {
      sourceLength: text.length,
      error: getErrorMessage(error),
    });
    throw error;
  }
}

export async function processCompressedPrompt(
  text: string,
  signal?: AbortSignal,
  deps: PromptCompressionDependencies = {
    compressMessages: compress,
  },
): Promise<PromptCompressionResult> {
  try {
    log.info('Starting prompt compression:', { textLength: text.length });

    if (signal?.aborted) {
      return { success: false, error: t('status.promptCompressionCancelled') };
    }

    const compressedPrompt = await compressPromptInput(text, deps, signal);
    if (signal?.aborted) {
      return { success: false, error: t('status.promptCompressionCancelled') };
    }
    if (!compressedPrompt.text.trim()) {
      return { success: false, error: t('error.noPromptCompressionResult') };
    }

    return { success: true, text: compressedPrompt.text, fallback: compressedPrompt.fallback };
  } catch (err: unknown) {
    if (signal?.aborted) {
      return { success: false, error: t('status.promptCompressionCancelled') };
    }
    log.error('Error:', getErrorMessage(err));
    return { success: false, error: getErrorMessage(err) };
  }
}
