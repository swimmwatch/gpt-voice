import { Buffer } from 'node:buffer';

import { freezeArray, freezeRecord, isRecord, requireNonNegativeInteger, runtimeFail } from './runtime-core-support.mjs';
import {
  AUDIT_ACTORS,
  RUNTIME_AUDIT_SCHEMA_VERSION,
  validateDigest,
  validateOutcome,
  validatePhase,
  validateReceiptId,
  validateRuntimeCode,
  validateSourceSha,
  validateWatchId,
} from './runtime-state-contracts.mjs';
import { AtomicStateStore } from './atomic-state-store.mjs';
import { WatchRuntimeStorage } from './watch-runtime-storage.mjs';

const ACTIVE_JOURNAL_FILE_NAME = 'events.jsonl';
const MAX_ACTIVE_EVENTS = 100;
const MAX_ARCHIVES = 3;
const MAX_JOURNAL_BYTES = 131_072;
const ARCHIVE_FILE_PATTERN = /^events\.(?<first>\d+)-(?<last>\d+)\.jsonl$/u;

function assertClosedRecord(value, fields, code) {
  if (!isRecord(value)) runtimeFail(code);
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) runtimeFail(code);
  }
  return value;
}

function assertRequiredFields(record, fields, code) {
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) runtimeFail(code);
  }
}

function normalizeNullable(value, normalizer, code) {
  if (value === null) return null;
  return normalizer(value, code);
}

function normalizeAuditEvent(value, expectedWatchId) {
  const code = 'invalid-audit-event';
  const event = assertClosedRecord(
    value,
    new Set([
      'actor',
      'generation',
      'libraryDigest',
      'outcome',
      'phase',
      'previousPhase',
      'receiptId',
      'scenarioDigest',
      'schemaVersion',
      'scriptDigest',
      'sequence',
      'sourceSha',
      'summaryCode',
      'targetIdentityDigest',
      'timestampEpochMilliseconds',
      'watchId',
    ]),
    code,
  );
  assertRequiredFields(
    event,
    [
      'actor',
      'generation',
      'libraryDigest',
      'outcome',
      'phase',
      'previousPhase',
      'receiptId',
      'scenarioDigest',
      'schemaVersion',
      'scriptDigest',
      'sequence',
      'sourceSha',
      'summaryCode',
      'targetIdentityDigest',
      'timestampEpochMilliseconds',
      'watchId',
    ],
    code,
  );
  if (event.schemaVersion !== RUNTIME_AUDIT_SCHEMA_VERSION || validateWatchId(event.watchId, code) !== expectedWatchId) {
    runtimeFail(code);
  }
  if (typeof event.actor !== 'string' || !AUDIT_ACTORS.includes(event.actor)) runtimeFail(code);
  return freezeRecord({
    actor: event.actor,
    generation: requireNonNegativeInteger(event.generation, code, 1_000_000_000),
    libraryDigest: validateDigest(event.libraryDigest, code),
    outcome: normalizeNullable(event.outcome, validateOutcome, code),
    phase: validatePhase(event.phase, code),
    previousPhase: normalizeNullable(event.previousPhase, validatePhase, code),
    receiptId: normalizeNullable(event.receiptId, validateReceiptId, code),
    scenarioDigest: validateDigest(event.scenarioDigest, code),
    schemaVersion: RUNTIME_AUDIT_SCHEMA_VERSION,
    scriptDigest: validateDigest(event.scriptDigest, code),
    sequence: requireNonNegativeInteger(event.sequence, code, Number.MAX_SAFE_INTEGER),
    sourceSha: normalizeNullable(event.sourceSha, validateSourceSha, code),
    summaryCode: validateRuntimeCode(event.summaryCode, code),
    targetIdentityDigest: normalizeNullable(event.targetIdentityDigest, validateDigest, code),
    timestampEpochMilliseconds: requireNonNegativeInteger(event.timestampEpochMilliseconds, code, Number.MAX_SAFE_INTEGER),
    watchId: expectedWatchId,
  });
}

function normalizeEventInput(value, expectedWatchId, sequence, timestampEpochMilliseconds) {
  const code = 'invalid-audit-event-input';
  const event = assertClosedRecord(
    value,
    new Set([
      'actor',
      'generation',
      'libraryDigest',
      'outcome',
      'phase',
      'previousPhase',
      'receiptId',
      'scenarioDigest',
      'scriptDigest',
      'sourceSha',
      'summaryCode',
      'targetIdentityDigest',
    ]),
    code,
  );
  assertRequiredFields(
    event,
    [
      'actor',
      'generation',
      'libraryDigest',
      'outcome',
      'phase',
      'previousPhase',
      'receiptId',
      'scenarioDigest',
      'scriptDigest',
      'sourceSha',
      'summaryCode',
      'targetIdentityDigest',
    ],
    code,
  );
  return normalizeAuditEvent(
    {
      ...event,
      schemaVersion: RUNTIME_AUDIT_SCHEMA_VERSION,
      sequence,
      timestampEpochMilliseconds,
      watchId: expectedWatchId,
    },
    expectedWatchId,
  );
}

