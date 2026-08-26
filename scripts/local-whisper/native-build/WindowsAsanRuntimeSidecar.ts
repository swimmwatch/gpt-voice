import { chmodSync, constants, copyFileSync, lstatSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';

export const WINDOWS_ASAN_RUNTIME_FILE_NAME = 'clang_rt.asan_dynamic-x86_64.dll';

/** Places the verified MSVC ASan runtime beside sanitized Windows fixture executables. */
export class WindowsAsanRuntimeSidecar {
  public constructor(
    private readonly sourcePath: string | undefined,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  public copyTo(directoryPath: string): string | null {
    if (this.sourcePath === undefined) return null;
    if (
      this.platform !== 'win32' ||
      !isAbsolute(this.sourcePath) ||
      basename(this.sourcePath).toLowerCase() !== WINDOWS_ASAN_RUNTIME_FILE_NAME
    ) {
      throw new Error('Windows ASan runtime sidecar source is invalid');
    }
    if (!lstatSync(this.sourcePath).isFile()) {
      throw new Error('Windows ASan runtime sidecar source is not a regular file');
    }
    if (!isAbsolute(directoryPath) || !lstatSync(directoryPath).isDirectory()) {
      throw new Error('Windows ASan runtime sidecar destination is invalid');
    }
    const destinationPath = resolve(directoryPath, WINDOWS_ASAN_RUNTIME_FILE_NAME);
    copyFileSync(this.sourcePath, destinationPath, constants.COPYFILE_EXCL);
    chmodSync(destinationPath, 0o500);
    return destinationPath;
  }
}
