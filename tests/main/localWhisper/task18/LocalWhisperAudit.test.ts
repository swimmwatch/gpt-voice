import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCommandAudit } from '@main/localWhisper/audit/LocalWhisperCommandAudit';
import {
  parseCanonicalProviderAuditRecord,
  PROVIDER_AUDIT_OPERATION_IDS,
  validateProviderAuditMetadata,
} from '@main/providerAudit';
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import type { LocalWhisperSettingsCommand } from '@shared/localWhisper';
import { FakeCoordinator, createSnapshotService } from '../ipc/localWhisperIpcTestUtils';

const OPERATION_ID = '00000000-0000-4000-8000-000000000018';

function createAudit(sink: {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}) {
  return new VoiceProviderAudit({
    elapsedNow: () => 10,
    getSink: () => sink,
    now: () => new Date('2026-08-03T00:00:00.000Z'),
    randomUUID: () => OPERATION_ID,
  });
}

describe('Local Whisper closed audit projection', () => {
  it('records only closed operations, phases, enums, bounded counts, and stable failure codes', () => {
    const payloads: string[] = [];
    const sink = {
      info: (_label: unknown, payload: unknown) => payloads.push(String(payload)),
      warn: (_label: unknown, payload: unknown) => payloads.push(String(payload)),
      error: (_label: unknown, payload: unknown) => payloads.push(String(payload)),
    };
    const snapshot = createSnapshotService(new FakeCoordinator()).snapshot;
    const command: LocalWhisperSettingsCommand = {
      kind: 'checkCompatibility',
      expectedSnapshotRevision: snapshot.snapshotRevision,
      expectedConfigurationEpoch: snapshot.configurationEpoch,
      expectedInventoryEpoch: snapshot.inventoryEpoch,
    };

    new LocalWhisperCommandAudit(createAudit(sink)).record(command, snapshot, {
      success: false,
      error: { code: 'INSUFFICIENT_RAM' },
    });

    assert.equal(PROVIDER_AUDIT_OPERATION_IDS.voice.includes('local-runtime-check'), true);
    assert.equal(payloads.length, 2);
    const records = payloads.map(parseCanonicalProviderAuditRecord);
    assert.equal(
      records.every((record) => record !== null),
      true,
    );
    assert.deepEqual(
      records.map((record) => record?.operation),
      ['local-runtime-check', 'local-runtime-check'],
    );
    assert.deepEqual(
      records.map((record) => record?.phase),
      ['readiness', 'readiness'],
    );
    assert.equal(
      records.some((record) => record?.phase === 'dispatch'),
      false,
    );
    assert.equal(records[1]?.failureCode, 'INSUFFICIENT_RAM');
    assert.equal(records[1]?.engineId, 'whisperCpp');
    assert.equal(records[1]?.target, 'cpu');
    assert.equal(records[1]?.backend, 'cpu');
    assert.equal(records[1]?.modelFamily, 'base');
    assert.equal(payloads.join('').includes('Private prompt'), false);
  });

  it('rejects unknown or free-form metadata and remains fail-open when the sink throws', () => {
    assert.equal(
      validateProviderAuditMetadata({ prompt: 'private-canary' }, () => true),
      null,
    );
    assert.equal(
      validateProviderAuditMetadata({ runtimeRevision: '/private/path' }, () => true),
      null,
    );

    const snapshot = createSnapshotService(new FakeCoordinator()).snapshot;
    const command: LocalWhisperSettingsCommand = {
      kind: 'unload',
      expectedSnapshotRevision: snapshot.snapshotRevision,
      expectedConfigurationEpoch: snapshot.configurationEpoch,
      expectedInventoryEpoch: snapshot.inventoryEpoch,
    };
    const throwing = (): never => {
      throw new Error('private-canary');
    };
    assert.doesNotThrow(() =>
      new LocalWhisperCommandAudit(createAudit({ info: throwing, warn: throwing, error: throwing })).record(
        command,
        snapshot,
        { success: true },
      ),
    );
  });
});
