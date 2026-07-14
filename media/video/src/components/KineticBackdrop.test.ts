import assert from 'node:assert/strict';
import test from 'node:test';
import { getKineticBackdropMotion } from '../data/kineticMotion.ts';

test('kinetic backdrop loops deterministically without changing its visual contract', () => {
  assert.deepEqual(getKineticBackdropMotion(24, 18), getKineticBackdropMotion(204, 18));
  assert.notDeepEqual(getKineticBackdropMotion(0), getKineticBackdropMotion(60));
});
