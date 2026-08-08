import { chmod, copyFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';
import type { DevelopmentRuntimePlatform } from './DevelopmentRuntimeInputs';

function helperInputs(platform: DevelopmentRuntimePlatform) {
  const extension = platform === 'win32' ? '.exe' : '';
  return Object.freeze([
    Object.freeze({
      role: 'filesystem-authority-guard' as const,
      source: Object.freeze(['.cache', 'local-whisper', 'fs-guard', `fs-guard${extension}`]),
      name: `fs-guard${extension}`,
    }),
    Object.freeze({
      role: 'operation-scoped-launcher' as const,
      source: Object.freeze(['.cache', 'local-whisper', 'launcher', `local-whisper-launcher${extension}`]),
      name: `local-whisper-launcher${extension}`,
    }),
  ]);
}

function safeRoot(value: string): string {
  const resolved = path.resolve(value);
  if (!path.isAbsolute(value) || resolved === path.parse(resolved).root) {
    throw new Error('Local Whisper development resource root invalid');
  }
  return resolved;
}

/** Stages the exact main-owned native helpers and their canonical identity manifest. */
export class DevelopmentResourceStager {
  public async stage(
    workspaceRoot: string,
    resourcesPath: string,
    platform: DevelopmentRuntimePlatform,
  ): Promise<void> {
    const workspace = safeRoot(workspaceRoot);
    const resources = safeRoot(resourcesPath);
    const nativeRoot = path.join(resources, 'local-whisper', 'native');
    await mkdir(nativeRoot, { recursive: true, mode: 0o700 });
    const helpers = [];
    for (const input of helperInputs(platform)) {
      const sourcePath = path.join(workspace, ...input.source);
      const source = await lstat(sourcePath);
      if (!source.isFile() || source.isSymbolicLink() || source.size <= 0) {
        throw new Error('Local Whisper development helper input invalid');
      }
      const destinationPath = path.join(nativeRoot, input.name);
      await copyFile(sourcePath, destinationPath);
      if (platform === 'linux') await chmod(destinationPath, 0o500);
      const destination = await lstat(destinationPath);
      if (!destination.isFile() || destination.isSymbolicLink() || destination.size !== source.size) {
        throw new Error('Local Whisper development helper staging failed');
      }
      helpers.push(
        Object.freeze({
          role: input.role,
          name: input.name,
          sizeBytes: destination.size,
          sha256: await sha256File(destinationPath),
          mode: platform === 'linux' ? 0o500 : 0,
        }),
      );
    }
    await writeFile(
      path.join(nativeRoot, 'LICENSE.txt'),
      'Development qualification helpers. See the repository LICENSE and THIRD_PARTY_NOTICES.md.\n',
      { encoding: 'utf8', mode: 0o400 },
    );
    await writeCanonicalJson(path.join(nativeRoot, 'helpers.manifest.json'), {
      schemaVersion: 1,
      platform,
      helpers,
      licenseFile: 'LICENSE.txt',
    });
    await chmod(path.join(nativeRoot, 'helpers.manifest.json'), 0o400);
  }
}
