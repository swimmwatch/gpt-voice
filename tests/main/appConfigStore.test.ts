import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { AppConfigStore, resolveAppConfigPaths, type AppConfigStoreDependencies } from '@main/config';
import { writeTextFileAtomically } from '@main/translationSettings';
import { DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS } from '@shared/diagnosticCaptureSettings';
import { DEFAULT_CANCEL_HOTKEY, DEFAULT_RECORD_HOTKEY, DEFAULT_RETRY_TRANSCRIPTION_HOTKEY } from '@shared/hotkeys';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';
import { getPrettifyBuiltInProfileDefinition } from '@main/services/prettifyProfileInstruction';
import { PRETTIFY_BUILT_IN_PROFILE_IDS, PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION } from '@shared/prettifyProfiles';

const GENERATED_FINGERPRINT_SEED = '54321';
const LEGACY_RETRY_TRANSCRIPTION_HOTKEY = 'Ctrl+F9';

interface AppConfigStoreFixtureOptions {
  readonly writeFileAtomically?: AppConfigStoreDependencies['writeFileAtomically'];
}

class AppConfigStoreFixture {
  public readonly errors: unknown[][] = [];
  public readonly paths;
  public readonly store: AppConfigStore;
  public readonly temporaryDirectory: string;
  public readonly writes: Array<{ readonly contents: string; readonly filePath: string }> = [];
  private readonly dependencies: AppConfigStoreDependencies;

  public constructor(options: AppConfigStoreFixtureOptions = {}) {
    this.temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-config-store-'));
    this.paths = resolveAppConfigPaths({
      environment: { XDG_CONFIG_HOME: this.temporaryDirectory },
      homeDirectory: () => this.temporaryDirectory,
      platform: 'linux',
    });
    this.dependencies = {
      fileSystem: fs,
      generateFingerprintSeed: () => GENERATED_FINGERPRINT_SEED,
      generatePrettifyProfileUuid: () => '00000000-0000-0000-0000-000000000001',
      logger: {
        error: (...args) => this.errors.push(args),
        info: () => undefined,
        warn: () => undefined,
      },
      paths: this.paths,
      writeFileAtomically:
        options.writeFileAtomically ??
        ((filePath, contents) => {
          this.writes.push({ contents, filePath });
          writeTextFileAtomically(filePath, contents, {
            createTemporaryPath: (target) => `${target}.pending`,
            fileSystem: fs,
          });
        }),
    };
    this.store = this.createStore();
  }

  public cleanup(): void {
    fs.rmSync(this.temporaryDirectory, { force: true, recursive: true });
  }

  public createStore(): AppConfigStore {
    return new AppConfigStore(this.dependencies);
  }

  public readPersistedConfig(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(this.paths.configFile, 'utf8')) as Record<string, unknown>;
  }

  public writePersistedConfig(config: unknown): void {
    fs.mkdirSync(this.paths.appDirectory, { recursive: true });
    fs.writeFileSync(this.paths.configFile, JSON.stringify(config, null, 2), 'utf8');
  }
}

const fixtures: AppConfigStoreFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures) fixture.cleanup();
  fixtures.length = 0;
});

function createFixture(options: AppConfigStoreFixtureOptions = {}): AppConfigStoreFixture {
  const fixture = new AppConfigStoreFixture(options);
  fixtures.push(fixture);
  return fixture;
}

