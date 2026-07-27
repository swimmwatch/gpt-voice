/* eslint-disable max-classes-per-file -- the graph fixture owns its isolated settings adapter. */
import {
  PrettifyProviderFactory,
  PrettifyProviderRegistry,
  PrettifyRuntime,
  type PrettifyProviderFactoryDependencies,
} from '@main/services/prettifyProviders';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import { CodexCliPrettifyErrorCode } from '@main/services/prettifyCodexCli';
import { PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import { TEST_PROVIDER_AUDIT_DEPENDENCIES } from './providerAudit/providerAuditTestDependencies';
import {
  createPrettifySettingsWithSecret,
  type PrettifySettingsStorage,
  type PrettifySettingsWithSecret,
} from '@main/services/prettifySettingsStorage';
import { getPrettifyBaseUrlValidationError, type PrettifySettingsInput } from '@shared/prettifySettings';
import { I18nService } from '@main/i18n';
import { RecordingDiagnosticCapture } from './diagnosticCaptureTestUtils';

type PrettifyRuntimeFixtureOptions = {
  readonly audit?: PrettifyProviderAudit;
  readonly claudeCliAdapter?: Partial<PrettifyProviderFactoryDependencies['claudeCliAdapter']>;
  readonly codexCliAdapter?: Partial<PrettifyProviderFactoryDependencies['codexCliAdapter']>;
  readonly diagnosticCapture?: RecordingDiagnosticCapture;
  readonly fetch?: PrettifyProviderFactoryDependencies['fetch'];
  readonly settings?: Pick<PrettifySettingsStorage, 'getWithSecret'>;
};

export class TestPrettifySettingsStorage {
  public constructor(private readonly storedSettings: PrettifySettingsInput = {}) {}

  public getWithSecret(input: PrettifySettingsInput = {}): PrettifySettingsWithSecret {
    const settings = createPrettifySettingsWithSecret({
      ...this.storedSettings,
      ...input,
      claudeCli: { ...this.storedSettings.claudeCli, ...input.claudeCli },
      codexCli: { ...this.storedSettings.codexCli, ...input.codexCli },
      ollama: { ...this.storedSettings.ollama, ...input.ollama },
      vllm: { ...this.storedSettings.vllm, ...input.vllm },
    });
    for (const baseUrl of [settings.ollama.baseUrl, settings.vllm.baseUrl]) {
      const error = getPrettifyBaseUrlValidationError(baseUrl);
      if (error) throw new Error(error);
    }
    return settings;
  }
}

/** Owns one isolated Prettify graph for provider and orchestration tests. */
export class PrettifyRuntimeFixture {
  public readonly audit: PrettifyProviderAudit;
  public readonly diagnosticCapture: RecordingDiagnosticCapture;
  public readonly factory: PrettifyProviderFactory;
  public readonly registry: PrettifyProviderRegistry;
  public readonly runtime: PrettifyRuntime;

  public constructor(options: PrettifyRuntimeFixtureOptions = {}) {
    this.audit = options.audit ?? new PrettifyProviderAudit(TEST_PROVIDER_AUDIT_DEPENDENCIES);
    this.diagnosticCapture = options.diagnosticCapture ?? new RecordingDiagnosticCapture();
    const settings = options.settings ?? new TestPrettifySettingsStorage();
    const localization = new I18nService();
    const claudeCliAdapter: PrettifyProviderFactoryDependencies['claudeCliAdapter'] = {
      checkAvailability: async () => ({
        error: ClaudeCliPrettifyErrorCode.ProcessFailed,
        success: false,
      }),
      prepare: async () => ({
        error: ClaudeCliPrettifyErrorCode.ProcessFailed,
        success: false,
      }),
      ...options.claudeCliAdapter,
    };
    const codexCliAdapter: PrettifyProviderFactoryDependencies['codexCliAdapter'] = {
      checkAvailability: async () => ({
        error: CodexCliPrettifyErrorCode.ProcessFailed,
        success: false,
      }),
      listModels: async () => ({
        error: CodexCliPrettifyErrorCode.ModelDiscoveryFailed,
        success: false,
      }),
      prepare: async () => ({
        error: CodexCliPrettifyErrorCode.ProcessFailed,
        success: false,
      }),
      ...options.codexCliAdapter,
    };
    this.factory = new PrettifyProviderFactory({
      audit: this.audit,
      claudeCliAdapter,
      codexCliAdapter,
      diagnosticCapture: this.diagnosticCapture,
      fetch:
        options.fetch ??
        (async () => {
          throw new Error('Unexpected Prettify HTTP request');
        }),
      localization,
      settings,
    });
    this.registry = new PrettifyProviderRegistry(this.factory);
    this.runtime = new PrettifyRuntime({
      audit: this.audit,
      localization,
      registry: this.registry,
      settings,
    });
  }
}
