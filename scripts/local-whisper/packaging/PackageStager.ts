import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import {
  LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
  parsePackageMode,
  parsePackagePlatform,
  type LocalWhisperPackageMode,
  type LocalWhisperPackagePlatform,
  type LocalWhisperPackageState,
} from './contracts';
import { BundleVerifier } from './BundleVerifier';
import { inspectFlatDirectory, sha256Bytes, writeCanonicalJson } from './fileIntegrity';

const GENERATED_MARKER = 'local-whisper-package-staging-v1\n';
const BUNDLE_RESOURCE_FILES = ['bundle-manifest.json', 'catalog.json', 'catalog.sha256', 'keyring.json'] as const;

export interface LocalWhisperHelperInputs {
  readonly filesystemGuard: string;
  readonly launcher: string;
  readonly license: string;
}

export interface LocalWhisperPackageStagingInput {
  readonly mode: LocalWhisperPackageMode;
  readonly platform: LocalWhisperPackagePlatform;
  readonly outputDirectory: string;
  readonly bundleDirectory?: string;
  readonly expectedBundleManifestSha256?: string;
  readonly helpers?: LocalWhisperHelperInputs;
}

export interface LocalWhisperPackageStagingResult {
  readonly outputDirectory: string;
  readonly state: LocalWhisperPackageState;
  readonly packageManifestSha256: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removePriorGeneratedOutput(outputDirectory: string): Promise<void> {
  if (!(await exists(outputDirectory))) return;
  const markerPath = path.join(outputDirectory, '.generated-root');
  let marker: string;
  try {
    marker = await readFile(markerPath, 'utf8');
  } catch {
    throw new Error('Refusing to replace an unmarked Local Whisper package directory');
  }
  if (marker !== GENERATED_MARKER) throw new Error('Invalid Local Whisper package directory marker');
  await rm(outputDirectory, { recursive: true });
}

async function stageHelpers(
  stagingDirectory: string,
  platform: LocalWhisperPackagePlatform,
  helpers: LocalWhisperHelperInputs | undefined,
): Promise<void> {
  if (platform === 'darwin') {
    if (helpers) throw new Error('macOS Local Whisper executable helpers are unavailable');
    return;
  }
  if (!helpers) throw new Error('Linux and Windows Local Whisper packages require exactly two helper inputs');
  const nativeDirectory = path.join(stagingDirectory, 'native');
  await mkdir(nativeDirectory, { mode: 0o700 });
  const extension = platform === 'win32' ? '.exe' : '';
  const staged = [
    { role: 'filesystem-authority-guard', source: helpers.filesystemGuard, name: `fs-guard${extension}` },
    { role: 'operation-scoped-launcher', source: helpers.launcher, name: `local-whisper-launcher${extension}` },
  ] as const;
  for (const helper of staged) {
    await copyFile(helper.source, path.join(nativeDirectory, helper.name));
    if (platform === 'linux') await chmod(path.join(nativeDirectory, helper.name), 0o500);
  }
  await copyFile(helpers.license, path.join(nativeDirectory, 'LICENSE.txt'));
  const helperFiles = await Promise.all(
    staged.map(async (helper) => {
      const target = path.join(nativeDirectory, helper.name);
      const bytes = await readFile(target);
      return {
        role: helper.role,
        name: helper.name,
        sizeBytes: bytes.byteLength,
        sha256: sha256Bytes(bytes),
        mode: platform === 'linux' ? 0o500 : 0,
      };
    }),
  );
  await writeCanonicalJson(path.join(nativeDirectory, 'helpers.manifest.json'), {
    schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
    platform,
    helpers: helperFiles,
    licenseFile: 'LICENSE.txt',
  });
}

async function createDisabledResources(sharedDirectory: string, platform: LocalWhisperPackagePlatform) {
  const keyring = {
    schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
    purpose: 'disabled',
    appRevision: 'deferred-publication-v1',
    workerProtocolVersion: 1,
    publicKeys: [],
    origins: [],
  } as const;
  await writeCanonicalJson(path.join(sharedDirectory, 'keyring.json'), keyring);
  return {
    schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
    mode: 'disabled',
    purpose: 'disabled',
    platform,
    catalogSha256: null,
    bundleManifestSha256: null,
    signingKeyId: null,
    executableActionsEnabled: false,
  } satisfies LocalWhisperPackageState;
}

/** Stages only authenticated shared inputs and the two package-platform native helper roles. */
export class PackageStager {
  private readonly verifier = new BundleVerifier();

