import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasExactDevelopmentRuntimeKeys,
  isDevelopmentRuntimeRecord,
} from '@scripts/local-whisper/development/DevelopmentRuntimeJson';

describe('development runtime JSON predicates', () => {
  it('accepts only non-null, non-array objects', () => {
    assert.equal(isDevelopmentRuntimeRecord({}), true);
    assert.equal(isDevelopmentRuntimeRecord([]), false);
    assert.equal(isDevelopmentRuntimeRecord(null), false);
  });

  it('requires the complete expected key set independent of object order', () => {
    assert.equal(hasExactDevelopmentRuntimeKeys({ second: 2, first: 1 }, ['first', 'second']), true);
    assert.equal(hasExactDevelopmentRuntimeKeys({ first: 1, extra: 2 }, ['first']), false);
    assert.equal(hasExactDevelopmentRuntimeKeys({ first: 1 }, ['first', 'second']), false);
  });
});
