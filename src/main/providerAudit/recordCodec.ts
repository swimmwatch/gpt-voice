import {
  PROVIDER_AUDIT_LABEL,
  PROVIDER_AUDIT_METADATA_KEYS,
  PROVIDER_AUDIT_SCHEMA_VERSION,
  type ProviderAuditMetadataKey,
  type ProviderAuditRecord,
  isProviderAuditEvent,
  isProviderAuditFamily,
  isProviderAuditOutcome,
  isProviderAuditPhase,
  validateProviderAuditMetadata,
} from './contracts';
import { isProviderAuditCauseCode, isProviderAuditOperation, isProviderAuditProviderId } from './mappings';

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PROVIDER_AUDIT_REQUIRED_KEYS = [
  'schemaVersion',
  'occurredAt',
  'family',
  'operation',
  'operationId',
  'sequence',
  'event',
  'phase',
  'outcome',
] as const;
const PROVIDER_AUDIT_RECORD_KEY_SET = new Set<string>([
  ...PROVIDER_AUDIT_REQUIRED_KEYS,
  'providerId',
  ...PROVIDER_AUDIT_METADATA_KEYS,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function getMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const key of PROVIDER_AUDIT_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) metadata[key] = value[key];
  }
  return metadata;
}

export function isProviderAuditRecord(value: unknown): value is ProviderAuditRecord {
  if (!isRecord(value)) return false;
  const family = value.family;
  if (
    Object.keys(value).some((key) => !PROVIDER_AUDIT_RECORD_KEY_SET.has(key)) ||
    PROVIDER_AUDIT_REQUIRED_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    value.schemaVersion !== PROVIDER_AUDIT_SCHEMA_VERSION ||
    !isCanonicalTimestamp(value.occurredAt) ||
    !isProviderAuditFamily(family) ||
    !isProviderAuditOperation(family, value.operation) ||
    typeof value.operationId !== 'string' ||
    !CANONICAL_UUID_PATTERN.test(value.operationId) ||
    typeof value.sequence !== 'number' ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence <= 0 ||
    !isProviderAuditEvent(value.event) ||
    !isProviderAuditPhase(value.phase) ||
    !isProviderAuditOutcome(value.outcome)
  ) {
    return false;
  }

  const providerKnown = value.providerKnown;
  if (value.providerId === undefined) {
    if (providerKnown !== false) return false;
  } else if (!isProviderAuditProviderId(family, value.providerId) || providerKnown === false) {
    return false;
  }

  const metadata = validateProviderAuditMetadata(getMetadata(value), (candidate) =>
    isProviderAuditCauseCode(family, candidate),
  );
  return metadata !== null;
}

export function serializeProviderAuditRecord(record: ProviderAuditRecord): string | null {
  if (!isProviderAuditRecord(record)) return null;
  const metadata = validateProviderAuditMetadata(
    getMetadata(record as unknown as Record<string, unknown>),
    (candidate) => isProviderAuditCauseCode(record.family, candidate),
  );
  if (!metadata) return null;

  const canonical: Record<string, unknown> = {
    schemaVersion: record.schemaVersion,
    occurredAt: record.occurredAt,
    family: record.family,
  };
  if (record.providerId !== undefined) canonical.providerId = record.providerId;
  canonical.operation = record.operation;
  canonical.operationId = record.operationId;
  canonical.sequence = record.sequence;
  canonical.event = record.event;
  canonical.phase = record.phase;
  canonical.outcome = record.outcome;

  for (const key of Object.keys(metadata).sort() as ProviderAuditMetadataKey[]) {
    canonical[key] = metadata[key];
  }

  const serialized = JSON.stringify(canonical);
  return serialized.includes('\n') || serialized.includes('\r') ? null : serialized;
}

export function parseCanonicalProviderAuditRecord(value: string): ProviderAuditRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isProviderAuditRecord(parsed)) return null;
    return serializeProviderAuditRecord(parsed) === value ? parsed : null;
  } catch {
    return null;
  }
}

export { PROVIDER_AUDIT_LABEL };
