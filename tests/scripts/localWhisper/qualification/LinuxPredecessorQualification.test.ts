import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import type {
  LinuxPredecessorApplicationSessionInput,
  LinuxPredecessorApplicationSessionPort,
} from '../../../../scripts/local-whisper/qualification/LinuxPredecessorElectronSession';
import type { LinuxPredecessorPackageExtractorPort } from '../../../../scripts/local-whisper/qualification/LinuxPredecessorAppImageExtractor';
import { LinuxPredecessorQualifier } from '../../../../scripts/local-whisper/qualification/LinuxPredecessorQualification';

const PASSED_SESSION = Object.freeze({
  initialProvider: 'local-whisper' as const,
  initialReady: false as const,
  knownProviders: Object.freeze(['chatgpt', 'claude-web', 'openai-api'] as const),
  recoveredProvider: 'openai-api' as const,
});

class RecordingPredecessorSession implements LinuxPredecessorApplicationSessionPort {
  public input: LinuxPredecessorApplicationSessionInput | null = null;

  public constructor(private readonly mutate?: (input: LinuxPredecessorApplicationSessionInput) => Promise<void>) {}

  public async run(input: LinuxPredecessorApplicationSessionInput) {
    this.input = input;
    await this.mutate?.(input);
    return PASSED_SESSION;
  }
}

const fixtureExtractor: LinuxPredecessorPackageExtractorPort = {
  extract: async (_appImagePath, extractionRoot) => {
    const executablePath = path.join(extractionRoot, 'squashfs-root', 'gpt-voice');
    const bytes = Buffer.from('packaged executable fixture', 'utf8');
    await mkdir(path.dirname(executablePath), { recursive: true, mode: 0o700 });
    await writeFile(executablePath, bytes, { mode: 0o700, flag: 'wx' });
    return Object.freeze({
      executablePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  },
};

async function fixture(root: string): Promise<{
  readonly appImagePath: string;
  readonly expectedSha256: string;
  readonly privateRoot: string;
}> {
  const bytes = Buffer.from('exact predecessor AppImage fixture', 'utf8');
  const appImagePath = path.join(root, 'cached.AppImage');
  await writeFile(appImagePath, bytes, { mode: 0o600 });
  return Object.freeze({
    appImagePath,
    expectedSha256: createHash('sha256').update(bytes).digest('hex'),
    privateRoot: path.join(root, 'private-run'),
  });
}

describe('LinuxPredecessorQualifier', { skip: process.platform !== 'linux' }, () => {
  it('copies the exact package, isolates the profile, and emits only sanitized evidence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-predecessor-test-'));
    try {
      const input = await fixture(root);
      const session = new RecordingPredecessorSession();
      const result = await new LinuxPredecessorQualifier(session, fixtureExtractor).run(input);
      assert.equal(result.passed, true);
      assert.match(result.sanitizedEvidenceDigest, /^[a-f0-9]{64}$/u);
      assert.equal(JSON.stringify(result.sanitizedEvidence).includes(root), false);
      const sessionInput = session.input;
      assert.ok(sessionInput);
      assert.equal(
        sessionInput.executablePath,
        path.join(input.privateRoot, 'extracted', 'squashfs-root', 'gpt-voice'),
      );
      assert.equal((await stat(sessionInput.executablePath)).mode & 0o777, 0o700);
      assert.equal((await stat(path.join(input.privateRoot, 'GPT-Voice-2.3.0.AppImage'))).mode & 0o777, 0o700);
      assert.equal((await stat(input.appImagePath)).mode & 0o777, 0o600);
      assert.equal(await readFile(input.appImagePath, 'utf8'), 'exact predecessor AppImage fixture');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects any Local Whisper namespace mutation', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-predecessor-test-'));
    try {
      const input = await fixture(root);
      const session = new RecordingPredecessorSession(async ({ configurationRoot }) => {
        await writeFile(
          path.join(configurationRoot, 'GPT-Voice', 'local-whisper', 'settings.json'),
          '{"changed":true}',
          'utf8',
        );
      });
      await assert.rejects(
        new LinuxPredecessorQualifier(session, fixtureExtractor).run(input),
        /changed a Local Whisper namespace/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects observed Local Whisper executable invocation', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-predecessor-test-'));
    try {
      const input = await fixture(root);
      const session = new RecordingPredecessorSession(async ({ executionMarkerPath }) => {
        await writeFile(executionMarkerPath, 'executed', { mode: 0o600 });
      });
      await assert.rejects(
        new LinuxPredecessorQualifier(session, fixtureExtractor).run(input),
        /executed a Local Whisper sentinel/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
