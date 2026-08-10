import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  assertPlatformCompilationCoverage,
  createNativeQualityCoverageReport,
  createNativeQualityManifest,
  normalizeNativeCompilationPath,
} from './native-quality-manifest.mjs';

function parseArguments(arguments_) {
  const values = new Map();
  for (const argument of arguments_) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || values.has(match[1])) throw new Error('Native quality coverage arguments are invalid');
    values.set(match[1], match[2]);
  }
  for (const required of ['codeql-database', 'compiler-profile', 'evidence', 'output', 'platform']) {
    if (!values.has(required)) throw new Error(`Native quality coverage requires --${required}`);
  }
  return values;
}

function compileCommandFiles(root) {
  if (!existsSync(root)) throw new Error('Native quality build cache is unavailable');
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      if (entry.isFile() && entry.name === 'compile_commands.json') result.push(path);
    }
  };
  visit(root);
  return result.sort();
}

function compiledProjectSources(workspaceRoot, manifest, compileCommandPaths) {
  const knownSources = new Set(
    manifest.filter((entry) => entry.kind === 'translation-unit').map((entry) => entry.path),
  );
  const compiled = new Set();
  for (const compileCommandsPath of compileCommandPaths) {
    const entries = JSON.parse(readFileSync(compileCommandsPath, 'utf8'));
    if (!Array.isArray(entries))
      throw new Error(`Native quality compile database is malformed: ${compileCommandsPath}`);
    for (const entry of entries) {
      if (typeof entry?.file !== 'string')
        throw new Error(`Native quality compile command is malformed: ${compileCommandsPath}`);
      const path = normalizeNativeCompilationPath(workspaceRoot, resolve(entry.directory ?? workspaceRoot, entry.file));
      if (knownSources.has(path)) compiled.add(path);
    }
  }
  return compiled;
}

function assertTaskOwnedOutput(workspaceRoot, output) {
  const resolved = resolve(workspaceRoot, output);
  const artifactRoot = resolve(workspaceRoot, 'release-artifacts');
  const artifactRelative = relative(artifactRoot, resolved);
  if (
    artifactRelative.length === 0 ||
    artifactRelative === '..' ||
    artifactRelative.startsWith('../') ||
    isAbsolute(artifactRelative)
  ) {
    throw new Error('Native quality coverage output must stay in release-artifacts');
  }
  return resolved;
}

try {
  const values = parseArguments(process.argv.slice(2));
  const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
  const platform = values.get('platform');
  const manifest = createNativeQualityManifest(workspaceRoot);
  const codeqlDatabase = resolve(workspaceRoot, values.get('codeql-database'));
  if (!existsSync(codeqlDatabase)) throw new Error('Native quality CodeQL database is unavailable');
  const compiled = compiledProjectSources(
    workspaceRoot,
    manifest,
    compileCommandFiles(resolve(workspaceRoot, '.cache', 'local-whisper')),
  );
  assertPlatformCompilationCoverage(manifest, platform, compiled);
  const report = createNativeQualityCoverageReport({
    compilerProfile: values.get('compiler-profile'),
    evidence: values.get('evidence').split(',').filter(Boolean),
    manifest,
    platform,
  });
  const output = assertTaskOwnedOutput(workspaceRoot, values.get('output'));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`Native quality coverage written to ${values.get('output')}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native quality coverage failed'}\n`);
  process.exitCode = 1;
}
