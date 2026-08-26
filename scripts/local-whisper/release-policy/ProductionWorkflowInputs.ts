import { isReleaseCandidateTarget, type ReleaseCandidateTargetKind } from './ReleaseProtocol';

const APP_REVISION_PATTERN = /^\d+\.\d+\.\d+(?:-[\dA-Za-z.-]+)?$/u;
const RUN_ID_PATTERN = /^[1-9]\d{0,19}$/u;

export interface ProductionWorkflowInputs {
  readonly appRevision: string;
  readonly candidateLabel: string;
  readonly candidateRunId?: string;
  readonly publish: boolean;
  readonly releaseTag?: string;
}

export interface ResolvedProductionWorkflowInputs {
  readonly appRevision: string;
  readonly candidateRunId: string | null;
  readonly candidateTarget: string;
  readonly targetKind: ReleaseCandidateTargetKind;
}

/** Resolves the default-off private target or the explicitly enabled release target before construction starts. */
export function resolveProductionWorkflowInputs(input: ProductionWorkflowInputs): ResolvedProductionWorkflowInputs {
  if (!APP_REVISION_PATTERN.test(input.appRevision) || !isReleaseCandidateTarget(input.candidateLabel, 'private')) {
    throw new Error('Production workflow app revision or private candidate label is invalid');
  }
  if (input.publish) {
    if (!isReleaseCandidateTarget(input.releaseTag, 'release')) {
      throw new Error('Production workflow publication requires an approved release target');
    }
    if (typeof input.candidateRunId !== 'string' || !RUN_ID_PATTERN.test(input.candidateRunId)) {
      throw new Error('Production workflow publication requires one prior candidate run');
    }
    return Object.freeze({
      appRevision: input.appRevision,
      candidateRunId: input.candidateRunId,
      candidateTarget: input.releaseTag,
      targetKind: 'release',
    });
  }
  if (input.candidateRunId !== undefined && input.candidateRunId.length > 0) {
    throw new Error('Candidate construction rejects a prior candidate run');
  }
  if (input.releaseTag !== undefined && input.releaseTag.length > 0) {
    if (!isReleaseCandidateTarget(input.releaseTag, 'release')) {
      throw new Error('Production workflow release candidate target is invalid');
    }
    return Object.freeze({
      appRevision: input.appRevision,
      candidateRunId: null,
      candidateTarget: input.releaseTag,
      targetKind: 'release',
    });
  }
  return Object.freeze({
    appRevision: input.appRevision,
    candidateRunId: null,
    candidateTarget: input.candidateLabel,
    targetKind: 'private',
  });
}
