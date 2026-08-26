import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readVerifiedRegularFileSync } from './secure-file-reader.mjs';
import { canonicalCatalogJson, sha256 } from './source-import/native-source-core.mjs';

/** Writes one canonical, owner-read-only runtime-pack JSON document. */
export function writeRuntimePackJson(filePath, value) {
  writeFileSync(filePath, canonicalCatalogJson(value), { mode: 0o400 });
}

/** Captures immutable evidence for one verified regular runtime-pack file. */
export function runtimePackFileEvidence(root, relativePath, id) {
  const filePath = resolve(root, ...relativePath.split('/'));
  const { bytes, stat: metadata } = readVerifiedRegularFileSync(filePath);
  return Object.freeze({
    id,
    relativePath,
    mode: metadata.mode & 0o777,
    sizeBytes: metadata.size,
    sha256: sha256(bytes),
  });
}

/** Builds the canonical SPDX dependency edges for staged runtime libraries. */
export function runtimePackDependencyRelationships(dependencyCount) {
  return Array.from({ length: dependencyCount }, (_, index) => ({
    spdxElementId: 'SPDXRef-Package-Worker',
    relationshipType: 'DEPENDS_ON',
    relatedSpdxElement: `SPDXRef-Runtime-${index}`,
  }));
}
