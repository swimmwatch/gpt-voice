import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

interface PackagedRuntimePolicyModule {
  getPackagedRuntimeViolations: (paths: readonly string[]) => string[];
}

const modulePath = path.join(__dirname, '..', '..', 'scripts', 'packaged-runtime-policy.mjs');

function isPackagedRuntimePolicyModule(value: unknown): value is PackagedRuntimePolicyModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).getPackagedRuntimeViolations === 'function'
  );
}

const requiredPaths = [
  'dist/about.html',
  'dist/history.html',
  'dist/index.html',
  'dist/main.js',
  'dist/preload.js',
  'dist/renderer.js',
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
        'dist\\renderer.js',
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
      'dist/renderer.old.js',
      'node_modules/cloakbrowser/dist/index.js.map',
      'node_modules/playwright-core/tests/example.test.js',
      'node_modules/unapproved-package/index.js',
    ]);

    assert.deepEqual(violations, [
      'forbidden diagnostic or test path: node_modules/cloakbrowser/dist/index.js.map',
      'forbidden diagnostic or test path: node_modules/playwright-core/tests/example.test.js',
      'missing required path: dist/preload.js',
      'stale renderer asset: dist/renderer.old.js',
      'unexpected runtime module: unapproved-package',
    ]);
  });
});
