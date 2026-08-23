import { lstat, realpath } from 'node:fs/promises';
import * as path from 'node:path';

import {
  EXT_GLOB_PATTERN,
  assertClosedObject,
  assertRequiredFields,
  assertUnique,
  containsControlCharacter,
  fail,
  hasOwn,
  isScenarioValidationError,
  requireArray,
  requireBoolean,
  requireFiniteNumber,
  requireString,
} from './scenario-contract-support.mjs';

const REPAIR_FIELDS = new Set([
  'includeGlobs',
  'excludeGlobs',
  'allowCreate',
  'allowDelete',
  'maxFiles',
  'maxBytesChanged',
]);
const REPAIR_DEFAULTED_FIELDS = new Set(['excludeGlobs', 'allowCreate', 'allowDelete', 'maxFiles', 'maxBytesChanged']);
const PATCH_FIELDS = new Set(['files', 'bytesChanged']);
const PATCH_FILE_FIELDS = new Set(['path', 'operation']);
const PATCH_OPERATIONS = new Set(['modify', 'create', 'delete']);

/** Validates and normalizes one POSIX, workspace-relative repair glob. */
export function validateRepairGlob(value, location = '$.repairGlob') {
  const glob = requireString(value, location, 1, 200);
  if (containsControlCharacter(glob) || glob.includes('\\')) fail('invalid-repair-glob', location);
  if (glob.startsWith('/') || glob.startsWith('//') || /^[A-Za-z]:/u.test(glob)) fail('invalid-repair-glob', location);
  if (
    glob.includes('{') ||
    glob.includes('}') ||
    glob.includes('[') ||
    glob.includes(']') ||
    EXT_GLOB_PATTERN.test(glob) ||
    glob.startsWith('!')
  ) {
    fail('invalid-repair-glob', location);
  }

  const segments = glob.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') fail('invalid-repair-glob', location);
    if (segment.includes('**') && segment !== '**') fail('invalid-repair-glob', location);
  }
  return segments.join('/');
}

function validateRepairGlobArray(value, location, minimum) {
  const globs = requireArray(value, location, minimum, 100);
  const normalized = globs.map((glob, index) => validateRepairGlob(glob, `${location}[${index}]`));
  assertUnique(normalized, location);
  return normalized;
}

/** Validates the repair subsection for both raw and defaulted scenario representations. */
export function validateRepairScopeDefinition(value, location, allowDefaultedFields) {
  const repair = assertClosedObject(value, REPAIR_FIELDS, location);
  assertRequiredFields(
    repair,
    ['includeGlobs', 'excludeGlobs', 'allowCreate', 'allowDelete', 'maxFiles', 'maxBytesChanged'],
    location,
    allowDefaultedFields,
    REPAIR_DEFAULTED_FIELDS,
  );

  validateRepairGlobArray(repair.includeGlobs, `${location}.includeGlobs`, 1);
  if (hasOwn(repair, 'excludeGlobs')) validateRepairGlobArray(repair.excludeGlobs, `${location}.excludeGlobs`, 0);
  if (hasOwn(repair, 'allowCreate')) requireBoolean(repair.allowCreate, `${location}.allowCreate`);
  if (hasOwn(repair, 'allowDelete')) requireBoolean(repair.allowDelete, `${location}.allowDelete`);
  if (hasOwn(repair, 'maxFiles')) requireFiniteNumber(repair.maxFiles, `${location}.maxFiles`, 1, 500, true);
  if (hasOwn(repair, 'maxBytesChanged')) {
    requireFiniteNumber(repair.maxBytesChanged, `${location}.maxBytesChanged`, 1, 10485760, true);
  }
  return repair;
}

export function normalizeWorkspaceRelativePath(value, location = '$.workspaceRelativePath') {
  const candidatePath = requireString(value, location, 1, 200);
  if (containsControlCharacter(candidatePath) || candidatePath.includes('\\')) {
    fail('invalid-workspace-relative-path', location);
  }
  if (candidatePath.startsWith('/') || candidatePath.startsWith('//') || /^[A-Za-z]:/u.test(candidatePath)) {
    fail('invalid-workspace-relative-path', location);
  }
  const segments = candidatePath.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') fail('invalid-workspace-relative-path', location);
  }
  return segments.join('/');
}

function matchesGlobSegment(patternSegment, candidateSegment) {
  let expression = '^';
  for (const character of patternSegment) {
    if (character === '*') expression += '.*';
    else if (character === '?') expression += '.';
    else expression += character.replace(/[|\\{}()[\]^$+*?.]/gu, '\\$&');
  }
  expression += '$';
  return new RegExp(expression, 'u').test(candidateSegment);
}

