import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT,
  PACKAGED_LOCAL_WHISPER_CATALOG_ORIGINS,
  PACKAGED_LOCAL_WHISPER_CATALOG_PUBLIC_KEYS,
  createPackagedLocalWhisperCatalogTrustPolicy,
} from '@main/localWhisper/catalog/LocalWhisperPackagedCatalog';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';

const workspaceRoot = path.join(__dirname, '..', '..', '..', '..');
const runtimeSourceRoot = path.join(workspaceRoot, 'src');
const fixtureRoot = path.join(workspaceRoot, 'tests', 'fixtures', 'local-whisper', 'catalog');
const packagePath = path.join(workspaceRoot, 'package.json');

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

describe('Local Whisper catalog fixture isolation', () => {
  it('generates fixture keys in memory and keeps private key material out of repository and package inputs', () => {
    const runtimeFiles = listFiles(runtimeSourceRoot);
    const runtimeText = runtimeFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      readonly build?: { readonly files?: readonly string[] };
    };

    assert.equal(runtimeText.includes('fixtureCatalogSigner'), false);
    assert.equal(runtimeText.includes('fixture-private-key.txt'), false);
    assert.equal(
      listFiles(fixtureRoot).some((filePath) => /private[-_.]?key/iu.test(path.basename(filePath))),
      false,
    );
    assert.equal(packageJson.build?.files?.includes('!**/{__test__,__tests__,fixture,fixtures,test,tests}/**'), true);
    const fixtureRelativePrefix = `${path.join('tests', 'fixtures')}${path.sep}`;
    assert.equal(
      listFiles(fixtureRoot).every((filePath) =>
        path.relative(workspaceRoot, filePath).startsWith(fixtureRelativePrefix),
      ),
      true,
    );
  });

  it('ships no production authority, actionable origin, model bytes, or runtime executable while publication is deferred', () => {
    const packagedDocument = PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT.toString('utf8');
    assert.deepEqual(PACKAGED_LOCAL_WHISPER_CATALOG_PUBLIC_KEYS, []);
    assert.deepEqual(PACKAGED_LOCAL_WHISPER_CATALOG_ORIGINS, []);
    assert.equal(packagedDocument.includes('disabled-deferred-publication'), true);
    assert.equal(/https:\/\//u.test(packagedDocument), false);
    assert.equal(/BEGIN (?:RSA |EC )?PRIVATE KEY/u.test(packagedDocument), false);
    assert.equal(/\.(?:bin|gguf|ggml|exe|dll|so|dylib|zip|tar|gz)\b/iu.test(packagedDocument), false);
    const trustPolicy = createPackagedLocalWhisperCatalogTrustPolicy('app-v1', 1);
    assert.ok(trustPolicy);
    assert.deepEqual(
      new LocalWhisperCatalogRepository({
        readDocument: () => PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT,
        trustPolicy,
      }).load(),
      {
        success: false,
        code: 'CATALOG_INVALID',
      },
    );
  });
});
