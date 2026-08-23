import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { TextDecoder } from 'node:util';

import { SCENARIO_FILE_SUFFIX, SCENARIO_ID_PATTERN, fail, requireString } from './scenario-contract-support.mjs';
import { WatchScenarioNormalizer } from './watch-scenario-normalizer.mjs';

export { parseCommandArgument, resolveCommandArguments } from './scenario-command-arguments.mjs';
export {
  SCENARIO_FILE_SUFFIX,
  SCENARIO_SCHEMA_ID,
  SCENARIO_SCHEMA_VERSION,
  createScenarioValidationError,
} from './scenario-contract-support.mjs';
export {
  assertPathWithinRepairScope,
  assertRepairPatchWithinScope,
  isPathInRepairScope,
  matchesRepairGlob,
  validateRepairGlob,
} from './scenario-repair-scope.mjs';
export {
  applyWatchScenarioDefaults,
  canonicalizeJson,
  digestCanonicalJson,
  normalizeWatchScenario,
} from './watch-scenario-normalizer.mjs';
export { validateWatchScenario } from './watch-scenario-validator.mjs';

function isPathInside(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
  );
}

function parseScenarioFileName(filePath) {
  const name = path.basename(filePath);
  if (!name.endsWith(SCENARIO_FILE_SUFFIX)) fail('invalid-scenario-file-name', '$.file');
  const id = name.slice(0, -SCENARIO_FILE_SUFFIX.length);
  if (!SCENARIO_ID_PATTERN.test(id) || name !== `${id}${SCENARIO_FILE_SUFFIX}`) {
    fail('invalid-scenario-file-name', '$.file');
  }
  return id;
}

function decodeScenarioJson(bytes) {
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('invalid-scenario-utf8', '$.file');
  }
  try {
    return JSON.parse(source);
  } catch {
    fail('invalid-scenario-json', '$.file');
  }
}

/** Loads only declarative, filename-bound UTF-8 scenarios from one configured directory. */
export class WatchScenarioRegistry {
  #scenarioDirectory;
  #normalizer;

  constructor(scenarioDirectory) {
    this.#scenarioDirectory = path.resolve(requireString(scenarioDirectory, '$.scenarioDirectory', 1));
    this.#normalizer = new WatchScenarioNormalizer();
  }

  async load(scenarioId) {
    const id = requireString(scenarioId, '$.scenarioId', 3, 64);
    if (!SCENARIO_ID_PATTERN.test(id)) fail('string-pattern-mismatch', '$.scenarioId');
    return this.#loadResolvedFile(path.join(this.#scenarioDirectory, `${id}${SCENARIO_FILE_SUFFIX}`), id);
  }

  async loadFile(filePath) {
    const requestedPath = path.resolve(requireString(filePath, '$.filePath', 1));
    if (
      !isPathInside(this.#scenarioDirectory, requestedPath) ||
      path.dirname(requestedPath) !== this.#scenarioDirectory
    ) {
      fail('scenario-file-outside-directory', '$.filePath');
    }
    return this.#loadResolvedFile(requestedPath, parseScenarioFileName(requestedPath));
  }

  async #loadResolvedFile(filePath, expectedId) {
    let bytes;
    try {
      bytes = await readFile(filePath);
    } catch {
      fail('scenario-read-failed', '$.file');
    }
    const normalized = this.#normalizer.normalize(decodeScenarioJson(bytes));
    if (normalized.scenario.id !== expectedId) fail('scenario-file-id-mismatch', '$.id');
    return normalized;
  }
}
