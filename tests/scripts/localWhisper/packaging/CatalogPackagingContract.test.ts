import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import { parseProductionApproval } from '@scripts/local-whisper/packaging/contracts';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

function repository(document: Uint8Array, purpose: 'fixture' | 'production' = 'fixture') {
  return new LocalWhisperCatalogRepository({
    readDocument: () => document,
    trustPolicy: { ...createFixtureCatalogTrustPolicy(), purpose },
  });
}

describe('Local Whisper signed catalog packaging contract', () => {
  it('binds authenticated payload purpose to the app-owned trust policy', () => {
    const document = signFixtureCatalog(createFixtureCatalogPayload());
    assert.equal(repository(document).load().success, true);
    assert.deepEqual(repository(document, 'production').load(), { success: false, code: 'CATALOG_INVALID' });
  });

  it('rejects duplicate envelope members without accepting a detached signature format', () => {
    const signed = signFixtureCatalog(createFixtureCatalogPayload());
    const text = Buffer.from(signed).toString('utf8');
    const duplicate = Buffer.from(text.replace('{', '{"schemaVersion":1,'), 'utf8');
    const detachedShape = Buffer.from(text.replace('"signatureBase64"', '"catalog.sig"'), 'utf8');
    assert.deepEqual(repository(duplicate).load(), { success: false, code: 'CATALOG_INVALID' });
    assert.deepEqual(repository(detachedShape).load(), { success: false, code: 'CATALOG_INVALID' });
  });

  it('requires complete frozen production approval metadata', () => {
    const approval = {
      schemaVersion: 1,
      purpose: 'production',
      approvalId: 'release-approval-v1',
      approvedAt: '2026-08-03T00:00:00.000Z',
      approvedBy: 'external-release-authority',
      originPolicyId: 'production-origin-policy-v1',
      licenseReviewId: 'redistribution-review-v1',
      redistributionApproved: true,
      frozenCatalogSha256: 'a'.repeat(64),
      approvedSourceLockIds: ['approved-source-lock-v1'],
      approvedToolchainProfileIds: ['approved-toolchain-v1'],
      approvedPackDefinitionIds: ['approved-pack-definition-v1'],
      approvedOriginIds: ['approved-origin-v1'],
      approvedSigningKeyIds: ['approved-signing-key-v1'],
    } as const;
    assert.deepEqual(parseProductionApproval(approval), approval);
    assert.throws(() => parseProductionApproval({ ...approval, redistributionApproved: false }), /approval/u);
    assert.throws(() => parseProductionApproval({ ...approval, purpose: 'fixture' }), /approval/u);
    assert.throws(() => parseProductionApproval({ ...approval, unexpected: true }), /approval/u);
  });
});
