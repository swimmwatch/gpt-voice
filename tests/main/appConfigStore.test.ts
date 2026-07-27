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
    assert.deepEqual(fixture.store.getSnapshot().prettifySettings, DEFAULT_PRETTIFY_SETTINGS);
  });
});
