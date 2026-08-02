import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

import { SOURCE_LOCK_DEFINITIONS } from './source-import/source-definitions.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const scanRoots = Object.freeze([
  'src/shared/localWhisper',
  'src/main/localWhisper',
  'runtime/local-whisper',
  'scripts/local-whisper',
  'tests/shared/localWhisper',
  'tests/main/localWhisper',
  'tests/runtime/localWhisper',
  'tests/fixtures/local-whisper',
  '.github/workflows',
  'package.json',
]);
const excludedFiles = new Set([
  'scripts/local-whisper/verify-single-engine-cleanup.mjs',
  'tests/main/localWhisper/singleEngineContract.test.ts',
  'tests/runtime/localWhisper/nativeSources/singleEngineSources.test.mjs',
]);
const textExtensions = new Set([
  '.c',
  '.cc',
  '.cmake',
  '.cpp',
  '.h',
  '.hpp',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const prohibitedPatterns = Object.freeze([
  { label: 'alternate engine', pattern: /faster[-_ ]?whisper/iu },
  { label: 'alternate native format/runtime', pattern: /ctranslate2/iu },
  { label: 'removed precision field', pattern: /\bprecision\b/iu },
  { label: 'removed effective precision field', pattern: /\beffectivePrecision\b/u },
  { label: 'removed Faster-Whisper type', pattern: /\bLocalWhisperFaster/u },
  { label: 'removed Faster-Whisper constant', pattern: /\bLOCAL_WHISPER_FASTER/u },
]);
const expectedLockIds = Object.freeze([
  'googletest-v1.17.0-52eb810',
  'nlohmann-json-v3.12.0-subset',
  'whisper-cpp-v1.9.1-f049fff',
]);

function collectFiles(path) {
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

function filesToScan() {
  return scanRoots.flatMap((root) => {
    const absoluteRoot = resolve(workspaceRoot, root);
    if (extname(absoluteRoot)) return [absoluteRoot];
    return collectFiles(absoluteRoot).filter((file) => textExtensions.has(extname(file)));
  });
}

const violations = [];
for (const file of filesToScan()) {
  const repositoryPath = relative(workspaceRoot, file).replaceAll('\\', '/');
  if (excludedFiles.has(repositoryPath)) continue;
  const contents = readFileSync(file, 'utf8');
  for (const { label, pattern } of prohibitedPatterns) {
    if (pattern.test(contents)) violations.push(`${repositoryPath}: ${label}`);
  }
}

const lockRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks');
const actualLockIds = readdirSync(lockRoot)
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => entry.replace(/\.json$/u, ''))
  .sort();
const definitionIds = Object.keys(SOURCE_LOCK_DEFINITIONS).sort();
if (JSON.stringify(actualLockIds) !== JSON.stringify(expectedLockIds)) {
  violations.push('runtime/local-whisper/sources/locks: unexpected lock set');
}
if (JSON.stringify(definitionIds) !== JSON.stringify(expectedLockIds)) {
  violations.push('scripts/local-whisper/source-import/source-definitions.mjs: unexpected definition set');
}

if (violations.length > 0) {
  throw new Error(`Local Whisper single-engine cleanup violations:\n${violations.join('\n')}`);
}

process.stdout.write('Local Whisper single-engine cleanup verified.\n');
