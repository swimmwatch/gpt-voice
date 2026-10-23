import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseLocalWhisperCanonicalWav } from '@shared/localWhisper';
import { ALPHA_SMOKE_FIXTURE } from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

const FIXTURE_PATH = path.resolve('tests/fixtures/local-whisper/alpha-smoke/smoke.wav');

describe('Alpha smoke fixture', () => {
  it('is the exact public, canonical, non-private FLEURS-derived WAV', async () => {
    const fixture = await readFile(FIXTURE_PATH);
    assert.equal(fixture.byteLength, ALPHA_SMOKE_FIXTURE.length);
    assert.equal(createHash('sha256').update(fixture).digest('hex'), ALPHA_SMOKE_FIXTURE.sha256);
    assert.equal(parseLocalWhisperCanonicalWav(fixture).sampleCount, 202_240);
  });
});
