/* eslint-disable max-classes-per-file -- Isolated provider adapters belong to one composition fixture. */
import type { Page } from 'playwright-core';
import type { ChatGPTSessionStore } from '@main/providers/chatgptSessionStore';
import type { SessionState } from '@main/providers/chatgptUtils';
import type { ClaudeWebPageTransportLike, ClaudeWebReadinessSnapshot } from '@main/providers/ClaudeWebVoiceProvider';
import type { ClaudeWebOrganizationEvidence, ClaudeWebSessionReadResult } from '@main/providers/claudeWebSession';
import { resolveClaudeWebOrganization } from '@main/providers/claudeWebSession';
import { ClaudeWebNavigationService } from '@main/providers/claudeWebNavigationService';
import type { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import { VoiceProviderFactory } from '@main/providers/voiceProviderFactory';
import { I18nService } from '@main/i18n';
import { VoiceProviderRegistry } from '@main/providers/voiceProviderRegistry';
import { DEFAULT_OPENAI_API_SETTINGS } from '@main/providers/openaiApiSettingsUtils';
import { UnavailableLocalWhisperCoordinatorPort } from '@main/providers/LocalWhisperVoiceProvider';
import { RecordingVoiceProviderAudit } from './voiceAuditTestUtils';

class MemoryChatGPTSessionStore implements ChatGPTSessionStore {
  public clearAccessToken(): void {}
  public clearSession(): void {}
  public readAccessToken(): string {
    return '';
  }
  public readSession(): SessionState | null {
    return null;
  }
  public saveAccessToken(): void {}
  public saveSession(): void {}
}

class InertClaudeWebTransport implements ClaudeWebPageTransportLike {
  public cancel(): Promise<void> {
    return Promise.resolve();
  }
  public cancelAll(): Promise<void> {
    return Promise.resolve();
  }
  public finish(): Promise<string> {
    return Promise.resolve('');
  }
  public push(): Promise<void> {
    return Promise.resolve();
  }
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
  public start(): Promise<never> {
    return Promise.reject(new Error('Unexpected Claude transport start'));
  }
  public transcribe(): Promise<string> {
    return Promise.reject(new Error('Unexpected Claude transcription'));
  }
}

const INERT_CLAUDE_READINESS: ClaudeWebReadinessSnapshot = {
  authentication: 'unavailable',
  featureAvailable: false,
  organizationEvidence: {
    activeOrganizationCandidates: [],
    eligibleOrganizations: [],
  },
};

/** State-owning test composition for fresh Voice factory and registry graphs. */
export class VoiceProviderRegistryFixture {
  public readonly audit: VoiceProviderAudit;
  public readonly factory: VoiceProviderFactory;
  public readonly registry: VoiceProviderRegistry;

  public constructor(audit: VoiceProviderAudit = new RecordingVoiceProviderAudit()) {
    this.audit = audit;
    this.factory = new VoiceProviderFactory({
      audit,
      localization: new I18nService(),
      localWhisper: {
        coordinator: new UnavailableLocalWhisperCoordinatorPort(),
      },
      chatGPT: {
        logger: { info: () => undefined, warn: () => undefined },
        now: () => 0,
        reloadPage: async () => undefined,
        sessionStore: new MemoryChatGPTSessionStore(),
        writeClipboardText: () => undefined,
      },
      claudeWeb: {
        clearSession: () => false,
        createTransport: () => new InertClaudeWebTransport(),
        getSettings: () => ({ language: 'en-US' }),
        getStorageState: (session) => ({ cookies: session.cookies, origins: session.origins }),
        inspectReadiness: async (_page: Page) => INERT_CLAUDE_READINESS,
        navigationService: new ClaudeWebNavigationService({ warn: () => undefined }),
        now: () => 0,
        readSession: (): ClaudeWebSessionReadResult => ({ status: 'missing' }),
        resolveOrganization: (evidence: ClaudeWebOrganizationEvidence) => resolveClaudeWebOrganization(evidence),
        saveSession: () => undefined,
        waitForReadinessRetry: async () => undefined,
        writeClipboardText: () => undefined,
      },
      openAIApi: {
        fetch: async () => ({ status: 200, text: async () => '' }),
        getSettings: () => ({ ...DEFAULT_OPENAI_API_SETTINGS, apiKey: '' }),
        writeClipboardText: () => undefined,
      },
    });
    this.registry = new VoiceProviderRegistry(this.factory, audit);
  }
}
