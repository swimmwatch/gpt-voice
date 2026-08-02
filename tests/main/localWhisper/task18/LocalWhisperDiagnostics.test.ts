import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { LocalWhisperDiagnosticsSnapshotProvider } from '@main/localWhisper/diagnostics/LocalWhisperDiagnosticsSnapshotProvider';
import { DiagnosticsManifestBuilder } from '@main/services/diagnosticsManifest';
import { LocalWhisperDiagnosticsArchiveReader } from '@main/services/localWhisperDiagnosticsArchiveReader';
import {
  DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_LEGACY_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
  LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES,
  isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit,
  parseCanonicalLocalWhisperDiagnosticsSnapshot,
  type DiagnosticsArchiveEnvironmentSnapshot,
  type DiagnosticsArchiveManifest,
  type DiagnosticsArchivePayloadMemberName,
} from '@shared/diagnosticsArchive';
import { toLocalWhisperOpaqueDeviceId, type LocalWhisperRendererSnapshot } from '@shared/localWhisper';
import { FakeCoordinator, createSnapshotService } from '../ipc/localWhisperIpcTestUtils';

const PRIVATE_CANARY = '/Users/private-user/audio/private-token.wav';
const ARCHIVE_ID = '00000000-0000-4000-8000-000000000018';
const CREATED_AT = '2026-08-03T00:00:00.000Z';

function hash(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function environment(): DiagnosticsArchiveEnvironmentSnapshot {
  return {
    appVersion: '1.4.0',
    architecture: 'x64',
    cloakBrowserVersion: '0.5.3',
    electronVersion: '43.1.1',
    nodeVersion: '24.0.0',
    platformFamily: 'linux',
    playwrightVersion: '1.62.1',
    providers: {
      voice: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: true,
        ready: true,
        registeredProviderIds: ['chatgpt', 'openai-api', 'claude-web', 'local-whisper'],
        selectedProviderId: 'local-whisper',
      },
      prettify: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: false,
        ready: false,
        registeredProviderIds: ['ollama', 'vllm', 'claude-cli', 'codex-cli'],
        selectedProviderId: 'ollama',
      },
      translation: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: false,
        ready: false,
        registeredProviderIds: ['google', 'bing', 'yandex'],
        selectedProviderId: 'google',
      },
    },
  };
}

function builder(): DiagnosticsManifestBuilder {
  return new DiagnosticsManifestBuilder({
    databaseSchemaVersion: 2,
    diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
    hash,
    providerAuditSchemaVersion: 1,
    redactorVersion: 1,
  });
}

function manifestFor(snapshotPayload: Buffer | null): DiagnosticsArchiveManifest {
  const payloads = new Map<DiagnosticsArchivePayloadMemberName, Buffer>([
    [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents, Buffer.alloc(0)],
  ]);
  if (snapshotPayload) payloads.set(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot, snapshotPayload);
  return builder().build({
    archiveId: ARCHIVE_ID,
    audit: { duplicateRecordCount: 0, invalidRecordCount: 0, validRecordCount: 0 },
    captureSettings: { capturePrettifyDiagnostics: false, captureTranslationDiagnostics: false },
    createdAt: CREATED_AT,
    diagnosticRows: [],
    environment: environment(),
    payloads,
  });
}

