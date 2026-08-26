import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canonicalSecurityEvidenceBytes,
  isSecurityRecord,
  SecurityEvidenceFields,
} from '@scripts/security/securityEvidenceFields';

const fields = Object.freeze(
  new SecurityEvidenceFields((code) => {
    throw new Error(`TEST_${code}`);
  }),
);

describe('security evidence fields', () => {
  it('validates records, exact keys, digests, and source commits', () => {
    assert.equal(isSecurityRecord({}), true);
    assert.equal(isSecurityRecord([]), false);
    assert.doesNotThrow(() => fields.exactKeys({ second: 2, first: 1 }, ['first', 'second'], 'KEYS_INVALID'));
    assert.equal(fields.sha256('a'.repeat(64), 'DIGEST_INVALID'), 'a'.repeat(64));
    assert.equal(fields.sourceCommit('b'.repeat(40), 'COMMIT_INVALID'), 'b'.repeat(40));
  });

  it('delegates exact caller-owned error codes for malformed fields', () => {
    assert.throws(() => fields.exactKeys({ extra: true }, [], 'KEYS_INVALID'), /^Error: TEST_KEYS_INVALID$/u);
    assert.throws(() => fields.sha256('invalid', 'DIGEST_INVALID'), /^Error: TEST_DIGEST_INVALID$/u);
    assert.throws(() => fields.sourceCommit('invalid', 'COMMIT_INVALID'), /^Error: TEST_COMMIT_INVALID$/u);
  });

  it('uses the canonical security evidence byte representation', () => {
    assert.equal(canonicalSecurityEvidenceBytes({ second: 2, first: 1 }).toString('utf8'), '{"first":1,"second":2}');
  });
});
