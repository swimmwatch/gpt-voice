import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const SKILL_PATH = path.join(WORKSPACE_PATH, '.agents/skills/analyze-diagnostics-archive');
const INSPECTOR_PATH = path.join(SKILL_PATH, 'scripts/inspect_diagnostics_archive.py');
const SKILL_INSTRUCTIONS_PATH = path.join(SKILL_PATH, 'SKILL.md');
const SKILL_METADATA_PATH = path.join(SKILL_PATH, 'agents/openai.yaml');
const SCHEMA_REFERENCE_PATH = path.join(SKILL_PATH, 'references/archive-schema.md');
const ARCHIVE_ID = '00000000-0000-4000-8000-000000000101';
const OPERATION_ID = '00000000-0000-4000-8000-000000000102';
const ACTION_ID = '00000000-0000-4000-8000-000000000103';
const OCCURRED_AT = '2026-07-27T12:00:00.000Z';
const SENSITIVITY_WARNING =
  'Diagnostic text may contain private or unrecognized secret data; treat this archive as sensitive.';
const PRIVATE_TEXT_CANARY = 'private-source-text-canary';
const PRIVATE_URL_CANARY = 'https://private.invalid/account?token=secret';
const PRIVATE_SECRET_CANARY = 'secret=private-token-canary';
const TEMPORARY_DIRECTORIES: string[] = [];

interface PythonExecution {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

type ArchiveFormat = 'zip' | 'tar-gzip';
type ArchiveEntryKind = 'regular' | 'directory' | 'symlink' | 'hardlink' | 'character' | 'fifo' | 'sparse';

interface ArchiveEntryFixture {
  readonly content?: Buffer;
  readonly fillByte?: number;
  readonly kind?: ArchiveEntryKind;
  readonly name: string;
  readonly size?: number;
}

interface FixturePayload {
  readonly actionRecords: readonly Record<string, unknown>[];
  readonly auditRecords: readonly Record<string, unknown>[];
  readonly entries: readonly ArchiveEntryFixture[];
  readonly manifest: Record<string, unknown>;
  readonly sourceText: string;
}

const ARCHIVE_WRITER = String.raw`
import base64
import io
import json
import os
import stat
import sys
import tarfile
import zipfile

configuration = json.loads(base64.b64decode(sys.argv[1]).decode("utf-8"))

def payload(entry):
    if "fillByte" in entry:
        return bytes([entry["fillByte"]]) * entry["size"]
    return base64.b64decode(entry.get("content", ""))

if configuration["format"] == "zip":
    with zipfile.ZipFile(configuration["outputPath"], "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for entry in configuration["entries"]:
            info = zipfile.ZipInfo(entry["name"])
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            kind = entry.get("kind", "regular")
            if kind == "directory":
                info.external_attr = (stat.S_IFDIR | 0o700) << 16
            elif kind == "symlink":
                info.external_attr = (stat.S_IFLNK | 0o700) << 16
            else:
                info.external_attr = (stat.S_IFREG | 0o600) << 16
            archive.writestr(info, payload(entry))
else:
    with tarfile.open(configuration["outputPath"], "w:gz") as archive:
        for entry in configuration["entries"]:
            content = payload(entry)
            info = tarfile.TarInfo(entry["name"])
            kind = entry.get("kind", "regular")
            if kind == "regular":
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
            elif kind == "directory":
                info.type = tarfile.DIRTYPE
                archive.addfile(info)
            elif kind == "symlink":
                info.type = tarfile.SYMTYPE
                info.linkname = "manifest.json"
                archive.addfile(info)
            elif kind == "hardlink":
                info.type = tarfile.LNKTYPE
                info.linkname = "manifest.json"
                archive.addfile(info)
            elif kind == "character":
                info.type = tarfile.CHRTYPE
                info.devmajor = 1
                info.devminor = 3
                archive.addfile(info)
            elif kind == "fifo":
                info.type = tarfile.FIFOTYPE
                archive.addfile(info)
            elif kind == "sparse":
                info.type = tarfile.GNUTYPE_SPARSE
                archive.addfile(info)
`;

function createTemporaryDirectory(prefix = 'gpt-voice-diagnostics-skill-'): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMPORARY_DIRECTORIES.push(directory);
  return directory;
}

