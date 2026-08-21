import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
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
});
