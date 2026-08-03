import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  qualificationEditDistance,
  qualificationMedian,
  qualificationTokens,
  qualificationWerPercentage,
  roundQualificationPeakBytes,
} from '@scripts/local-whisper/qualification/QualificationMetrics';

describe('Local Whisper qualification metrics', () => {
  it('applies NFKC, apostrophe mapping, locale lowercase, and maximal tokenization', () => {
    assert.deepEqual(qualificationTokens('ＨＥＬＬＯ, driver’s １２ cars!', 'en_us'), [
      'hello',
      "driver's",
      '12',
      'cars',
    ]);
    assert.deepEqual(qualificationTokens('ЁЖИК — № ２', 'ru_ru'), ['ёжик', 'no', '2']);
  });

  it('uses unit-cost edit distance and total-reference-token WER aggregation', () => {
    assert.equal(qualificationEditDistance(['one', 'two'], ['one', 'three']), 1);
    assert.ok(
      Math.abs(
        qualificationWerPercentage([
          { locale: 'en_us', reference: 'one two', hypothesis: 'one three' },
          { locale: 'en_us', reference: 'four', hypothesis: 'four' },
        ]) -
          100 / 3,
      ) < 1e-12,
    );
  });

  it('freezes median and upward 64-MiB peak rounding', () => {
    assert.equal(qualificationMedian([0.5, 0.1, 0.3, 0.4, 0.2]), 0.3);
    assert.equal(roundQualificationPeakBytes(1), 64 * 1024 * 1024);
    assert.equal(roundQualificationPeakBytes(64 * 1024 * 1024), 64 * 1024 * 1024);
  });
});
