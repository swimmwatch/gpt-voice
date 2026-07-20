import assert from 'node:assert/strict';
import test from 'node:test';
import { getDirectedFlowPoints } from './directedFlow.ts';

test('directed flow dots wrap across the shared path and advance deterministically', () => {
  assert.deepEqual(getDirectedFlowPoints(-1), getDirectedFlowPoints(0));
  assert.deepEqual(getDirectedFlowPoints(2), getDirectedFlowPoints(1));
  assert.deepEqual(getDirectedFlowPoints(1.2), getDirectedFlowPoints(0.2));
  assert.notDeepEqual(getDirectedFlowPoints(0.2), getDirectedFlowPoints(0.6));
});
