import { spawn } from 'node:child_process';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import * as path from 'node:path';

import { sha256File } from '../packaging/fileIntegrity';

export interface LinuxPredecessorPackageExecutable {
  readonly executablePath: string;
  readonly sha256: string;
}

export interface LinuxPredecessorPackageExtractorPort {
  readonly extract: (appImagePath: string, extractionRoot: string) => Promise<LinuxPredecessorPackageExecutable>;
}

/** Self-extracts the already hash-verified AppImage and returns its exact packaged Electron executable. */
export class LinuxPredecessorAppImageExtractor implements LinuxPredecessorPackageExtractorPort {
  public async extract(appImagePath: string, extractionRoot: string): Promise<LinuxPredecessorPackageExecutable> {
    await mkdir(extractionRoot, { recursive: false, mode: 0o700 });
    const child = spawn(appImagePath, ['--appimage-extract'], {
      cwd: extractionRoot,
      env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin' },
      shell: false,
      stdio: 'ignore',
    });
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal !== null) reject(new Error('Predecessor AppImage extraction terminated by signal'));
        else resolve(code);
      });
    });
    if (exitCode !== 0) throw new Error('Predecessor AppImage extraction failed');
    const executablePath = path.join(extractionRoot, 'squashfs-root', 'gpt-voice');
    const metadata = await lstat(executablePath);
    const resolvedExtractionRoot = await realpath(extractionRoot);
    const resolvedExecutablePath = await realpath(executablePath);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o111) === 0 ||
      !resolvedExecutablePath.startsWith(`${resolvedExtractionRoot}${path.sep}`)
    ) {
      throw new Error('Predecessor packaged executable identity invalid');
    }
    return Object.freeze({ executablePath, sha256: await sha256File(executablePath) });
  }
}
