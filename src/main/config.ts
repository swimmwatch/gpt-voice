import * as path from 'node:path';
import type * as fs from 'node:fs';
import {
  DEFAULT_CANCEL_HOTKEY,
  DEFAULT_PRETTIFY_HOTKEY,
  DEFAULT_RECORD_HOTKEY,
  DEFAULT_RETRY_TRANSCRIPTION_HOTKEY,
  DEFAULT_STOP_HOTKEY,
  DEFAULT_TRANSLATE_HOTKEY,
  type HotkeySettings,
} from '@shared/hotkeys';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  normalizePrettifySettings,
  type PrettifySettings,
  type PrettifySettingsInput,
} from '@shared/prettifySettings';
import { DEFAULT_TEXT_ACTION_SETTINGS } from '@shared/textActionSettings';
import { DEFAULT_APP_LOCALE, normalizeAppLocale, type AppLocaleId } from '@shared/appLocale';
import type { TranslationSettings } from '@shared/translationProvider';
import {
  DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS,
  isDiagnosticCaptureSettings,
  normalizeDiagnosticCaptureSettings,
  type DiagnosticCaptureSettings,
} from '@shared/diagnosticCaptureSettings';
import {
  TranslationSettingsState,
  type AtomicFileSystem,
  type TranslationSettingsRepairNotice,
} from './translationSettings';

const APP_DIRECTORY_NAME = 'GPT-Voice';
const BROWSER_CACHE_DIRECTORY_NAME = 'browser-cache';
const CONFIG_FILE_NAME = 'config.json';
const DATABASE_FILE_NAME = 'gpt-voice.sqlite3';
const CHATGPT_SESSION_FILE_NAME = 'chatgpt-session.json';
const CHATGPT_TOKEN_FILE_NAME = 'access-token.json';
const CLOAK_BROWSER_SETTINGS_FILE_NAME = 'cloakbrowser-settings.json';
const PRETTIFY_SETTINGS_FILE_NAME = 'prettify-provider-settings.json';
const OPENAI_API_SETTINGS_FILE_NAME = 'openai-api-settings.json';
const CLAUDE_WEB_SETTINGS_FILE_NAME = 'claude-web-settings.json';
const CLAUDE_WEB_SESSION_FILE_NAME = 'claude-web-session.json';
const LEGACY_APP_DIRECTORY_NAMES = ['.gpt-voice', '.webvoice'] as const;
const MIGRATED_LEGACY_ENTRIES = [
  CONFIG_FILE_NAME,
  CHATGPT_SESSION_FILE_NAME,
  CHATGPT_TOKEN_FILE_NAME,
  BROWSER_CACHE_DIRECTORY_NAME,
] as const;
const LEGACY_RETRY_TRANSCRIPTION_HOTKEY = 'Ctrl+F9';
const DEFAULT_VOICE_PROVIDER_ID = 'chatgpt';
const FINGERPRINT_SEED_PATTERN = /^\d+$/;

export interface AppConfigPaths {
  readonly appDirectory: string;
  readonly browserCacheDirectory: string;
  readonly chatGPTSessionFile: string;
  readonly chatGPTTokenFile: string;
  readonly claudeWebSessionFile: string;
  readonly claudeWebSettingsFile: string;
  readonly cloakBrowserSettingsFile: string;
  readonly configFile: string;
  readonly databaseFile: string;
  readonly legacyAppDirectories: readonly string[];
  readonly openAIApiSettingsFile: string;
  readonly prettifySettingsFile: string;
}

export interface AppConfigPathDependencies {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly homeDirectory: () => string;
  readonly platform: NodeJS.Platform;
}

export interface AppConfigFileSystem extends AtomicFileSystem {
  cpSync(source: fs.PathLike, destination: fs.PathLike, options?: fs.CopySyncOptions): void;
  existsSync(path: fs.PathLike): boolean;
  mkdirSync(path: fs.PathLike, options?: fs.MakeDirectoryOptions): string | undefined;
  readFileSync(path: fs.PathOrFileDescriptor, encoding: BufferEncoding): string;
}

