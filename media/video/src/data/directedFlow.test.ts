import assert from 'node:assert/strict';
import test from 'node:test';
import { getDirectedFlowPoints } from './directedFlow.ts';

test('directed flow dots clamp to the shared path endpoints and advance deterministically', () => {
  assert.deepEqual(getDirectedFlowPoints(-1), getDirectedFlowPoints(0));
  assert.deepEqual(getDirectedFlowPoints(2)[0], getDirectedFlowPoints(1)[0]);
  assert.notDeepEqual(getDirectedFlowPoints(0.2), getDirectedFlowPoints(0.6));
});
