import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BoundedStderrRing } from '@main/localWhisper/supervisor/BoundedStderrRing';

test('stderr ring sanitizes controls and retains only the bounded tail', () => {
  const ring = new BoundedStderrRing(12);
  ring.append(Buffer.from('secret\u0000prefix'));
  ring.append(Buffer.from('-tail'));
  assert.ok(ring.byteLength <= 12);
  assert.equal(ring.copySanitizedTail().includes('\u0000'), false);
  assert.match(ring.copySanitizedTail(), /tail/u);
  ring.clear();
  assert.equal(ring.byteLength, 0);
});
