import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ProductionPromotionSourceVerifier } from '@scripts/local-whisper/release-policy/ProductionPromotionSourceVerifier';

const SOURCE_SHA = 'a'.repeat(40);
const EXPECTED = Object.freeze({
  candidateRunId: '32594163793',
  repository: 'swimmwatch/gpt-voice',
  sourceSha: SOURCE_SHA,
});

function run(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return {
    conclusion: 'success',
    display_title: 'release-watch-0123456789abcdef',
    event: 'workflow_dispatch',
    head_sha: SOURCE_SHA,
    id: 32594163793,
    path: '.github/workflows/release-builds.yml',
    repository: { full_name: 'swimmwatch/gpt-voice' },
    status: 'completed',
    ...overrides,
  };
}

describe('ProductionPromotionSourceVerifier', () => {
  it('accepts one successful exact-SHA release candidate run', () => {
    assert.doesNotThrow(() => new ProductionPromotionSourceVerifier().verify(run(), EXPECTED));
  });

  it('rejects failed, cross-SHA, cross-workflow, and uncorrelated runs', () => {
    const verifier = new ProductionPromotionSourceVerifier();
    for (const candidate of [
      run({ conclusion: 'failure' }),
      run({ head_sha: 'b'.repeat(40) }),
      run({ path: '.github/workflows/pr-checks.yml' }),
      run({ display_title: 'uncorrelated' }),
    ]) {
      assert.throws(() => verifier.verify(candidate, EXPECTED), /PRODUCTION_PROMOTION_SOURCE_INVALID/u);
    }
  });
});
