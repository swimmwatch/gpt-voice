import * as path from 'node:path';

import { parsePackageMode, type LocalWhisperPackageMode } from './contracts';
import { BundleVerifier } from './BundleVerifier';
import { readCanonicalJson } from './fileIntegrity';
import { PackagePolicyInspector } from './PackagePolicyInspector';

/** Rejects fixture trust and incomplete production authority before release artifact collection. */
export class ReleaseCollectionGuard {
  private readonly bundleVerifier = new BundleVerifier();
  private readonly packageInspector = new PackagePolicyInspector();

  public async assertCollectable(input: {
    readonly mode: LocalWhisperPackageMode;
    readonly platform: 'darwin' | 'linux' | 'win32';
    readonly stagingDirectory: string;
    readonly productionBundleDirectory?: string;
  }): Promise<void> {
    const mode = parsePackageMode(input.mode);
    if (mode === 'fixture') throw new Error('Fixture Local Whisper trust cannot enter release collection');
    if (mode === 'qualification') throw new Error('Qualification Local Whisper trust cannot enter release collection');
    await this.packageInspector.inspect({
      directory: input.stagingDirectory,
      mode,
      platform: input.platform,
    });
    if (mode === 'disabled') {
      if (input.productionBundleDirectory)
        throw new Error('Disabled release collection rejects production bundle inputs');
      return;
    }
    if (!input.productionBundleDirectory)
      throw new Error('Production release collection requires approved frozen inputs');
    const state = await readCanonicalJson(path.join(input.stagingDirectory, 'shared', 'catalog-state.json'));
    if (typeof state !== 'object' || state === null || !('bundleManifestSha256' in state)) {
      throw new Error('Production Local Whisper package state is incomplete');
    }
    const declaredDigest = (state as { readonly bundleManifestSha256?: unknown }).bundleManifestSha256;
    if (typeof declaredDigest !== 'string') throw new Error('Production Local Whisper package digest is missing');
    const bundle = await this.bundleVerifier.verify(input.productionBundleDirectory, {
      purpose: 'production',
      manifestSha256: declaredDigest,
    });
    await this.bundleVerifier.verifyProductionApproval(bundle);
  }
}