describe('AppConfigStore', () => {
  it('constructs without filesystem mutation and keeps application graphs isolated', () => {
    const first = createFixture();
    const second = createFixture();

    assert.equal(fs.existsSync(first.paths.appDirectory), false);
    assert.equal(fs.existsSync(second.paths.appDirectory), false);

    first.store.setProvider('openai-api');
    first.store.setLocalePreference('ru');
    first.store.save();

    assert.equal(fs.existsSync(first.paths.configFile), true);
    assert.equal(fs.existsSync(second.paths.appDirectory), false);
    assert.equal(first.store.getSnapshot().provider, 'openai-api');
    assert.equal(first.store.getSnapshot().locale, 'ru');
    assert.equal(second.store.getSnapshot().provider, 'chatgpt');
    assert.equal(second.store.getSnapshot().locale, 'en');
  });

  it('returns deeply immutable snapshots that remain stable after later mutations', () => {
    const fixture = createFixture();
    const snapshot = fixture.store.getSnapshot();

    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.prettifySettings), true);
    assert.equal(Object.isFrozen(snapshot.prettifySettings.claudeCli), true);
    assert.equal(Object.isFrozen(snapshot.prettifySettings.codexCli), true);
    assert.equal(Object.isFrozen(snapshot.prettifySettings.ollama), true);
    assert.equal(Object.isFrozen(snapshot.prettifySettings.vllm), true);
    assert.equal(Object.isFrozen(snapshot.prettifyProfileCatalog), true);
    assert.equal(Object.isFrozen(snapshot.prettifyProfileCatalog.chooserOrder), true);
    assert.equal(Object.isFrozen(snapshot.prettifyProfileCatalog.customProfiles), true);
    assert.equal(Object.isFrozen(snapshot.translationSettings), true);
    assert.equal(Object.isFrozen(snapshot.translationSettings.targetLanguageByProvider), true);

    fixture.store.setProvider('claude-web');
    fixture.store.setPrettifySettings({ claudeCli: { model: 'claude-sonnet' } });

    assert.equal(snapshot.provider, 'chatgpt');
    assert.equal(snapshot.prettifySettings.claudeCli.model, '');
    assert.equal(fixture.store.getSnapshot().provider, 'claude-web');
    assert.equal(fixture.store.getSnapshot().prettifySettings.claudeCli.model, 'claude-sonnet');
  });

  it('round-trips the canonical persisted JSON shape through an independent store', () => {
    const fixture = createFixture();
    fixture.store.setHotkeys({
      cancelHotkey: 'Alt+Escape',
      hotkey: 'Alt+Space',
      prettifyHotkey: 'Alt+P',
      retryTranscriptionHotkey: 'Alt+R',
      stopHotkey: 'Alt+S',
      translateHotkey: 'Alt+T',
    });
    fixture.store.setTextActionSettings({ prettifyEnabled: false, translateEnabled: false });
    fixture.store.setProvider('openai-api');
    fixture.store.setLocalePreference('uk');
    fixture.store.setPrettifySettings({
      providerId: 'claude-cli',
      claudeCli: { executablePath: '/opt/claude', model: 'claude-sonnet' },
    });
    fixture.store.saveTranslationSettings({
      providerId: 'bing',
      targetLanguageByProvider: { bing: 'ru', google: 'uk', yandex: 'be' },
    });
    fixture.store.saveDiagnosticCaptureSettings({
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: false,
    });
    assert.equal(fixture.store.getFingerprintSeed(), GENERATED_FINGERPRINT_SEED);
    fixture.store.save();

    const persisted = fixture.readPersistedConfig();
    assert.deepEqual(Object.keys(persisted), [
      'hotkey',
      'cancelHotkey',
      'captureTranslationDiagnostics',
      'capturePrettifyDiagnostics',
      'stopHotkey',
      'translateHotkey',
      'prettifyHotkey',
      'retryTranscriptionHotkey',
      'translateEnabled',
      'prettifyEnabled',
      'prettifyProfileCatalog',
      'translationSettings',
      'provider',
      'locale',
      'localeExplicit',
      'fingerprintSeed',
      'prettifySettings',
    ]);
    assert.equal('targetLang' in persisted, false);

    const loaded = fixture.createStore();
    loaded.load();
    assert.deepEqual(loaded.getSnapshot(), fixture.store.getSnapshot());
  });

  it('keeps config load and save failures out of runtime logs', () => {
    const loadFixture = createFixture();
    const privateLoadError = 'private-profile-instruction';
    fs.mkdirSync(loadFixture.paths.appDirectory, { recursive: true });
    fs.writeFileSync(
      loadFixture.paths.configFile,
      `{"prettifyProfileCatalog":{"customProfiles":[{"instruction":"${privateLoadError}"}`,
      'utf8',
    );

    loadFixture.store.load();

    assert.deepEqual(loadFixture.errors, [['Failed to load application config']]);
    assert.equal(JSON.stringify(loadFixture.errors).includes(privateLoadError), false);
    assert.equal(JSON.stringify(loadFixture.errors).includes(loadFixture.paths.configFile), false);

    const privateSaveError = 'private-config-write-error';
    const saveFixture = createFixture({
      writeFileAtomically: () => {
        throw new Error(privateSaveError);
      },
    });

    assert.throws(() => saveFixture.store.save(), new RegExp(privateSaveError));
    assert.deepEqual(saveFixture.errors, [['Failed to save application config']]);
    assert.equal(JSON.stringify(saveFixture.errors).includes(privateSaveError), false);
  });

  it('isolates corrupt fields while migrating hotkeys, fingerprint state, and Translation settings', () => {
    const fixture = createFixture();
    fixture.writePersistedConfig({
      cancelHotkey: 42,
      fingerprintSeed: 'invalid-seed',
      hotkey: DEFAULT_RECORD_HOTKEY,
      locale: 'ru',
      localeExplicit: 'yes',
      prettifyEnabled: false,
      provider: [],
      retryTranscriptionHotkey: LEGACY_RETRY_TRANSCRIPTION_HOTKEY,
      translateEnabled: 'yes',
      translationSettings: {
        providerId: 'unknown',
        targetLanguageByProvider: {
          bing: 'not-a-language',
          google: 'not-a-language',
          yandex: 'not-a-language',
        },
      },
    });

    fixture.store.load();
    const snapshot = fixture.store.getSnapshot();
    const notice = fixture.store.consumePendingTranslationSettingsRepairNotice();

    assert.equal(snapshot.cancelHotkey, DEFAULT_CANCEL_HOTKEY);
    assert.equal(snapshot.fingerprintSeed, GENERATED_FINGERPRINT_SEED);
    assert.equal(snapshot.locale, 'en');
    assert.equal(snapshot.localeExplicit, false);
    assert.equal(snapshot.prettifyEnabled, false);
    assert.equal(snapshot.provider, 'chatgpt');
    assert.equal(snapshot.retryTranscriptionHotkey, DEFAULT_RETRY_TRANSCRIPTION_HOTKEY);
    assert.equal(snapshot.translateEnabled, true);
    assert.equal(snapshot.translationSettings.providerId, 'google');
    assert.ok(notice);
    assert.equal(notice.categories.includes('provider'), true);
    assert.equal(notice.categories.includes('target'), true);
    assert.equal(fixture.store.consumePendingTranslationSettingsRepairNotice(), null);
    assert.equal(fixture.readPersistedConfig().fingerprintSeed, GENERATED_FINGERPRINT_SEED);
  });

  it('defaults independently corrupt diagnostic settings and resets them before every load', () => {
    const fixture = createFixture();
    fixture.writePersistedConfig({
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: 'true',
      fingerprintSeed: GENERATED_FINGERPRINT_SEED,
    });

    fixture.store.load();
    assert.deepEqual(fixture.store.getDiagnosticCaptureSettings(), {
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: false,
    });

    fs.rmSync(fixture.paths.configFile);
    fixture.store.load();
    assert.deepEqual(fixture.store.getDiagnosticCaptureSettings(), DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS);

    fixture.store.saveDiagnosticCaptureSettings({
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: true,
    });
    fs.writeFileSync(fixture.paths.configFile, '{corrupt-json', 'utf8');
    fixture.store.load();
    assert.deepEqual(fixture.store.getDiagnosticCaptureSettings(), DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS);
  });

  it('publishes diagnostic settings in memory only after atomic persistence succeeds', () => {
    let shouldFail = false;
    const fixture = createFixture({
      writeFileAtomically: (filePath, contents) => {
        if (shouldFail) throw new Error('synthetic diagnostic settings save failure');
        writeTextFileAtomically(filePath, contents, {
          createTemporaryPath: (target) => `${target}.pending`,
          fileSystem: fs,
        });
      },
    });
    fixture.store.saveDiagnosticCaptureSettings({
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    });
    const previousBytes = fs.readFileSync(fixture.paths.configFile, 'utf8');
    shouldFail = true;

    assert.throws(
      () =>
        fixture.store.saveDiagnosticCaptureSettings({
          capturePrettifyDiagnostics: true,
          captureTranslationDiagnostics: false,
        }),
      /synthetic diagnostic settings save failure/u,
    );
    assert.deepEqual(fixture.store.getDiagnosticCaptureSettings(), {
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    });
    assert.equal(fs.readFileSync(fixture.paths.configFile, 'utf8'), previousBytes);
  });

  it('migrates the legacy application directory only when load begins', () => {
    const fixture = createFixture();
    const legacyDirectory = fixture.paths.legacyAppDirectories[0];
    assert.ok(legacyDirectory);
    fs.mkdirSync(legacyDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(legacyDirectory, 'config.json'),
      JSON.stringify({ fingerprintSeed: '67890', provider: 'openai-api' }, null, 2),
      'utf8',
    );
    fs.writeFileSync(path.join(legacyDirectory, 'chatgpt-session.json'), '{"cookies":[]}', 'utf8');

    assert.equal(fs.existsSync(fixture.paths.appDirectory), false);
    fixture.store.load();

    assert.equal(fs.existsSync(fixture.paths.configFile), true);
    assert.equal(fs.existsSync(fixture.paths.chatGPTSessionFile), true);
    assert.equal(fixture.store.getSnapshot().fingerprintSeed, '67890');
    assert.equal(fixture.store.getSnapshot().provider, 'openai-api');
  });

  it('generates and persists a fingerprint lazily when no load has occurred', () => {
    const fixture = createFixture();

    assert.equal(fs.existsSync(fixture.paths.appDirectory), false);
    assert.equal(fixture.store.getFingerprintSeed(), GENERATED_FINGERPRINT_SEED);
    assert.equal(fixture.readPersistedConfig().fingerprintSeed, GENERATED_FINGERPRINT_SEED);
    assert.equal(fixture.writes.length, 1);
  });

  it('propagates atomic save failures, logs them, and leaves existing bytes unchanged', () => {
    const fixture = createFixture({
      writeFileAtomically: () => {
        throw new Error('synthetic atomic failure');
      },
    });
    fixture.writePersistedConfig({ fingerprintSeed: '11111', provider: 'chatgpt' });
    const previousBytes = fs.readFileSync(fixture.paths.configFile, 'utf8');
    fixture.store.setProvider('openai-api');

    assert.throws(() => fixture.store.save(), /synthetic atomic failure/);
    assert.equal(fs.readFileSync(fixture.paths.configFile, 'utf8'), previousBytes);
    assert.equal(fixture.store.getSnapshot().provider, 'openai-api');
    assert.equal(fixture.errors.length, 1);
  });

  it('preserves the complete default Prettify settings shape', () => {
    const fixture = createFixture();
    assert.deepEqual(fixture.store.getSnapshot().prettifySettings, {
      ...DEFAULT_PRETTIFY_SETTINGS,
      prompt: getPrettifyBuiltInProfileDefinition('prompt-ready').instruction,
    });
  });

  it('initializes and persists a new installation with Prompt-ready as the explicit default', () => {
    const fixture = createFixture();

    fixture.store.load();
    const snapshot = fixture.store.getSnapshot();
    const persisted = fixture.readPersistedConfig();

    assert.equal(snapshot.prettifyProfileCatalog.defaultProfileId, 'prompt-ready');
    assert.deepEqual(snapshot.prettifyProfileCatalog.chooserOrder, PRETTIFY_BUILT_IN_PROFILE_IDS);
    assert.equal(snapshot.prettifySettings.prompt, getPrettifyBuiltInProfileDefinition('prompt-ready').instruction);
    assert.deepEqual(persisted.prettifyProfileCatalog, snapshot.prettifyProfileCatalog);
    assert.deepEqual(persisted.prettifySettings, snapshot.prettifySettings);
  });

  it('migrates a recognized legacy prompt to Polish idempotently while preserving unrelated settings', () => {
    const fixture = createFixture();
    fixture.writePersistedConfig({
      fingerprintSeed: GENERATED_FINGERPRINT_SEED,
      locale: 'ru',
      localeExplicit: true,
      prettifySettings: {
        ...DEFAULT_PRETTIFY_SETTINGS,
        providerId: 'vllm',
      },
      provider: 'openai-api',
      translationSettings: {
        providerId: 'bing',
        targetLanguageByProvider: {
          bing: 'ru',
          google: 'uk',
          yandex: 'be',
        },
      },
    });

    fixture.store.load();
    const first = fixture.store.getSnapshot();

    assert.equal(first.prettifyProfileCatalog.defaultProfileId, 'polish');
    assert.equal(first.prettifyProfileCatalog.customProfiles.length, 0);
    assert.equal(first.prettifySettings.providerId, 'vllm');
    assert.equal(first.prettifySettings.prompt, getPrettifyBuiltInProfileDefinition('polish').instruction);
    assert.equal(first.provider, 'openai-api');
    assert.equal(first.locale, 'ru');
    assert.equal(first.translationSettings.providerId, 'bing');
    assert.deepEqual(
      (fixture.readPersistedConfig().translationSettings as { providerId?: unknown }).providerId,
      'bing',
    );

    const reloaded = fixture.createStore();
    reloaded.load();
    assert.deepEqual(reloaded.getSnapshot().prettifyProfileCatalog, first.prettifyProfileCatalog);
    assert.equal(reloaded.getSnapshot().prettifySettings.prompt, first.prettifySettings.prompt);
  });

  it('migrates one customized legacy prompt byte-for-byte without creating another copy', () => {
    const fixture = createFixture();
    const legacyPrompt = '  Preserve my private custom prompt.  \n';
    fixture.writePersistedConfig({
      fingerprintSeed: GENERATED_FINGERPRINT_SEED,
      prettifySettings: {
        ...DEFAULT_PRETTIFY_SETTINGS,
        prompt: legacyPrompt,
      },
    });

    fixture.store.load();
    const first = fixture.store.getSnapshot();

    assert.equal(first.prettifyProfileCatalog.customProfiles.length, 1);
    assert.equal(first.prettifyProfileCatalog.defaultProfileId, first.prettifyProfileCatalog.customProfiles[0]?.id);
    assert.equal(first.prettifyProfileCatalog.customProfiles[0]?.instruction, legacyPrompt);
    assert.equal(first.prettifySettings.prompt, legacyPrompt);

    const reloaded = fixture.createStore();
    reloaded.load();
    assert.equal(reloaded.getSnapshot().prettifyProfileCatalog.customProfiles.length, 1);
    assert.equal(
      reloaded.getSnapshot().prettifyProfileCatalog.customProfiles[0]?.id,
      first.prettifyProfileCatalog.customProfiles[0]?.id,
    );
  });

  it('repairs a corrupt catalog without resetting unrelated application settings', () => {
    const fixture = createFixture();
    const customId = 'custom:00000000-0000-0000-0000-000000000099';
    fixture.writePersistedConfig({
      fingerprintSeed: GENERATED_FINGERPRINT_SEED,
      hotkey: 'Alt+Space',
      prettifyProfileCatalog: {
        chooserOrder: ['unknown', customId, 'natural', customId],
        customProfiles: [
          { id: customId, instruction: 'Keep valid profile', name: 'Valid profile' },
          { id: customId, instruction: 'Duplicate', name: 'Duplicate' },
        ],
        defaultProfileId: 'missing',
        schemaVersion: 99,
      },
      prettifySettings: {
        ...DEFAULT_PRETTIFY_SETTINGS,
        providerId: 'claude-cli',
      },
      provider: 'claude-web',
    });

    fixture.store.load();
    const snapshot = fixture.store.getSnapshot();

    assert.equal(snapshot.provider, 'claude-web');
    assert.equal(snapshot.hotkey, 'Alt+Space');
    assert.equal(snapshot.prettifySettings.providerId, 'claude-cli');
    assert.equal(snapshot.prettifyProfileCatalog.customProfiles.length, 1);
    assert.equal(snapshot.prettifyProfileCatalog.defaultProfileId, 'prompt-ready');
    assert.deepEqual(snapshot.prettifyProfileCatalog.chooserOrder, [
      customId,
      'natural',
      'prompt-ready',
      'polish',
      'professional',
    ]);
    assert.deepEqual(fixture.store.consumePendingPrettifyProfileCatalogRepairNotice(), {
      repaired: true,
    });
    assert.equal(fixture.store.consumePendingPrettifyProfileCatalogRepairNotice(), null);
    assert.deepEqual(fixture.readPersistedConfig().prettifyProfileCatalog, snapshot.prettifyProfileCatalog);
  });

  it('keeps catalog, projection, and persisted bytes unchanged when atomic catalog save fails', () => {
    let shouldFail = false;
    const fixture = createFixture({
      writeFileAtomically: (filePath, contents) => {
        if (shouldFail) throw new Error('synthetic catalog save failure');
        writeTextFileAtomically(filePath, contents, {
          createTemporaryPath: (target) => `${target}.pending`,
          fileSystem: fs,
        });
      },
    });
    fixture.store.load();
    const previousSnapshot = fixture.store.getSnapshot();
    const previousBytes = fs.readFileSync(fixture.paths.configFile, 'utf8');
    const customId = 'custom:00000000-0000-0000-0000-000000000077';
    shouldFail = true;

    assert.throws(
      () =>
        fixture.store.savePrettifyProfileCatalog({
          chooserOrder: [...PRETTIFY_BUILT_IN_PROFILE_IDS, customId],
          customProfiles: [{ id: customId, instruction: 'Custom instruction', name: 'Custom' }],
          defaultProfileId: customId,
          schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
        }),
      /synthetic catalog save failure/u,
    );
    assert.equal(fixture.store.getSnapshot().prettifyProfileCatalog, previousSnapshot.prettifyProfileCatalog);
    assert.equal(fixture.store.getSnapshot().prettifySettings.prompt, previousSnapshot.prettifySettings.prompt);
    assert.equal(fs.readFileSync(fixture.paths.configFile, 'utf8'), previousBytes);
  });

  it('does not publish a migrated catalog or legacy projection when migration persistence fails', () => {
    const fixture = createFixture({
      writeFileAtomically: () => {
        throw new Error('synthetic migration persistence failure');
      },
    });
    fixture.writePersistedConfig({
      fingerprintSeed: GENERATED_FINGERPRINT_SEED,
      prettifySettings: {
        ...DEFAULT_PRETTIFY_SETTINGS,
        prompt: 'private legacy prompt',
        providerId: 'vllm',
      },
    });
    const previousBytes = fs.readFileSync(fixture.paths.configFile, 'utf8');

    fixture.store.load();
    const snapshot = fixture.store.getSnapshot();

    assert.equal(snapshot.prettifyProfileCatalog.defaultProfileId, 'prompt-ready');
    assert.equal(snapshot.prettifyProfileCatalog.customProfiles.length, 0);
    assert.equal(snapshot.prettifySettings.prompt, getPrettifyBuiltInProfileDefinition('prompt-ready').instruction);
    assert.equal(snapshot.prettifySettings.providerId, DEFAULT_PRETTIFY_SETTINGS.providerId);
    assert.equal(fs.readFileSync(fixture.paths.configFile, 'utf8'), previousBytes);
    assert.equal(fixture.errors.length, 1);
  });

  it('preserves the catalog-owned projection across provider-only configuration updates', () => {
    const fixture = createFixture();
    fixture.store.load();
    const projection = fixture.store.getSnapshot().prettifySettings.prompt;

    fixture.store.setPrettifySettings({
      prompt: 'stale renderer prompt',
      providerId: 'codex-cli',
    } as never);

    assert.equal(fixture.store.getSnapshot().prettifySettings.providerId, 'codex-cli');
    assert.equal(fixture.store.getSnapshot().prettifySettings.prompt, projection);
  });
});
