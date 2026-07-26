import { BaseVoiceProvider } from './BaseVoiceProvider';
import { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
import { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
import { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';
import { isBatchVoiceProvider, isStreamingVoiceProvider } from './voiceProviderGuards';
import { CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';
import { isRendererSafeVoiceProviderInfo, type RendererSafeVoiceProviderInfo } from '@shared/voiceProvider';
import {
  voiceProviderAudit,
  type VoiceProviderAudit,
} from './voiceProviderAudit';
import type { VoiceProviderAuditId } from '@main/providerAudit/mappings';

export type {
  TranscriptionResult,
  VoiceProviderInfo,
  VoiceProviderAuthType,
  VoiceProviderCategory,
  VoiceTranscriptionMode,
} from './BaseVoiceProvider';
export { BaseVoiceProvider } from './BaseVoiceProvider';
export { BatchVoiceProvider } from './BatchVoiceProvider';
export { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
export { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
export { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';
export { StreamingTranscriptionOperationError } from './StreamingTranscriptionOperationError';
export {
  copyStreamingTranscriptionChunk,
  StreamingVoiceProvider,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
} from './streamingVoiceProvider';
export type {
  CancelStreamingTranscriptionInput,
  CopiedStreamingTranscriptionChunk,
  FinishStreamingTranscriptionInput,
  PushStreamingTranscriptionChunkInput,
  StartStreamingTranscriptionInput,
  StreamingTranscriptionChunkAccepted,
  StreamingTranscriptionCancellation,
  StreamingTranscriptionError,
  StreamingTranscriptionOperationId,
  StreamingTranscriptionResult,
  StreamingTranscriptionStarted,
  StreamingVoiceProviderCapability,
  StreamingVoiceProviderOperations,
} from './streamingVoiceProvider';
export { resolveStreamingVoiceProviderCapability } from './streamingVoiceProviderCapability';
export {
  VoiceProviderAudit,
  voiceProviderAudit,
} from './voiceProviderAudit';
export type {
  VoiceAuditLifecycle,
  VoiceAuditMetadata,
  VoiceAuditOperationContext,
  VoiceBatchAuditContext,
} from './voiceProviderAudit';
export { isBatchVoiceProvider, isStreamingVoiceProvider } from './voiceProviderGuards';

type VoiceProviderFactory = (audit: VoiceProviderAudit) => BaseVoiceProvider;

const providerRegistry = {
  chatgpt: (audit) => new ChatGPTVoiceProvider({ audit }),
  'openai-api': (audit) => new OpenAIApiVoiceProvider({ audit }),
  [CLAUDE_WEB_PROVIDER_ID]: () => new ClaudeWebVoiceProvider(),
} as const satisfies Readonly<Record<VoiceProviderAuditId, VoiceProviderFactory>>;

export function getAvailableProviders(): RendererSafeVoiceProviderInfo[] {
  return (Object.entries(providerRegistry) as Array<[VoiceProviderAuditId, VoiceProviderFactory]>).map(
    ([registeredId, factory]) => {
      const p = factory(voiceProviderAudit);
      if (!isBatchVoiceProvider(p) && !isStreamingVoiceProvider(p)) {
        throw new Error(`Voice provider class does not match its transcription mode: ${p.info.id}`);
      }
      if (p.info.id !== registeredId) {
        throw new Error('Voice provider metadata does not match its registry entry');
      }
      const info: unknown = {
        id: p.info.id,
        name: p.info.name,
        authType: p.info.authType,
        category: p.info.category,
        hasSettings: p.info.hasSettings,
        transcriptionMode: p.info.transcriptionMode,
      };
      if (!isRendererSafeVoiceProviderInfo(info)) {
        throw new Error(`Invalid renderer-safe metadata for voice provider: ${p.info.id}`);
      }
      return info;
    },
  );
}

export function createProvider(
  id: string,
  audit: VoiceProviderAudit = voiceProviderAudit,
): BaseVoiceProvider {
  const auditContext = audit.startOperation(id, 'initialize', 'validation');
  if (!audit.isKnownProviderId(id)) {
    auditContext.lifecycle.terminal(
      'validation',
      'failure',
      audit.createMetadata({
        causeCode: 'not-configured',
        durationMs: 0,
      }),
    );
    throw new Error(`Unknown voice provider: ${id}`);
  }

  auditContext.lifecycle.phaseCompleted('validation');
  auditContext.lifecycle.phaseEntered('dispatch');
  try {
    const provider = providerRegistry[id](audit);
    if (!isBatchVoiceProvider(provider) && !isStreamingVoiceProvider(provider)) {
      throw new TypeError('Voice provider class does not match its transcription mode');
    }
    if (provider.info.id !== id) {
      throw new TypeError('Voice provider metadata does not match its registry entry');
    }
    auditContext.lifecycle.phaseCompleted('dispatch');
    auditContext.lifecycle.terminal(
      'dispatch',
      'success',
      audit.createMetadata({
        durationMs: audit.durationMs(auditContext),
        transcriptionMode: provider.info.transcriptionMode,
      }),
    );
    return provider;
  } catch (error: unknown) {
    audit.terminalException(auditContext, 'dispatch', error);
    throw error;
  }
}
