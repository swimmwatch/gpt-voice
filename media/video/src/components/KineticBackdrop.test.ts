import assert from 'node:assert/strict';
import test from 'node:test';
import { getKineticBackdropMotion } from '../data/kineticMotion.ts';

test('kinetic backdrop advances continuously across its former three-second seam', () => {
  const preceding = getKineticBackdropMotion(179);
  const boundary = getKineticBackdropMotion(180);
  const following = getKineticBackdropMotion(181);

  assert.equal(boundary.dashOffset - preceding.dashOffset, following.dashOffset - boundary.dashOffset);
  assert.ok(Math.abs(boundary.driftX - preceding.driftX) < 4);
  assert.ok(Math.abs(boundary.driftY - preceding.driftY) < 4);
  assert.ok(Math.abs(boundary.pulse - preceding.pulse) < 0.01);
  assert.ok(Math.abs(boundary.flowProgress - preceding.flowProgress - 1 / 180) < Number.EPSILON);
  assert.ok(Math.abs(following.flowProgress - boundary.flowProgress - 1 / 180) < Number.EPSILON);
});