function parseJournalText(text, expectedWatchId) {
  if (text === null || text === '') return freezeArray([]);
  if (!text.endsWith('\n')) runtimeFail('audit-journal-corrupt');
  const lines = text.slice(0, -1).split('\n');
  if (lines.length > MAX_ACTIVE_EVENTS) runtimeFail('audit-journal-corrupt');
  const events = [];
  let previousSequence = -1;
  let previousGeneration = -1;
  for (const line of lines) {
    if (line.length === 0) runtimeFail('audit-journal-corrupt');
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      runtimeFail('audit-journal-corrupt');
    }
    const event = normalizeAuditEvent(value, expectedWatchId);
    if (event.sequence <= previousSequence || event.generation < previousGeneration) runtimeFail('audit-journal-corrupt');
    previousSequence = event.sequence;
    previousGeneration = event.generation;
    events.push(event);
  }
  return freezeArray(events);
}

function serializeEvents(events) {
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
}

function archiveMetadata(fileName) {
  const match = ARCHIVE_FILE_PATTERN.exec(fileName);
  if (match === null) return null;
  const first = Number(match.groups?.first);
  const last = Number(match.groups?.last);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first > last) return null;
  return freezeRecord({ fileName, first, last });
}

/**
 * Owns bounded, append-only sanitized audit records. Active journal replacement
 * is atomic; rotation preserves complete prior files and retains only a bounded
 * suffix of verified archive files.
 */
export class AuditJournal {
  #appendTail = Promise.resolve();
  #clock;
  #stateStore;
  #storage;

  constructor({ clock = () => Date.now(), stateStore, storage } = {}) {
    if (typeof clock !== 'function' || !(stateStore instanceof AtomicStateStore) || !(storage instanceof WatchRuntimeStorage)) {
      runtimeFail('invalid-audit-journal-dependency');
    }
    if (stateStore.watchId !== storage.watchId) runtimeFail('audit-journal-watch-mismatch');
    this.#clock = clock;
    this.#stateStore = stateStore;
    this.#storage = storage;
  }

  async readActive() {
    try {
      const text = await this.#storage.readText(ACTIVE_JOURNAL_FILE_NAME, { maximumBytes: MAX_JOURNAL_BYTES });
      return parseJournalText(text, this.#storage.watchId);
    } catch {
      runtimeFail('audit-journal-corrupt');
    }
  }

  async append({ event, expectedGeneration }) {
    return this.#enqueueAppend(() => this.#append({ event, expectedGeneration }));
  }

  async #append({ event, expectedGeneration }) {
    const generation = requireNonNegativeInteger(expectedGeneration, 'invalid-audit-generation', 1_000_000_000);
    return this.#stateStore.withOwnership({
      expectedGeneration: generation,
      operation: async () => {
        const activeEvents = await this.readActive();
        const lastEvent = activeEvents.at(-1);
        const timestamp = requireNonNegativeInteger(this.#clock(), 'invalid-audit-clock', Number.MAX_SAFE_INTEGER);
        const nextEvent = normalizeEventInput(event, this.#storage.watchId, (lastEvent?.sequence ?? 0) + 1, timestamp);
        if (nextEvent.generation !== generation || (lastEvent !== undefined && nextEvent.generation < lastEvent.generation)) {
          runtimeFail('invalid-audit-generation');
        }
        const nextEvents = [...activeEvents, nextEvent];
        const serialized = serializeEvents(nextEvents);
        if (nextEvents.length > MAX_ACTIVE_EVENTS || Buffer.byteLength(serialized, 'utf8') > MAX_JOURNAL_BYTES) {
          if (activeEvents.length === 0) runtimeFail('audit-event-too-large');
          await this.#rotate(activeEvents);
          const oneEventText = serializeEvents([nextEvent]);
          if (Buffer.byteLength(oneEventText, 'utf8') > MAX_JOURNAL_BYTES) runtimeFail('audit-event-too-large');
          await this.#storage.writeText(ACTIVE_JOURNAL_FILE_NAME, oneEventText, { maximumBytes: MAX_JOURNAL_BYTES });
        } else {
          await this.#storage.writeText(ACTIVE_JOURNAL_FILE_NAME, serialized, { maximumBytes: MAX_JOURNAL_BYTES });
        }
        return nextEvent;
      },
    });
  }

  async #rotate(events) {
    const archiveFileName = `events.${events[0].sequence}-${events.at(-1).sequence}.jsonl`;
    const archiveText = serializeEvents(events);
    const existingArchiveText = await this.#storage.readText(archiveFileName, { maximumBytes: MAX_JOURNAL_BYTES });
    if (existingArchiveText === null) {
      await this.#storage.writeText(archiveFileName, archiveText, { maximumBytes: MAX_JOURNAL_BYTES });
    } else if (existingArchiveText !== archiveText) {
      runtimeFail('audit-archive-conflict');
    }
    const archiveEntries = (await this.#storage.listRegularFileNames())
      .map((fileName) => archiveMetadata(fileName))
      .filter((entry) => entry !== null)
      .sort((left, right) => left.last - right.last);
    while (archiveEntries.length > MAX_ARCHIVES) {
      const oldest = archiveEntries.shift();
      await this.#storage.removeRegularFile(oldest.fileName);
    }
  }

  #enqueueAppend(operation) {
    const append = this.#appendTail.then(operation);
    this.#appendTail = append.catch(() => undefined);
    return append;
  }
}

export { ACTIVE_JOURNAL_FILE_NAME };
