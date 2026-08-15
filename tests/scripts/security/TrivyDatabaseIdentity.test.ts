import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { trivyDatabaseIdentity } from '@scripts/security/trivyDatabaseIdentity';

describe('Trivy database payload identity', () => {
  it('changes when either metadata or the consumed database payload changes', () => {
    const metadata = { sha256: 'a'.repeat(64), size: 100 };
    const payload = { sha256: 'b'.repeat(64), size: 200 };
    const identity = trivyDatabaseIdentity(metadata, payload);
    assert.notEqual(identity, trivyDatabaseIdentity({ ...metadata, sha256: 'c'.repeat(64) }, payload));
    assert.notEqual(identity, trivyDatabaseIdentity(metadata, { ...payload, sha256: 'd'.repeat(64) }));
    assert.notEqual(identity, trivyDatabaseIdentity(metadata, { ...payload, size: 201 }));
  });

  it('rejects missing, empty, and malformed database file evidence', () => {
    assert.throws(
      () => trivyDatabaseIdentity({ sha256: 'invalid', size: 1 }, { sha256: 'b'.repeat(64), size: 1 }),
      /identity is malformed/u,
    );
    assert.throws(
      () => trivyDatabaseIdentity({ sha256: 'a'.repeat(64), size: 1 }, { sha256: 'b'.repeat(64), size: 0 }),
      /identity is malformed/u,
    );
  });
});
