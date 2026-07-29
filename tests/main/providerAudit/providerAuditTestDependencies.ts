import type { ProviderAuditDependencies } from '@main/providerAudit';

export const TEST_PROVIDER_AUDIT_OPERATION_ID = '00000000-0000-4000-8000-000000000099';
export const TEST_PROVIDER_AUDIT_OCCURRED_AT = '2026-07-27T12:00:00.000Z';

export const TEST_PROVIDER_AUDIT_DEPENDENCIES: ProviderAuditDependencies = Object.freeze({
  elapsedNow: () => 1_000,
  getSink: () => null,
  now: () => new Date(TEST_PROVIDER_AUDIT_OCCURRED_AT),
  randomUUID: () => TEST_PROVIDER_AUDIT_OPERATION_ID,
});
