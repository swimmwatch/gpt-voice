import type * as fs from 'node:fs';
import type { AppConfigStore } from '@main/config';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  assertValidPrettifySettingsInput,
  getPrettifyBaseUrlValidationError,
  getPrettifyProviderCapabilities,
  normalizePrettifySettings,
  type PrettifySettings,
  type PrettifySettingsInput,
} from '@shared/prettifySettings';

interface StoredPrettifyProviderSettings {
  encryptedVllmApiKey?: string;
}

export interface PrettifySettingsWithSecret extends PrettifySettings {
  vllm: PrettifySettings['vllm'] & {
    apiKey: string;
  };
}

export interface PrettifySettingsStorageDependencies {
  readonly config: Pick<AppConfigStore, 'getSnapshot' | 'save' | 'setPrettifySettings'>;
  readonly fileSystem: {
    existsSync(path: fs.PathLike): boolean;
    readFileSync(path: fs.PathOrFileDescriptor, encoding: BufferEncoding): string;
    writeFileSync(path: fs.PathOrFileDescriptor, data: string, options?: fs.WriteFileOptions): void;
  };
  readonly logger: {
    warn(...args: unknown[]): void;
  };
  readonly secureStorage: {
    decrypt(value: Buffer): string;
    encrypt(value: string): Buffer;
    isEncryptionAvailable(): boolean;
  };
  readonly settingsFile: string;
}

export function mergePrettifySettingsForStorage(
  currentSettings: PrettifySettings,
  input: PrettifySettingsInput = {},
  hasApiKey = false,
): PrettifySettings {
  return normalizePrettifySettings({
    ...currentSettings,
    ...input,
    claudeCli: {
      ...currentSettings.claudeCli,
      ...input.claudeCli,
    },
    codexCli: {
      ...currentSettings.codexCli,
      ...input.codexCli,
    },
    ollama: {
      ...currentSettings.ollama,
      ...input.ollama,
    },
    vllm: {
      ...currentSettings.vllm,
      ...input.vllm,
      hasApiKey,
    },
  });
}

export function createPrettifySettingsWithSecret(input: PrettifySettingsInput = {}): PrettifySettingsWithSecret {
  const apiKey = typeof input.vllm?.apiKey === 'string' ? input.vllm.apiKey.trim() : '';
  const settings = mergePrettifySettingsForStorage(DEFAULT_PRETTIFY_SETTINGS, input, Boolean(apiKey));
  return {
    ...settings,
    vllm: {
      ...settings.vllm,
      apiKey,
    },
  };
}

/** Owns encrypted Prettify provider settings for one application graph. */
export class PrettifySettingsStorage {
  public constructor(private readonly dependencies: PrettifySettingsStorageDependencies) {}

  public getView(): PrettifySettings {
    const stored = this.readStoredSettings();
    return this.mergeSettings({}, Boolean(this.decryptApiKey(stored.encryptedVllmApiKey)));
  }

  public getWithSecret(input: PrettifySettingsInput = {}): PrettifySettingsWithSecret {
    assertValidPrettifySettingsInput(input);
    const stored = this.readStoredSettings();
    const draftApiKey = typeof input.vllm?.apiKey === 'string' ? input.vllm.apiKey.trim() : '';
    const savedApiKey = input.vllm?.clearApiKey ? '' : this.decryptApiKey(stored.encryptedVllmApiKey);
    const apiKey = draftApiKey || savedApiKey;
    const settings = this.mergeSettings(input, Boolean(apiKey));
    this.assertValidProviderUrls(settings);

    return {
      ...settings,
      vllm: {
        ...settings.vllm,
        apiKey,
      },
    };
  }

  public save(input: PrettifySettingsInput = {}): PrettifySettings {
    assertValidPrettifySettingsInput(input);
    const stored = this.readStoredSettings();
    const draftApiKey = typeof input.vllm?.apiKey === 'string' ? input.vllm.apiKey.trim() : '';
    const nextStored: StoredPrettifyProviderSettings = { ...stored };

    if (input.vllm?.clearApiKey) {
      delete nextStored.encryptedVllmApiKey;
    }
    if (draftApiKey) {
      nextStored.encryptedVllmApiKey = this.encryptApiKey(draftApiKey);
    }

    const hasApiKey = Boolean(this.decryptApiKey(nextStored.encryptedVllmApiKey));
    const settings = this.mergeSettings(input, hasApiKey);
    this.assertValidProviderUrls(settings);
    this.writeStoredSettings(nextStored);
    this.dependencies.config.setPrettifySettings(settings);
    this.dependencies.config.save();
    return this.getView();
  }

  private mergeSettings(input: PrettifySettingsInput = {}, hasApiKey = false): PrettifySettings {
    return mergePrettifySettingsForStorage(this.dependencies.config.getSnapshot().prettifySettings, input, hasApiKey);
  }

  private readStoredSettings(): StoredPrettifyProviderSettings {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.settingsFile)) return {};
      return JSON.parse(
        this.dependencies.fileSystem.readFileSync(this.dependencies.settingsFile, 'utf8'),
      ) as StoredPrettifyProviderSettings;
    } catch (error: unknown) {
      this.dependencies.logger.warn(
        'Failed to read prettify provider settings:',
        error instanceof Error ? error.message : error,
      );
      return {};
    }
  }

  private writeStoredSettings(settings: StoredPrettifyProviderSettings): void {
    this.dependencies.fileSystem.writeFileSync(this.dependencies.settingsFile, JSON.stringify(settings, null, 2), {
      mode: 0o600,
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
    } catch (error: unknown) {
      this.dependencies.logger.warn('Failed to decrypt vLLM API key:', error instanceof Error ? error.message : error);
      return '';
    }
  }

  private assertValidProviderUrls(settings: PrettifySettings): void {
    const baseUrls = [
      ['ollama', settings.ollama.baseUrl],
      ['vllm', settings.vllm.baseUrl],
    ] as const;
    for (const [providerId, baseUrl] of baseUrls) {
      if (!getPrettifyProviderCapabilities(providerId).baseUrl) continue;
      const error = getPrettifyBaseUrlValidationError(baseUrl);
      if (error) throw new Error(error);
    }
  }
}
