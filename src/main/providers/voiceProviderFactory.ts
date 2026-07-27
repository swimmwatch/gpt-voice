import {
  CHATGPT_VOICE_PROVIDER_ID,
  CHATGPT_RENDERER_PROVIDER_INFO,
  ChatGPTVoiceProvider,
  type ChatGPTVoiceProviderDependencies,
} from './ChatGPTVoiceProvider';
import {
  CLAUDE_WEB_RENDERER_PROVIDER_INFO,
  ClaudeWebVoiceProvider,
  type ClaudeWebVoiceProviderDependencies,
} from './ClaudeWebVoiceProvider';
import { ClaudeWebNavigationService, type ClaudeWebNavigationLogger } from './claudeWebNavigationService';
import {
  OPENAI_API_RENDERER_PROVIDER_INFO,
  OpenAIApiVoiceProvider,
  type OpenAIApiVoiceProviderDependencies,
} from './OpenAIApiVoiceProvider';
import type { BaseVoiceProvider } from './BaseVoiceProvider';
import type { VoiceProviderAudit } from './voiceProviderAudit';
import type { VoiceProviderAuditId } from '@main/providerAudit/mappings';
import { CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';
import { OPENAI_API_PROVIDER_ID } from './openaiApiSettingsUtils';
import type { RendererSafeVoiceProviderInfo } from '@shared/voiceProvider';
import type { I18nService } from '@main/i18n';

export interface VoiceProviderFactoryDependencies {
  readonly audit: VoiceProviderAudit;
  readonly chatGPT: Omit<ChatGPTVoiceProviderDependencies, 'audit' | 'localization'>;
  readonly claudeWeb: Omit<ClaudeWebVoiceProviderDependencies, 'audit' | 'localization' | 'navigationService'> & {
    readonly navigationLogger: ClaudeWebNavigationLogger;
  };
  readonly localization: Pick<I18nService, 'translate'>;
  readonly openAIApi: Omit<OpenAIApiVoiceProviderDependencies, 'audit' | 'localization'>;
}

/** Explicit construction boundary for fresh Voice provider instances. */
export class VoiceProviderFactory {
  private readonly claudeWebNavigationService: ClaudeWebNavigationService;

  public constructor(private readonly dependencies: VoiceProviderFactoryDependencies) {
    this.claudeWebNavigationService = new ClaudeWebNavigationService(dependencies.claudeWeb.navigationLogger);
  }

  public create(providerId: VoiceProviderAuditId): BaseVoiceProvider {
    switch (providerId) {
      case CHATGPT_VOICE_PROVIDER_ID:
        return new ChatGPTVoiceProvider({
          ...this.dependencies.chatGPT,
          audit: this.dependencies.audit,
          localization: this.dependencies.localization,
        });
      case OPENAI_API_PROVIDER_ID:
        return new OpenAIApiVoiceProvider({
          ...this.dependencies.openAIApi,
          audit: this.dependencies.audit,
          localization: this.dependencies.localization,
        });
      case CLAUDE_WEB_PROVIDER_ID:
        return new ClaudeWebVoiceProvider({
          ...this.dependencies.claudeWeb,
          audit: this.dependencies.audit,
          localization: this.dependencies.localization,
          navigationService: this.claudeWebNavigationService,
        });
    }
  }

  public getProviderInfo(providerId: VoiceProviderAuditId): RendererSafeVoiceProviderInfo {
    switch (providerId) {
      case CHATGPT_VOICE_PROVIDER_ID:
        return CHATGPT_RENDERER_PROVIDER_INFO;
      case OPENAI_API_PROVIDER_ID:
        return OPENAI_API_RENDERER_PROVIDER_INFO;
      case CLAUDE_WEB_PROVIDER_ID:
        return CLAUDE_WEB_RENDERER_PROVIDER_INFO;
    }
  }
}
