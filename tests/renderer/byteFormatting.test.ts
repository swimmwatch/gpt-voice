import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatByteSize } from '@renderer/byteFormatting';

describe('byteFormatting', () => {
  it('formats byte sizes with binary conversion and JEDEC unit labels', () => {
    assert.equal(formatByteSize(1), '1 B');
    assert.equal(formatByteSize(1536), '1.5 KB');
    assert.equal(formatByteSize(15 * 1024 * 1024), '15 MB');
    assert.equal(formatByteSize(1_500_000_000), '1.4 GB');
  });

  it('returns an empty label for missing or invalid sizes', () => {
    assert.equal(formatByteSize(), '');
    assert.equal(formatByteSize(0), '');
    assert.equal(formatByteSize(-1), '');
    assert.equal(formatByteSize(Number.NaN), '');
    assert.equal(formatByteSize(Number.POSITIVE_INFINITY), '');
  });
});
