import { isReleaseCandidateTarget, type ReleaseCandidateTargetKind } from './ReleaseProtocol';

const APP_REVISION_PATTERN = /^\d+\.\d+\.\d+(?:-[\dA-Za-z.-]+)?$/u;

export interface ProductionWorkflowInputs {
  readonly appRevision: string;
  readonly candidateLabel: string;
  readonly publish: boolean;
  readonly releaseTag?: string;
}

export interface ResolvedProductionWorkflowInputs {
  readonly appRevision: string;
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
    return Object.freeze({ appRevision: input.appRevision, candidateTarget: input.releaseTag, targetKind: 'release' });
  }
  if (input.releaseTag !== undefined && input.releaseTag.length > 0) {
    throw new Error('Private production candidate construction rejects a release tag');
  }
  return Object.freeze({
    appRevision: input.appRevision,
    candidateTarget: input.candidateLabel,
    targetKind: 'private',
  });
}
