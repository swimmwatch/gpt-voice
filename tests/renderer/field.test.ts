import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { joinAriaDescribedBy } from '@renderer/components/ui/field';

describe('joinAriaDescribedBy', () => {
  it('joins unique non-empty IDs for field descriptions and errors', () => {
    assert.equal(
      joinAriaDescribedBy('field-description', undefined, 'field-error', 'field-description'),
      'field-description field-error',
    );
  });

  it('returns undefined when no IDs are available', () => {
    assert.equal(joinAriaDescribedBy(undefined, '', '   '), undefined);
  });
});
