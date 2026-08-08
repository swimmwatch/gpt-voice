import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { sha256, validateRelativePath } from '../source-import/native-source-core.mjs';

const FORBIDDEN_LOADER_ENVIRONMENT = new Set(['GGML_BACKEND_PATH', 'LD_LIBRARY_PATH', 'LD_PRELOAD']);
const NEEDED_PATTERN = /\(NEEDED\).*Shared library: \[([^\]]+)\]/u;
const SAFE_SONAME_PATTERN = /^[\w.+-]{1,255}$/u;

function assertOwnedDescendant(root, candidate) {
  const relativePath = relative(root, candidate);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error('ELF dependency path escaped its owned staging root');
  }
}

function verifyRegularFileIdentity(path, expectedSha256, label) {
  const canonicalPath = realpathSync(path);
  const stat = lstatSync(canonicalPath);
  if (!stat.isFile()) throw new Error(`${label} is not a regular file: ${path}`);
  const actualSha256 = sha256(readFileSync(canonicalPath));
  if (actualSha256 !== expectedSha256) throw new Error(`${label} identity changed: ${path}`);
  return Object.freeze({ path: canonicalPath, sha256: actualSha256 });
}

function inspectNeeded(inspector, file) {
  const result = spawnSync(inspector.path, ['--wide', '--dynamic', file.path], {
    cwd: '/',
    encoding: 'utf8',
    env: { LANG: 'C', LC_ALL: 'C' },
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`ELF dependency inspection failed: ${file.path}`);
  }
  const needed = [];
  for (const line of result.stdout.split(/\r?\n/u)) {
    const match = NEEDED_PATTERN.exec(line);
    if (!match) continue;
    if (!SAFE_SONAME_PATTERN.test(match[1])) throw new Error(`Unsafe ELF dependency name: ${match[1]}`);
    needed.push(match[1]);
  }
  if (new Set(needed).size !== needed.length) throw new Error(`Duplicate ELF dependency entry: ${file.path}`);
  return Object.freeze(needed);
}

function indexedDependencies(stagingRoot, stagedLibraries, reviewedSystemLibraries) {
  const dependencies = new Map();
  for (const component of stagedLibraries) {
    validateRelativePath(component.relativePath);
    const path = resolve(stagingRoot, ...component.relativePath.split('/'));
    assertOwnedDescendant(stagingRoot, path);
    if (dependencies.has(component.soname)) throw new Error(`Duplicate ELF dependency authority: ${component.soname}`);
    dependencies.set(component.soname, Object.freeze({ ...component, path, resolutionKind: 'staged' }));
  }
  for (const component of reviewedSystemLibraries) {
    if (!isAbsolute(component.path))
      throw new Error(`Reviewed system dependency path is not absolute: ${component.id}`);
    if (dependencies.has(component.soname)) throw new Error(`Duplicate ELF dependency authority: ${component.soname}`);
    dependencies.set(component.soname, Object.freeze({ ...component, resolutionKind: 'reviewed-system' }));
  }
  return dependencies;
}

export function verifyElfDependencyClosure({
  inspector: inspectorInput,
  stagingRoot: stagingRootInput,
  entrypoints,
  stagedLibraries,
  reviewedSystemLibraries,
  environment = {},
}) {
  for (const key of Object.keys(environment)) {
    if (FORBIDDEN_LOADER_ENVIRONMENT.has(key)) {
      throw new Error(`Loader/backend environment is prohibited during closure inspection: ${key}`);
    }
  }
  const stagingRoot = realpathSync(stagingRootInput);
  const inspector = verifyRegularFileIdentity(inspectorInput.path, inspectorInput.sha256, 'ELF inspector');
  const dependencies = indexedDependencies(stagingRoot, stagedLibraries, reviewedSystemLibraries);
  const queue = entrypoints.map((entrypoint) => {
    validateRelativePath(entrypoint.relativePath);
    const path = resolve(stagingRoot, ...entrypoint.relativePath.split('/'));
    assertOwnedDescendant(stagingRoot, path);
    return Object.freeze({ ...entrypoint, path, resolutionKind: 'staged' });
  });
  const records = [];
  const inspectedIds = new Set();
  while (queue.length > 0) {
    const component = queue.shift();
    if (inspectedIds.has(component.id)) continue;
    inspectedIds.add(component.id);
    const identity = verifyRegularFileIdentity(component.path, component.sha256, 'ELF staged file');
    const needed = inspectNeeded(inspector, identity).map((soname) => {
      const dependency = dependencies.get(soname);
      if (!dependency) throw new Error(`Unresolved or ambient ELF dependency: ${soname}`);
      const resolved = verifyRegularFileIdentity(dependency.path, dependency.sha256, 'ELF dependency');
      if (dependency.resolutionKind === 'staged' && !inspectedIds.has(dependency.id)) queue.push(dependency);
      return Object.freeze({
        soname,
        resolutionKind: dependency.resolutionKind,
        resolvedId: dependency.id,
        sha256: resolved.sha256,
      });
    });
    records.push(
      Object.freeze({
        fileId: component.id,
        relativePath: component.relativePath,
        sha256: identity.sha256,
        needed: Object.freeze(needed),
      }),
    );
  }
  return Object.freeze({ inspector, records: Object.freeze(records) });
}
