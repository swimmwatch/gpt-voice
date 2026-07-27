import type * as fs from 'node:fs';
import type { AppConfigStore } from '@main/config';
import {
  assertValidCloakBrowserSettingsInput,
  createCloakBrowserSettingsView,
  normalizeCloakBrowserSettingsInput,
  type NormalizedCloakBrowserSettings,
} from '@main/cloakBrowserSettingsUtils';
import type {
  CloakBrowserProxySettingsInput,
  CloakBrowserSettingsInput,
  CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';
import { isSocks5ProxyServer } from '@shared/cloakBrowserSettings';

interface StoredCloakBrowserProxySettings extends Omit<CloakBrowserProxySettingsInput, 'password' | 'clearPassword'> {
  encryptedPassword?: string;
}

interface StoredCloakBrowserSettings extends Omit<CloakBrowserSettingsInput, 'proxy'> {
  proxy?: StoredCloakBrowserProxySettings;
}

export interface CloakBrowserProxySettingsWithSecret extends Omit<CloakBrowserSettingsView['proxy'], 'hasPassword'> {
  password: string;
}

export interface CloakBrowserSettingsWithSecret extends Omit<CloakBrowserSettingsView, 'proxy'> {
  proxy: CloakBrowserProxySettingsWithSecret;
}

export interface PreparedCloakBrowserSettings {
  settings: CloakBrowserSettingsView;
  settingsWithSecret: CloakBrowserSettingsWithSecret;
  persist: () => CloakBrowserSettingsView;
}

export interface CloakBrowserSettingsRepositoryDependencies {
  readonly config: Pick<AppConfigStore, 'getFingerprintSeed'>;
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

function shouldSanitizeFingerprintSeed(input: CloakBrowserSettingsInput): boolean {
  return typeof input.fingerprintSeed !== 'string' || input.fingerprintSeed.trim() === '';
}

function mergeStoredSettings(
  stored: StoredCloakBrowserSettings,
  input: CloakBrowserSettingsInput,
): CloakBrowserSettingsInput {
  return {
    humanize: input.humanize ?? stored.humanize,
    humanPreset: input.humanPreset ?? stored.humanPreset,
    backgroundMode: input.backgroundMode ?? stored.backgroundMode,
    fingerprintSeed: input.fingerprintSeed ?? stored.fingerprintSeed,
    locale: input.locale ?? stored.locale,
    timezone: input.timezone ?? stored.timezone,
    proxy: {
      enabled: input.proxy?.enabled ?? stored.proxy?.enabled,
      server: input.proxy?.server ?? stored.proxy?.server,
      bypass: input.proxy?.bypass ?? stored.proxy?.bypass,
      username: input.proxy?.username ?? stored.proxy?.username,
      geoip: input.proxy?.geoip ?? stored.proxy?.geoip,
    },
  };
}

function toStoredSettings(
  settings: NormalizedCloakBrowserSettings,
  encryptedPassword?: string,
): StoredCloakBrowserSettings {
  return {
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    backgroundMode: settings.backgroundMode,
    fingerprintSeed: settings.fingerprintSeed,
    locale: settings.locale,
    timezone: settings.timezone,
    proxy: {
      enabled: settings.proxy.enabled,
      server: settings.proxy.server,
      bypass: settings.proxy.bypass,
      username: settings.proxy.username,
      geoip: settings.proxy.geoip,
      encryptedPassword,
    },
  };
}

/** Owns encrypted CloakBrowser settings for one application graph. */
export class CloakBrowserSettingsRepository {
  public constructor(private readonly dependencies: CloakBrowserSettingsRepositoryDependencies) {}

  public getView(): CloakBrowserSettingsView {
    const stored = this.readStoredSettings();
    const normalized = normalizeCloakBrowserSettingsInput(stored, this.dependencies.config.getFingerprintSeed(), {
      sanitizeInvalidFingerprintSeed: true,
    });
    return createCloakBrowserSettingsView(
      normalized,
      Boolean(this.decryptProxyPassword(stored.proxy?.encryptedPassword)),
    );
  }

  public getWithSecret(): CloakBrowserSettingsWithSecret {
    const stored = this.readStoredSettings();
    const normalized = normalizeCloakBrowserSettingsInput(stored, this.dependencies.config.getFingerprintSeed(), {
      sanitizeInvalidFingerprintSeed: true,
    });
    const password = this.decryptProxyPassword(stored.proxy?.encryptedPassword);

    return {
      ...normalized,
      proxy: {
        ...normalized.proxy,
        password,
      },
    };
  }

  public prepare(input: CloakBrowserSettingsInput = {}): PreparedCloakBrowserSettings {
    assertValidCloakBrowserSettingsInput(input);
    const stored = this.readStoredSettings();
    const normalized = normalizeCloakBrowserSettingsInput(
      mergeStoredSettings(stored, input),
      this.dependencies.config.getFingerprintSeed(),
      { sanitizeInvalidFingerprintSeed: shouldSanitizeFingerprintSeed(input) },
    );
    const storedPassword = this.decryptProxyPassword(stored.proxy?.encryptedPassword);
    let encryptedPassword = storedPassword ? stored.proxy?.encryptedPassword : undefined;
    let proxyPassword = storedPassword;
    const password = typeof input.proxy?.password === 'string' ? input.proxy.password.trim() : '';

    if (input.proxy?.clearPassword) {
      encryptedPassword = undefined;
      proxyPassword = '';
    }
    if (password) {
      encryptedPassword = this.encryptProxyPassword(password);
      proxyPassword = password;
    }
    if (
      normalized.proxy.enabled &&
      isSocks5ProxyServer(normalized.proxy.server) &&
      (normalized.proxy.username || proxyPassword)
    ) {
      throw new Error('SOCKS5 proxy username/password is not supported');
    }

    const storedSettings = toStoredSettings(normalized, encryptedPassword);
    const view = createCloakBrowserSettingsView(normalized, Boolean(proxyPassword));
    const settingsWithSecret: CloakBrowserSettingsWithSecret = {
      ...normalized,
      proxy: {
        ...normalized.proxy,
        password: proxyPassword,
      },
    };

    return {
      settings: view,
      settingsWithSecret,
      persist: () => {
        this.writeStoredSettings(storedSettings);
        return view;
      },
    };
  }

  public save(input: CloakBrowserSettingsInput = {}): CloakBrowserSettingsView {
    return this.prepare(input).persist();
  }

  private readStoredSettings(): StoredCloakBrowserSettings {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.settingsFile)) return {};
      return JSON.parse(
        this.dependencies.fileSystem.readFileSync(this.dependencies.settingsFile, 'utf8'),
      ) as StoredCloakBrowserSettings;
    } catch (error) {
      this.dependencies.logger.warn('Failed to read CloakBrowser settings:', error);
      return {};
    }
  }

  private writeStoredSettings(settings: StoredCloakBrowserSettings): void {
    this.dependencies.fileSystem.writeFileSync(this.dependencies.settingsFile, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    });
  }

  private encryptProxyPassword(password: string): string {
    if (!this.dependencies.secureStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system');
    }
    return this.dependencies.secureStorage.encrypt(password).toString('base64');
  }

  private decryptProxyPassword(encryptedPassword?: string): string {
    if (!encryptedPassword || !this.dependencies.secureStorage.isEncryptionAvailable()) return '';

    try {
      return this.dependencies.secureStorage.decrypt(Buffer.from(encryptedPassword, 'base64'));
    } catch (error) {
      this.dependencies.logger.warn('Failed to decrypt CloakBrowser proxy password:', error);
      return '';
    }
  }
}
