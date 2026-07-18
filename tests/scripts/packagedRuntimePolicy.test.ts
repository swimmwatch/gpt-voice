import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

interface PackagedRuntimePolicyModule {
  ELECTRON_LOCALE_FILENAMES: readonly string[];
  RUNTIME_ASSET_PATHS: readonly string[];
  getElectronLocaleViolations: (paths: readonly string[]) => string[];
  getPackagedRuntimeViolations: (paths: readonly string[]) => string[];
  getRuntimeAssetViolations: (paths: readonly string[]) => string[];
}

const modulePath = path.join(__dirname, '..', '..', 'scripts', 'packaged-runtime-policy.mjs');

function isPackagedRuntimePolicyModule(value: unknown): value is PackagedRuntimePolicyModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).ELECTRON_LOCALE_FILENAMES) &&
    Array.isArray((value as Record<string, unknown>).RUNTIME_ASSET_PATHS) &&
    typeof (value as Record<string, unknown>).getElectronLocaleViolations === 'function' &&
    typeof (value as Record<string, unknown>).getPackagedRuntimeViolations === 'function' &&
    typeof (value as Record<string, unknown>).getRuntimeAssetViolations === 'function'
  );
}

const requiredPaths = [
  'dist/about.html',
  'dist/history.html',
  'dist/index.html',
  'dist/main.js',
  'dist/preload.js',
  'dist/provider-settings.html',
  'dist/renderer/about.js',
  'dist/renderer/history.js',
  'dist/renderer/main.js',
  'dist/renderer/providerSettings.js',
  'dist/renderer/runtime.js',
  'dist/renderer/settings.js',
  'dist/settings.html',
  'package.json',
];

describe('packaged runtime policy', () => {
  it('accepts required files and approved runtime modules with normalized separators', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isPackagedRuntimePolicyModule(importedModule));

    assert.deepEqual(
      importedModule.getPackagedRuntimeViolations([
        'dist\\about.html',
        'dist\\history.html',
        'dist\\index.html',
        'dist\\main.js',
        'dist\\preload.js',
        'dist\\provider-settings.html',
        'dist\\renderer/about.js',
        'dist\\renderer/history.js',
        'dist\\renderer/main.js',
        'dist\\renderer/providerSettings.js',
        'dist\\renderer/runtime.js',
        'dist\\renderer/settings.js',
        'dist\\settings.html',
        'package.json',
        'node_modules/cloakbrowser/dist/index.js',
        'node_modules/playwright-core/lib/server/browserType.js',
      ]),
      [],
    );
  });

  it('reports missing runtime files and forbidden diagnostics with concise relative paths', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isPackagedRuntimePolicyModule(importedModule));

    const violations = importedModule.getPackagedRuntimeViolations([
      ...requiredPaths.filter((filePath) => filePath !== 'dist/preload.js'),
      'dist/renderer.js',
      'dist/renderer.old.js',
      'node_modules/cloakbrowser/dist/index.js.map',
      'node_modules/playwright-core/tests/example.test.js',
      'node_modules/unapproved-package/index.js',
    ]);

    assert.deepEqual(violations, [
      'forbidden diagnostic or test path: node_modules/cloakbrowser/dist/index.js.map',
      'forbidden diagnostic or test path: node_modules/playwright-core/tests/example.test.js',
      'missing required path: dist/preload.js',
      'stale renderer asset: dist/renderer.js',
      'stale renderer asset: dist/renderer.old.js',
      'unexpected runtime module: unapproved-package',
    ]);
  });

  it('requires the exact runtime asset set and rejects duplicate ASAR assets', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isPackagedRuntimePolicyModule(importedModule));

    assert.deepEqual(importedModule.getRuntimeAssetViolations(importedModule.RUNTIME_ASSET_PATHS), []);
    assert.deepEqual(importedModule.getRuntimeAssetViolations([...importedModule.RUNTIME_ASSET_PATHS, 'readme.png']), [
      'unexpected runtime asset: readme.png',
    ]);
    assert.deepEqual(importedModule.getPackagedRuntimeViolations([...requiredPaths, 'assets/icon.png']), [
      'duplicate ASAR asset: assets/icon.png',
    ]);
  });

  it('requires the Electron locale allowlist while ignoring non-locale resources', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isPackagedRuntimePolicyModule(importedModule));

    assert.deepEqual(
      importedModule.getElectronLocaleViolations([...importedModule.ELECTRON_LOCALE_FILENAMES, 'resources.pak']),
      [],
    );
    assert.deepEqual(importedModule.getElectronLocaleViolations(['en-US.pak', 'be.pak']), [
      'missing Electron locale: en-GB.pak',
      'missing Electron locale: ru.pak',
      'missing Electron locale: uk.pak',
      'unexpected Electron locale: be.pak',
    ]);
  });
});
