import * as path from 'node:path';

import type { BrowserWindow, SaveDialogOptions, SaveDialogReturnValue } from 'electron';

import type { I18nService } from '../i18n';
import type { DiagnosticsArchiveService } from './diagnosticsArchive';
import { type DiagnosticsExportResult, type DiagnosticsExportStatus } from '@shared/diagnosticsArchive';
import type { SystemNotificationOptions } from '@shared/notifications';

const DIAGNOSTICS_EXPORT_RANDOM_BYTES = 4;
const DIAGNOSTICS_EXPORT_RANDOM_HEX_LENGTH = DIAGNOSTICS_EXPORT_RANDOM_BYTES * 2;
const DIAGNOSTICS_EXPORT_FILENAME_PREFIX = 'gpt-voice-diagnostics-';
const DIAGNOSTICS_EXPORT_FAILURE = Object.freeze({ status: 'failed' } as const);
const DIAGNOSTICS_EXPORT_CANCELLED = Object.freeze({ status: 'cancelled' } as const);
const DIAGNOSTICS_EXPORT_SAVED = Object.freeze({ status: 'saved' } as const);
const DIAGNOSTICS_EXPORT_DIALOG_PROPERTIES: NonNullable<SaveDialogOptions['properties']> = [
  'createDirectory',
  'showOverwriteConfirmation',
];

type SupportedDiagnosticsExportPlatform = 'darwin' | 'linux' | 'win32';

interface DiagnosticsExportPlatformConfiguration {
  readonly extension: '.tar.gz' | '.zip';
  readonly filter: NonNullable<SaveDialogOptions['filters']>[number];
}

const DIAGNOSTICS_EXPORT_PLATFORM_CONFIGURATION: Readonly<
  Record<SupportedDiagnosticsExportPlatform, DiagnosticsExportPlatformConfiguration>
> = Object.freeze({
  darwin: Object.freeze({
    extension: '.tar.gz',
    filter: Object.freeze({ extensions: ['tar.gz'], name: 'Compressed tar archive' }),
  }),
  linux: Object.freeze({
    extension: '.tar.gz',
    filter: Object.freeze({ extensions: ['tar.gz'], name: 'Compressed tar archive' }),
  }),
  win32: Object.freeze({
    extension: '.zip',
    filter: Object.freeze({ extensions: ['zip'], name: 'ZIP archive' }),
  }),
});

export interface DiagnosticsExportDialog {
  showSaveDialog(parentWindow: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
}

export interface DiagnosticsExportFileSystem {
  pathExists(filePath: string): Promise<boolean>;
}

export interface DiagnosticsExportLogger {
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface DiagnosticsExportNotification {
  show(title: string, body: string, options?: SystemNotificationOptions): void;
}

export interface DiagnosticsExportServiceDependencies {
  readonly archive: Pick<DiagnosticsArchiveService, 'createArchive'>;
  readonly dialog: DiagnosticsExportDialog;
  readonly fileSystem: DiagnosticsExportFileSystem;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly logger: DiagnosticsExportLogger;
  readonly notification: DiagnosticsExportNotification;
  readonly now: () => Date;
  readonly platform: NodeJS.Platform;
  readonly randomBytes: (size: number) => Buffer;
}

interface ActiveDiagnosticsExport {
  readonly operation: Promise<DiagnosticsExportResult>;
  readonly window: BrowserWindow;
}

type DiagnosticsExportDestinationResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed' }
  | { readonly filePath: string; readonly status: 'selected' };

/** Owns the privileged Settings export flow and its process-local single-flight invariant. */
export class DiagnosticsExportService {
  private activeExport: ActiveDiagnosticsExport | null = null;

  public constructor(private readonly dependencies: DiagnosticsExportServiceDependencies) {}

  public export(settingsWindow: BrowserWindow): Promise<DiagnosticsExportResult> {
    const activeExport = this.activeExport;
    if (activeExport) {
      if (activeExport.window === settingsWindow && !settingsWindow.isDestroyed()) {
        return activeExport.operation;
      }
      return Promise.reject(new Error('Diagnostics export is already active'));
    }
    if (settingsWindow.isDestroyed()) {
      return Promise.reject(new Error('Diagnostics export window is unavailable'));
    }

    const operation = this.exportNow(settingsWindow).finally(() => {
      if (this.activeExport?.operation === operation) this.activeExport = null;
    });
    this.activeExport = Object.freeze({ operation, window: settingsWindow });
    return operation;
  }

