import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { canonicalDigest, sha256, validateRelativePath } from '../source-import/native-source-core.mjs';

export const SANITIZER_FIXTURE_ID = 'local-whisper-sanitizer-proof-v1';
export const SANITIZER_FIXTURE_FILES = Object.freeze([
  'CMakeLists.txt',
  'asan_heap_use_after_free.cpp',
  'clean.cpp',
  'ubsan_signed_overflow.cpp',
]);
export const WHISPER_LINK_SMOKE_FIXTURE_ID = 'local-whisper-link-smoke-v1';

const FIXTURES = Object.freeze({
  [SANITIZER_FIXTURE_ID]: Object.freeze({
    relativeRoot: 'runtime/local-whisper/toolchains/fixtures/sanitizer-proof',
    files: SANITIZER_FIXTURE_FILES,
  }),
  [WHISPER_LINK_SMOKE_FIXTURE_ID]: Object.freeze({
    relativeRoot: 'runtime/local-whisper/toolchains/fixtures/whisper-link-smoke',
    files: Object.freeze(['CMakeLists.txt', 'main.cpp']),
  }),
});

export function readQualificationFixtureIdentity(workspaceRoot, fixtureId) {
  const definition = FIXTURES[fixtureId];
  if (!definition) throw new Error(`Unknown native qualification fixture: ${fixtureId}`);
  const root = realpathSync(resolve(workspaceRoot, ...definition.relativeRoot.split('/')));
  const files = definition.files.map((relativePath) => {
    validateRelativePath(relativePath);
    const path = resolve(root, relativePath);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      throw new Error(`Sanitizer fixture entry is not an owned regular file: ${relativePath}`);
    }
    const bytes = readFileSync(path);
    const text = bytes.toString('utf8');
    if (Buffer.from(text, 'utf8').compare(bytes) !== 0 || /\r(?!\n)/u.test(text)) {
      throw new Error(`Qualification fixture entry is not canonical UTF-8 text: ${relativePath}`);
    }
    const canonicalBytes = Buffer.from(text.replaceAll('\r\n', '\n'), 'utf8');
    return Object.freeze({
      mode: stat.mode & 0o111 ? '100755' : '100644',
      path: relativePath,
      sha256: sha256(canonicalBytes),
      sizeBytes: canonicalBytes.byteLength,
    });
  });
  return Object.freeze({
    fixtureId,
    manifestSha256: canonicalDigest(files),
    root,
    files: Object.freeze(files),
  });
}

export function readSanitizerFixtureIdentity(workspaceRoot) {
  return readQualificationFixtureIdentity(workspaceRoot, SANITIZER_FIXTURE_ID);
}
