import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { BrowserContext } from 'playwright-core';
import type { LaunchContextOptions, LaunchPersistentContextOptions } from 'cloakbrowser';
import { createLogger } from './logger';

type CloakBrowserApi = {
  launchContext(options?: LaunchContextOptions): Promise<BrowserContext>;
  launchPersistentContext(options: LaunchPersistentContextOptions): Promise<BrowserContext>;
};

const log = createLogger('cloakbrowser');
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<CloakBrowserApi>;

let cloakBrowserPromise: Promise<CloakBrowserApi> | null = null;

function getBundledExecutablePath(): string {
  const baseDir = path.join(process.resourcesPath, 'cloakbrowser');
  if (process.platform === 'win32') {
    return path.join(baseDir, 'chrome.exe');
  }
  if (process.platform === 'darwin') {
    return path.join(baseDir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
  }
  return path.join(baseDir, 'chrome');
}

export function configureCloakBrowserRuntime(): void {
  if (!app.isPackaged) return;

  process.env.CLOAKBROWSER_AUTO_UPDATE = 'false';

  if (process.env.CLOAKBROWSER_BINARY_PATH) return;

  const executablePath = getBundledExecutablePath();
  if (fs.existsSync(executablePath)) {
    process.env.CLOAKBROWSER_BINARY_PATH = executablePath;
    log.info('Using bundled CloakBrowser executable:', executablePath);
  } else {
    log.warn('Bundled CloakBrowser executable not found:', executablePath);
  }
}

async function getCloakBrowser(): Promise<CloakBrowserApi> {
  configureCloakBrowserRuntime();
  cloakBrowserPromise ??= importEsm('cloakbrowser');
  return cloakBrowserPromise;
}

export async function launchCloakContext(options?: LaunchContextOptions): Promise<BrowserContext> {
  const cloakBrowser = await getCloakBrowser();
  return cloakBrowser.launchContext(options);
}

export async function launchCloakPersistentContext(options: LaunchPersistentContextOptions): Promise<BrowserContext> {
  const cloakBrowser = await getCloakBrowser();
  return cloakBrowser.launchPersistentContext(options);
}
