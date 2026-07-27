import {
  PrettifyProviderFactory,
  PrettifyProviderRegistry,
  PrettifyRuntime,
  type PrettifyProviderFactoryDependencies,
} from '@main/services/prettifyProviders';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import { CodexCliPrettifyErrorCode } from '@main/services/prettifyCodexCli';
import { PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import { getPrettifySettingsWithSecret } from '@main/services/prettifySettingsStorage';

type PrettifyRuntimeFixtureOptions = {
  readonly audit?: PrettifyProviderAudit;
  readonly claudeCliAdapter?: Partial<PrettifyProviderFactoryDependencies['claudeCliAdapter']>;
  readonly codexCliAdapter?: Partial<PrettifyProviderFactoryDependencies['codexCliAdapter']>;
  readonly fetch?: PrettifyProviderFactoryDependencies['fetch'];
  readonly getSettingsWithSecret?: PrettifyProviderFactoryDependencies['getSettingsWithSecret'];
};

/** Owns one isolated Prettify graph for provider and orchestration tests. */
export class PrettifyRuntimeFixture {
  public readonly audit: PrettifyProviderAudit;
  public readonly factory: PrettifyProviderFactory;
  public readonly registry: PrettifyProviderRegistry;
  public readonly runtime: PrettifyRuntime;

  public constructor(options: PrettifyRuntimeFixtureOptions = {}) {
    this.audit = options.audit ?? new PrettifyProviderAudit();
    const getSettings = options.getSettingsWithSecret ?? getPrettifySettingsWithSecret;
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
      fetch:
        options.fetch ??
        (async () => {
          throw new Error('Unexpected Prettify HTTP request');
        }),
      getSettingsWithSecret: getSettings,
    });
    this.registry = new PrettifyProviderRegistry(this.factory);
    this.runtime = new PrettifyRuntime({
      audit: this.audit,
      getSettingsWithSecret: getSettings,
      registry: this.registry,
    });
  }
}
