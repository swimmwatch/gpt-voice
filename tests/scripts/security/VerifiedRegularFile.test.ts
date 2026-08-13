import assert from 'node:assert/strict';
import type { Stats } from 'node:fs';
import { describe, it } from 'node:test';

import { hasSameVerifiedFileIdentity } from '@scripts/security/verifiedRegularFile';

function metadata(input: Partial<Stats>): Stats {
  return {
    birthtimeMs: 0,
    ctimeMs: 0,
    dev: 0,
    ino: 0,
    mtimeMs: 0,
    size: 0,
    ...input,
  } as Stats;
}

describe('verified regular file identity', () => {
  it('uses stable portable timestamps when native device and inode identities are unavailable', () => {
    const expected = metadata({ birthtimeMs: 1000, ctimeMs: 1001, mtimeMs: 1002, size: 1003 });
    const opened = metadata({ birthtimeMs: 1000, ctimeMs: 2001, mtimeMs: 1002, size: 1003 });

    assert.equal(hasSameVerifiedFileIdentity(expected, opened), true);
  });

  it('fails closed when a portable fallback identity changes or is unavailable', () => {
    const expected = metadata({ birthtimeMs: 1000, mtimeMs: 1002, size: 1003 });

    assert.equal(
      hasSameVerifiedFileIdentity(expected, metadata({ birthtimeMs: 1001, mtimeMs: 1002, size: 1003 })),
      false,
    );
    assert.equal(
      hasSameVerifiedFileIdentity(expected, metadata({ birthtimeMs: 1000, mtimeMs: 1001, size: 1003 })),
      false,
    );
    assert.equal(hasSameVerifiedFileIdentity(expected, metadata({ birthtimeMs: 0, mtimeMs: 1002, size: 1003 })), false);
  });

  it('prefers native device and inode identities when both descriptors provide them', () => {
    const expected = metadata({ birthtimeMs: 1000, dev: 1, ino: 2, mtimeMs: 1002, size: 1003 });

    assert.equal(
      hasSameVerifiedFileIdentity(expected, metadata({ birthtimeMs: 2000, dev: 1, ino: 2, mtimeMs: 2002, size: 2003 })),
      true,
    );
    assert.equal(
      hasSameVerifiedFileIdentity(expected, metadata({ birthtimeMs: 1000, dev: 1, ino: 3, mtimeMs: 1002, size: 1003 })),
      false,
    );
  });
});
