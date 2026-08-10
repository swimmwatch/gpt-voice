import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
  assertPlatformCompilationCoverage,
  createNativeQualityManifest,
  manifestEntriesForPlatform,
} from '../../../../scripts/local-whisper/native-build/native-quality-manifest.mjs';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

test('CodeQL source inclusion contract fails closed when a host source is absent', () => {
  const manifest = createNativeQualityManifest(WORKSPACE_ROOT);
  const sources = manifestEntriesForPlatform(manifest, 'windows', { translationUnitsOnly: true }).map(
    (entry) => entry.path,
  );
  assert.throws(() => assertPlatformCompilationCoverage(manifest, 'windows', sources.slice(0, -1)), /missing/u);
});