  public async stage(input: LocalWhisperPackageStagingInput): Promise<LocalWhisperPackageStagingResult> {
    const mode = parsePackageMode(input.mode);
    const platform = parsePackagePlatform(input.platform);
    if (platform === 'darwin' && mode !== 'disabled') {
      throw new Error('macOS Local Whisper packaging remains planned and non-actionable');
    }
    const outputDirectory = path.resolve(input.outputDirectory);
    const parent = path.dirname(outputDirectory);
    await mkdir(parent, { mode: 0o700, recursive: true });
    await removePriorGeneratedOutput(outputDirectory);
    const stagingDirectory = await mkdtemp(path.join(parent, '.local-whisper-package-'));
    try {
      await writeFile(path.join(stagingDirectory, '.generated-root'), GENERATED_MARKER, { mode: 0o600 });
      const sharedDirectory = path.join(stagingDirectory, 'shared');
      await mkdir(sharedDirectory, { mode: 0o700 });
      let state: LocalWhisperPackageState;
      if (mode === 'disabled') {
        if (input.bundleDirectory || input.expectedBundleManifestSha256) {
          throw new Error('Disabled Local Whisper packaging rejects bundle inputs');
        }
        state = await createDisabledResources(sharedDirectory, platform);
      } else {
        if (!input.bundleDirectory) throw new Error(`${mode} Local Whisper packaging requires a frozen bundle`);
        if (mode !== 'fixture' && !input.expectedBundleManifestSha256) {
          throw new Error(`${mode} Local Whisper packaging requires an externally frozen bundle digest`);
        }
        const bundle = await this.verifier.verify(input.bundleDirectory, {
          purpose: mode,
          manifestSha256: input.expectedBundleManifestSha256,
        });
        if (mode === 'production') await this.verifier.verifyProductionApproval(bundle);
        await Promise.all(
          BUNDLE_RESOURCE_FILES.map((fileName) =>
            copyFile(path.join(bundle.directory, fileName), path.join(sharedDirectory, fileName)),
          ),
        );
        state = {
          schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
          mode,
          purpose: mode,
          platform,
          catalogSha256: bundle.manifest.catalogSha256,
          bundleManifestSha256: bundle.manifestSha256,
          signingKeyId: bundle.manifest.keyId,
          executableActionsEnabled: true,
        };
      }
      await writeCanonicalJson(path.join(sharedDirectory, 'catalog-state.json'), state);
      await stageHelpers(stagingDirectory, platform, input.helpers);

      const sharedFiles = await inspectFlatDirectory(sharedDirectory);
      const nativeFiles =
        platform === 'darwin' ? [] : await inspectFlatDirectory(path.join(stagingDirectory, 'native'));
      const packageManifest = {
        schemaVersion: LOCAL_WHISPER_PACKAGE_SCHEMA_VERSION,
        mode,
        platform,
        files: [
          ...sharedFiles.map((file) => ({ ...file, path: `shared/${file.path}` })),
          ...nativeFiles.map((file) => ({ ...file, path: `native/${file.path}` })),
        ].sort((left, right) => left.path.localeCompare(right.path, 'en')),
      };
      await writeCanonicalJson(path.join(stagingDirectory, 'package-manifest.json'), packageManifest);
      const packageManifestSha256 = sha256Bytes(serializeCanonicalLocalWhisperCatalogJson(packageManifest));
      await rename(stagingDirectory, outputDirectory);
      return Object.freeze({ outputDirectory, state: Object.freeze(state), packageManifestSha256 });
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  }
}
