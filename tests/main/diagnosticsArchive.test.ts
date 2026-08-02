import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import type { MainLogFileAccessor } from '@main/logger';
import {
  PROVIDER_AUDIT_SCHEMA_VERSION,
  serializeProviderAuditRecord,
  type ProviderAuditRecord,
} from '@main/providerAudit';
import type { DiagnosticCaptureRow } from '@main/repositories/diagnosticCaptureRepository';
import { LocalWhisperDiagnosticsSnapshotProvider } from '@main/localWhisper/diagnostics/LocalWhisperDiagnosticsSnapshotProvider';
import {
  DiagnosticsArchiveJsonlSerializer,
  DiagnosticsArchiveService,
  ProviderAuditLogExtractor,
  type DiagnosticsArchiveServiceDependencies,
} from '@main/services/diagnosticsArchive';
import {
  ArchiverDiagnosticsArchiveWriterFactory,
  DiagnosticsArchiveFormatAdapter,
  inspectDiagnosticsArchiveForVerification,
} from '@main/services/diagnosticsArchiveFormat';
import { DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES } from '@main/services/diagnosticCaptureStorage';
import { DIAGNOSTIC_REDACTOR_VERSION } from '@main/services/diagnosticTextRedactor';
import { DiagnosticsManifestBuilder } from '@main/services/diagnosticsManifest';
import {
  DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_LIMITS,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION,
  isDiagnosticsArchiveManifest,
  parseCanonicalLocalWhisperDiagnosticsSnapshot,
  serializeCanonicalDiagnosticsJson,
  type DiagnosticArchiveTextActionRow,
  type DiagnosticsArchiveEnvironmentSnapshot,
  type DiagnosticsArchiveManifest,
} from '@shared/diagnosticsArchive';
import { FakeCoordinator, createSnapshotService } from './localWhisper/ipc/localWhisperIpcTestUtils';

const ARCHIVE_ID = '00000000-0000-4000-8000-000000000020';
const AUDIT_OPERATION_ID = '00000000-0000-4000-8000-000000000019';
const DIAGNOSTIC_ACTION_ID = '00000000-0000-4000-8000-000000000018';
const RECORDED_AT = '2026-07-27T12:00:00.000Z';
const PRIVATE_LOG_CANARY = 'private-unrelated-log-canary';
const PRIVATE_PATH_CANARY = 'private-destination-canary';
const RAW_SECRET_CANARY = 'sk-private-secret-canary-1234567890';
const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-diagnostics-service-'));
  temporaryDirectories.push(directory);
  return directory;
}

function hash(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function createAuditRecord(overrides: Partial<ProviderAuditRecord> = {}): ProviderAuditRecord {
  return {
    event: 'started',
    family: 'voice',
    operation: 'transcribe-batch',
    operationId: AUDIT_OPERATION_ID,
    outcome: 'in-progress',
    occurredAt: RECORDED_AT,
    phase: 'validation',
    providerId: 'chatgpt',
    schemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
    sequence: 1,
    ...overrides,
  };
}

function createAuditLine(record: ProviderAuditRecord, scopePadding = ''): string {
  const serialized = serializeProviderAuditRecord(record);
  assert.ok(serialized);
  return `[${RECORDED_AT}] [info] (provider-audit)${scopePadding} Provider audit event ${serialized}`;
}

function createDiagnosticRow(overrides: Partial<DiagnosticCaptureRow> = {}): DiagnosticCaptureRow {
  const sourceText = 'Bearer [REDACTED]';
  const resultText = 'translated result';
  const sourceBytes = Buffer.byteLength(sourceText, 'utf8');
  const resultBytes = Buffer.byteLength(resultText, 'utf8');
  return {
    actionId: DIAGNOSTIC_ACTION_ID,
    actionType: 'translation',
    contractVersion: '2026-07-25',
    providerId: 'google',
    providerOperationId: AUDIT_OPERATION_ID,
    recordedAt: RECORDED_AT,
    redactionCount: 1,
    redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
    resultBytes,
    resultText,
    retainedBytes: sourceBytes + resultBytes,
    sourceBytes,
    sourceKind: 'provider',
    sourceText,
    targetLanguage: 'en',
    ...overrides,
  };
}

function createUtf8Text(byteLength: number): string {
  return `${'é'.repeat(Math.floor(byteLength / 2))}${byteLength % 2 === 0 ? '' : 'x'}`;
}

function createArchiveRowWithSerializedByteLength(targetBytes: number): DiagnosticArchiveTextActionRow {
  let sourceBytes = targetBytes - 512;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const sourceText = createUtf8Text(sourceBytes);
    const candidate: DiagnosticArchiveTextActionRow = {
      ...createDiagnosticRow({
        redactionCount: 0,
        resultBytes: 0,
        resultText: '',
        retainedBytes: sourceBytes,
        sourceBytes,
        sourceText,
      }),
      schemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
    };
    const serialized = serializeCanonicalDiagnosticsJson(candidate);
    assert.ok(serialized);
    const serializedBytes = Buffer.byteLength(serialized, 'utf8');
    if (serializedBytes === targetBytes) return candidate;
    sourceBytes += targetBytes - serializedBytes;
  }
  throw new Error('Unable to construct an exact diagnostics JSONL fixture');
}

