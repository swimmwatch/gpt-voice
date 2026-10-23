import assert from 'node:assert/strict';
import { it } from 'node:test';
import { LinuxAlphaSmokeClock } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeClock';

it('preserves uptime deadlines across clock instances and rejects another boot', () => {
  let uptime = 100;
  let bootId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const read = (file: string) => (file.endsWith('boot_id') ? bootId : `${uptime}.00 0.00`);
  const first = new LinuxAlphaSmokeClock(read);
  const deadline = first.capture(2000);
  uptime = 101;
  assert.equal(new LinuxAlphaSmokeClock(read).remaining(deadline), 1000);
  uptime = 102;
  assert.throws(() => first.assertWithinDeadline(deadline), /DEADLINE_EXHAUSTED/u);
  bootId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  assert.throws(() => first.remaining(deadline), /BOOT_CHANGED/u);
});
