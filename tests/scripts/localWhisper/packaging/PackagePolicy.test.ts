import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { PackageConfigurationVerifier } from '@scripts/local-whisper/packaging/PackageConfigurationVerifier';
import { PackagePolicyInspector } from '@scripts/local-whisper/packaging/PackagePolicyInspector';
import { PackageStager } from '@scripts/local-whisper/packaging/PackageStager';

import { createSyntheticHelpers, WORKSPACE_ROOT } from './packagingTestUtils';

describe('Local Whisper base-package policy', () => {
  it('stages disabled Linux with exactly two native helper roles and no inference payload', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-package-policy-'));
    try {
      const output = path.join(root, 'package');
      await new PackageStager().stage({
        mode: 'disabled',
        platform: 'linux',
        outputDirectory: output,
        helpers: await createSyntheticHelpers(root),
      });
      await new PackagePolicyInspector().inspect({ directory: output, mode: 'disabled', platform: 'linux' });
      await writeFile(path.join(output, 'native', 'whisper-worker'), 'forbidden worker\n', { mode: 0o500 });
      await assert.rejects(
        new PackagePolicyInspector().inspect({ directory: output, mode: 'disabled', platform: 'linux' }),
        /allowlist mismatch/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps macOS non-actionable and rejects missing or crossed mode inputs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-package-modes-'));
    try {
      const stager = new PackageStager();
      const macOutput = path.join(root, 'mac-package');
      await stager.stage({ mode: 'disabled', platform: 'darwin', outputDirectory: macOutput });
      await new PackagePolicyInspector().inspect({ directory: macOutput, mode: 'disabled', platform: 'darwin' });
      await assert.rejects(
        stager.stage({ mode: 'fixture', platform: 'darwin', outputDirectory: path.join(root, 'mac-fixture') }),
        /planned and non-actionable/u,
      );
      await assert.rejects(
        stager.stage({
          mode: 'disabled',
          platform: 'linux',
          outputDirectory: path.join(root, 'crossed'),
          bundleDirectory: root,
          helpers: await createSyntheticHelpers(path.join(root, 'crossed-helpers')),
        }),
        /rejects bundle inputs/u,
      );
      await assert.rejects(
        stager.stage({
          mode: 'production',
          platform: 'linux',
          outputDirectory: path.join(root, 'production'),
          helpers: await createSyntheticHelpers(path.join(root, 'production-helpers')),
        }),
        /requires a frozen bundle/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps Electron resources outside ASAR and platform-scoped', async () => {
    await new PackageConfigurationVerifier().verify(path.join(WORKSPACE_ROOT, 'package.json'));
    assert.ok(true);
  });
});