export interface AppConfigLogger {
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface AppConfigStoreDependencies {
  readonly fileSystem: AppConfigFileSystem;
  readonly generateFingerprintSeed: () => string;
  readonly logger: AppConfigLogger;
  readonly paths: AppConfigPaths;
  readonly writeFileAtomically: (filePath: string, contents: string) => void;
}

export interface AppConfigSnapshot {
  readonly cancelHotkey: string;
  readonly capturePrettifyDiagnostics: boolean;
  readonly captureTranslationDiagnostics: boolean;
  readonly fingerprintSeed: string;
  readonly hotkey: string;
  readonly locale: AppLocaleId;
  readonly localeExplicit: boolean;
  readonly prettifyEnabled: boolean;
  readonly prettifyHotkey: string;
  readonly prettifySettings: PrettifySettings;
  readonly provider: string;
  readonly retryTranscriptionHotkey: string;
  readonly stopHotkey: string;
  readonly translateEnabled: boolean;
  readonly translateHotkey: string;
  readonly translationSettings: TranslationSettings;
}

export interface TextActionSettingsSnapshot {
  readonly prettifyEnabled: boolean;
  readonly translateEnabled: boolean;
}

function getAppDataDirectory({ environment, homeDirectory, platform }: AppConfigPathDependencies): string {
  const home = homeDirectory();
  if (platform === 'win32') {
    return environment.APPDATA || path.join(home, 'AppData', 'Roaming');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support');
  }
  return environment.XDG_CONFIG_HOME || path.join(home, '.config');
}

export function resolveAppConfigPaths(dependencies: AppConfigPathDependencies): AppConfigPaths {
  const home = dependencies.homeDirectory();
  const appDirectory = path.join(getAppDataDirectory(dependencies), APP_DIRECTORY_NAME);
  return Object.freeze({
    appDirectory,
    browserCacheDirectory: path.join(appDirectory, BROWSER_CACHE_DIRECTORY_NAME),
    chatGPTSessionFile: path.join(appDirectory, CHATGPT_SESSION_FILE_NAME),
    chatGPTTokenFile: path.join(appDirectory, CHATGPT_TOKEN_FILE_NAME),
    claudeWebSessionFile: path.join(appDirectory, CLAUDE_WEB_SESSION_FILE_NAME),
    claudeWebSettingsFile: path.join(appDirectory, CLAUDE_WEB_SETTINGS_FILE_NAME),
    cloakBrowserSettingsFile: path.join(appDirectory, CLOAK_BROWSER_SETTINGS_FILE_NAME),
    configFile: path.join(appDirectory, CONFIG_FILE_NAME),
    databaseFile: path.join(appDirectory, DATABASE_FILE_NAME),
    legacyAppDirectories: Object.freeze(
      LEGACY_APP_DIRECTORY_NAMES.map((directoryName) => path.join(home, directoryName)),
    ),
    openAIApiSettingsFile: path.join(appDirectory, OPENAI_API_SETTINGS_FILE_NAME),
    prettifySettingsFile: path.join(appDirectory, PRETTIFY_SETTINGS_FILE_NAME),
  });
}

function isValidFingerprintSeed(value: string): boolean {
  return FINGERPRINT_SEED_PATTERN.test(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getConfigString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  return typeof value === 'string' && value ? value : undefined;
}

function getConfigBoolean(config: Record<string, unknown>, key: string): boolean | undefined {
  const value = config[key];
  return typeof value === 'boolean' ? value : undefined;
}

function createImmutablePrettifySettings(settings: PrettifySettings): PrettifySettings {
  return Object.freeze({
    ...settings,
    claudeCli: Object.freeze({ ...settings.claudeCli }),
    codexCli: Object.freeze({ ...settings.codexCli }),
    ollama: Object.freeze({ ...settings.ollama }),
    vllm: Object.freeze({ ...settings.vllm }),
  });
}

/**
 * Owns the mutable persisted application configuration for one application
 * graph. Construction is side-effect free; filesystem preparation happens
 * only when load or save is explicitly requested.
 */
export class AppConfigStore {
  private cancelHotkey = DEFAULT_CANCEL_HOTKEY;
  private diagnosticCaptureSettings = DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS;
  private fingerprintSeed = '';
  private hotkey = DEFAULT_RECORD_HOTKEY;
  private locale: AppLocaleId = DEFAULT_APP_LOCALE;
  private localeWasExplicitlySelected = false;
  private prettifyEnabled = DEFAULT_TEXT_ACTION_SETTINGS.prettifyEnabled;
  private prettifyHotkey = DEFAULT_PRETTIFY_HOTKEY;
  private prettifySettings = createImmutablePrettifySettings(DEFAULT_PRETTIFY_SETTINGS);
  private provider = DEFAULT_VOICE_PROVIDER_ID;
  private retryTranscriptionHotkey = DEFAULT_RETRY_TRANSCRIPTION_HOTKEY;
  private stopHotkey = DEFAULT_STOP_HOTKEY;
  private translateEnabled = DEFAULT_TEXT_ACTION_SETTINGS.translateEnabled;
  private translateHotkey = DEFAULT_TRANSLATE_HOTKEY;
  private readonly translationSettingsState = new TranslationSettingsState();

  public constructor(private readonly dependencies: AppConfigStoreDependencies) {}

  public get paths(): AppConfigPaths {
    return this.dependencies.paths;
  }

  public getSnapshot(): AppConfigSnapshot {
    return Object.freeze({
      cancelHotkey: this.cancelHotkey,
      capturePrettifyDiagnostics: this.diagnosticCaptureSettings.capturePrettifyDiagnostics,
      captureTranslationDiagnostics: this.diagnosticCaptureSettings.captureTranslationDiagnostics,
      fingerprintSeed: this.fingerprintSeed,
      hotkey: this.hotkey,
      locale: this.locale,
      localeExplicit: this.localeWasExplicitlySelected,
      prettifyEnabled: this.prettifyEnabled,
      prettifyHotkey: this.prettifyHotkey,
      prettifySettings: createImmutablePrettifySettings(this.prettifySettings),
      provider: this.provider,
      retryTranscriptionHotkey: this.retryTranscriptionHotkey,
      stopHotkey: this.stopHotkey,
      translateEnabled: this.translateEnabled,
      translateHotkey: this.translateHotkey,
      translationSettings: this.translationSettingsState.getSnapshot(),
    });
  }

  public getHotkeySettings(): HotkeySettings {
    return Object.freeze({
      cancelHotkey: this.cancelHotkey,
      hotkey: this.hotkey,
      prettifyHotkey: this.prettifyHotkey,
      retryTranscriptionHotkey: this.retryTranscriptionHotkey,
      stopHotkey: this.stopHotkey,
      translateHotkey: this.translateHotkey,
    });
  }

  public getTextActionSettings(): TextActionSettingsSnapshot {
    return Object.freeze({
      prettifyEnabled: this.prettifyEnabled,
      translateEnabled: this.translateEnabled,
    });
  }

  public getDiagnosticCaptureSettings(): DiagnosticCaptureSettings {
    return Object.freeze({ ...this.diagnosticCaptureSettings });
  }

  public getTranslationSettings(): TranslationSettings {
    return this.translationSettingsState.getSnapshot();
  }

  public getFingerprintSeed(): string {
    if (!isValidFingerprintSeed(this.fingerprintSeed)) {
      this.fingerprintSeed = this.dependencies.generateFingerprintSeed();
      this.save();
    }
    return this.fingerprintSeed;
  }

  public consumePendingTranslationSettingsRepairNotice(): TranslationSettingsRepairNotice | null {
    return this.translationSettingsState.consumeRepairNotice();
  }

  public setHotkeys(settings: Partial<HotkeySettings>): void {
    if (settings.hotkey !== undefined) this.hotkey = settings.hotkey;
    if (settings.cancelHotkey !== undefined) this.cancelHotkey = settings.cancelHotkey;
    if (settings.stopHotkey !== undefined) this.stopHotkey = settings.stopHotkey;
    if (settings.translateHotkey !== undefined) this.translateHotkey = settings.translateHotkey;
    if (settings.prettifyHotkey !== undefined) this.prettifyHotkey = settings.prettifyHotkey;
    if (settings.retryTranscriptionHotkey !== undefined) {
      this.retryTranscriptionHotkey = settings.retryTranscriptionHotkey;
    }
  }

  public setTextActionSettings(settings: Partial<TextActionSettingsSnapshot>): void {
    if (settings.translateEnabled !== undefined) this.translateEnabled = settings.translateEnabled;
    if (settings.prettifyEnabled !== undefined) this.prettifyEnabled = settings.prettifyEnabled;
  }

  public setPrettifySettings(settings: PrettifySettingsInput = {}): void {
    this.prettifySettings = createImmutablePrettifySettings(
      normalizePrettifySettings({
        ...this.prettifySettings,
        ...settings,
        claudeCli: {
          ...this.prettifySettings.claudeCli,
          ...settings.claudeCli,
        },
        codexCli: {
          ...this.prettifySettings.codexCli,
          ...settings.codexCli,
        },
        ollama: {
          ...this.prettifySettings.ollama,
          ...settings.ollama,
        },
        vllm: {
          ...this.prettifySettings.vllm,
          ...settings.vllm,
        },
      }),
    );
  }

  public setProvider(providerId: string): void {
    this.provider = providerId;
  }

  public setLocalePreference(locale: AppLocaleId): void {
    this.locale = locale;
    this.localeWasExplicitlySelected = true;
  }

  public saveTranslationSettings(candidate: unknown): TranslationSettings {
    return this.translationSettingsState.save(candidate, (settings) => this.persistSnapshot(settings));
  }

  public saveDiagnosticCaptureSettings(candidate: unknown): DiagnosticCaptureSettings {
    if (!isDiagnosticCaptureSettings(candidate)) {
      throw new Error('Invalid diagnostic capture settings');
    }
    const nextSettings = Object.freeze({ ...candidate });
    this.persistSnapshot(this.translationSettingsState.getSnapshot(), nextSettings);
    this.diagnosticCaptureSettings = nextSettings;
    return this.getDiagnosticCaptureSettings();
  }

  public load(): void {
    this.diagnosticCaptureSettings = DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS;
    this.initializeFileSystem();
    try {
      if (this.dependencies.fileSystem.existsSync(this.paths.configFile)) {
        const parsedConfig: unknown = JSON.parse(
          this.dependencies.fileSystem.readFileSync(this.paths.configFile, 'utf8'),
        );
        this.loadPersistedConfig(isRecord(parsedConfig) ? parsedConfig : {});
      }
      if (!isValidFingerprintSeed(this.fingerprintSeed)) {
        this.fingerprintSeed = this.dependencies.generateFingerprintSeed();
        this.save();
      }
    } catch (error) {
      this.dependencies.logger.error('Failed to load config:', getErrorMessage(error));
    }
  }

  public save(): void {
    this.ensureAppDirectory();
    try {
      this.persistSnapshot();
    } catch (error) {
      this.dependencies.logger.error('Failed to save config:', getErrorMessage(error));
      throw error;
    }
  }

  private loadPersistedConfig(config: Record<string, unknown>): void {
    const targetLang = getConfigString(config, 'targetLang');
    const locale = getConfigString(config, 'locale');
    const localeExplicit = getConfigBoolean(config, 'localeExplicit');
    const prettifySettings = config.prettifySettings;
    const prettifyPrompt = getConfigString(config, 'prettifyPrompt');
    let shouldSaveConfig = false;

    this.diagnosticCaptureSettings = normalizeDiagnosticCaptureSettings(config);
    this.hotkey = getConfigString(config, 'hotkey') ?? this.hotkey;
    this.cancelHotkey = getConfigString(config, 'cancelHotkey') ?? this.cancelHotkey;
    this.stopHotkey = getConfigString(config, 'stopHotkey') ?? this.stopHotkey;
    this.translateHotkey = getConfigString(config, 'translateHotkey') ?? this.translateHotkey;
    this.prettifyHotkey = getConfigString(config, 'prettifyHotkey') ?? this.prettifyHotkey;
    this.retryTranscriptionHotkey =
      getConfigString(config, 'retryTranscriptionHotkey') ?? this.retryTranscriptionHotkey;
    this.translateEnabled = getConfigBoolean(config, 'translateEnabled') ?? this.translateEnabled;
    this.prettifyEnabled = getConfigBoolean(config, 'prettifyEnabled') ?? this.prettifyEnabled;
    this.provider = getConfigString(config, 'provider') ?? this.provider;
    if (locale && localeExplicit === true) {
      this.locale = normalizeAppLocale(locale) ?? DEFAULT_APP_LOCALE;
      this.localeWasExplicitlySelected = true;
    }
    this.fingerprintSeed = getConfigString(config, 'fingerprintSeed') ?? this.fingerprintSeed;
    this.prettifySettings = createImmutablePrettifySettings(
      normalizePrettifySettings(isRecord(prettifySettings) ? prettifySettings : { prompt: prettifyPrompt }),
    );

    if (this.hotkey === DEFAULT_RECORD_HOTKEY && this.retryTranscriptionHotkey === LEGACY_RETRY_TRANSCRIPTION_HOTKEY) {
      this.retryTranscriptionHotkey = DEFAULT_RETRY_TRANSCRIPTION_HOTKEY;
      this.dependencies.logger.info(
        'Migrated conflicting retry transcription hotkey to:',
        DEFAULT_RETRY_TRANSCRIPTION_HOTKEY,
      );
      shouldSaveConfig = true;
    }
    if (!isValidFingerprintSeed(this.fingerprintSeed)) {
      this.fingerprintSeed = this.dependencies.generateFingerprintSeed();
      shouldSaveConfig = true;
    }

    this.translationSettingsState.load(config.translationSettings, targetLang, (settings) =>
      this.persistSnapshot(settings),
    );
    if (shouldSaveConfig) this.save();
  }

  private createPersistedSnapshot(
    translationSettings = this.translationSettingsState.getSnapshot(),
    diagnosticCaptureSettings = this.diagnosticCaptureSettings,
  ): Record<string, unknown> {
    return {
      hotkey: this.hotkey,
      cancelHotkey: this.cancelHotkey,
      captureTranslationDiagnostics: diagnosticCaptureSettings.captureTranslationDiagnostics,
      capturePrettifyDiagnostics: diagnosticCaptureSettings.capturePrettifyDiagnostics,
      stopHotkey: this.stopHotkey,
      translateHotkey: this.translateHotkey,
      prettifyHotkey: this.prettifyHotkey,
      retryTranscriptionHotkey: this.retryTranscriptionHotkey,
      translateEnabled: this.translateEnabled,
      prettifyEnabled: this.prettifyEnabled,
      translationSettings,
      provider: this.provider,
      locale: this.locale,
      localeExplicit: this.localeWasExplicitlySelected,
      fingerprintSeed: this.fingerprintSeed,
      prettifySettings: this.prettifySettings,
    };
  }

  private persistSnapshot(
    translationSettings = this.translationSettingsState.getSnapshot(),
    diagnosticCaptureSettings = this.diagnosticCaptureSettings,
  ): void {
    this.ensureAppDirectory();
    this.dependencies.writeFileAtomically(
      this.paths.configFile,
      JSON.stringify(this.createPersistedSnapshot(translationSettings, diagnosticCaptureSettings), null, 2),
    );
  }

  private initializeFileSystem(): void {
    this.migrateLegacyAppDirectory();
    this.ensureAppDirectory();
  }

  private ensureAppDirectory(): void {
    if (!this.dependencies.fileSystem.existsSync(this.paths.appDirectory)) {
      this.dependencies.fileSystem.mkdirSync(this.paths.appDirectory, { recursive: true });
    }
  }

  private migrateLegacyAppDirectory(): void {
    const legacyDirectories = this.paths.legacyAppDirectories.filter(
      (candidate) => candidate !== this.paths.appDirectory && this.dependencies.fileSystem.existsSync(candidate),
    );
    if (legacyDirectories.length === 0) return;

    if (
      !this.dependencies.fileSystem.existsSync(this.paths.appDirectory) &&
      this.migrateWholeLegacyAppDirectory(legacyDirectories[0])
    ) {
      return;
    }

    this.ensureAppDirectory();
    for (const legacyDirectory of legacyDirectories) {
      this.copyMissingLegacyEntries(legacyDirectory);
    }
  }

  private migrateWholeLegacyAppDirectory(legacyDirectory: string): boolean {
    this.dependencies.fileSystem.mkdirSync(path.dirname(this.paths.appDirectory), { recursive: true });
    try {
      this.dependencies.fileSystem.renameSync(legacyDirectory, this.paths.appDirectory);
      this.dependencies.logger.info('Migrated app data directory:', legacyDirectory, '->', this.paths.appDirectory);
    } catch (renameError) {
      try {
        this.dependencies.fileSystem.cpSync(legacyDirectory, this.paths.appDirectory, { recursive: true });
        this.dependencies.fileSystem.rmSync(legacyDirectory, { recursive: true, force: true });
        this.dependencies.logger.info('Copied app data directory:', legacyDirectory, '->', this.paths.appDirectory);
      } catch (copyError) {
        this.dependencies.logger.warn('Failed to migrate app data directory:', renameError, copyError);
      }
    }
    return this.dependencies.fileSystem.existsSync(this.paths.appDirectory);
  }

  private copyMissingLegacyEntries(legacyDirectory: string): void {
    for (const entry of MIGRATED_LEGACY_ENTRIES) {
      const source = path.join(legacyDirectory, entry);
      const target = path.join(this.paths.appDirectory, entry);
      if (!this.dependencies.fileSystem.existsSync(source) || this.dependencies.fileSystem.existsSync(target)) {
        continue;
      }

      try {
        this.dependencies.fileSystem.cpSync(source, target, { recursive: true });
        this.dependencies.logger.info('Copied missing app data entry:', source, '->', target);
      } catch (error) {
        this.dependencies.logger.warn('Failed to copy missing app data entry:', source, error);
      }
    }
  }
}
