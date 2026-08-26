import * as path from 'node:path';

export const LOCAL_WHISPER_DEVICE_IDENTITY_DIRECTORY_MODE = 0o700;
export const LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE = 0o600;

export type LocalWhisperDeviceIdentityReadResult =
  | { readonly status: 'ok'; readonly value: unknown }
  | { readonly status: 'missing' }
  | { readonly status: 'malformed' };

export interface LocalWhisperDeviceIdentityStore {
  read(): LocalWhisperDeviceIdentityReadResult;
  write(value: unknown): void;
  remove(): boolean;
}

export interface FileLocalWhisperDeviceIdentityStoreDependencies {
  readonly filePath: string;
  readonly platform: NodeJS.Platform;
  readonly createTemporaryPath: (filePath: string) => string;
  readonly fileSystem: {
    existsSync(filePath: string): boolean;
    readFileSync(filePath: string, encoding: BufferEncoding): string;
    mkdirSync(directoryPath: string, options: { readonly recursive: true; readonly mode: number }): unknown;
    chmodSync(filePath: string, mode: number): void;
    writeFileSync(
      filePath: string,
      data: string,
      options: { readonly encoding: BufferEncoding; readonly flag: 'wx'; readonly mode: number },
    ): void;
    renameSync(oldPath: string, newPath: string): void;
    rmSync(filePath: string, options: { readonly force: true }): void;
    unlinkSync(filePath: string): void;
  };
}

/** Persists the private device-identity salt with owner-only permissions and atomic replacement. */
export class FileLocalWhisperDeviceIdentityStore implements LocalWhisperDeviceIdentityStore {
  public constructor(private readonly dependencies: FileLocalWhisperDeviceIdentityStoreDependencies) {}

  public read(): LocalWhisperDeviceIdentityReadResult {
    if (!this.dependencies.fileSystem.existsSync(this.dependencies.filePath)) return { status: 'missing' };
    try {
      return {
        status: 'ok',
        value: JSON.parse(this.dependencies.fileSystem.readFileSync(this.dependencies.filePath, 'utf8')) as unknown,
      };
    } catch {
      return { status: 'malformed' };
    }
  }

  public write(value: unknown): void {
    const directory = path.dirname(this.dependencies.filePath);
    const temporaryPath = this.dependencies.createTemporaryPath(this.dependencies.filePath);
    if (path.dirname(temporaryPath) !== directory || temporaryPath === this.dependencies.filePath) {
      throw new Error('Local Whisper device identity persistence failed');
    }
    try {
      this.dependencies.fileSystem.mkdirSync(directory, {
        recursive: true,
        mode: LOCAL_WHISPER_DEVICE_IDENTITY_DIRECTORY_MODE,
      });
      if (this.dependencies.platform !== 'win32') {
        this.dependencies.fileSystem.chmodSync(directory, LOCAL_WHISPER_DEVICE_IDENTITY_DIRECTORY_MODE);
      }
      this.dependencies.fileSystem.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE,
      });
      if (this.dependencies.platform !== 'win32') {
        this.dependencies.fileSystem.chmodSync(temporaryPath, LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE);
      }
      this.dependencies.fileSystem.renameSync(temporaryPath, this.dependencies.filePath);
      if (this.dependencies.platform !== 'win32') {
        this.dependencies.fileSystem.chmodSync(this.dependencies.filePath, LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE);
      }
    } catch {
      try {
        this.dependencies.fileSystem.rmSync(temporaryPath, { force: true });
      } catch {
        // Preserve a content-free error and never expose private paths.
      }
      throw new Error('Local Whisper device identity persistence failed');
    }
  }

  public remove(): boolean {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.filePath)) return false;
      this.dependencies.fileSystem.unlinkSync(this.dependencies.filePath);
      return true;
    } catch {
      throw new Error('Local Whisper device identity persistence failed');
    }
  }
}
