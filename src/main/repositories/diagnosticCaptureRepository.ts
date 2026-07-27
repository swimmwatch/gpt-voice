import type { KnownPrettifyProviderId } from '@shared/prettifySettings';
import type { TranslationProviderId } from '@shared/translationProvider';

export const DIAGNOSTIC_ACTION_TYPES = ['translation', 'prettify'] as const;
export const DIAGNOSTIC_SOURCE_KINDS = ['provider', 'cache'] as const;

export type DiagnosticActionType = (typeof DIAGNOSTIC_ACTION_TYPES)[number];
export type DiagnosticSourceKind = (typeof DIAGNOSTIC_SOURCE_KINDS)[number];
export type DiagnosticCaptureProviderId = TranslationProviderId | KnownPrettifyProviderId;

export interface DiagnosticCaptureRow {
  readonly actionId: string;
  readonly actionType: DiagnosticActionType;
  readonly contractVersion: string | null;
  readonly providerId: DiagnosticCaptureProviderId;
  readonly providerOperationId: string | null;
  readonly recordedAt: string;
  readonly redactionCount: number;
  readonly redactorVersion: number;
  readonly resultBytes: number;
  readonly resultText: string;
  readonly retainedBytes: number;
  readonly sourceBytes: number;
  readonly sourceKind: DiagnosticSourceKind;
  readonly sourceText: string;
  readonly targetLanguage: string | null;
}

export type DiagnosticCaptureRecord = DiagnosticCaptureRow;

export interface DiagnosticCapturePrunePolicy {
  readonly capacityBytes: number;
  readonly retentionCutoff: string;
}

export interface DiagnosticCaptureRepository {
  insert(capture: DiagnosticCaptureRecord, policy: DiagnosticCapturePrunePolicy): void;
  prune(policy: DiagnosticCapturePrunePolicy): number;
  pruneAndPurge(policy: DiagnosticCapturePrunePolicy, categories: readonly DiagnosticActionType[]): number;
  purge(categories: readonly DiagnosticActionType[]): number;
  readForArchive(categories: readonly DiagnosticActionType[]): readonly DiagnosticCaptureRow[];
}
