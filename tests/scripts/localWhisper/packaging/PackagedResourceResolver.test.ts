import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LocalWhisperPackagedResourceResolver } from '@main/localWhisper/packaging/LocalWhisperPackagedResourceResolver';
import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('LocalWhisperPackagedResourceResolver', () => {
  it('returns main-only paths only after exact helper identity verification', async () => {
    const root = '/opt/gpt-voice/resources';
    const guard = Buffer.from('guard fixture');
    const launcher = Buffer.from('launcher fixture');
    const manifest = Buffer.from(
      serializeCanonicalLocalWhisperCatalogJson({
        schemaVersion: 1,
        platform: 'linux',
        helpers: [
          {
            role: 'filesystem-authority-guard',
            name: 'fs-guard',
            sizeBytes: guard.byteLength,
            sha256: sha256(guard),
            mode: 0o500,
          },
          {
            role: 'operation-scoped-launcher',
            name: 'local-whisper-launcher',
            sizeBytes: launcher.byteLength,
            sha256: sha256(launcher),
            mode: 0o500,
          },
        ],
        licenseFile: 'LICENSE.txt',
      }),
    );
    const files = new Map<string, Uint8Array>([
      [path.join(root, 'local-whisper', 'native', 'helpers.manifest.json'), manifest],
      [path.join(root, 'local-whisper', 'native', 'fs-guard'), guard],
      [path.join(root, 'local-whisper', 'native', 'local-whisper-launcher'), launcher],
    ]);
    const resolver = new LocalWhisperPackagedResourceResolver({
      platform: 'linux',
      resourcesPath: root,
      readFile: (filePath) => {
        const value = files.get(filePath);
        return value ? Promise.resolve(value) : Promise.reject(new Error('missing'));
      },
    });
    assert.deepEqual(await resolver.resolve(), {
      availability: 'available',
      filesystemGuardExecutable: path.join(root, 'local-whisper', 'native', 'fs-guard'),
      launcherExecutable: path.join(root, 'local-whisper', 'native', 'local-whisper-launcher'),
    });
    files.set(path.join(root, 'local-whisper', 'native', 'fs-guard'), Buffer.from('changed'));
    await assert.rejects(resolver.resolve(), /IDENTITY_MISMATCH/u);
  });

  it('returns the macOS planned skeleton without resolving executable paths', async () => {
    let reads = 0;
    const resolver = new LocalWhisperPackagedResourceResolver({
      platform: 'darwin',
      resourcesPath: '/Applications/GPT-Voice.app/Contents/Resources',
      readFile: () => {
        reads += 1;
        return Promise.reject(new Error('must not read'));
      },
    });
    assert.deepEqual(await resolver.resolve(), { availability: 'planned', code: 'PLANNED_UNAVAILABLE' });
    assert.equal(reads, 0);
  });
});
