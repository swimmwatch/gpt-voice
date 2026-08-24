import { isRecord } from '../packaging/contracts';

const SHA_PATTERN = /^[a-f\d]{40}$/u;
const RUN_ID_PATTERN = /^[1-9]\d{0,19}$/u;
const WORKFLOW_PATH = '.github/workflows/release-builds.yml';

export interface ProductionPromotionSource {
  readonly conclusion: string | null;
  readonly display_title: string;
  readonly event: string;
  readonly head_sha: string;
  readonly id: number;
  readonly path: string;
  readonly repository: Readonly<{ full_name: string }>;
  readonly status: string;
}

/** Verifies that promotion consumes one successful release-candidate run from the same repository and frozen SHA. */
export class ProductionPromotionSourceVerifier {
  public verify(
    value: unknown,
    expected: Readonly<{ candidateRunId: string; repository: string; sourceSha: string }>,
  ): asserts value is ProductionPromotionSource {
    if (
      !RUN_ID_PATTERN.test(expected.candidateRunId) ||
      !SHA_PATTERN.test(expected.sourceSha) ||
      !isRecord(value) ||
      value.id !== Number(expected.candidateRunId) ||
      value.repository === null ||
      !isRecord(value.repository) ||
      value.repository.full_name !== expected.repository ||
      value.head_sha !== expected.sourceSha ||
      value.path !== WORKFLOW_PATH ||
      value.event !== 'workflow_dispatch' ||
      value.status !== 'completed' ||
      value.conclusion !== 'success' ||
      typeof value.display_title !== 'string' ||
      !value.display_title.startsWith('release-watch-')
    ) {
      throw new Error('PRODUCTION_PROMOTION_SOURCE_INVALID');
    }
  }
}
