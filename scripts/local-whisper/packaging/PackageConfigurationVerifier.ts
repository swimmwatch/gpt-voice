import { readFile } from 'node:fs/promises';

import { isRecord } from './contracts';

function hasResource(resources: unknown, from: string, to: string): boolean {
  return (
    Array.isArray(resources) && resources.some((entry) => isRecord(entry) && entry.from === from && entry.to === to)
  );
}

/** Verifies that Electron packaging takes only staged shared inputs and platform helper resources. */
export class PackageConfigurationVerifier {
  public async verify(packageJsonPath: string): Promise<void> {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as unknown;
    if (!isRecord(packageJson) || !isRecord(packageJson.build) || !isRecord(packageJson.scripts)) {
      throw new Error('Invalid package.json packaging configuration');
    }
    const build = packageJson.build;
    if (!hasResource(build.extraResources, 'build/generated/local-whisper/shared', 'local-whisper')) {
      throw new Error('Local Whisper shared package resources are not explicitly staged');
    }
    if (
      !isRecord(build.linux) ||
      !hasResource(build.linux.extraResources, 'build/generated/local-whisper/native', 'local-whisper/native') ||
      !isRecord(build.win) ||
      !hasResource(build.win.extraResources, 'build/generated/local-whisper/native', 'local-whisper/native')
    ) {
      throw new Error('Local Whisper Linux/Windows helper staging is incomplete');
    }
    if (
      isRecord(build.mac) &&
      hasResource(build.mac.extraResources, 'build/generated/local-whisper/native', 'local-whisper/native')
    ) {
      throw new Error('macOS Local Whisper executable helper staging is forbidden');
    }
    if (
      !Array.isArray(build.files) ||
      build.files.some(
        (entry) =>
          typeof entry === 'string' &&
          ['runtime/local-whisper', '.cache/local-whisper', 'build/generated/local-whisper/native'].some((fragment) =>
            entry.includes(fragment),
          ),
      )
    ) {
      throw new Error('Local Whisper native/runtime content entered ASAR policy');
    }
    for (const scriptName of ['pack', 'dist', 'dist:linux', 'dist:win', 'dist:mac']) {
      const script = packageJson.scripts[scriptName];
      if (typeof script !== 'string' || !script.includes('prepare:local-whisper:packaging')) {
        throw new Error(`${scriptName} does not explicitly prepare Local Whisper packaging`);
      }
    }
  }
}