function createRetainedRows(recordCount: number): DiagnosticCaptureRow[] {
  const sourceText = 'x'.repeat(DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES);
  return Array.from({ length: recordCount }, (_value, index) =>
    createDiagnosticRow({
      actionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      redactionCount: 0,
      resultBytes: 0,
      resultText: '',
      retainedBytes: DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES,
      sourceBytes: DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES,
      sourceText,
    }),
  );
}

function createEnvironment(): DiagnosticsArchiveEnvironmentSnapshot {
  return {
    appVersion: '1.4.0',
    architecture: 'x64',
    cloakBrowserVersion: '0.4.12',
    electronVersion: '43.1.1',
    nodeVersion: '24.0.0',
    platformFamily: 'linux',
    playwrightVersion: '1.61.1',
    providers: {
      voice: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: true,
        ready: true,
        registeredProviderIds: ['chatgpt', 'openai-api', 'claude-web', 'local-whisper'],
        selectedProviderId: 'chatgpt',
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

class DiagnosticsArchiveHarness {
  public readonly directory = createTemporaryDirectory();
  public readonly destinationPath = path.join(this.directory, `${PRIVATE_PATH_CANARY}.tar.gz`);
  public readonly rows: DiagnosticCaptureRow[] = [createDiagnosticRow()];
  public readCount = 0;
  public readonly retainedLogs = [
    {
      contents: [
        `${PRIVATE_LOG_CANARY} ${RAW_SECRET_CANARY}`,
        createAuditLine(createAuditRecord()),
        `[${RECORDED_AT}] [info] (other-scope) Provider audit event ${RAW_SECRET_CANARY}`,
      ].join('\n'),
      generation: 'rotated' as const,
    },
    {
      contents: [
        createAuditLine(createAuditRecord(), '   '),
        `[${RECORDED_AT}] [warn] (provider-audit) Provider audit event malformed-json`,
      ].join('\n'),
      generation: 'current' as const,
    },
  ];
  public readonly service: DiagnosticsArchiveService;

  public constructor(overrides: Partial<DiagnosticsArchiveServiceDependencies> = {}) {
    const fileSystem = {
      chmod: (filePath: string, mode: number) => fs.promises.chmod(filePath, mode),
      createWriteStream: (filePath: string, options: { readonly flags: 'wx'; readonly mode: number }): fs.WriteStream =>
        fs.createWriteStream(filePath, options),
      readFile: (filePath: string) => fs.promises.readFile(filePath),
      removeFile: (filePath: string) => fs.promises.rm(filePath, { force: true }),
      rename: (sourcePath: string, destinationPath: string) => fs.promises.rename(sourcePath, destinationPath),
    };
    const defaults: DiagnosticsArchiveServiceDependencies = {
      environment: { getSnapshot: createEnvironment },
      fileSystem,
      formatAdapter: new DiagnosticsArchiveFormatAdapter({
        fileSystem,
        platform: 'linux',
        writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
      }),
      jsonl: new DiagnosticsArchiveJsonlSerializer(),
      logs: new ProviderAuditLogExtractor({
        readRetainedLogs: () => this.retainedLogs,
      }),
      localWhisperSnapshot: { capture: () => null },
      manifest: new DiagnosticsManifestBuilder({
        databaseSchemaVersion: 2,
        diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
        hash,
        providerAuditSchemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
        redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
      }),
      now: () => new Date(RECORDED_AT),
      platform: 'linux',
      randomUUID: () => ARCHIVE_ID,
      settings: {
        getSettings: () => ({
          capturePrettifyDiagnostics: false,
          captureTranslationDiagnostics: true,
        }),
      },
      storage: {
        readPrunedArchiveSnapshot: async (categories) => {
          this.readCount += 1;
          assert.deepEqual(categories, ['translation']);
          return { rows: this.rows, status: 'success' };
        },
      },
    };
    this.service = new DiagnosticsArchiveService({ ...defaults, ...overrides });
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories) fs.rmSync(directory, { force: true, recursive: true });
  temporaryDirectories.length = 0;
});

describe('provider audit log extractor', () => {
  it('extracts oldest-first exact records, counts malformed candidates, and deduplicates by operation sequence', () => {
    const secondRecord = createAuditRecord({
      event: 'phase-entered',
      phase: 'submission',
      sequence: 2,
    });
    const firstLine = createAuditLine(createAuditRecord());
    const secondLine = createAuditLine(secondRecord, '      ');
    const { sequence, ...recordWithoutSequence } = createAuditRecord({ sequence: 3 });
    const nonCanonical = JSON.stringify({ sequence, ...recordWithoutSequence });
    const accessor: MainLogFileAccessor = {
      readRetainedLogs: () => [
        {
          contents: [firstLine, `${PRIVATE_LOG_CANARY} ${RAW_SECRET_CANARY}`, secondLine].join('\n'),
          generation: 'rotated',
        },
        {
          contents: [
            firstLine,
            `[${RECORDED_AT}] [info] (provider-audit) Provider audit event ${nonCanonical}`,
            `[${RECORDED_AT}] [warn] (provider-audit) Provider audit event`,
            `[${RECORDED_AT}] [info] (wrong-scope) Provider audit event ${RAW_SECRET_CANARY}`,
          ].join('\n'),
          generation: 'current',
        },
      ],
    };

    const extraction = new ProviderAuditLogExtractor(accessor).extract();
    assert.deepEqual(
      extraction.records.map((record) => record.sequence),
      [1, 2],
    );
    assert.deepEqual(extraction.summary, {
      duplicateRecordCount: 1,
      invalidRecordCount: 2,
      validRecordCount: 2,
    });
    assert.equal(JSON.stringify(extraction).includes(PRIVATE_LOG_CANARY), false);
    assert.equal(JSON.stringify(extraction).includes(RAW_SECRET_CANARY), false);
  });
});

describe('diagnostics archive JSONL limits', () => {
  it('counts multibyte UTF-8 line bytes without the terminator at the exact limit and one byte over', () => {
    const serializer = new DiagnosticsArchiveJsonlSerializer();
    const exact = createArchiveRowWithSerializedByteLength(DIAGNOSTICS_ARCHIVE_LIMITS.MaxJsonlLineBytes);
    const payload = serializer.serializeDiagnosticRows([exact]);

    assert.equal(payload.byteLength, DIAGNOSTICS_ARCHIVE_LIMITS.MaxJsonlLineBytes + 1);
    assert.equal(payload.subarray(-1).equals(Buffer.from('\n')), true);
    assert.throws(() =>
      serializer.serializeDiagnosticRows([
        createArchiveRowWithSerializedByteLength(DIAGNOSTICS_ARCHIVE_LIMITS.MaxJsonlLineBytes + 1),
      ]),
    );
  });

  it('accepts the exact 64 MiB member and rejects one byte over', () => {
    const serializer = new DiagnosticsArchiveJsonlSerializer();
    const fullMemberLine = createArchiveRowWithSerializedByteLength(DIAGNOSTICS_ARCHIVE_LIMITS.MaxJsonlLineBytes - 1);
    const exactRows = Array<DiagnosticArchiveTextActionRow>(8).fill(fullMemberLine);
    const payload = serializer.serializeDiagnosticRows(exactRows);
    assert.equal(payload.byteLength, DIAGNOSTICS_ARCHIVE_LIMITS.MaxMemberBytes);

    const oneByteLonger = createArchiveRowWithSerializedByteLength(DIAGNOSTICS_ARCHIVE_LIMITS.MaxJsonlLineBytes);
    assert.throws(() => serializer.serializeDiagnosticRows([...exactRows.slice(0, 7), oneByteLonger]));
  });

  it('accepts exactly 100,000 records and rejects record 100,001 before serialization', () => {
    const serializer = new DiagnosticsArchiveJsonlSerializer();
    const record = createAuditRecord();
    const oneRecord = serializer.serializeAuditEvents([record]);
    const exactRecords = Array<ProviderAuditRecord>(DIAGNOSTICS_ARCHIVE_LIMITS.MaxRecordsPerJsonlMember).fill(record);
    const exactPayload = serializer.serializeAuditEvents(exactRecords);

    assert.equal(exactPayload.byteLength, oneRecord.byteLength * DIAGNOSTICS_ARCHIVE_LIMITS.MaxRecordsPerJsonlMember);
    assert.throws(() => serializer.serializeAuditEvents([...exactRecords, record]));
  });
});

describe('diagnostics archive service', () => {
  it('creates the fixed archive from pruned rows and retained audit records without unrelated private data', async () => {
    const harness = new DiagnosticsArchiveHarness();
    const result = await harness.service.createArchive(harness.destinationPath);

    assert.deepEqual(result, { status: 'success' });
    assert.equal(harness.readCount, 1);
    const archiveBytes = await fs.promises.readFile(harness.destinationPath);
    const members = inspectDiagnosticsArchiveForVerification('tar-gzip', archiveBytes);
    assert.deepEqual(
      [...members.keys()],
      [
        DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest,
        DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
        DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
      ],
    );

    const manifestPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest);
    const auditPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents);
    const diagnosticPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions);
    assert.ok(manifestPayload);
    assert.ok(auditPayload);
    assert.ok(diagnosticPayload);
    const manifest: unknown = JSON.parse(manifestPayload.toString('utf8'));
    assert.equal(isDiagnosticsArchiveManifest(manifest), true);
    assert.deepEqual((manifest as DiagnosticsArchiveManifest).audit, {
      duplicateRecordCount: 1,
      invalidRecordCount: 1,
      validRecordCount: 1,
    });
    assert.equal(auditPayload.toString('utf8'), `${serializeProviderAuditRecord(createAuditRecord())}\n`);
    assert.equal(diagnosticPayload.toString('utf8').endsWith('\n'), true);

    for (const privateCanary of [PRIVATE_LOG_CANARY, PRIVATE_PATH_CANARY, RAW_SECRET_CANARY]) {
      assert.equal(archiveBytes.includes(Buffer.from(privateCanary, 'utf8')), false);
    }
    assert.equal(
      fs.readdirSync(harness.directory).some((name) => name.endsWith('.tmp')),
      false,
    );
  });

  it('writes one manifest-bound Local Whisper snapshot as additive schema v2', async () => {
    const harness = new DiagnosticsArchiveHarness({
      localWhisperSnapshot: new LocalWhisperDiagnosticsSnapshotProvider({
        now: () => new Date(RECORDED_AT),
        snapshots: { snapshot: createSnapshotService(new FakeCoordinator()).snapshot },
      }),
    });

    assert.deepEqual(await harness.service.createArchive(harness.destinationPath), { status: 'success' });
    const members = inspectDiagnosticsArchiveForVerification(
      'tar-gzip',
      await fs.promises.readFile(harness.destinationPath),
    );
    const manifestPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest);
    const snapshotPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot);
    assert.ok(manifestPayload);
    assert.ok(snapshotPayload);
    const manifest: unknown = JSON.parse(manifestPayload.toString('utf8'));
    assert.equal(isDiagnosticsArchiveManifest(manifest), true);
    assert.equal((manifest as DiagnosticsArchiveManifest).schemaVersion, DIAGNOSTICS_ARCHIVE_SCHEMA_VERSION);
    assert.equal(parseCanonicalLocalWhisperDiagnosticsSnapshot(snapshotPayload) !== null, true);
    const summary = (manifest as DiagnosticsArchiveManifest).members.find(
      ({ name }) => name === DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.LocalWhisperSnapshot,
    );
    assert.equal(summary?.byteLength, snapshotPayload.byteLength);
    assert.equal(summary?.sha256, hash(snapshotPayload));
  });

  it('omits diagnostic rows and the optional member when all capture categories are disabled', async () => {
    const harness = new DiagnosticsArchiveHarness({
      settings: {
        getSettings: () => ({
          capturePrettifyDiagnostics: false,
          captureTranslationDiagnostics: false,
        }),
      },
      storage: {
        readPrunedArchiveSnapshot: async (categories) => {
          assert.deepEqual(categories, []);
          return { rows: [], status: 'success' };
        },
      },
    });

    assert.deepEqual(await harness.service.createArchive(harness.destinationPath), { status: 'success' });
    const members = inspectDiagnosticsArchiveForVerification(
      'tar-gzip',
      await fs.promises.readFile(harness.destinationPath),
    );
    assert.deepEqual(
      [...members.keys()],
      [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest, DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents],
    );
  });

  it('fails closed for invalid rows, throwing log access, storage failure, clocks, UUIDs, and destinations', async () => {
    const cases: Array<{
      readonly destination?: string;
      readonly overrides: Partial<DiagnosticsArchiveServiceDependencies>;
    }> = [
      {
        overrides: {
          storage: {
            readPrunedArchiveSnapshot: async () => ({
              rows: [createDiagnosticRow({ sourceBytes: 1 })],
              status: 'success',
            }),
          },
        },
      },
      {
        overrides: {
          logs: {
            extract: () => {
              throw new Error(`${RAW_SECRET_CANARY}-log-error`);
            },
          },
        },
      },
      {
        overrides: {
          jsonl: {
            serializeAuditEvents: () => {
              throw new Error(`${RAW_SECRET_CANARY}-serializer-error`);
            },
            serializeDiagnosticRows: () => Buffer.alloc(0),
          },
        },
      },
      {
        overrides: {
          manifest: new DiagnosticsManifestBuilder({
            databaseSchemaVersion: 2,
            diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
            hash: () => {
              throw new Error(`${RAW_SECRET_CANARY}-hash-error`);
            },
            providerAuditSchemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
            redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
          }),
        },
      },
      {
        overrides: {
          storage: {
            readPrunedArchiveSnapshot: async () => ({
              causeCode: 'diagnostic-storage-failed',
              status: 'failure',
            }),
          },
        },
      },
      { overrides: { now: () => new Date(Number.NaN) } },
      { overrides: { randomUUID: () => 'renderer-candidate-id' } },
      { destination: 'relative-output.tar.gz', overrides: {} },
    ];

    for (const testCase of cases) {
      const harness = new DiagnosticsArchiveHarness(testCase.overrides);
      const destination = testCase.destination ?? harness.destinationPath;
      assert.deepEqual(await harness.service.createArchive(destination), { status: 'failure' });
      assert.equal(fs.existsSync(destination), false);
      assert.equal(
        fs.readdirSync(harness.directory).some((name) => name.endsWith('.tmp')),
        false,
      );
    }
  });

  it('preserves an existing destination and removes the private sibling after write or rename failure', async () => {
    const harness = new DiagnosticsArchiveHarness({
      fileSystem: {
        removeFile: (filePath) => fs.promises.rm(filePath, { force: true }),
        rename: async () => {
          throw new Error(`${RAW_SECRET_CANARY}-rename-error`);
        },
      },
    });
    await fs.promises.writeFile(harness.destinationPath, 'existing-destination', { mode: 0o600 });

    assert.deepEqual(await harness.service.createArchive(harness.destinationPath), { status: 'failure' });
    assert.equal(await fs.promises.readFile(harness.destinationPath, 'utf8'), 'existing-destination');
    assert.equal(
      fs.readdirSync(harness.directory).some((name) => name.endsWith('.tmp')),
      false,
    );

    const partialHarness = new DiagnosticsArchiveHarness({
      formatAdapter: {
        writeAndVerify: async (_format, outputPath) => {
          await fs.promises.writeFile(outputPath, 'partial', { flag: 'wx', mode: 0o600 });
          throw new Error(`${RAW_SECRET_CANARY}-format-error`);
        },
      },
    });
    assert.deepEqual(await partialHarness.service.createArchive(partialHarness.destinationPath), { status: 'failure' });
    assert.equal(
      fs.readdirSync(partialHarness.directory).some((name) => name.endsWith('.tmp')),
      false,
    );

    let cleanupAttempts = 0;
    const cleanupHarness = new DiagnosticsArchiveHarness({
      fileSystem: {
        removeFile: async (filePath) => {
          cleanupAttempts += 1;
          if (cleanupAttempts === 1) throw new Error(`${RAW_SECRET_CANARY}-cleanup-error`);
          await fs.promises.rm(filePath, { force: true });
        },
        rename: (sourcePath, destinationPath) => fs.promises.rename(sourcePath, destinationPath),
      },
      formatAdapter: {
        writeAndVerify: async (_format, outputPath) => {
          await fs.promises.writeFile(outputPath, 'partial', { flag: 'wx', mode: 0o600 });
          throw new Error(`${RAW_SECRET_CANARY}-verification-error`);
        },
      },
    });
    assert.deepEqual(await cleanupHarness.service.createArchive(cleanupHarness.destinationPath), {
      status: 'failure',
    });
    assert.equal(cleanupAttempts, 2);
    assert.equal(fs.existsSync(cleanupHarness.destinationPath), false);
    assert.equal(cleanupHarness.rows.length, 1);
    assert.equal(
      fs.readdirSync(cleanupHarness.directory).some((name) => name.endsWith('.tmp')),
      false,
    );
  });

  it('preserves a valid 100 MiB retained snapshot on failure and succeeds after user-controlled deletion', async () => {
    const captureSettings = {
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    } as const;
    let settingsReadCount = 0;
    const harness = new DiagnosticsArchiveHarness({
      settings: {
        getSettings: () => {
          settingsReadCount += 1;
          return captureSettings;
        },
      },
    });
    harness.rows.splice(0, harness.rows.length, ...createRetainedRows(100));

    assert.deepEqual(await harness.service.createArchive(harness.destinationPath), { status: 'failure' });
    assert.equal(harness.rows.length, 100);
    assert.equal(
      harness.rows.reduce((total, row) => total + row.retainedBytes, 0),
      100 * DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES,
    );
    assert.deepEqual(captureSettings, {
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    });
    assert.equal(fs.existsSync(harness.destinationPath), false);
    assert.equal(
      fs.readdirSync(harness.directory).some((name) => name.endsWith('.tmp')),
      false,
    );

    harness.rows.splice(0, harness.rows.length, createDiagnosticRow());
    assert.deepEqual(await harness.service.createArchive(harness.destinationPath), { status: 'success' });
    assert.equal(harness.rows.length, 1);
    assert.equal(settingsReadCount, 2);
  });

  it('drains active creation, removes temporary output, and rejects later work during idempotent shutdown', async () => {
    let releaseWrite = (): void => {
      throw new Error('write gate was not initialized');
    };
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let writeStarted: () => void;
    const started = new Promise<void>((resolve) => {
      writeStarted = resolve;
    });
    const harness = new DiagnosticsArchiveHarness({
      formatAdapter: {
        writeAndVerify: async (_format, outputPath) => {
          await fs.promises.writeFile(outputPath, 'synthetic-verified-archive', { flag: 'wx', mode: 0o600 });
          writeStarted();
          await writeGate;
        },
      },
    });

    const creation = harness.service.createArchive(harness.destinationPath);
    await started;
    const shutdown = harness.service.shutdown();
    assert.deepEqual(await harness.service.createArchive(path.join(harness.directory, 'late.tar.gz')), {
      status: 'failure',
    });
    releaseWrite();
    assert.deepEqual(await creation, { status: 'success' });
    await shutdown;
    await harness.service.shutdown();
    assert.equal(
      fs.readdirSync(harness.directory).some((name) => name.endsWith('.tmp')),
      false,
    );
  });

  it('enforces the JSONL record bound and rejects non-schema rows without partial output', () => {
    const serializer = new DiagnosticsArchiveJsonlSerializer();
    const record = createAuditRecord();
    const tooManyRecords = Array<ProviderAuditRecord>(DIAGNOSTICS_ARCHIVE_LIMITS.MaxRecordsPerJsonlMember + 1).fill(
      record,
    );
    assert.throws(() => serializer.serializeAuditEvents(tooManyRecords));
    assert.throws(() =>
      serializer.serializeDiagnosticRows([
        {
          ...createDiagnosticRow(),
          schemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
          unexpected: RAW_SECRET_CANARY,
        } as never,
      ]),
    );
  });
});