  private async exportNow(settingsWindow: BrowserWindow): Promise<DiagnosticsExportResult> {
    try {
      const destination = await this.selectDestination(settingsWindow);
      if (destination.status === 'cancelled') return DIAGNOSTICS_EXPORT_CANCELLED;
      if (destination.status === 'failed') {
        this.notifySafely('failed');
        return DIAGNOSTICS_EXPORT_FAILURE;
      }

      const archiveResult = await this.dependencies.archive.createArchive(destination.filePath);
      if (archiveResult.status !== 'success') {
        this.notifySafely('failed');
        return DIAGNOSTICS_EXPORT_FAILURE;
      }

      this.notifySafely('saved');
      return DIAGNOSTICS_EXPORT_SAVED;
    } catch {
      this.notifySafely('failed');
      return DIAGNOSTICS_EXPORT_FAILURE;
    }
  }

  private async selectDestination(settingsWindow: BrowserWindow): Promise<DiagnosticsExportDestinationResult> {
    const configuration = this.getPlatformConfiguration();
    const defaultFilename = this.createDefaultFilename(configuration.extension);
    const baseOptions: SaveDialogOptions = {
      defaultPath: defaultFilename,
      filters: [configuration.filter],
      properties: [...DIAGNOSTICS_EXPORT_DIALOG_PROPERTIES],
      title: this.dependencies.localization.translate('auditLog.exportDialogTitle'),
    };
    let options = baseOptions;

    for (;;) {
      const selection = await this.dependencies.dialog.showSaveDialog(settingsWindow, options);
      if (selection.canceled) return DIAGNOSTICS_EXPORT_CANCELLED;
      if (!selection.filePath || !path.isAbsolute(selection.filePath) || selection.filePath.includes('\0')) {
        return DIAGNOSTICS_EXPORT_FAILURE;
      }

      const selectedPath = selection.filePath;
      const hasExpectedExtension = selectedPath.toLowerCase().endsWith(configuration.extension);
      const finalPath = hasExpectedExtension ? selectedPath : `${selectedPath}${configuration.extension}`;
      if (hasExpectedExtension || !(await this.dependencies.fileSystem.pathExists(finalPath))) {
        return Object.freeze({ filePath: finalPath, status: 'selected' });
      }

      // Reopen the native dialog on the exact appended path so overwrite
      // confirmation applies to the destination that will actually be written.
      options = {
        ...baseOptions,
        defaultPath: finalPath,
      };
    }
  }

  private createDefaultFilename(extension: DiagnosticsExportPlatformConfiguration['extension']): string {
    const now = this.dependencies.now();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError('Invalid diagnostics export time');
    }
    const randomBytes = this.dependencies.randomBytes(DIAGNOSTICS_EXPORT_RANDOM_BYTES);
    if (!Buffer.isBuffer(randomBytes) || randomBytes.byteLength !== DIAGNOSTICS_EXPORT_RANDOM_BYTES) {
      throw new TypeError('Invalid diagnostics export randomness');
    }
    const randomSuffix = randomBytes.toString('hex');
    if (randomSuffix.length !== DIAGNOSTICS_EXPORT_RANDOM_HEX_LENGTH) {
      throw new TypeError('Invalid diagnostics export suffix');
    }
    const timestamp = `${now.toISOString().slice(0, 19).replace(/[-:]/gu, '')}Z`;
    return `${DIAGNOSTICS_EXPORT_FILENAME_PREFIX}${timestamp}-${randomSuffix}${extension}`;
  }

  private getPlatformConfiguration(): DiagnosticsExportPlatformConfiguration {
    if (
      this.dependencies.platform !== 'darwin' &&
      this.dependencies.platform !== 'linux' &&
      this.dependencies.platform !== 'win32'
    ) {
      throw new TypeError('Unsupported diagnostics export platform');
    }
    return DIAGNOSTICS_EXPORT_PLATFORM_CONFIGURATION[this.dependencies.platform];
  }

  private notifySafely(status: Extract<DiagnosticsExportStatus, 'failed' | 'saved'>): void {
    try {
      const titleKey =
        status === 'saved' ? 'notification.diagnosticsExportSaved' : 'notification.diagnosticsExportFailed';
      const bodyKey =
        status === 'saved' ? 'notification.diagnosticsExportSavedBody' : 'notification.diagnosticsExportFailedBody';
      this.dependencies.notification.show(
        this.dependencies.localization.translate(titleKey),
        this.dependencies.localization.translate(bodyKey),
        { sound: status === 'saved' ? 'success' : 'error' },
      );
    } catch {
      this.warnSafely('Diagnostics export notification failed', status);
    }
  }

  private warnSafely(message: string, status: Extract<DiagnosticsExportStatus, 'failed' | 'saved'>): void {
    try {
      this.dependencies.logger.warn(message, { status });
    } catch {
      // Diagnostics export remains fail-safe even when its logger is unavailable.
    }
  }
}
