import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { it } from 'node:test';

import { LinuxPredecessorAppImageExtractor } from '../../../../scripts/local-whisper/qualification/LinuxPredecessorAppImageExtractor';
import { LinuxPredecessorElectronSession } from '../../../../scripts/local-whisper/qualification/LinuxPredecessorElectronSession';
import { LinuxPredecessorQualifier } from '../../../../scripts/local-whisper/qualification/LinuxPredecessorQualification';

const PREDECESSOR_SHA256 = '80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111';
const appImagePath = process.env.LOCAL_WHISPER_PREDECESSOR_APPIMAGE;

it(
  'qualifies the exact predecessor AppImage in one bounded private profile',
  { skip: appImagePath === undefined },
  async () => {
    assert.ok(appImagePath);
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-predecessor-real-'));
    try {
      const result = await new LinuxPredecessorQualifier(
        new LinuxPredecessorElectronSession(),
        new LinuxPredecessorAppImageExtractor(),
      ).run({
        appImagePath: path.resolve(appImagePath),
        expectedSha256: PREDECESSOR_SHA256,
        privateRoot: path.join(root, 'run'),
      });
      assert.equal(result.passed, true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
