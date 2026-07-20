import type { BaseVoiceProvider } from './BaseVoiceProvider';
import { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
import type { StreamingVoiceProviderCapability } from './streamingVoiceProvider';
import { CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';

/** Resolves privileged live operations only from the nominally supported provider class. */
export function resolveStreamingVoiceProviderCapability(
  provider: BaseVoiceProvider | null,
): StreamingVoiceProviderCapability | null {
  if (!(provider instanceof ClaudeWebVoiceProvider) || provider.info.id !== CLAUDE_WEB_PROVIDER_ID) {
    return null;
  }

  return {
    provider,
    operations: provider,
  };
}