function sha256(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function createAuditRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    occurredAt: OCCURRED_AT,
    family: 'translation',
    providerId: 'google',
    operation: 'translate',
    operationId: OPERATION_ID,
    sequence: 1,
    event: 'started',
    phase: 'validation',
    outcome: 'in-progress',
    contractVersion: '2026-07-25',
    providerKnown: true,
    sourceLength: 42,
    targetLanguage: 'en',
    ...overrides,
  };
}

function createActionRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const sourceText = `${PRIVATE_TEXT_CANARY} ${PRIVATE_URL_CANARY} ${PRIVATE_SECRET_CANARY} ${'x'.repeat(260)}`;
  const resultText = 'validated result';
  const sourceBytes = Buffer.byteLength(sourceText, 'utf8');
  const resultBytes = Buffer.byteLength(resultText, 'utf8');
  return {
    actionId: ACTION_ID,
    actionType: 'translation',
    contractVersion: '2026-07-25',
    providerId: 'google',
    providerOperationId: OPERATION_ID,
    recordedAt: OCCURRED_AT,
    redactionCount: 1,
    redactorVersion: 1,
    resultBytes,
    resultText,
    retainedBytes: sourceBytes + resultBytes,
    schemaVersion: 1,
    sourceBytes,
    sourceKind: 'provider',
    sourceText,
    targetLanguage: 'en',
    ...overrides,
  };
}

function createProviderManifest(
  registeredProviderIds: readonly string[],
  selectedProviderId: string,
): Record<string, unknown> {
  return {
    capabilityAvailable: true,
    configured: true,
    readinessKnown: true,
    ready: true,
    registeredProviderIds,
    selectedProviderId,
  };
}

function createFixturePayload(
  options: {
    actionRecords?: readonly Record<string, unknown>[] | null;
    auditRecords?: readonly Record<string, unknown>[];
    manifestMutation?: (manifest: Record<string, unknown>) => void;
    rawActionPayload?: Buffer;
    rawAuditPayload?: Buffer;
  } = {},
): FixturePayload {
  const auditRecords = options.auditRecords ?? [createAuditRecord()];
  const actionRecords = options.actionRecords === undefined ? [createActionRecord()] : (options.actionRecords ?? []);
  const auditPayload =
    options.rawAuditPayload ?? Buffer.from(`${auditRecords.map((record) => JSON.stringify(record)).join('\n')}\n`);
  const includesActions = options.actionRecords !== null || options.rawActionPayload !== undefined;
  const actionPayload = includesActions
    ? (options.rawActionPayload ?? Buffer.from(`${actionRecords.map((record) => JSON.stringify(record)).join('\n')}\n`))
    : null;
  const retainedBytes = actionRecords.reduce((total, record) => total + Number(record.retainedBytes ?? 0), 0);
  const categories = [...new Set(actionRecords.map((record) => String(record.actionType)))].filter((category) =>
    ['translation', 'prettify'].includes(category),
  );
  const manifest: Record<string, unknown> = {
    appVersion: '1.4.0',
    archiveId: ARCHIVE_ID,
    audit: {
      duplicateRecordCount: 0,
      invalidRecordCount: 0,
      validRecordCount: auditRecords.length,
    },
    captureSettings: {
      captureTranslationDiagnostics: actionRecords.some((record) => record.actionType === 'translation'),
      capturePrettifyDiagnostics: actionRecords.some((record) => record.actionType === 'prettify'),
    },
    createdAt: OCCURRED_AT,
    diagnostics:
      actionPayload === null
        ? {
            includedCategories: [],
            recordCount: 0,
            recordedAtRange: null,
            retainedBytes: 0,
          }
        : {
            includedCategories: categories,
            recordCount: actionRecords.length,
            recordedAtRange:
              actionRecords.length === 0
                ? null
                : {
                    from: actionRecords[0].recordedAt,
                    to: actionRecords[actionRecords.length - 1]?.recordedAt,
                  },
            retainedBytes,
          },
    members: [
      {
        byteLength: auditPayload.byteLength,
        name: 'provider-audit/events.jsonl',
        sha256: sha256(auditPayload),
      },
      ...(actionPayload === null
        ? []
        : [
            {
              byteLength: actionPayload.byteLength,
              name: 'diagnostics/text-actions.jsonl',
              sha256: sha256(actionPayload),
            },
          ]),
    ],
    platform: {
      architecture: 'x64',
      family: 'linux',
    },
    providers: {
      voice: createProviderManifest(['chatgpt', 'openai-api', 'claude-web'], 'chatgpt'),
      prettify: createProviderManifest(['ollama', 'vllm', 'claude-cli', 'codex-cli'], 'ollama'),
      translation: createProviderManifest(['google', 'bing', 'yandex'], 'google'),
    },
    runtimeVersions: {
      cloakBrowser: '0.4.12',
      electron: '43.1.1',
      node: '24.0.0',
      playwright: '1.61.1',
    },
    schemaVersion: 1,
    schemaVersions: {
      database: 2,
      diagnosticRow: 1,
      providerAudit: 1,
      redactor: 1,
    },
    sensitivity: {
      containsDiagnosticText: actionPayload !== null,
      warning: actionPayload === null ? null : SENSITIVITY_WARNING,
    },
  };
  options.manifestMutation?.(manifest);
  const manifestPayload = Buffer.from(JSON.stringify(manifest));
  const entries: ArchiveEntryFixture[] = [
    { content: manifestPayload, name: 'manifest.json' },
    { content: auditPayload, name: 'provider-audit/events.jsonl' },
  ];
  if (actionPayload !== null) {
    entries.push({ content: actionPayload, name: 'diagnostics/text-actions.jsonl' });
  }
  return {
    actionRecords,
    auditRecords,
    entries,
    manifest,
    sourceText: String(actionRecords[0]?.sourceText ?? ''),
  };
}