function matchesGlobSegments(patternSegments, candidateSegments, patternIndex, candidateIndex, cache) {
  const cacheKey = `${patternIndex}:${candidateIndex}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let result;
  if (patternIndex === patternSegments.length) {
    result = candidateIndex === candidateSegments.length;
  } else if (patternSegments[patternIndex] === '**') {
    result = false;
    for (let nextIndex = candidateIndex; nextIndex <= candidateSegments.length; nextIndex += 1) {
      if (matchesGlobSegments(patternSegments, candidateSegments, patternIndex + 1, nextIndex, cache)) {
        result = true;
        break;
      }
    }
  } else {
    result =
      candidateIndex < candidateSegments.length &&
      matchesGlobSegment(patternSegments[patternIndex], candidateSegments[candidateIndex]) &&
      matchesGlobSegments(patternSegments, candidateSegments, patternIndex + 1, candidateIndex + 1, cache);
  }
  cache.set(cacheKey, result);
  return result;
}

/** Matches one normalized POSIX glob without using platform shell or glob libraries. */
export function matchesRepairGlob(glob, workspaceRelativePath) {
  const normalizedGlob = validateRepairGlob(glob);
  const normalizedPath = normalizeWorkspaceRelativePath(workspaceRelativePath, '$.workspaceRelativePath');
  return matchesGlobSegments(normalizedGlob.split('/'), normalizedPath.split('/'), 0, 0, new Map());
}

function isPathInside(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
  );
}

/** Owns one normalized repair scope and its path, patch, and filesystem-boundary invariants. */
export class RepairScope {
  #repair;

  constructor(repair) {
    this.#repair = validateRepairScopeDefinition(repair, '$.repair', false);
  }

  includes(workspaceRelativePath) {
    const normalizedPath = normalizeWorkspaceRelativePath(workspaceRelativePath, '$.workspaceRelativePath');
    const included = this.#repair.includeGlobs.some((glob) => matchesRepairGlob(glob, normalizedPath));
    const excluded = this.#repair.excludeGlobs.some((glob) => matchesRepairGlob(glob, normalizedPath));
    return included && !excluded;
  }

  assertPatch(patch) {
    const patchRecord = assertClosedObject(patch, PATCH_FIELDS, '$.patch');
    assertRequiredFields(patchRecord, ['files', 'bytesChanged'], '$.patch', false);
    const files = requireArray(patchRecord.files, '$.patch.files');
    const bytesChanged = requireFiniteNumber(
      patchRecord.bytesChanged,
      '$.patch.bytesChanged',
      0,
      Number.MAX_SAFE_INTEGER,
      true,
    );
    if (files.length > this.#repair.maxFiles || bytesChanged > this.#repair.maxBytesChanged) {
      fail('repair-patch-limit-exceeded', '$.patch');
    }

    for (const [index, file] of files.entries()) this.#assertPatchFile(file, index);
    return true;
  }

  async assertCandidatePath({ workspaceRoot, candidatePath }) {
    const root = requireString(workspaceRoot, '$.workspaceRoot', 1);
    const normalizedPath = normalizeWorkspaceRelativePath(candidatePath, '$.candidatePath');
    if (!this.includes(normalizedPath)) fail('repair-path-outside-scope', '$.candidatePath');

    const resolvedRoot = path.resolve(root);
    const resolvedCandidate = path.resolve(resolvedRoot, ...normalizedPath.split('/'));
    if (!isPathInside(resolvedRoot, resolvedCandidate)) fail('repair-path-outside-workspace', '$.candidatePath');

    await this.#assertNoLinkedPathSegments(resolvedRoot, resolvedCandidate);
    let realRoot;
    let realExistingPath;
    try {
      realRoot = await realpath(resolvedRoot);
      realExistingPath = await realpath(await this.#nearestExistingPath(resolvedCandidate, resolvedRoot));
    } catch (error) {
      if (isScenarioValidationError(error)) throw error;
      fail('repair-path-inspection-failed', '$.candidatePath');
    }
    if (!isPathInside(realRoot, realExistingPath)) fail('repair-path-through-link', '$.candidatePath');
    return resolvedCandidate;
  }

  #assertPatchFile(file, index) {
    const fileLocation = `$.patch.files[${index}]`;
    const entry = assertClosedObject(file, PATCH_FILE_FIELDS, fileLocation);
    assertRequiredFields(entry, ['path', 'operation'], fileLocation, false);
    if (!this.includes(entry.path)) fail('repair-path-outside-scope', `${fileLocation}.path`);
    const operation = requireString(entry.operation, `${fileLocation}.operation`, 1);
    if (!PATCH_OPERATIONS.has(operation)) fail('invalid-repair-operation', `${fileLocation}.operation`);
    if (operation === 'create' && !this.#repair.allowCreate) fail('repair-create-not-allowed', fileLocation);
    if (operation === 'delete' && !this.#repair.allowDelete) fail('repair-delete-not-allowed', fileLocation);
  }

  async #assertNoLinkedPathSegments(workspaceRoot, candidatePath) {
    const relativePath = path.relative(workspaceRoot, candidatePath);
    let currentPath = workspaceRoot;
    for (const segment of relativePath.split(path.sep)) {
      currentPath = path.join(currentPath, segment);
      try {
        const metadata = await lstat(currentPath);
        if (metadata.isSymbolicLink()) fail('repair-path-through-link', '$.candidatePath');
      } catch (error) {
        if (isScenarioValidationError(error)) throw error;
        if (error?.code === 'ENOENT') return;
        fail('repair-path-inspection-failed', '$.candidatePath');
      }
    }
  }

  async #nearestExistingPath(candidatePath, workspaceRoot) {
    let currentPath = candidatePath;
    while (true) {
      try {
        await lstat(currentPath);
        return currentPath;
      } catch (error) {
        if (error?.code !== 'ENOENT') fail('repair-path-inspection-failed', '$.candidatePath');
        if (currentPath === workspaceRoot) fail('repair-path-inspection-failed', '$.candidatePath');
        currentPath = path.dirname(currentPath);
      }
    }
  }
}

/** Returns whether a path is inside the declarative repair allowlist after exclusions win. */
export function isPathInRepairScope(repair, workspaceRelativePath) {
  return new RepairScope(repair).includes(workspaceRelativePath);
}

/** Validates complete-patch caps and explicit create/delete authority without changing files. */
export function assertRepairPatchWithinScope(repair, patch) {
  return new RepairScope(repair).assertPatch(patch);
}

/**
 * Resolves a candidate only after lexical scope, link/reparse-point, and realpath containment checks.
 * It is validation-only and does not create, delete, or modify a path.
 */
export async function assertPathWithinRepairScope({ workspaceRoot, repair, candidatePath }) {
  return new RepairScope(repair).assertCandidatePath({ workspaceRoot, candidatePath });
}
