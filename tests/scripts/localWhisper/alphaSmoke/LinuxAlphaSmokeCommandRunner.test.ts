import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LINUX_ALPHA_SMOKE_MANUAL_INSTALL_EXECUTABLE,
  LinuxAlphaSmokeCommandRunner,
} from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeCommandRunner';

describe('LinuxAlphaSmokeCommandRunner', () => {
  it('does not permit the privileged manual installer through the command runner', async () => {
    await assert.rejects(
      new LinuxAlphaSmokeCommandRunner().run(LINUX_ALPHA_SMOKE_MANUAL_INSTALL_EXECUTABLE, ['--version']),
      /ALPHA_SMOKE_LINUX_EXECUTABLE_FORBIDDEN/u,
    );
  });
});
