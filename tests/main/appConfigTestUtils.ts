/* eslint-disable max-classes-per-file -- focused test services own independent config and settings state. */
import * as fs from 'node:fs';
import { AppConfigStore, resolveAppConfigPaths } from '@main/config';
import type { CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import { normalizeCloakBrowserSettingsInput } from '@main/cloakBrowserSettingsUtils';

const TEST_FINGERPRINT_SEED = '12345';
const TEST_CONFIG_DIRECTORY = '/synthetic-config';
const TEST_HOME_DIRECTORY = '/synthetic-home';

/** Side-effect-free configuration store for isolated main-process tests. */
export class TestAppConfigStore extends AppConfigStore {
  public saveCount = 0;

  public constructor(providerId: string | null = 'chatgpt') {
    super({
      fileSystem: fs,
      generateFingerprintSeed: () => TEST_FINGERPRINT_SEED,
      generatePrettifyProfileUuid: () => '00000000-0000-0000-0000-000000000001',
      logger: { error: () => undefined, info: () => undefined, warn: () => undefined },
      paths: resolveAppConfigPaths({
        environment: { XDG_CONFIG_HOME: TEST_CONFIG_DIRECTORY },
        homeDirectory: () => TEST_HOME_DIRECTORY,
        platform: 'linux',
      }),
      writeFileAtomically: () => undefined,
    });
    this.setProvider(providerId);
  }

  public override save(): void {
    this.saveCount += 1;
  }
}

/** Deterministic CloakBrowser settings source for provider tests. */
export class TestCloakBrowserSettingsRepository {
  public getWithSecret(): CloakBrowserSettingsWithSecret {
    const settings = normalizeCloakBrowserSettingsInput({}, TEST_FINGERPRINT_SEED);
    return {
      ...settings,
      proxy: {
        ...settings.proxy,
        password: '',
      },
    };
  }
}
