import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  VersionScopedReleaseRecoveryPermitStore,
  WatchRuntimeStorage,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';

const SOURCE_SHA = 'a'.repeat(40);
const WATCH_ID = 'local-whisper-alpha-release-test';

describe('VersionScopedReleaseRecoveryPermitStore', () => {
  it('binds one explicit recovery lease to the exact watch, source, and finite deadline', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'release-recovery-permit-'));
    try {
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      await storage.initialize();
      const permits = new VersionScopedReleaseRecoveryPermitStore({ storage });
      await permits.issue({
        deadlineEpochMilliseconds: 20_000,
        sourceSha: SOURCE_SHA,
        timeoutSeconds: 3_600,
      });

      assert.equal(
        await permits.matches({ deadlineEpochMilliseconds: 20_000, sourceSha: SOURCE_SHA, timeoutSeconds: 3_600 }),
        true,
      );
      assert.equal(
        await permits.matches({ deadlineEpochMilliseconds: 20_001, sourceSha: SOURCE_SHA, timeoutSeconds: 3_600 }),
        false,
      );
      assert.equal(
        await permits.matches({ deadlineEpochMilliseconds: 20_000, sourceSha: 'b'.repeat(40), timeoutSeconds: 3_600 }),
        false,
      );
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  });
});