async function runPython(
  arguments_: readonly string[],
  environment: Readonly<Record<string, string>> = {},
): Promise<PythonExecution> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', arguments_, {
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
        ...environment,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? -1, stderr, stdout });
    });
  });
}

async function writeArchive(
  format: ArchiveFormat,
  outputPath: string,
  entries: readonly ArchiveEntryFixture[],
): Promise<void> {
  const configuration = Buffer.from(
    JSON.stringify({
      entries: entries.map((entry) => ({
        ...(entry.content === undefined ? {} : { content: entry.content.toString('base64') }),
        ...(entry.fillByte === undefined ? {} : { fillByte: entry.fillByte }),
        ...(entry.kind === undefined ? {} : { kind: entry.kind }),
        ...(entry.size === undefined ? {} : { size: entry.size }),
        name: entry.name,
      })),
      format,
      outputPath,
    }),
  ).toString('base64');
  const execution = await runPython(['-c', ARCHIVE_WRITER, configuration]);
  assert.equal(execution.exitCode, 0, execution.stderr);
}

async function runInspector(
  archivePath: string,
  command: 'inspect' | 'excerpt' = 'inspect',
  extraArguments: readonly string[] = [],
  temporaryRoot?: string,
): Promise<PythonExecution> {
  return runPython(
    [INSPECTOR_PATH, command, '--archive', archivePath, ...extraArguments],
    temporaryRoot === undefined ? {} : { TMPDIR: temporaryRoot },
  );
}

function parseOutput(execution: PythonExecution): Record<string, unknown> {
  assert.ok(execution.stdout.trim());
  return JSON.parse(execution.stdout) as Record<string, unknown>;
}

async function runModuleProbe(expression: string): Promise<PythonExecution> {
  const probe = String.raw`
import importlib.util
import sys

specification = importlib.util.spec_from_file_location("diagnostics_inspector", sys.argv[1])
module = importlib.util.module_from_spec(specification)
sys.modules[specification.name] = module
specification.loader.exec_module(module)
try:
    exec(sys.argv[2], {"module": module})
except module.InspectionError as error:
    print(error.code)
    sys.exit(2)
print("ok")
`;
  return runPython(['-c', probe, INSPECTOR_PATH, expression]);
}

afterEach(() => {
  for (const directory of TEMPORARY_DIRECTORIES) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
  TEMPORARY_DIRECTORIES.length = 0;
});

