import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldDismissTooltipForPointerExit } from '@renderer/tooltipDismissal';

describe('tooltipDismissal', () => {
  it('dismisses an open tooltip when the pointer leaves the document', () => {
    assert.equal(shouldDismissTooltipForPointerExit(null), true);
  });

  it('keeps the tooltip open while the pointer moves to another document target', () => {
    assert.equal(shouldDismissTooltipForPointerExit(new EventTarget()), false);
  });
});
