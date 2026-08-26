import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  getNativeRuntimeLogEventLevel,
  NATIVE_RUNTIME_LOG_COMPONENTS,
  NATIVE_RUNTIME_LOG_ERROR_CODES,
  NATIVE_RUNTIME_LOG_EVENTS,
  NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES,
  parseCanonicalNativeRuntimeLogRecord,
  serializeCanonicalNativeRuntimeLogRecord,
  type NativeRuntimeLogRecord,
} from '@shared/localWhisper';
import {
  NativeRuntimeLogForwarder,
  NativeRuntimeLogRelay,
  NativeRuntimeLogStreamDecoder,
} from '@main/localWhisper/supervisor/NativeRuntimeLogStreamDecoder';

const RECORD: NativeRuntimeLogRecord = Object.freeze({
  component: 'whisperWorker',
  elapsedMs: 0,
  event: 'requestAccepted',
  level: 'debug',
  processInstanceId: '11111111-1111-1111-8111-111111111111',
  requestId: 'тест',
  schemaVersion: 1,
  sequence: 1,
});

describe('NativeRuntimeLogStreamDecoder', () => {
  it('accepts every schema enum and the shared canonical fixture without accepting alternate shapes', () => {
    const fixture = readFileSync(
      resolve('tests/fixtures/local-whisper/native-runtime-log/v1/valid.jsonl'),
      'utf8',
    ).trimEnd();
    assert.deepEqual(parseCanonicalNativeRuntimeLogRecord(fixture), {
      component: 'whisperWorker',
      elapsedMs: 0,
      event: 'requestAccepted',
      level: 'debug',
      processInstanceId: '11111111-1111-1111-8111-111111111111',
      requestId: 'fixture',
      schemaVersion: 1,
      sequence: 1,
    });
    for (const [index, event] of NATIVE_RUNTIME_LOG_EVENTS.entries()) {
      const record: NativeRuntimeLogRecord = {
        component: NATIVE_RUNTIME_LOG_COMPONENTS[index % NATIVE_RUNTIME_LOG_COMPONENTS.length] ?? 'whisperWorker',
        event,
        level: getNativeRuntimeLogEventLevel(event),
        processInstanceId: RECORD.processInstanceId,
        schemaVersion: 1,
        sequence: index + 1,
      };
      const serialized = serializeCanonicalNativeRuntimeLogRecord(record);
      assert.ok(serialized);
      assert.deepEqual(parseCanonicalNativeRuntimeLogRecord(serialized), record);
    }
    for (const errorCode of NATIVE_RUNTIME_LOG_ERROR_CODES) {
      const record: NativeRuntimeLogRecord = {
        ...RECORD,
        errorCode,
        sequence: NATIVE_RUNTIME_LOG_EVENTS.length + NATIVE_RUNTIME_LOG_ERROR_CODES.indexOf(errorCode) + 1,
        suppressedCount: 1,
      };
      const serialized = serializeCanonicalNativeRuntimeLogRecord(record);
      assert.ok(serialized);
      assert.deepEqual(parseCanonicalNativeRuntimeLogRecord(serialized), record);
    }
    assert.equal(serializeCanonicalNativeRuntimeLogRecord({ ...RECORD, requestId: 'invalid\ud800' }), null);
  });

  it('preserves split UTF-8 and exact canonical records', () => {
    const received: NativeRuntimeLogRecord[] = [];
    const decoder = new NativeRuntimeLogStreamDecoder({ onRecord: (record) => received.push(record) });
    const serialized = serializeCanonicalNativeRuntimeLogRecord(RECORD);
    assert.ok(serialized);
    const line = Buffer.from(`${serialized}\n`, 'utf8');
    const multibyte = line.indexOf(Buffer.from('т', 'utf8'));
    decoder.append(line.subarray(0, multibyte + 1));
    decoder.append(line.subarray(multibyte + 1));

    assert.deepEqual(received, [RECORD]);
    assert.deepEqual(decoder.counters, {
      invalidRecordCount: 0,
      overlongLineCount: 0,
      schemaFailureCount: 0,
      utf8FailureCount: 0,
    });
  });

  it('resynchronizes after overlong and malformed records without retaining their bytes', () => {
    const received: NativeRuntimeLogRecord[] = [];
    const decoder = new NativeRuntimeLogStreamDecoder({ onRecord: (record) => received.push(record) });
    const serialized = serializeCanonicalNativeRuntimeLogRecord(RECORD);
    assert.ok(serialized);
    decoder.append(Buffer.from(`${'x'.repeat(NATIVE_RUNTIME_LOG_MAXIMUM_LINE_BYTES)}\n${serialized}\n`, 'utf8'));

    assert.deepEqual(received, [RECORD]);
    assert.equal(decoder.counters.overlongLineCount, 1);
    assert.equal(decoder.counters.invalidRecordCount, 1);
    assert.doesNotMatch(JSON.stringify(decoder), /x{32}/u);
  });

  it('accepts the exact distinct identities authorized for one native process tree', () => {
    const workerIdentity = '22222222-2222-2222-8222-222222222222';
    const received: NativeRuntimeLogRecord[] = [];
    const decoder = new NativeRuntimeLogStreamDecoder({
      expectedProcessInstanceIds: [RECORD.processInstanceId, workerIdentity],
      onRecord: (record) => received.push(record),
    });
    const workerRecord: NativeRuntimeLogRecord = {
      ...RECORD,
      component: 'launcher',
      processInstanceId: workerIdentity,
    };
    for (const record of [RECORD, workerRecord]) {
      const serialized = serializeCanonicalNativeRuntimeLogRecord(record);
      assert.ok(serialized);
      decoder.append(Buffer.from(`${serialized}\n`, 'utf8'));
    }

    assert.deepEqual(received, [RECORD, workerRecord]);
    assert.throws(
      () =>
        new NativeRuntimeLogStreamDecoder({
          expectedProcessInstanceIds: [RECORD.processInstanceId, RECORD.processInstanceId],
          onRecord: () => undefined,
        }),
      /identity set/u,
    );
  });

  it('counts malformed UTF-8, identity mismatch, and an EOF fragment while recovering later records', () => {
    const received: NativeRuntimeLogRecord[] = [];
    const decoder = new NativeRuntimeLogStreamDecoder({
      expectedProcessInstanceIds: [RECORD.processInstanceId],
      onRecord: (record) => received.push(record),
    });
    const serialized = serializeCanonicalNativeRuntimeLogRecord(RECORD);
    assert.ok(serialized);
    decoder.append(Buffer.from([0xc3, 0x28, 0x0a]));
    decoder.append(Buffer.from(`${serialized}\n`, 'utf8'));
    const mismatched = serializeCanonicalNativeRuntimeLogRecord({
      ...RECORD,
      processInstanceId: '22222222-2222-2222-8222-222222222222',
      sequence: 2,
    });
    assert.ok(mismatched);
    decoder.append(Buffer.from(`${mismatched}\ntruncated`, 'utf8'));
    decoder.finish();

    assert.deepEqual(received, [RECORD]);
    assert.deepEqual(decoder.counters, {
      invalidRecordCount: 3,
      overlongLineCount: 0,
      schemaFailureCount: 1,
      utf8FailureCount: 1,
    });
  });

  it('forwards a validated archive envelope at the record severity', () => {
    const messages: string[] = [];
    const forwarder = new NativeRuntimeLogForwarder({
      logger: {
        debug: (message: unknown) => messages.push(String(message)),
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
      },
      now: () => new Date('2026-08-12T00:00:00.000Z'),
    });

    forwarder.forward(RECORD);
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? '', /^\[native-runtime\] \{"native":/u);
  });

  it('contains clock and logger failures for buffered and live relay records', () => {
    const throwingClock = new NativeRuntimeLogForwarder({
      logger: { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined },
      now: () => {
        throw new Error('private clock failure');
      },
    });
    assert.doesNotThrow(() => throwingClock.forward(RECORD));

    let attempts = 0;
    const throwingLogger = new NativeRuntimeLogForwarder({
      logger: {
        debug: () => {
          attempts += 1;
          throw new Error('private logger failure');
        },
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
      },
      now: () => new Date('2026-08-12T00:00:00.000Z'),
    });
    const relay = new NativeRuntimeLogRelay();
    relay.accept(RECORD);
    assert.doesNotThrow(() => relay.attach(throwingLogger));
    assert.doesNotThrow(() => relay.accept(RECORD));
    assert.equal(attempts, 2);
  });
});
