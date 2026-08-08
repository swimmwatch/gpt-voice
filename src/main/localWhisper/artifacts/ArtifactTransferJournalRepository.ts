import { toLocalWhisperArtifactId, toLocalWhisperRevisionId, type LocalWhisperArtifactId } from '@shared/localWhisper';

import {
  ARTIFACT_TRANSFER_JOURNAL_SCHEMA_VERSION,
  type ArtifactTransferJournal,
  type ArtifactTransferJournalStore,
  type LocalWhisperArtifactDownloadSpec,
  type LocalWhisperArtifactOperationId,
} from './ArtifactLifecycleTypes';

const JOURNAL_KEYS = [
  'schemaVersion',
  'operationId',
  'artifactId',
  'catalogRevision',
  'catalogDigest',
  'expectedLength',
  'expectedSha256',
  'originId',
  'receivedLength',
  'serverValidator',
  'spoolId',
  'state',
  'createdAtMs',
  'updatedAtMs',
] as const;
const SAFE_TOKEN_PATTERN = /^[\w-]{16,128}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const STRONG_ETAG_PATTERN = /^"[\x21\x23-\x7e]{1,510}"$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === JOURNAL_KEYS.length && keys.every((key) => JOURNAL_KEYS.includes(key as never));
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isStrongArtifactValidator(value: unknown): value is string {
  return typeof value === 'string' && STRONG_ETAG_PATTERN.test(value) && !value.startsWith('W/');
}

function parseJournal(value: unknown): ArtifactTransferJournal | null {
  if (!isRecord(value) || !hasExactKeys(value)) return null;
  const artifactId = toLocalWhisperArtifactId(value.artifactId);
  const originId = toLocalWhisperArtifactId(value.originId);
  const catalogRevision = toLocalWhisperRevisionId(value.catalogRevision);
  if (
    value.schemaVersion !== ARTIFACT_TRANSFER_JOURNAL_SCHEMA_VERSION ||
    !artifactId ||
    !originId ||
    !catalogRevision ||
    typeof value.operationId !== 'string' ||
    !SAFE_TOKEN_PATTERN.test(value.operationId) ||
    typeof value.spoolId !== 'string' ||
    !SAFE_TOKEN_PATTERN.test(value.spoolId) ||
    typeof value.catalogDigest !== 'string' ||
    !SHA256_PATTERN.test(value.catalogDigest) ||
    typeof value.expectedSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.expectedSha256) ||
    !isSafeInteger(value.expectedLength) ||
    value.expectedLength <= 0 ||
    !isSafeInteger(value.receivedLength) ||
    value.receivedLength > value.expectedLength ||
    (value.serverValidator !== null && !isStrongArtifactValidator(value.serverValidator)) ||
    (value.state !== 'Downloading' && value.state !== 'Resumable') ||
    !isSafeInteger(value.createdAtMs) ||
    !isSafeInteger(value.updatedAtMs) ||
    value.updatedAtMs < value.createdAtMs
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: ARTIFACT_TRANSFER_JOURNAL_SCHEMA_VERSION,
    operationId: value.operationId,
    artifactId,
    catalogRevision,
    catalogDigest: value.catalogDigest,
    expectedLength: value.expectedLength,
    expectedSha256: value.expectedSha256,
    originId,
    receivedLength: value.receivedLength,
    serverValidator: value.serverValidator,
    spoolId: value.spoolId,
    state: value.state,
    createdAtMs: value.createdAtMs,
    updatedAtMs: value.updatedAtMs,
  });
}

function matchesSpec(journal: ArtifactTransferJournal, spec: LocalWhisperArtifactDownloadSpec): boolean {
  return (
    journal.artifactId === spec.artifactId &&
    journal.catalogRevision === spec.catalogRevision &&
    journal.catalogDigest === spec.descriptor.catalogDigest &&
    journal.expectedLength === spec.expectedTransferSizeBytes &&
    journal.expectedSha256 === spec.expectedTransferSha256 &&
    journal.originId === spec.originId
  );
}

export type ArtifactResumeClassification =
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid'; readonly safelyRemovable: false }
  | { readonly kind: 'invalid'; readonly safelyRemovable: true; readonly journal: ArtifactTransferJournal }
  | { readonly kind: 'resumable'; readonly journal: ArtifactTransferJournal };

/** Validates a private storage port and never grants authority from malformed journal data. */
export class ArtifactTransferJournalRepository {
  public constructor(private readonly store: ArtifactTransferJournalStore) {}

  public async create(
    spec: LocalWhisperArtifactDownloadSpec,
    operationId: LocalWhisperArtifactOperationId,
    nowMs: number,
  ): Promise<ArtifactTransferJournal> {
    const journal = Object.freeze({
      schemaVersion: ARTIFACT_TRANSFER_JOURNAL_SCHEMA_VERSION,
      operationId,
      artifactId: spec.artifactId,
      catalogRevision: spec.catalogRevision,
      catalogDigest: spec.descriptor.catalogDigest,
      expectedLength: spec.expectedTransferSizeBytes,
      expectedSha256: spec.expectedTransferSha256,
      originId: spec.originId,
      receivedLength: 0,
      serverValidator: null,
      spoolId: operationId,
      state: 'Downloading' as const,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    if (!parseJournal(journal)) throw new TypeError('Invalid Local Whisper artifact journal identity');
    await this.store.write(spec.artifactId, journal);
    return journal;
  }

  public async update(
    journal: ArtifactTransferJournal,
    update: {
      readonly operationId?: LocalWhisperArtifactOperationId;
      readonly receivedLength: number;
      readonly serverValidator: string | null;
      readonly state: 'Downloading' | 'Resumable';
      readonly updatedAtMs: number;
    },
  ): Promise<ArtifactTransferJournal> {
    const next = parseJournal({ ...journal, ...update });
    if (!next) throw new TypeError('Invalid Local Whisper artifact journal update');
    await this.store.write(next.artifactId, next);
    return next;
  }

  public async classifyResume(spec: LocalWhisperArtifactDownloadSpec): Promise<ArtifactResumeClassification> {
    const stored = await this.store.read(spec.artifactId);
    if (stored === null) return Object.freeze({ kind: 'missing' });
    const journal = parseJournal(stored);
    if (!journal) return Object.freeze({ kind: 'invalid', safelyRemovable: false });
    if (!matchesSpec(journal, spec)) return Object.freeze({ kind: 'invalid', safelyRemovable: true, journal });
    if (
      journal.receivedLength <= 0 ||
      journal.receivedLength >= journal.expectedLength ||
      !isStrongArtifactValidator(journal.serverValidator)
    ) {
      return Object.freeze({ kind: 'invalid', safelyRemovable: true, journal });
    }
    return Object.freeze({ kind: 'resumable', journal });
  }

  public async listSafe(): Promise<readonly ArtifactTransferJournal[]> {
    const journals = (await this.store.list()).map(parseJournal).filter((value) => value !== null);
    return Object.freeze(journals);
  }

  public async remove(artifactId: LocalWhisperArtifactId): Promise<void> {
    await this.store.remove(artifactId);
  }
}
