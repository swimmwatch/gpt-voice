import type { LaunchContextOptions, LaunchPersistentContextOptions } from 'cloakbrowser';
import { BROWSER_CACHE_DIR } from '@main/config';
import { getCloakBrowserSettingsWithSecret, type CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import { DEFAULT_CLOAK_BROWSER_LOCALE, getSystemTimezone } from '@main/cloakBrowserSettingsUtils';
import { isSocks5ProxyServer } from '@shared/cloakBrowserSettings';

type CloakBrowserContextKind = 'login' | 'background';

const VIEWPORT = { width: 1366, height: 768 };
const CHROMIUM_FATAL_LOG_LEVEL_ARG = '--log-level=3';

function buildProxyOption(settings: CloakBrowserSettingsWithSecret): LaunchContextOptions['proxy'] {
  if (!settings.proxy.enabled || !settings.proxy.server) return undefined;

  const proxy: NonNullable<LaunchContextOptions['proxy']> = {
    server: settings.proxy.server,
  };

  if (settings.proxy.bypass) proxy.bypass = settings.proxy.bypass;
  if (!isSocks5ProxyServer(settings.proxy.server)) {
    if (settings.proxy.username) proxy.username = settings.proxy.username;
    if (settings.proxy.password) proxy.password = settings.proxy.password;
  }

  return proxy;
}

export function buildCloakBrowserContextOptions(
  settings: CloakBrowserSettingsWithSecret,
  kind: CloakBrowserContextKind,
): LaunchContextOptions {
  const proxy = buildProxyOption(settings);
  const useProxyGeoip = Boolean(proxy && settings.proxy.geoip);
  const options: LaunchContextOptions = {
    headless: kind === 'background' ? settings.backgroundMode !== 'visible' : false,
    viewport: VIEWPORT,
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    args: [`--fingerprint=${settings.fingerprintSeed}`, CHROMIUM_FATAL_LOG_LEVEL_ARG],
  };

  if (proxy) {
    options.proxy = proxy;
  }
  if (useProxyGeoip) {
    options.geoip = true;
  } else {
    options.locale = settings.locale || DEFAULT_CLOAK_BROWSER_LOCALE;
    options.timezone = settings.timezone || getSystemTimezone();
  }

  return options;
}

export function createCloakBrowserLoginContextOptions(
  settings: CloakBrowserSettingsWithSecret = getCloakBrowserSettingsWithSecret(),
): LaunchContextOptions {
  return buildCloakBrowserContextOptions(settings, 'login');
}

export function createCloakBrowserPersistentContextOptions(
  settings: CloakBrowserSettingsWithSecret = getCloakBrowserSettingsWithSecret(),
): LaunchPersistentContextOptions {
  return {
    userDataDir: BROWSER_CACHE_DIR,
    ...buildCloakBrowserContextOptions(settings, 'background'),
  };
}
