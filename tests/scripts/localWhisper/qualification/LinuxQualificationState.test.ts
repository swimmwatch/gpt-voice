import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import type { LinuxQualificationPackageIdentity } from '../../../../scripts/local-whisper/qualification/LinuxQualificationPackageBuilder';
import { LinuxQualificationStateProducer } from '../../../../scripts/local-whisper/qualification/LinuxQualificationState';
import { LocalWhisperQualificationValidator } from '../../../../scripts/local-whisper/qualification/QualificationContracts';
import type { QualificationLinuxFoundation } from '../../../../scripts/local-whisper/qualification/QualificationInputProducer';
import type { QualificationLinuxResult } from '../../../../scripts/local-whisper/qualification/QualificationResultProducer';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);
const digest = (digit: string): string => digit.repeat(64);

function foundation(): QualificationLinuxFoundation {
  return Object.freeze({
    candidateInput: Object.freeze({ candidateInputDigest: digest('1') }),
    platformInput: Object.freeze({ platformInputDigest: digest('2') }),
    profiles: Object.freeze([
      Object.freeze({ profileDigest: digest('3') }),
      Object.freeze({ profileDigest: digest('4') }),
    ]),
    platformGraph: Object.freeze({ platformGraphDigest: digest('5') }),
  });
}

function packages(): readonly LinuxQualificationPackageIdentity[] {
  return Object.freeze(
    (['AppImage', 'deb', 'rpm'] as const).map((format, index) =>
      Object.freeze({
        format,
        fileName: `candidate.${format}`,
        filePath: `/private/candidate.${format}`,
        sizeBytes: 1,
        sha256: digest(String(index + 6)),
      }),
    ),
  );
}

function result(value: QualificationLinuxFoundation): QualificationLinuxResult {
  return Object.freeze({
    branch: Object.freeze({
      ...value,
      measurementSeries: Object.freeze([]),
      platformResult: Object.freeze({ resultDigest: digest('9') }),
      evidenceIndex: Object.freeze({ indexDigest: digest('a') }),
    }),
    resultDigest: digest('9'),
    evidenceIndexDigest: digest('a'),
    sanitizedEvidenceDocuments: Object.freeze([]),
  });
}

describe('LinuxQualificationStateProducer', () => {
  it('seals only the completed Linux branch and retains Task 21 blockers', () => {
    const frozenFoundation = foundation();
    const state = new LinuxQualificationStateProducer(validator).produce({
      candidateSemVer: '2.4.0',
      freezeTimestampUtc: '2026-08-03T12:00:00Z',
      sourceCommit: 'b'.repeat(40),
      foundation: frozenFoundation,
      packages: packages(),
      predecessorEvidenceDigest: digest('b'),
      result: result(frozenFoundation),
    });
    assert.equal(state.candidateState, 'Frozen');
    assert.equal(state.profileState, 'Pass');
    assert.equal(state.previousPackageState, 'Pass');
    assert.equal(state.activationState, 'FailClosed');
    assert.deepEqual(state.reasonCodes, [
      'AUTHENTICATED_PRODUCTION_CATALOG_UNAVAILABLE',
      'LICENSE_REDISTRIBUTION_APPROVAL_UNAVAILABLE',
    ]);
  });

  it('rejects a completed state with a pending predecessor gate', () => {
    const frozenFoundation = foundation();
    const state = new LinuxQualificationStateProducer(validator).produce({
      candidateSemVer: '2.4.0',
      freezeTimestampUtc: '2026-08-03T12:00:00Z',
      sourceCommit: 'b'.repeat(40),
      foundation: frozenFoundation,
      packages: packages(),
      predecessorEvidenceDigest: digest('b'),
      result: result(frozenFoundation),
    });
    assert.throws(
      () => validator.validateLinuxStateDocument({ ...state, previousPackageState: 'Pending' }),
      /QUALIFICATION_LINUX_STATE_INVALID/u,
    );
  });
});
