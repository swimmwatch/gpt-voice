import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { PackageStager } from '@scripts/local-whisper/packaging/PackageStager';
import { ReleaseCollectionGuard } from '@scripts/local-whisper/packaging/ReleaseCollectionGuard';

import { createSyntheticHelpers } from './packagingTestUtils';

describe('Local Whisper release collection', () => {
  it('rejects disabled and fixture staging before incomplete production inputs can reach collection', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-release-test-'));
    try {
      const stagingDirectory = path.join(root, 'disabled');
      await new PackageStager().stage({
        mode: 'disabled',
        platform: 'linux',
        outputDirectory: stagingDirectory,
        helpers: await createSyntheticHelpers(root),
      });
      const guard = new ReleaseCollectionGuard();
      await assert.rejects(
        guard.assertCollectable({ mode: 'disabled', platform: 'linux', stagingDirectory }),
        /requires production/u,
      );
      await assert.rejects(
        guard.assertCollectable({ mode: 'fixture', platform: 'linux', stagingDirectory }),
        /requires production/u,
      );
      await assert.rejects(
        guard.assertCollectable({ mode: 'production', platform: 'linux', stagingDirectory }),
        /allowlist|state|mode/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
