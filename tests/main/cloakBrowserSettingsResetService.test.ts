/* eslint-disable max-classes-per-file -- deterministic lifecycle adapters own independent test state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BackgroundBrowserLaunchOptions, BackgroundBrowserStatus } from '@main/browser';
import type {
  CloakBrowserSettingsSnapshot,
  CloakBrowserSettingsWithSecret,
  PreparedCloakBrowserSettings,
} from '@main/cloakBrowserSettings';
import {
  CloakBrowserSettingsResetService,
  type CloakBrowserSettingsSaveResult,
} from '@main/services/cloakBrowserSettingsReset';
import { INITIAL_PROVIDER_READINESS_TIMEOUT_MS } from '@main/services/initialProviderReadinessDeadline';
import type { TranslationProviderShutdownResult } from '@main/translateProviders';
import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import { I18nService } from '@main/i18n';
import { InitialProviderReadinessTestDependencies } from './initialProviderReadinessTestUtils';

const PRIVATE_CANARY = 'private://settings/session?token=credential-canary';

const AUTHORITATIVE_SETTINGS: CloakBrowserSettingsView = Object.freeze({
  backgroundMode: 'hidden',
  fingerprintSeed: '12345',
  humanPreset: 'careful',
  humanize: true,
  locale: 'en-US',
  proxy: Object.freeze({
    bypass: '',
    enabled: false,
    geoip: true,
    hasPassword: false,
    server: '',
    username: '',
  }),
  timezone: 'UTC',
});

const CANDIDATE_SETTINGS: CloakBrowserSettingsView = Object.freeze({
  ...AUTHORITATIVE_SETTINGS,
  backgroundMode: 'visible',
});

function withSecret(settings: CloakBrowserSettingsView, password = ''): CloakBrowserSettingsWithSecret {
  const { hasPassword: _hasPassword, ...proxy } = settings.proxy;
  return Object.freeze({
    ...settings,
    proxy: Object.freeze({
      ...proxy,
      password,
    }),
  });
}

class Deferred {
  public readonly promise: Promise<void>;
  private resolvePromise: (() => void) | null = null;

  public constructor() {
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  public resolve(): void {
    this.resolvePromise?.();
  }
}

class RecordingSettingsRepository {
  public persistError: Error | null = null;
  public prepareCount = 0;
  public reloadCount = 0;
  private snapshot: CloakBrowserSettingsSnapshot = {
    settings: AUTHORITATIVE_SETTINGS,
    settingsWithSecret: withSecret(AUTHORITATIVE_SETTINGS),
  };

  public constructor(private readonly events: string[]) {}

  public getView(): CloakBrowserSettingsView {
    return this.snapshot.settings;
  }

  public getSnapshot(): CloakBrowserSettingsSnapshot {
    this.events.push('settings:reload');
    this.reloadCount += 1;
    return this.snapshot;
  }

  public prepare(_input: CloakBrowserSettingsInput = {}): PreparedCloakBrowserSettings {
    this.events.push('settings:prepare');
    this.prepareCount += 1;
    const candidateSnapshot = {
      settings: CANDIDATE_SETTINGS,
      settingsWithSecret: withSecret(CANDIDATE_SETTINGS, PRIVATE_CANARY),
    };
    return {
      authoritativeSettings: this.snapshot.settings,
      ...candidateSnapshot,
      persist: () => {
        this.events.push('settings:persist');
        if (this.persistError) throw this.persistError;
        this.snapshot = candidateSnapshot;
        return candidateSnapshot.settings;
      },
    };
  }
}

class RecordingBackgroundBrowser {
  public readonly initializeInputs: BackgroundBrowserLaunchOptions[] = [];
  public readonly publishedStatuses: BackgroundBrowserStatus[] = [];
  public initializeResults: Array<BackgroundBrowserStatus | Error | Promise<BackgroundBrowserStatus>> = [];
  public releaseResults: Array<boolean | Error> = [];
  public releaseGate: Deferred | null = null;
  public readonly releaseStarted = new Deferred();
  public readonly restorationStarted = new Deferred();

  public constructor(private readonly events: string[]) {}

  public async initialize(options: BackgroundBrowserLaunchOptions = {}): Promise<BackgroundBrowserStatus> {
    this.initializeInputs.push(options);
    this.events.push(`browser:initialize:${options.cloakBrowserSettings?.backgroundMode ?? 'stored'}`);
    if (this.initializeInputs.length === 2) this.restorationStarted.resolve();
    const result = this.initializeResults.shift() ?? { providerId: 'openai-api', ready: true };
    if (result instanceof Error) throw result;
    return await result;
  }

  public async releaseForSettingsReset(): Promise<boolean> {
    this.events.push('browser:release');
    this.releaseStarted.resolve();
    if (this.releaseGate) {
      const gate = this.releaseGate;
      this.releaseGate = null;
      await gate.promise;
    }
    const result = this.releaseResults.shift() ?? true;
    if (result instanceof Error) throw result;
    return result;
  }
}

class RecordingTranslationReset {
  public cleanupSettlements = 0;
  public resetResult: TranslationProviderShutdownResult = {
    failedProviderIds: [],
    success: true,
  };
  public throwOnReset = false;
  public throwOnWarm = false;
  public unexpectedSettlements = 0;
  public warmCount = 0;

  public constructor(private readonly events: string[]) {}

  public async reset(): Promise<TranslationProviderShutdownResult> {
    this.events.push('translation:reset');
    if (this.throwOnReset) throw new Error(PRIVATE_CANARY);
    return this.resetResult;
  }

  public async initializeSelectedProvider(): Promise<never> {
    this.events.push('translation:warm');
    this.warmCount += 1;
    if (this.throwOnWarm) throw new Error(PRIVATE_CANARY);
    return undefined as never;
  }

  public settleResetCleanupFailure(): never {
    this.events.push('translation:cleanup-failure');
    this.cleanupSettlements += 1;
    return undefined as never;
  }

  public settleResetUnexpectedFailure(): never {
    this.events.push('translation:unexpected-failure');
    this.unexpectedSettlements += 1;
    return undefined as never;
  }
}

class CloakBrowserSettingsResetFixture {
  public readonly background: RecordingBackgroundBrowser;
  public readonly events: string[] = [];
  public readonly logs: string[] = [];
  public readonly readinessDeadline = new InitialProviderReadinessTestDependencies();
  public readonly service: CloakBrowserSettingsResetService;
  public readonly settings: RecordingSettingsRepository;
  public throwOnLog = false;
  public readonly translation: RecordingTranslationReset;

  public constructor() {
    this.background = new RecordingBackgroundBrowser(this.events);
    this.settings = new RecordingSettingsRepository(this.events);
    this.translation = new RecordingTranslationReset(this.events);
    this.service = new CloakBrowserSettingsResetService({
      backgroundBrowser: this.background,
      getVoiceProviderId: () => 'openai-api',
      localization: new I18nService(),
      logger: {
        error: (message) => this.recordLog(message),
        info: (message) => this.recordLog(message),
        warn: (message) => this.recordLog(message),
      },
      publishBackgroundStatus: (status) => {
        this.background.publishedStatuses.push(status);
      },
      readinessDeadline: this.readinessDeadline,
      settings: this.settings,
      translation: this.translation,
    });
  }

  public save(request: unknown = { backgroundMode: 'visible' }): Promise<CloakBrowserSettingsSaveResult> {
    return this.service.save(request);
  }

  private recordLog(message: string): void {
    if (this.throwOnLog) throw new Error(PRIVATE_CANARY);
    this.logs.push(message);
  }
}

describe('CloakBrowserSettingsResetService', () => {
  it('persists only after cleanup and candidate restart, then warms Translation', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();

    const result = await fixture.save();

    assert.deepEqual(result, {
      backgroundStatus: { providerId: 'openai-api', ready: true },
      settings: CANDIDATE_SETTINGS,
      success: true,
    });
    assert.deepEqual(fixture.events, [
      'settings:prepare',
      'translation:reset',
      'browser:release',
      'browser:initialize:visible',
      'settings:persist',
      'translation:warm',
    ]);
    assert.equal(fixture.background.publishedStatuses.length, 1);
  });

  it('rejects invalid input without resetting, launching, or persisting', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();

    const result = await fixture.save({ backgroundMode: PRIVATE_CANARY });

    assert.equal(result.success, false);
    assert.deepEqual(fixture.events, []);
    assert.equal(JSON.stringify({ result, logs: fixture.logs }).includes(PRIVATE_CANARY), false);
  });

  it('blocks candidate ownership and persistence when Translation cleanup fails', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.translation.resetResult = {
      failedProviderIds: ['google'],
      success: false,
    };

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.deepEqual(result.settings, AUTHORITATIVE_SETTINGS);
    assert.deepEqual(fixture.events, ['settings:prepare', 'translation:reset']);
  });

  it('settles a throwing Translation reset without starting browser work', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.translation.throwOnReset = true;

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.equal(fixture.translation.cleanupSettlements, 1);
    assert.deepEqual(fixture.events, ['settings:prepare', 'translation:reset', 'translation:cleanup-failure']);
    assert.equal(JSON.stringify({ result, logs: fixture.logs }).includes(PRIVATE_CANARY), false);
  });

  it('settles cleanup failure and starts no candidate when browser release is uncertain', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.background.releaseResults.push(false);

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.equal(fixture.translation.cleanupSettlements, 1);
    assert.deepEqual(fixture.events, [
      'settings:prepare',
      'translation:reset',
      'browser:release',
      'translation:cleanup-failure',
    ]);
  });

  it('cleans a failed candidate restart and preserves authoritative settings', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.background.initializeResults.push(new Error(PRIVATE_CANARY));

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.deepEqual(result.settings, AUTHORITATIVE_SETTINGS);
    assert.equal(fixture.translation.unexpectedSettlements, 1);
    assert.deepEqual(fixture.events, [
      'settings:prepare',
      'translation:reset',
      'browser:release',
      'browser:initialize:visible',
      'browser:release',
      'translation:unexpected-failure',
    ]);
    assert.equal(JSON.stringify({ result, logs: fixture.logs }).includes(PRIVATE_CANARY), false);
  });

  it('closes the candidate, reloads prior settings, restores once, and keeps save failed', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.settings.persistError = new Error(PRIVATE_CANARY);

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.deepEqual(result.settings, AUTHORITATIVE_SETTINGS);
    assert.equal(fixture.settings.reloadCount, 1);
    assert.equal(fixture.translation.warmCount, 1);
    assert.deepEqual(fixture.events, [
      'settings:prepare',
      'translation:reset',
      'browser:release',
      'browser:initialize:visible',
      'settings:persist',
      'browser:release',
      'settings:reload',
      'browser:initialize:hidden',
      'translation:warm',
    ]);
    assert.equal(JSON.stringify({ result, logs: fixture.logs }).includes(PRIVATE_CANARY), false);
  });

  it('does not restore or warm when candidate cleanup after persistence failure is uncertain', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.settings.persistError = new Error(PRIVATE_CANARY);
    fixture.background.releaseResults.push(true, false);

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.equal(fixture.settings.reloadCount, 0);
    assert.equal(fixture.translation.warmCount, 0);
    assert.equal(fixture.translation.unexpectedSettlements, 1);
  });

  it('settles failed prior restoration once and leaves no provider warmup', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.settings.persistError = new Error(PRIVATE_CANARY);
    fixture.background.initializeResults.push({ providerId: 'openai-api', ready: true }, new Error(PRIVATE_CANARY));

    const result = await fixture.save();

    assert.equal(result.success, false);
    assert.equal(fixture.background.initializeInputs.length, 2);
    assert.equal(fixture.translation.warmCount, 0);
    assert.equal(fixture.translation.unexpectedSettlements, 1);
    assert.equal(JSON.stringify({ result, logs: fixture.logs }).includes(PRIVATE_CANARY), false);
  });

  it('bounds the complete prior restoration with one absolute readiness deadline', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.settings.persistError = new Error(PRIVATE_CANARY);
    fixture.background.initializeResults.push(
      { providerId: 'openai-api', ready: true },
      new Promise<BackgroundBrowserStatus>(() => undefined),
    );

    const save = fixture.save();
    await fixture.background.restorationStarted.promise;
    fixture.readinessDeadline.clock.advanceBy(INITIAL_PROVIDER_READINESS_TIMEOUT_MS);
    const result = await save;

    assert.equal(result.success, false);
    assert.equal(fixture.translation.warmCount, 0);
    assert.equal(fixture.translation.unexpectedSettlements, 1);
    assert.equal(fixture.readinessDeadline.controllers[0]?.signal.aborted, true);
  });

  it('keeps a successful save fixed when provider warmup throws', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.translation.throwOnWarm = true;

    const result = await fixture.save();

    assert.equal(result.success, true);
    assert.equal(fixture.translation.unexpectedSettlements, 1);
    assert.equal(JSON.stringify({ result, logs: fixture.logs }).includes(PRIVATE_CANARY), false);
  });

  it('keeps the complete transaction fail-open when logging throws', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    fixture.throwOnLog = true;

    const result = await fixture.save();

    assert.equal(result.success, true);
    assert.equal(fixture.translation.warmCount, 1);
  });

  it('serializes duplicate save attempts so only one candidate owns the browser at a time', async () => {
    const fixture = new CloakBrowserSettingsResetFixture();
    const releaseGate = new Deferred();
    fixture.background.releaseGate = releaseGate;

    const first = fixture.save();
    await fixture.background.releaseStarted.promise;
    const second = fixture.save();
    await Promise.resolve();

    assert.equal(fixture.settings.prepareCount, 1);
    releaseGate.resolve();
    await Promise.all([first, second]);

    assert.equal(fixture.settings.prepareCount, 2);
    assert.equal(fixture.background.initializeInputs.length, 2);
  });
});
