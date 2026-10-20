import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { AlphaSmokeSchemaValidator } from '@scripts/local-whisper/alpha-smoke/AlphaSmokeSchemaValidator';
import {
  alphaSmokeDigest,
  createPlatformSmokeInput,
  parseAlphaSmokeAttempt,
  type AlphaSmokeAttempt,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';

it('gives the v2 schema and parser identical acceptance for pinned inputs and integer bounds', () => {
  const ajv = new Ajv2020({ strict: true });
  const schemas = path.resolve(__dirname, '../../../../scripts/local-whisper/alpha-smoke/schemas');
  ajv.addSchema(JSON.parse(readFileSync(path.join(schemas, 'alpha-smoke-input.schema.json'), 'utf8')) as object);
  const validate = ajv.compile(
    JSON.parse(readFileSync(path.join(schemas, 'alpha-smoke-attempt-v2.schema.json'), 'utf8')) as object,
  );
  const base: AlphaSmokeAttempt = {
    schemaVersion: 2,
    monotonicDeadline: null,
    completion: null,
    terminalOutcome: null,
    attemptId: 'alpha-test',
    deadlineEpochMilliseconds: 10_000,
    input: createPlatformSmokeInput(
      'linux',
      [{ fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb', length: 1, sha256: 'a'.repeat(64) }],
      'd'.repeat(64),
    ),
    packageDisposition: 'exact-alpha',
    settingsBackupStatus: 'retained-private',
    startedAtEpochMilliseconds: null,
    state: 'AwaitingPackageReady',
  };
  assert.equal(validate(base), true);
  parseAlphaSmokeAttempt(base);
  for (const change of [
    { input: { ...base.input, sourceSha: 'a'.repeat(40) } },
    { input: { ...base.input, candidateInputDigest: 'a'.repeat(64) } },
    { input: { ...base.input, packageAsset: { ...base.input.packageAsset, fileName: 'wrong.deb' } } },
    { input: { ...base.input, packageAsset: { ...base.input.packageAsset, length: Number.MAX_SAFE_INTEGER + 1 } } },
    { deadlineEpochMilliseconds: Number.MAX_SAFE_INTEGER + 1 },
    { terminalOutcome: 'private_transcript_excerpt' },
    {
      monotonicDeadline: {
        bootId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        expiresAtUptimeMilliseconds: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  ]) {
    const candidate = { ...base, ...change };
    assert.throws(() => parseAlphaSmokeAttempt(candidate), /STATE_INVALID/u);
    assert.equal(validate(candidate), false, JSON.stringify(change));
  }
});

it('rejects false Pass and sealed Pending even when the digest is recomputed', () => {
  const schemas = new AlphaSmokeSchemaValidator();
  const base = {
    schemaVersion: 2 as const,
    deploymentDigest: 'd'.repeat(64),
    attemptId: 'alpha-test',
    inputDigest: 'a'.repeat(64),
    outcome: 'qualified' as const,
    packageStatus: 'retained-alpha' as const,
    settingsBackupStatus: 'retained-private' as const,
    platform: 'linux' as const,
    status: 'Pass' as const,
    target: 'v2.4.0-alpha.1' as const,
  };
  const valid = { ...base, resultDigest: alphaSmokeDigest(base) };
  assert.equal(schemas.result(valid).status, 'Pass');
  for (const change of [
    { packageStatus: 'absent' },
    { settingsBackupStatus: 'integrity-failed' },
    { status: 'Pending' },
    { outcome: 'deadline_exhausted' },
    { status: 'Fail', outcome: 'private_transcript_excerpt' },
    { schemaVersion: 1 },
  ]) {
    const body = { ...base, ...change };
    assert.throws(() => schemas.result({ ...body, resultDigest: alphaSmokeDigest(body) }), /RESULT_INVALID/u);
  }
  const index = {
    schemaVersion: 2,
    attemptId: base.attemptId,
    deploymentDigest: base.deploymentDigest,
    inputDigest: base.inputDigest,
    platform: base.platform,
    resultDigest: valid.resultDigest,
    target: base.target,
  };
  schemas.index(index, valid);
  assert.throws(() => schemas.index({ ...index, deploymentDigest: 'b'.repeat(64) }, valid), /INDEX_BINDING_INVALID/u);
});
