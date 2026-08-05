import * as path from 'node:path';
import type { BrowserContext } from 'playwright-core';
import type { LaunchContextOptions, LaunchPersistentContextOptions } from 'cloakbrowser';
import { FIRST_LAUNCH_STARTUP_FAILURE_CODES, type FirstLaunchStartupJobRunResult } from '@shared/firstLaunchStartup';
import type { ScopedLogger } from './logger';

export interface CloakBrowserBinaryInfo {
  readonly binaryPath: string;
  readonly installed: boolean;
}

export interface CloakBrowserApi {
  readonly BinaryVerificationError?: new (message: string) => Error;
  binaryInfo(): CloakBrowserBinaryInfo;
  ensureBinary(): Promise<string>;
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

  /** Prepares only the verified app-owned browser runtime without launching a browser context. */
  public readonly prepare = async (): Promise<FirstLaunchStartupJobRunResult> => {
    this.configure();
    const configuredBinaryPath = this.dependencies.environment[CLOAKBROWSER_BINARY_PATH_ENVIRONMENT_KEY];
    if (configuredBinaryPath) {
      return this.dependencies.fileSystem.existsSync(configuredBinaryPath)
        ? { failureCode: null, success: true }
        : { failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed, success: false };
    }

    let cloakBrowser: CloakBrowserApi;
    try {
      cloakBrowser = await this.getCloakBrowser();
    } catch {
      return { failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed, success: false };
    }

    try {
      const existingBinary = cloakBrowser.binaryInfo();
      if (existingBinary.installed && this.dependencies.fileSystem.existsSync(existingBinary.binaryPath)) {
        this.dependencies.environment[CLOAKBROWSER_BINARY_PATH_ENVIRONMENT_KEY] = existingBinary.binaryPath;
        return { failureCode: null, success: true };
      }
    } catch (error: unknown) {
      return this.createPreparationFailure(cloakBrowser, error);
    }

    try {
      const binaryPath = await cloakBrowser.ensureBinary();
      if (!this.dependencies.fileSystem.existsSync(binaryPath)) {
        return { failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed, success: false };
      }
      this.dependencies.environment[CLOAKBROWSER_BINARY_PATH_ENVIRONMENT_KEY] = binaryPath;
      return { failureCode: null, success: true };
    } catch (error: unknown) {
      return this.createPreparationFailure(cloakBrowser, error);
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

  private createPreparationFailure(
    cloakBrowser: Pick<CloakBrowserApi, 'BinaryVerificationError'>,
    error: unknown,
  ): FirstLaunchStartupJobRunResult {
    const VerificationError = cloakBrowser.BinaryVerificationError;
    return {
      failureCode:
        VerificationError && error instanceof VerificationError
          ? FIRST_LAUNCH_STARTUP_FAILURE_CODES.VerificationFailed
          : FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
      success: false,
    };
  }

  private getCloakBrowser(): Promise<CloakBrowserApi> {
    this.configure();
    this.cloakBrowserPromise ??= this.dependencies.importModule(CLOAKBROWSER_MODULE_SPECIFIER);
    return this.cloakBrowserPromise;
  }
}
