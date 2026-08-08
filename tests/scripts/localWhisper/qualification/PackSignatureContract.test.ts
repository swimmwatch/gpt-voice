import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { localWhisperPackSignatureInput } from '@scripts/local-whisper/packaging/BundleVerifier';

describe('Local Whisper pack signature input', () => {
  it('preserves legacy fixture-byte signatures and uses raw SHA-256 input for candidate packs', () => {
    const bytes = Buffer.from('exact runtime archive bytes');
    assert.deepEqual(localWhisperPackSignatureInput('fixture', bytes), bytes);
    const digest = createHash('sha256').update(bytes).digest();
    assert.deepEqual(localWhisperPackSignatureInput('qualification', bytes), digest);
    assert.deepEqual(localWhisperPackSignatureInput('production', bytes), digest);
  });
});