describe('Local Whisper diagnostics schema v2', () => {
  it('projects a canonical bounded snapshot without private prompt, opaque device, path, or prerequisite data', () => {
    const baseline = createSnapshotService(new FakeCoordinator()).snapshot;
    const opaqueCanary = toLocalWhisperOpaqueDeviceId('private-device-identity-canary');
    assert.ok(opaqueCanary);
    const source: LocalWhisperRendererSnapshot = {
      ...baseline,
      hasInitialPrompt: true,
      selectedDeviceId: opaqueCanary,
      host: { ...baseline.host, label: PRIVATE_CANARY },
      prerequisites: [{ id: 'private', label: PRIVATE_CANARY, version: PRIVATE_CANARY }],
    };
    const payload = new LocalWhisperDiagnosticsSnapshotProvider({
      now: () => new Date(CREATED_AT),
      snapshots: { snapshot: source },
    }).capture();

    assert.ok(payload);
    assert.equal(payload.includes(Buffer.from(PRIVATE_CANARY)), false);
    assert.equal(payload.includes(Buffer.from(opaqueCanary)), false);
    const parsed = parseCanonicalLocalWhisperDiagnosticsSnapshot(payload);
    assert.ok(parsed);
    assert.equal(parsed.engineId, 'whisperCpp');
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.failureCode, null);
    assert.equal('hasInitialPrompt' in parsed, false);
    assert.equal('selectedDeviceId' in parsed, false);
  });

  it('keeps schema v1 readable and classifies schema v2 as absent, valid, or invalid only', () => {
    const reader = new LocalWhisperDiagnosticsArchiveReader({ hash });
    const payload = new LocalWhisperDiagnosticsSnapshotProvider({
      now: () => new Date(CREATED_AT),
      snapshots: { snapshot: createSnapshotService(new FakeCoordinator()).snapshot },
    }).capture();
    assert.ok(payload);
    const legacyManifest = manifestFor(null);
    const currentManifest = manifestFor(payload);

    assert.equal(legacyManifest.schemaVersion, DIAGNOSTICS_ARCHIVE_LEGACY_SCHEMA_VERSION);
    assert.equal(currentManifest.schemaVersion, DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION);
    assert.equal(reader.inspect(legacyManifest, []), 'absent');
    assert.equal(
      reader.inspect(currentManifest, [{ name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot, payload }]),
      'valid',
    );

    const wrongHash = structuredClone(currentManifest);
    const summary = wrongHash.members.find(
      (member) => member.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot,
    );
    assert.ok(summary);
    Object.assign(summary, { sha256: '0'.repeat(64) });
    assert.equal(
      reader.inspect(wrongHash, [{ name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot, payload }]),
      'invalid',
    );
    assert.deepEqual(
      new Set(['absent', 'valid', 'invalid']),
      new Set(['absent', 'valid', reader.inspect(wrongHash, [])]),
    );
  });

  it('rejects duplicate members, malformed or duplicate-key snapshots, wrong lengths, and wrong schema maps', () => {
    const reader = new LocalWhisperDiagnosticsArchiveReader({ hash });
    const malformedPayloads = [
      Buffer.from('{"unknown":"private-canary"}', 'utf8'),
      Buffer.from('{"activityState":"Idle","activityState":"Idle"}', 'utf8'),
      Buffer.from('not-json', 'utf8'),
    ];
    for (const payload of malformedPayloads) {
      const manifest = manifestFor(payload);
      assert.equal(
        reader.inspect(manifest, [{ name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot, payload }]),
        'invalid',
      );
    }

    const validPayload = new LocalWhisperDiagnosticsSnapshotProvider({
      now: () => new Date(CREATED_AT),
      snapshots: { snapshot: createSnapshotService(new FakeCoordinator()).snapshot },
    }).capture();
    assert.ok(validPayload);
    const manifest = manifestFor(validPayload);
    const member = { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot, payload: validPayload };
    assert.equal(reader.inspect(manifest, [member, member]), 'invalid');

    const wrongLength = structuredClone(manifest);
    const summary = wrongLength.members.find(
      (candidate) => candidate.name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot,
    );
    assert.ok(summary);
    Object.assign(summary, { byteLength: validPayload.byteLength + 1 });
    assert.equal(reader.inspect(wrongLength, [member]), 'invalid');

    const wrongSchema = structuredClone(manifest);
    Object.assign(wrongSchema.schemaVersions, { localWhisperSnapshot: 2 });
    assert.equal(reader.inspect(wrongSchema, [member]), 'invalid');
  });

  it('enforces the inclusive 65,536-byte member ceiling and rejects 65,537 bytes', () => {
    assert.equal(
      isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit(LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES),
      true,
    );
    assert.equal(
      isLocalWhisperDiagnosticsSnapshotByteLengthWithinLimit(LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES + 1),
      false,
    );
    const exact = Buffer.alloc(LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES, 0x20);
    const reader = new LocalWhisperDiagnosticsArchiveReader({ hash });
    assert.equal(
      reader.inspect(manifestFor(exact), [
        { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot, payload: exact },
      ]),
      'invalid',
    );
    assert.throws(() => manifestFor(Buffer.alloc(LOCAL_WHISPER_DIAGNOSTICS_SNAPSHOT_MAX_BYTES + 1, 0x20)));
  });
});
