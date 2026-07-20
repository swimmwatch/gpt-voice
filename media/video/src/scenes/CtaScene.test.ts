import assert from 'node:assert/strict';
import test from 'node:test';
import { getCtaViewState } from '../data/ctaState.ts';

test('CTA enters before the fixed poster hold and remains stable through the final frame', () => {
  assert.equal(getCtaViewState(0).isStable, false);
  assert.equal(getCtaViewState(17).resolveOpacity, 1);
  assert.equal(getCtaViewState(119).isStable, false);
  assert.deepEqual(getCtaViewState(120), { isStable: true, resolveOpacity: 1 });
  assert.deepEqual(getCtaViewState(150), { isStable: true, resolveOpacity: 1 });
  assert.deepEqual(getCtaViewState(179), { isStable: true, resolveOpacity: 1 });
});
