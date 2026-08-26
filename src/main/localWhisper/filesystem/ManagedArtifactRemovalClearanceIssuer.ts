import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import { ManagedArtifactRemovalClearance } from './ManagedArtifactRemovalClearance';
import { MANAGED_ARTIFACT_REMOVAL_CLEARANCE_AUTHORITY } from './ManagedArtifactRemovalClearanceAuthority';

/** Main-owned authority assigned to the coordinator composition graph. */
export class ManagedArtifactRemovalClearanceIssuer {
  public issue(artifactId: LocalWhisperArtifactId): ManagedArtifactRemovalClearance {
    return new ManagedArtifactRemovalClearance(MANAGED_ARTIFACT_REMOVAL_CLEARANCE_AUTHORITY, artifactId);
  }
}
