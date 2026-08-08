import { lstat, readFile, readdir } from 'node:fs/promises';
import * as path from 'node:path';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import {
  hasExactKeys,
  isRecord,
  isSha256,
  parseKeyringDocument,
  parsePackageMode,
  parsePackagePlatform,
  type LocalWhisperPackageMode,
  type LocalWhisperPackagePlatform,
} from './contracts';
import { readCanonicalJson, sha256Bytes, sha256File } from './fileIntegrity';

const PROHIBITED_PACKAGE_PATH =
  /(?:^|\/)(?:models?|workers?|sources?|build-tree|toolchains?|sdk|cache)(?:\/|$)|\.(?:cu|cubin|dll|dylib|ggml|gguf|hip|ptx|so)(?:\.|$)/iu;

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

async function listFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error(`Unsafe Local Whisper package staging entry: ${entry.name}`);
    }
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path.join(directory, entry.name), relativePath)));
    else files.push(relativePath);
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

function expectedPackageFiles(mode: LocalWhisperPackageMode, platform: LocalWhisperPackagePlatform): string[] {
  const files = ['.generated-root', 'package-manifest.json', 'shared/catalog-state.json', 'shared/keyring.json'];
  if (mode !== 'disabled') {
    files.push('shared/bundle-manifest.json', 'shared/catalog.json', 'shared/catalog.sha256');
  }
  if (platform !== 'darwin') {
    const extension = platform === 'win32' ? '.exe' : '';
    files.push(
      'native/LICENSE.txt',
      `native/fs-guard${extension}`,
      'native/helpers.manifest.json',
      `native/local-whisper-launcher${extension}`,
    );
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

function parsePackageState(value: unknown, mode: LocalWhisperPackageMode, platform: LocalWhisperPackagePlatform): void {
  const keys = [
    'schemaVersion',
    'mode',
    'purpose',
    'platform',
    'catalogSha256',
    'bundleManifestSha256',
    'signingKeyId',
    'executableActionsEnabled',
  ];
  if (
    !isRecord(value) ||
    !hasExactKeys(value, keys) ||
    value.schemaVersion !== 1 ||
    value.mode !== mode ||
    value.platform !== platform ||
    value.purpose !== mode ||
    typeof value.executableActionsEnabled !== 'boolean'
  ) {
    throw new Error('Invalid Local Whisper package state');
  }
  if (mode === 'disabled') {
    if (
      value.catalogSha256 !== null ||
      value.bundleManifestSha256 !== null ||
      value.signingKeyId !== null ||
      value.executableActionsEnabled
    ) {
      throw new Error('Disabled Local Whisper package is actionable');
    }
  } else if (
    !isSha256(value.catalogSha256) ||
    !isSha256(value.bundleManifestSha256) ||
    typeof value.signingKeyId !== 'string' ||
    !value.executableActionsEnabled
  ) {
    throw new Error('Authenticated Local Whisper package state is incomplete');
  }
}

async function verifyHelperManifest(directory: string, platform: Exclude<LocalWhisperPackagePlatform, 'darwin'>) {
  const value = await readCanonicalJson(path.join(directory, 'native', 'helpers.manifest.json'));
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schemaVersion', 'platform', 'helpers', 'licenseFile']) ||
    value.schemaVersion !== 1 ||
    value.platform !== platform ||
    value.licenseFile !== 'LICENSE.txt' ||
    !isUnknownArray(value.helpers) ||
    value.helpers.length !== 2
  ) {
    throw new Error('Invalid Local Whisper helper manifest');
  }
  const expectedRoles = ['filesystem-authority-guard', 'operation-scoped-launcher'];
  for (let index = 0; index < value.helpers.length; index += 1) {
    const helper = value.helpers[index];
    if (
      !isRecord(helper) ||
      !hasExactKeys(helper, ['role', 'name', 'sizeBytes', 'sha256', 'mode']) ||
      helper.role !== expectedRoles[index] ||
      typeof helper.name !== 'string' ||
      !Number.isSafeInteger(helper.sizeBytes) ||
      (helper.sizeBytes as number) <= 0 ||
      !isSha256(helper.sha256) ||
      helper.mode !== (platform === 'linux' ? 0o500 : 0)
    ) {
      throw new Error('Invalid Local Whisper helper identity');
    }
    const helperPath = path.join(directory, 'native', helper.name);
    const file = await lstat(helperPath);
    if (
      !file.isFile() ||
      file.isSymbolicLink() ||
      file.size !== helper.sizeBytes ||
      (await sha256File(helperPath)) !== helper.sha256
    ) {
      throw new Error(`Local Whisper helper identity mismatch: ${helper.role}`);
    }
  }
}

/** Enforces the base-installer allowlist and rejects bundled inference/runtime payloads. */
export class PackagePolicyInspector {
  public async inspect(input: {
    readonly directory: string;
    readonly mode: LocalWhisperPackageMode;
    readonly platform: LocalWhisperPackagePlatform;
  }): Promise<void> {
    const mode = parsePackageMode(input.mode);
    const platform = parsePackagePlatform(input.platform);
    const directory = path.resolve(input.directory);
    const actualFiles = await listFiles(directory);
    const expectedFiles = expectedPackageFiles(mode, platform);
    if (
      actualFiles.length !== expectedFiles.length ||
      actualFiles.some((filePath, index) => filePath !== expectedFiles[index])
    ) {
      throw new Error(`Local Whisper base-package allowlist mismatch: ${actualFiles.join(', ')}`);
    }
    if (actualFiles.some((filePath) => PROHIBITED_PACKAGE_PATH.test(filePath))) {
      throw new Error('Local Whisper base package contains a prohibited inference artifact');
    }

    parsePackageState(await readCanonicalJson(path.join(directory, 'shared', 'catalog-state.json')), mode, platform);
    const keyring = parseKeyringDocument(await readCanonicalJson(path.join(directory, 'shared', 'keyring.json')));
    if (keyring.purpose !== mode) throw new Error('Local Whisper staged keyring mode mismatch');
    if (platform === 'darwin') {
      if (mode !== 'disabled') throw new Error('macOS Local Whisper package actions are unavailable');
    } else {
      await verifyHelperManifest(directory, platform);
    }

    const packageManifest = await readCanonicalJson(path.join(directory, 'package-manifest.json'));
    if (
      !isRecord(packageManifest) ||
      !hasExactKeys(packageManifest, ['schemaVersion', 'mode', 'platform', 'files']) ||
      packageManifest.schemaVersion !== 1 ||
      packageManifest.mode !== mode ||
      packageManifest.platform !== platform ||
      !isUnknownArray(packageManifest.files)
    ) {
      throw new Error('Invalid Local Whisper package manifest');
    }
    const stagedFiles = actualFiles.filter(
      (filePath) => filePath !== '.generated-root' && filePath !== 'package-manifest.json',
    );
    if (packageManifest.files.length !== stagedFiles.length)
      throw new Error('Local Whisper package manifest file count mismatch');
    for (let index = 0; index < stagedFiles.length; index += 1) {
      const file = packageManifest.files[index];
      if (!isRecord(file) || !hasExactKeys(file, ['path', 'sizeBytes', 'sha256']) || file.path !== stagedFiles[index]) {
        throw new Error('Local Whisper package manifest path mismatch');
      }
      const bytes = await readFile(path.join(directory, stagedFiles[index]));
      if (bytes.byteLength !== file.sizeBytes || sha256Bytes(bytes) !== file.sha256) {
        throw new Error(`Local Whisper package manifest integrity mismatch: ${stagedFiles[index]}`);
      }
    }
    const canonicalManifest = serializeCanonicalLocalWhisperCatalogJson(packageManifest);
    if (sha256Bytes(canonicalManifest).length !== 64) throw new Error('Invalid Local Whisper package manifest digest');
  }
}
