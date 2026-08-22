import { readdir } from 'node:fs/promises';
import * as path from 'node:path';

import { sha256VerifiedRegularFile } from '../../SecureFileReader';
import { readCanonicalJson } from '../packaging/fileIntegrity';
import {
  ReleaseProtocolVerifier,
  productionReleaseCandidateDigest,
  type ReleaseCandidate,
  type ReleaseCandidateTargetKind,
} from './ReleaseProtocol';

function candidateFiles(candidate: ReleaseCandidate): readonly {
  readonly fileName: string;
  readonly length: number;
  readonly sha256: string;
}[] {
  return candidate.assets.flatMap((asset) => [
    { fileName: asset.fileName, length: asset.length, sha256: asset.sha256 },
    { fileName: asset.signature.fileName, length: asset.signature.length, sha256: asset.signature.sha256 },
  ]);
}

/** Checks that the signature-bound production manifest describes exactly the private candidate bytes on disk. */
export class ProductionCandidateInventoryVerifier {
  private readonly protocol = new ReleaseProtocolVerifier();

  public async verify(input: {
    readonly artifactDirectory: string;
    readonly candidatePath: string;
    readonly expectedTarget?: string;
    readonly targetKind?: ReleaseCandidateTargetKind;
  }): Promise<ReleaseCandidate> {
    const candidate = (await readCanonicalJson(input.candidatePath)) as ReleaseCandidate;
    this.protocol.verifyCandidate(candidate, { target: input.expectedTarget, targetKind: input.targetKind });
    if (candidate.releaseCandidateDigest !== productionReleaseCandidateDigest(candidate)) {
      throw new Error('Production release candidate digest does not bind its physical inventory');
    }

    const artifactDirectory = path.resolve(input.artifactDirectory);
    const expected = candidateFiles(candidate);
    const expectedNames = new Set(expected.map(({ fileName }) => fileName));
    const entries = await readdir(artifactDirectory, { withFileTypes: true });
    if (
      entries.length !== expected.length ||
      entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !expectedNames.has(entry.name))
    ) {
      throw new Error('Production release candidate physical inventory is incomplete or contains extra entries');
    }
    for (const entry of expected) {
      const file = await sha256VerifiedRegularFile(path.join(artifactDirectory, entry.fileName));
      if (file.sizeBytes !== entry.length || file.sha256 !== entry.sha256) {
        throw new Error(`Production release candidate file identity changed: ${entry.fileName}`);
      }
    }
    return candidate;
  }
}
