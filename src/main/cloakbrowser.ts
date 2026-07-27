import * as path from 'node:path';
import type { BrowserContext } from 'playwright-core';
import type { LaunchContextOptions, LaunchPersistentContextOptions } from 'cloakbrowser';
import type { ScopedLogger } from './logger';

export interface CloakBrowserApi {
  launchContext(options?: LaunchContextOptions): Promise<BrowserContext>;
  launchPersistentContext(options: LaunchPersistentContextOptions): Promise<BrowserContext>;
}

export interface CloakBrowserRuntimeLoaderDependencies {
  readonly environment: NodeJS.ProcessEnv;
  readonly fileSystem: {
    existsSync(filePath: string): boolean;
  };
  readonly importModule: (specifier: string) => Promise<CloakBrowserApi>;
  readonly isPackaged: boolean;
  readonly logger: Pick<ScopedLogger, 'info' | 'warn'>;
  readonly platform: NodeJS.Platform;
  readonly resourcesPath: string;
}

const CLOAKBROWSER_MODULE_SPECIFIER = 'cloakbrowser';
const CLOAKBROWSER_RESOURCE_DIRECTORY = 'cloakbrowser';
const CLOAKBROWSER_AUTO_UPDATE_ENVIRONMENT_KEY = 'CLOAKBROWSER_AUTO_UPDATE';
const CLOAKBROWSER_BINARY_PATH_ENVIRONMENT_KEY = 'CLOAKBROWSER_BINARY_PATH';

/** Owns packaged CloakBrowser configuration and one isolated lazy ESM import. */
export class CloakBrowserRuntimeLoader {
  private cloakBrowserPromise: Promise<CloakBrowserApi> | null = null;

  public constructor(private readonly dependencies: CloakBrowserRuntimeLoaderDependencies) {}

  public readonly configure = (): void => {
    if (!this.dependencies.isPackaged) return;

    this.dependencies.environment[CLOAKBROWSER_AUTO_UPDATE_ENVIRONMENT_KEY] = 'false';
    if (this.dependencies.environment[CLOAKBROWSER_BINARY_PATH_ENVIRONMENT_KEY]) return;

    const executablePath = this.getBundledExecutablePath();
    if (this.dependencies.fileSystem.existsSync(executablePath)) {
      this.dependencies.environment[CLOAKBROWSER_BINARY_PATH_ENVIRONMENT_KEY] = executablePath;
      this.dependencies.logger.info('Using bundled CloakBrowser executable:', executablePath);
    } else {
      this.dependencies.logger.warn('Bundled CloakBrowser executable not found:', executablePath);
    }
  };

  public readonly launchContext = async (options?: LaunchContextOptions): Promise<BrowserContext> => {
    return (await this.getCloakBrowser()).launchContext(options);
  };

  public readonly launchPersistentContext = async (
    options: LaunchPersistentContextOptions,
  ): Promise<BrowserContext> => {
    return (await this.getCloakBrowser()).launchPersistentContext(options);
  };

  private getBundledExecutablePath(): string {
    const baseDirectory = path.join(this.dependencies.resourcesPath, CLOAKBROWSER_RESOURCE_DIRECTORY);
    if (this.dependencies.platform === 'win32') {
      return path.join(baseDirectory, 'chrome.exe');
    }
    if (this.dependencies.platform === 'darwin') {
      return path.join(baseDirectory, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
    }
    return path.join(baseDirectory, 'chrome');
  }

  private getCloakBrowser(): Promise<CloakBrowserApi> {
    this.configure();
    this.cloakBrowserPromise ??= this.dependencies.importModule(CLOAKBROWSER_MODULE_SPECIFIER);
    return this.cloakBrowserPromise;
  }
}
