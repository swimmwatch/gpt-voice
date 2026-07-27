import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  DiagnosticCaptureRecord,
  DiagnosticCaptureRepository,
} from '@main/repositories/diagnosticCaptureRepository';

export interface DiagnosticCaptureRepositoryContractHarness {
  readonly repository: DiagnosticCaptureRepository;
  dispose(): void;
}

const CONTRACT_POLICY = {
  capacityBytes: Number.MAX_SAFE_INTEGER,
  retentionCutoff: '1970-01-01T00:00:00.000Z',
} as const;

function createRecord(actionId: string, actionType: 'prettify' | 'translation'): DiagnosticCaptureRecord {
  return {
    actionId,
    actionType,
    contractVersion: actionType === 'translation' ? '2026-07-25' : null,
    providerId: actionType === 'translation' ? 'google' : 'ollama',
    providerOperationId: null,
    recordedAt: '2026-07-27T12:00:00.000Z',
    redactionCount: 0,
    redactorVersion: 1,
    resultBytes: 6,
    resultText: 'result',
    retainedBytes: 12,
    sourceBytes: 6,
    sourceKind: 'provider',
    sourceText: 'source',
    targetLanguage: actionType === 'translation' ? 'en' : null,
  };
}

export function registerDiagnosticCaptureRepositoryContract(
  createHarness: () => DiagnosticCaptureRepositoryContractHarness,
): void {
  describe('diagnostic capture repository contract', () => {
    it('inserts, filters, deterministically reads, and idempotently purges domain rows', () => {
      const harness = createHarness();
      try {
        const translation = createRecord('00000000-0000-4000-8000-000000000001', 'translation');
        const prettify = createRecord('00000000-0000-4000-8000-000000000002', 'prettify');
        harness.repository.insert(translation, CONTRACT_POLICY);
        harness.repository.insert(prettify, CONTRACT_POLICY);

        assert.deepEqual(harness.repository.readForArchive(['translation']), [translation]);
        assert.equal(harness.repository.purge(['translation']), 1);
        assert.equal(harness.repository.purge(['translation']), 0);
        assert.deepEqual(harness.repository.readForArchive(['translation', 'prettify']), [prettify]);
      } finally {
        harness.dispose();
      }
    });
  });
}
