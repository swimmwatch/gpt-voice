import type * as fs from 'node:fs';
import type { ScopedLogger } from '../logger';
import {
  assertValidOpenAIApiSettingsInput,
  normalizeOpenAIApiSettings,
  sanitizeOpenAIApiSettings,
  shouldUpdateApiKey,
  type OpenAIApiSettings,
  type OpenAIApiSettingsInput,
  type OpenAIApiSettingsView,
  type OpenAIApiSettingsWithSecret,
} from './openaiApiSettingsUtils';

const PRIVATE_FILE_MODE = 0o600;

interface StoredOpenAIApiSettings extends OpenAIApiSettingsInput {
  encryptedApiKey?: string;
}

export interface OpenAIApiSettingsRepositoryDependencies {
  readonly fileSystem: Pick<typeof fs, 'existsSync' | 'readFileSync' | 'writeFileSync'>;
  readonly logger: Pick<ScopedLogger, 'warn'>;
  readonly secureStorage: {
    decrypt(encrypted: Buffer): string;
    encrypt(plainText: string): Buffer;
    isEncryptionAvailable(): boolean;
  };
  readonly settingsFile: string;
}

/** Filesystem and secure-storage repository for OpenAI API settings. */
export class OpenAIApiSettingsRepository {
  public constructor(private readonly dependencies: OpenAIApiSettingsRepositoryDependencies) {}

  public readonly getView = (): OpenAIApiSettingsView => {
    const stored = this.readStoredSettings();
    return sanitizeOpenAIApiSettings(stored, Boolean(this.decryptApiKey(stored.encryptedApiKey)));
  };

  public readonly getSettings = (): OpenAIApiSettings => {
    return normalizeOpenAIApiSettings(this.readStoredSettings());
  };

  public readonly getSettingsWithSecret = (): OpenAIApiSettingsWithSecret => {
    const stored = this.readStoredSettings();
    return {
      ...normalizeOpenAIApiSettings(stored),
      apiKey: this.decryptApiKey(stored.encryptedApiKey),
    };
  };

  public readonly save = (input: OpenAIApiSettingsInput): OpenAIApiSettingsView => {
    assertValidOpenAIApiSettingsInput(input);
    const stored = this.readStoredSettings();
    const normalized = normalizeOpenAIApiSettings({ ...stored, ...input });
    const next: StoredOpenAIApiSettings = {
      ...normalized,
      encryptedApiKey: stored.encryptedApiKey,
    };

    if (shouldUpdateApiKey(input.apiKey)) {
      next.encryptedApiKey = this.encryptApiKey(input.apiKey.trim());
    }

    this.writeStoredSettings(next);
    return sanitizeOpenAIApiSettings(next, Boolean(this.decryptApiKey(next.encryptedApiKey)));
  };

  public readonly clearApiKey = (): OpenAIApiSettingsView => {
    const stored = this.readStoredSettings();
    const next: StoredOpenAIApiSettings = normalizeOpenAIApiSettings(stored);
    this.writeStoredSettings(next);
    return sanitizeOpenAIApiSettings(next, false);
  };

  private readStoredSettings(): StoredOpenAIApiSettings {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.settingsFile)) return {};
      return JSON.parse(
        this.dependencies.fileSystem.readFileSync(this.dependencies.settingsFile, 'utf-8'),
      ) as StoredOpenAIApiSettings;
    } catch (error) {
      this.dependencies.logger.warn('Failed to read OpenAI API settings:', error);
      return {};
    }
  }

  private writeStoredSettings(settings: StoredOpenAIApiSettings): void {
    this.dependencies.fileSystem.writeFileSync(this.dependencies.settingsFile, JSON.stringify(settings, null, 2), {
      mode: PRIVATE_FILE_MODE,
    });
  }

  private encryptApiKey(apiKey: string): string {
    if (!this.dependencies.secureStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system');
    }
    return this.dependencies.secureStorage.encrypt(apiKey).toString('base64');
  }

  private decryptApiKey(encryptedApiKey?: string): string {
    if (!encryptedApiKey || !this.dependencies.secureStorage.isEncryptionAvailable()) return '';

    try {
      return this.dependencies.secureStorage.decrypt(Buffer.from(encryptedApiKey, 'base64'));
    } catch (error) {
      this.dependencies.logger.warn('Failed to decrypt OpenAI API key:', error);
      return '';
    }
  }
}
