import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';

function canonicalDllName(value) {
  return value.toLowerCase();
}

export function parseDumpbinDependencies(output) {
  const dependencies = [];
  const seen = new Set();
  for (const line of output.split(/\r?\n/u)) {
    const candidate = line.trim();
    if (!/^[\w.+-]+\.dll$/u.test(candidate.toLowerCase())) continue;
    const canonical = canonicalDllName(candidate);
    if (seen.has(canonical)) throw new Error(`PE dependency inspector repeated an import: ${candidate}`);
    seen.add(canonical);
    dependencies.push(candidate);
  }
  if (dependencies.length === 0) throw new Error('PE dependency inspector returned no DLL imports');
  return Object.freeze(dependencies);
}

function inspectDependencies(inspector, path, environment) {
  const result = spawnSync(inspector, ['/DEPENDENTS', path], {
    cwd: dirname(path),
    encoding: 'utf8',
    env: environment,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`PE dependency inspection failed for ${path}`);
  }
  return parseDumpbinDependencies(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
}

export function verifyWindowsPeDependencyClosure({
  entrypoint,
  environment,
  inspector,
  permittedUnreferenced = [],
  stagedDependencies,
  systemDependencies,
}) {
  const staged = new Map();
  for (const dependency of stagedDependencies) {
    const canonical = canonicalDllName(dependency.name);
    if (staged.has(canonical)) throw new Error(`Duplicate staged PE dependency: ${dependency.name}`);
    staged.set(canonical, dependency);
  }
  const system = new Map();
  for (const dependency of systemDependencies) {
    const canonical = canonicalDllName(dependency.name);
    if (system.has(canonical) || staged.has(canonical)) {
      throw new Error(`Ambiguous PE dependency authority: ${dependency.name}`);
    }
    system.set(canonical, dependency);
  }
  const permitted = new Set(permittedUnreferenced.map(canonicalDllName));
  for (const name of permitted) {
    if (!staged.has(name)) throw new Error(`Permitted unreferenced PE dependency is not staged: ${name}`);
  }

  const files = [{ id: 'worker', name: 'local-whisper-whisper-cpp-worker.exe', path: entrypoint }];
  files.push(...[...staged.values()].map((dependency) => ({ ...dependency })));
  const referencedStaged = new Set();
  const records = [];
  for (const file of files) {
    const imports = inspectDependencies(inspector, file.path, environment);
    const resolved = imports.map((name) => {
      const canonical = canonicalDllName(name);
      const stagedDependency = staged.get(canonical);
      if (stagedDependency) {
        referencedStaged.add(canonical);
        return Object.freeze({ name, resolutionKind: 'staged', resolvedId: stagedDependency.id });
      }
      const systemDependency = system.get(canonical);
      if (systemDependency) {
        return Object.freeze({ name, resolutionKind: 'windows-system', resolvedId: systemDependency.id });
      }
      throw new Error(`Unexpected PE dependency ${name} imported by ${file.name}`);
    });
    records.push(Object.freeze({ fileId: file.id, fileName: file.name, imports: Object.freeze(resolved) }));
  }
  for (const [canonical, dependency] of staged) {
    if (!referencedStaged.has(canonical) && !permitted.has(canonical)) {
      throw new Error(`Staged PE dependency is outside the import-derived closure: ${dependency.name}`);
    }
  }
  return Object.freeze(records);
}
