import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import { canonicalDigest, sha256 } from './native-source-core.mjs';

const IMPORTER_FILES = Object.freeze([
  'importer-identity.mjs',
  'import-native-source.mjs',
  'native-source-core.mjs',
  'source-definitions.mjs',
]);

export function importerImplementationDigest() {
  const directory = import.meta.dirname;
  const files = IMPORTER_FILES.map((name) => ({
    name,
    sha256: sha256(readFileSync(resolve(directory, name))),
  }));
  return canonicalDigest(files);
}

export function importerIdentity(gitVersion, imageIdentity = 'host-manual-gate') {
  return Object.freeze({
    schemaId: 'local-whisper-native-importer-v1',
    implementationSha256: importerImplementationDigest(),
    imageIdentity,
    gitVersion,
    nodeVersion: process.version,
  });
}
