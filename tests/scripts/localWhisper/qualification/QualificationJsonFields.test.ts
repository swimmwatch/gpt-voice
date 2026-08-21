import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasExactQualificationKeys,
  isQualificationRecord,
  isQualificationSafeInteger,
  requireQualificationRecord,
  requireQualificationStringField,
} from '@scripts/local-whisper/qualification/QualificationJsonFields';

describe('qualification JSON fields', () => {
  it('accepts object records and string fields without copying them', () => {
    const value = { field: 'value' };

    const record = requireQualificationRecord(value, 'record invalid');

    assert.equal(record, value);
    assert.equal(requireQualificationStringField(record, 'field', 'field invalid'), 'value');
  });

  it('preserves each caller-owned validation error', () => {
    for (const value of [null, [], 'value', 1]) {
      assert.throws(() => requireQualificationRecord(value, 'record invalid'), /^Error: record invalid$/u);
    }
    assert.throws(
      () => requireQualificationStringField({ field: 1 }, 'field', 'field invalid'),
      /^Error: field invalid$/u,
    );
  });

  it('checks complete key sets and inclusive safe-integer ranges', () => {
    assert.equal(isQualificationRecord({ field: 'value' }), true);
    assert.equal(isQualificationRecord([]), false);
    assert.equal(hasExactQualificationKeys({ second: 2, first: 1 }, ['first', 'second']), true);
    assert.equal(hasExactQualificationKeys({ first: 1, extra: 2 }, ['first']), false);
    assert.equal(isQualificationSafeInteger(2, 1, 2), true);
    assert.equal(isQualificationSafeInteger(3, 1, 2), false);
    assert.equal(isQualificationSafeInteger(0), true);
  });
});
