import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS,
  NativeRuntimeLogArchiveExtractor,
} from '@main/services/nativeRuntimeLogArchive';
import { serializeCanonicalNativeRuntimeArchiveRecord, type NativeRuntimeArchiveRecord } from '@shared/localWhisper';

const RECORD: NativeRuntimeArchiveRecord = Object.freeze({
  native: Object.freeze({
    component: 'whisperWorker',
    event: 'requestCompleted',
    level: 'info',
    processInstanceId: '11111111-1111-1111-8111-111111111111',
    schemaVersion: 1,
    sequence: 1,
  }),
  observedAt: '2026-08-12T00:00:00.000Z',
});

test('native runtime archive extractor accepts canonical main-log envelopes in retained order', () => {
  const serialized = serializeCanonicalNativeRuntimeArchiveRecord(RECORD);
  assert.ok(serialized);
  const prefix = '[2026-08-12 00:00:00.000] [info] (local-whisper-native-runtime) [native-runtime] ';
  const extraction = new NativeRuntimeLogArchiveExtractor({
    readRetainedLogs: () => [
      { contents: `${prefix}${serialized}\n${prefix}not-json\n`, generation: 'rotated' as const },
      { contents: `${prefix}${serialized}\n`, generation: 'current' as const },
    ],
  }).extract();

  assert.deepEqual(extraction.records, [RECORD]);
  assert.deepEqual(extraction.summary, {
    byteLength: Buffer.byteLength(serialized, 'utf8') + 1,
    duplicateRecordCount: 1,
    firstObservedAt: RECORD.observedAt,
    includedRecordCount: 1,
    invalidRecordCount: 1,
    lastObservedAt: RECORD.observedAt,
    truncated: false,
    validRecordCount: 1,
  });
});

test('native runtime archive extractor retains approved development debug records', () => {
  const debugRecord: NativeRuntimeArchiveRecord = {
    ...RECORD,
    native: {
      ...RECORD.native,
      event: 'requestAccepted',
      level: 'debug',
    },
  };
  const serialized = serializeCanonicalNativeRuntimeArchiveRecord(debugRecord);
  assert.ok(serialized);
  const extraction = new NativeRuntimeLogArchiveExtractor({
    readRetainedLogs: () => [
      {
        contents: `[2026-08-12 00:00:00.000] [debug] (local-whisper-native-runtime) [native-runtime] ${serialized}\n`,
        generation: 'current' as const,
      },
    ],
  }).extract();

  assert.deepEqual(extraction.records, [debugRecord]);
});

test('native runtime archive extractor keeps the newest complete unique records at its hard record bound', () => {
  const prefix = '[2026-08-12 00:00:00.000] [info] (local-whisper-native-runtime) [native-runtime] ';
  const contents = Array.from({ length: NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS + 1 }, (_value, index) => {
    const serialized = serializeCanonicalNativeRuntimeArchiveRecord({
      ...RECORD,
      native: { ...RECORD.native, sequence: index + 1 },
    });
    assert.ok(serialized);
    return `${prefix}${serialized}`;
  }).join('\n');
  const extraction = new NativeRuntimeLogArchiveExtractor({
    readRetainedLogs: () => [{ contents, generation: 'current' as const }],
  }).extract();

  assert.equal(extraction.records.length, NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS);
  assert.equal(extraction.records[0]?.native.sequence, 2);
  assert.equal(
    extraction.records[extraction.records.length - 1]?.native.sequence,
    NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS + 1,
  );
  assert.equal(extraction.summary.truncated, true);
  assert.equal(extraction.summary.validRecordCount, NATIVE_RUNTIME_ARCHIVE_MAXIMUM_RECORDS + 1);
});