describe('analyze diagnostics archive skill', () => {
  it('validates equivalent schema-v1 ZIP and tar.gz archives without retaining diagnostic text', async () => {
    const fixture = createFixturePayload();
    const normalizedResults: Record<string, unknown>[] = [];

    for (const [format, filename] of [
      ['zip', 'diagnostics.tar.gz'],
      ['tar-gzip', 'diagnostics.zip'],
    ] as const) {
      const directory = createTemporaryDirectory();
      const extractionRoot = path.join(directory, 'temporary-extraction');
      fs.mkdirSync(extractionRoot);
      const archivePath = path.join(directory, filename);
      await writeArchive(format, archivePath, fixture.entries);

      const execution = await runInspector(archivePath, 'inspect', [], extractionRoot);
      assert.equal(execution.exitCode, 0, execution.stderr);
      assert.equal(execution.stderr, '');
      assert.deepEqual(fs.readdirSync(extractionRoot), []);
      assert.equal(execution.stdout.includes(fixture.sourceText), false);
      assert.equal(execution.stdout.includes(PRIVATE_URL_CANARY), false);
      assert.equal(execution.stdout.includes(PRIVATE_SECRET_CANARY), false);

      const output = parseOutput(execution);
      assert.equal(output.status, 'validated');
      const archive = output.archive as Record<string, unknown>;
      assert.equal(archive.archiveId, ARCHIVE_ID);
      assert.equal(archive.format, format);
      assert.equal(archive.defaultReportPath, `.artifacts/diagnostics/${ARCHIVE_ID}/report.md`);
      const diagnostics = output.diagnostics as Record<string, unknown>;
      const actions = diagnostics.actions as Record<string, unknown>[];
      assert.equal(actions.length, 1);
      assert.equal('sourceText' in actions[0], false);
      assert.equal('resultText' in actions[0], false);
      assert.deepEqual(actions[0].evidence, {
        line: 1,
        member: 'diagnostics/text-actions.jsonl',
      });
      const audit = output.audit as Record<string, unknown>;
      const events = audit.events as Record<string, unknown>[];
      assert.equal(events[0].operationId, OPERATION_ID);
      assert.deepEqual(events[0].evidence, {
        line: 1,
        member: 'provider-audit/events.jsonl',
      });
      normalizedResults.push(output);
    }

    assert.deepEqual(
      (normalizedResults[0].audit as Record<string, unknown>).events,
      (normalizedResults[1].audit as Record<string, unknown>).events,
    );
  });

  it('returns only one explicitly requested, redacted excerpt capped at 200 characters', async () => {
    const directory = createTemporaryDirectory();
    const archivePath = path.join(directory, 'diagnostics.zip');
    const fixture = createFixturePayload();
    await writeArchive('zip', archivePath, fixture.entries);

    const execution = await runInspector(archivePath, 'excerpt', ['--action-id', ACTION_ID, '--field', 'source']);
    assert.equal(execution.exitCode, 0, execution.stderr);
    const output = parseOutput(execution);
    const excerpt = String(output.excerpt);
    assert.equal(output.status, 'validated-excerpt');
    assert.ok(excerpt.length <= 200);
    assert.equal(output.excerptCharacters, excerpt.length);
    assert.equal(excerpt.includes(PRIVATE_URL_CANARY), false);
    assert.equal(excerpt.includes(PRIVATE_SECRET_CANARY), false);
    assert.equal(excerpt.includes('[REDACTED_URL]'), true);
    assert.equal(excerpt.includes('[REDACTED]'), true);
    assert.equal(excerpt === fixture.sourceText, false);
    assert.equal(String(output.warning).includes('can miss'), true);

    const missing = await runInspector(archivePath, 'excerpt', [
      '--action-id',
      '00000000-0000-4000-8000-000000000199',
      '--field',
      'result',
    ]);
    assert.equal(missing.exitCode, 2);
    assert.equal(parseOutput(missing).code, 'action-not-found');
    assert.equal(missing.stdout.includes(fixture.sourceText), false);
  });

  it('rejects unsafe paths, duplicate or unexpected members, and missing required members', async () => {
    const fixture = createFixturePayload({ actionRecords: null });
    const cases: readonly {
      readonly code: string;
      readonly entries: readonly ArchiveEntryFixture[];
      readonly name: string;
    }[] = [
      {
        code: 'unsafe-member-path',
        entries: [...fixture.entries, { content: Buffer.alloc(0), name: '../private.txt' }],
        name: 'traversal',
      },
      {
        code: 'unsafe-member-path',
        entries: [...fixture.entries, { content: Buffer.alloc(0), name: '/private.txt' }],
        name: 'absolute',
      },
      {
        code: 'unsafe-member-path',
        entries: [...fixture.entries, { content: Buffer.alloc(0), name: 'C:/private.txt' }],
        name: 'drive',
      },
      {
        code: 'unsafe-member-path',
        entries: [...fixture.entries, { content: Buffer.alloc(0), name: '\\\\server\\private.txt' }],
        name: 'unc',
      },
      {
        code: 'unsafe-member-path',
        entries: [...fixture.entries, { content: Buffer.alloc(0), name: '..\\private.txt' }],
        name: 'backslash',
      },
      {
        code: 'duplicate-member',
        entries: [...fixture.entries, fixture.entries[0]],
        name: 'duplicate',
      },
      {
        code: 'unexpected-member',
        entries: [...fixture.entries, { content: Buffer.alloc(0), name: 'private.txt' }],
        name: 'unexpected',
      },
      {
        code: 'missing-member',
        entries: [fixture.entries[0]],
        name: 'missing',
      },
    ];

    for (const testCase of cases) {
      const directory = createTemporaryDirectory();
      const archivePath = path.join(directory, `${testCase.name}.zip`);
      await writeArchive('zip', archivePath, testCase.entries);
      const execution = await runInspector(archivePath);
      assert.equal(execution.exitCode, 2, testCase.name);
      assert.equal(parseOutput(execution).code, testCase.code, testCase.name);
      assert.equal(execution.stdout.includes(archivePath), false);
    }
  });

  it('rejects links, directories, devices, FIFOs, and ZIP symlinks as unsupported member types', async () => {
    const fixture = createFixturePayload({ actionRecords: null });
    for (const kind of ['directory', 'symlink', 'hardlink', 'character', 'fifo', 'sparse'] as const) {
      const directory = createTemporaryDirectory();
      const archivePath = path.join(directory, `${kind}.tar.gz`);
      await writeArchive('tar-gzip', archivePath, [{ ...fixture.entries[0], kind }, fixture.entries[1]]);
      const execution = await runInspector(archivePath);
      assert.equal(execution.exitCode, 2, kind);
      assert.equal(parseOutput(execution).code, 'unsupported-member-type', kind);
    }

    const directory = createTemporaryDirectory();
    const archivePath = path.join(directory, 'symlink.zip');
    await writeArchive('zip', archivePath, [{ ...fixture.entries[0], kind: 'symlink' }, fixture.entries[1]]);
    const execution = await runInspector(archivePath);
    assert.equal(execution.exitCode, 2);
    assert.equal(parseOutput(execution).code, 'unsupported-member-type');
  });

  it('rejects signatures, unsupported schemas, hashes, malformed JSON/JSONL, and invalid records safely', async () => {
    const cases: readonly {
      readonly code: string;
      readonly fixture: FixturePayload;
      readonly name: string;
    }[] = [
      {
        code: 'malformed-json',
        fixture: (() => {
          const fixture = createFixturePayload();
          return {
            ...fixture,
            entries: [
              { content: Buffer.from('{"schemaVersion":1'), name: 'manifest.json' },
              ...fixture.entries.slice(1),
            ],
          };
        })(),
        name: 'malformed-manifest',
      },
      {
        code: 'unsupported-schema',
        fixture: createFixturePayload({
          manifestMutation: (manifest) => {
            manifest.schemaVersion = 2;
          },
        }),
        name: 'unsupported-schema',
      },
      {
        code: 'hash-mismatch',
        fixture: createFixturePayload({
          manifestMutation: (manifest) => {
            const members = manifest.members as Record<string, unknown>[];
            members[0].sha256 = '0'.repeat(64);
          },
        }),
        name: 'hash',
      },
      {
        code: 'malformed-jsonl',
        fixture: createFixturePayload({
          auditRecords: [createAuditRecord()],
          rawAuditPayload: Buffer.from(`{"private":"${PRIVATE_TEXT_CANARY}"`),
        }),
        name: 'malformed-jsonl',
      },
      {
        code: 'invalid-audit-record',
        fixture: createFixturePayload({
          auditRecords: [createAuditRecord({ providerId: 'private-provider' })],
        }),
        name: 'audit-schema',
      },
      {
        code: 'invalid-audit-record',
        fixture: createFixturePayload({
          auditRecords: [createAuditRecord({ causeCode: 'provider-private-error' })],
        }),
        name: 'audit-cause',
      },
      {
        code: 'invalid-audit-record',
        fixture: createFixturePayload({
          auditRecords: [createAuditRecord({ privateMetadata: PRIVATE_TEXT_CANARY })],
        }),
        name: 'audit-metadata',
      },
      {
        code: 'invalid-action-record',
        fixture: createFixturePayload({
          actionRecords: [createActionRecord({ endpoint: PRIVATE_URL_CANARY })],
        }),
        name: 'action-schema',
      },
      {
        code: 'invalid-action-record',
        fixture: createFixturePayload({
          actionRecords: [createActionRecord({ targetLanguage: 'private-language' })],
        }),
        name: 'action-language',
      },
    ];

    for (const testCase of cases) {
      const directory = createTemporaryDirectory();
      const archivePath = path.join(directory, `${testCase.name}.tar.gz`);
      await writeArchive('tar-gzip', archivePath, testCase.fixture.entries);
      const extractionRoot = path.join(directory, 'temporary-extraction');
      fs.mkdirSync(extractionRoot);
      const execution = await runInspector(archivePath, 'inspect', [], extractionRoot);
      assert.equal(execution.exitCode, 2, testCase.name);
      assert.equal(parseOutput(execution).code, testCase.code, testCase.name);
      assert.deepEqual(fs.readdirSync(extractionRoot), []);
      assert.equal(execution.stdout.includes(PRIVATE_TEXT_CANARY), false);
      assert.equal(execution.stdout.includes(PRIVATE_URL_CANARY), false);
      assert.equal(execution.stdout.includes(archivePath), false);
    }

    const directory = createTemporaryDirectory();
    const archivePath = path.join(directory, 'invalid-signature.zip');
    fs.writeFileSync(archivePath, `not-an-archive-${PRIVATE_TEXT_CANARY}`);
    const execution = await runInspector(archivePath);
    assert.equal(execution.exitCode, 2);
    assert.equal(parseOutput(execution).code, 'invalid-signature');
    assert.equal(execution.stdout.includes(PRIVATE_TEXT_CANARY), false);
  });

  it('rejects duplicate audit keys and action IDs and manifest evidence contradictions', async () => {
    const cases: readonly { readonly code: string; readonly fixture: FixturePayload; readonly name: string }[] = [
      {
        code: 'duplicate-audit-record',
        fixture: createFixturePayload({
          auditRecords: [createAuditRecord(), createAuditRecord()],
        }),
        name: 'duplicate-audit',
      },
      {
        code: 'duplicate-action-record',
        fixture: createFixturePayload({
          actionRecords: [createActionRecord(), createActionRecord()],
        }),
        name: 'duplicate-action',
      },
      {
        code: 'manifest-contradiction',
        fixture: createFixturePayload({
          manifestMutation: (manifest) => {
            (manifest.audit as Record<string, unknown>).validRecordCount = 2;
          },
        }),
        name: 'summary-contradiction',
      },
    ];

    for (const testCase of cases) {
      const directory = createTemporaryDirectory();
      const archivePath = path.join(directory, `${testCase.name}.zip`);
      await writeArchive('zip', archivePath, testCase.fixture.entries);
      const execution = await runInspector(archivePath);
      assert.equal(execution.exitCode, 2, testCase.name);
      assert.equal(parseOutput(execution).code, testCase.code, testCase.name);
    }
  });

  it('enforces all approved bounds while accepting their exact boundaries', async () => {
    const exactBoundaries = await runModuleProbe(
      [
        'module.validate_limit_snapshot(',
        '(module.MAX_MEMBER_BYTES, module.MAX_MEMBER_BYTES),',
        '(module.MAX_MEMBER_BYTES, module.MAX_MEMBER_BYTES))',
        '; assert module.compression_ratio_exceeded(2_000_000, 2_000) is False',
        '; module.validate_jsonl_bound_snapshot(module.MAX_JSONL_LINE_BYTES, module.MAX_JSONL_RECORDS)',
        '; module.validate_observed_size(123, 123)',
      ].join(''),
    );
    assert.equal(exactBoundaries.exitCode, 0, exactBoundaries.stderr);
    assert.equal(exactBoundaries.stdout.trim(), 'ok');

    const failures = [
      {
        code: 'limit-exceeded',
        expression: 'module.validate_limit_snapshot((module.MAX_MEMBER_BYTES + 1,), (module.MAX_MEMBER_BYTES + 1,))',
      },
      {
        code: 'limit-exceeded',
        expression:
          'module.validate_limit_snapshot((module.MAX_MEMBER_BYTES, module.MAX_MEMBER_BYTES, 1), (module.MAX_MEMBER_BYTES, module.MAX_MEMBER_BYTES, 1))',
      },
      {
        code: 'suspicious-compression',
        expression: 'module.validate_limit_snapshot((2_000_000,), (1_999,))',
      },
      {
        code: 'limit-exceeded',
        expression: 'module.validate_jsonl_bound_snapshot(module.MAX_JSONL_LINE_BYTES + 1, module.MAX_JSONL_RECORDS)',
      },
      {
        code: 'limit-exceeded',
        expression: 'module.validate_jsonl_bound_snapshot(module.MAX_JSONL_LINE_BYTES, module.MAX_JSONL_RECORDS + 1)',
      },
      {
        code: 'size-mismatch',
        expression: 'module.validate_observed_size(123, 122)',
      },
    ] as const;
    for (const failure of failures) {
      const execution = await runModuleProbe(failure.expression);
      assert.equal(execution.exitCode, 2, failure.expression);
      assert.equal(execution.stdout.trim(), failure.code, failure.expression);
    }

    for (const [format, size] of [
      ['zip', 1024 * 1024],
      ['tar-gzip', 2 * 1024 * 1024],
    ] as const) {
      const directory = createTemporaryDirectory();
      const archivePath = path.join(directory, `compression-bomb-${format}`);
      const auditPayload = Buffer.alloc(size);
      const fixture = createFixturePayload({
        actionRecords: null,
        rawAuditPayload: auditPayload,
      });
      await writeArchive(format, archivePath, [
        fixture.entries[0],
        {
          fillByte: 0,
          name: 'provider-audit/events.jsonl',
          size: auditPayload.byteLength,
        },
      ]);
      const execution = await runInspector(archivePath);
      assert.equal(execution.exitCode, 2, format);
      assert.equal(parseOutput(execution).code, 'suspicious-compression', format);
    }
  });

  it('supports a synthetic evidence-linked report at the validated default path', async () => {
    const directory = createTemporaryDirectory();
    const archivePath = path.join(directory, 'diagnostics.tar.gz');
    const fixture = createFixturePayload();
    await writeArchive('tar-gzip', archivePath, fixture.entries);
    const execution = await runInspector(archivePath);
    assert.equal(execution.exitCode, 0, execution.stderr);
    const output = parseOutput(execution);
    const archive = output.archive as Record<string, unknown>;
    const reportPath = path.join(directory, String(archive.defaultReportPath));
    const report = `# GPT-Voice Diagnostics Incident Report

## Incident Context

- Issue: Translation produced no visible result.
- Expected: The translated text should be returned.
- Observed: The request appeared to stop.
- Approximate occurrence time: ${OCCURRED_AT}

## Archive and Integrity Validation

Validated schema version 1 and all hashes (manifest.json schemaVersion).

## Environment and Providers

Translation selected Google (manifest.json providers.translation.selectedProviderId).

## Correlated Timeline

- Validation started (provider-audit/events.jsonl:line 1, operationId ${OPERATION_ID}, sequence 1).

## Root Cause Assessment

1. Low confidence — the retained event has no terminal cause, so the root cause is not established
   (provider-audit/events.jsonl:line 1, operationId ${OPERATION_ID}, sequence 1).

## Transformation Findings

The retained action correlates to the operation, but no text is reproduced
(diagnostics/text-actions.jsonl:line 1, actionId ${ACTION_ID}).

## Contradictions, Missing Evidence, and Limitations

The terminal event is missing; best-effort redaction may miss arbitrary secrets
(manifest.json audit.validRecordCount).

## Recommended Next Checks

Inspect the Translation lifecycle around validation without calling a live provider
(provider-audit/events.jsonl:line 1, operationId ${OPERATION_ID}, sequence 1).

## Privacy Notice

Treat the archive and report as sensitive. No full retained text is included.
`;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report, { mode: 0o600 });

    assert.equal(reportPath, path.join(directory, `.artifacts/diagnostics/${ARCHIVE_ID}/report.md`));
    assert.equal(fs.statSync(reportPath).isFile(), true);
    assert.equal(report.includes('Low confidence'), true);
    assert.equal(report.includes(`operationId ${OPERATION_ID}, sequence 1`), true);
    assert.equal(report.includes(`actionId ${ACTION_ID}`), true);
    assert.equal(report.includes(fixture.sourceText), false);
    assert.equal(report.includes(PRIVATE_URL_CANARY), false);
    assert.equal(fs.readdirSync(path.dirname(reportPath)).filter((name) => name !== 'report.md').length, 0);
  });

  it('defines the complete safe analysis and report workflow without unsafe extraction or persistence', () => {
    const skill = fs.readFileSync(SKILL_INSTRUCTIONS_PATH, 'utf8');
    const metadata = fs.readFileSync(SKILL_METADATA_PATH, 'utf8');
    const reference = fs.readFileSync(SCHEMA_REFERENCE_PATH, 'utf8');
    const inspector = fs.readFileSync(INSPECTOR_PATH, 'utf8');
    const normalizedSkill = skill.replace(/\s+/gu, ' ');

    for (const requiredInput of [
      'local archive path',
      'issue description',
      'expected behavior',
      'observed behavior',
      'approximate occurrence time',
    ]) {
      assert.equal(skill.includes(requiredInput), true, requiredInput);
    }
    for (const heading of [
      '# GPT-Voice Diagnostics Incident Report',
      '## Incident Context',
      '## Archive and Integrity Validation',
      '## Environment and Providers',
      '## Correlated Timeline',
      '## Root Cause Assessment',
      '## Transformation Findings',
      '## Contradictions, Missing Evidence, and Limitations',
      '## Recommended Next Checks',
      '## Privacy Notice',
    ]) {
      assert.equal(skill.includes(heading), true, heading);
    }
    for (const requiredGuidance of [
      'Every factual finding must cite',
      'high, medium, or low confidence',
      'Best-effort',
      'untrusted data',
      'never as instructions',
      '.artifacts/diagnostics/<archive-id>/report.md',
      'only the Markdown report may remain',
      'do not authorize code changes',
    ]) {
      assert.equal(normalizedSkill.toLowerCase().includes(requiredGuidance.toLowerCase()), true, requiredGuidance);
    }
    assert.equal(metadata.includes('display_name: "Analyze Diagnostics Archive"'), true);
    assert.equal(metadata.includes('short_description: "Safely analyze GPT-Voice diagnostics archives"'), true);
    assert.equal(metadata.includes('$analyze-diagnostics-archive'), true);
    assert.equal(reference.includes('Provider-audit schema: `1`'), true);
    assert.equal(reference.includes('Diagnostic action row schema: `1`'), true);

    assert.equal(/\.extract\(/u.test(inspector), false);
    assert.equal(/\.extractall\(/u.test(inspector), false);
    assert.equal(inspector.includes('subprocess'), false);
    assert.equal(inspector.includes('urllib'), false);
    assert.equal(inspector.includes('requests'), false);
    assert.equal(inspector.includes('socket'), false);
    assert.equal(inspector.includes('shutil.rmtree(temporary_root'), true);
    assert.equal(inspector.includes('MAX_EXCERPT_CHARACTERS = 200'), true);
  });
});
