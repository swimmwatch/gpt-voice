import { createHash } from 'node:crypto';

import { SCENARIO_SCHEMA_VERSION, fail, isRecord, requireString } from './scenario-contract-support.mjs';
import { WatchScenarioValidator } from './watch-scenario-validator.mjs';

function canonicalizeValue(value, ancestors) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('invalid-canonical-number', '$');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) fail('cyclic-json-value', '$');
    ancestors.add(value);
    const result = `[${value.map((entry) => canonicalizeValue(entry, ancestors)).join(',')}]`;
    ancestors.delete(value);
    return result;
  }
  if (isRecord(value)) {
    if (ancestors.has(value)) fail('cyclic-json-value', '$');
    ancestors.add(value);
    const result = `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key], ancestors)}`)
      .join(',')}}`;
    ancestors.delete(value);
    return result;
  }
  fail('invalid-json-value', '$');
}

/** Produces the stable UTF-8 JSON representation used for scenario digests. */
export function canonicalizeJson(value) {
  return canonicalizeValue(value, new Set());
}

export function digestCanonicalJson(canonicalJson) {
  const value = requireString(canonicalJson, '$.canonicalJson');
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneJson(value) {
  return JSON.parse(canonicalizeJson(value));
}

function applyCommandDefaults(command) {
  command.cwd ??= '.';
  command.env ??= [];
}

function applyCommandsDefaults(commands) {
  if (!isRecord(commands)) return;
  for (const field of ['start', 'observe', 'evidence', 'cancel']) {
    if (isRecord(commands[field])) applyCommandDefaults(commands[field]);
  }
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return Object.freeze(value);
}

/** Owns validation, defaulting, digest generation, and immutable normalized scenario output. */
export class WatchScenarioNormalizer {
  #validator;

  constructor() {
    this.#validator = new WatchScenarioValidator();
  }

  applyDefaults(value) {
    const scenario = cloneJson(value);
    scenario.description ??= '';
    scenario.authority ??= { kind: 'standard' };
    scenario.schemaVersion = SCENARIO_SCHEMA_VERSION;
    scenario.target.requireExactSourceRevision ??= true;
    scenario.repair.excludeGlobs ??= [];
    scenario.repair.allowCreate ??= false;
    scenario.repair.allowDelete ??= false;
    scenario.repair.maxFiles ??= 50;
    scenario.repair.maxBytesChanged ??= 1048576;
    for (const command of scenario.verification) applyCommandDefaults(command);
    scenario.delivery.pushCurrentUpstream ??= false;
    applyCommandsDefaults(scenario.adapterConfig.commands);
    if (isRecord(scenario.adapterConfig.buildCommand)) applyCommandDefaults(scenario.adapterConfig.buildCommand);
    if (isRecord(scenario.adapterConfig.startCommand)) applyCommandDefaults(scenario.adapterConfig.startCommand);
    if (scenario.adapter === 'docker-build') {
      scenario.adapterConfig.imageVerification ??= [];
      for (const command of scenario.adapterConfig.imageVerification) applyCommandDefaults(command);
    }
    if (isRecord(scenario.adapterConfig.dispatch)) scenario.adapterConfig.dispatch.enabled ??= false;
    return scenario;
  }

  normalize(value) {
    this.#validator.validate(value, { allowDefaultedFields: true });
    const oldDigest = digestCanonicalJson(canonicalizeJson(value));
    const scenario = this.applyDefaults(value);
    this.#validator.validate(scenario);
    const canonicalJson = canonicalizeJson(scenario);
    const newDigest = digestCanonicalJson(canonicalJson);
    return Object.freeze({
      scenario: deepFreeze(scenario),
      canonicalJson,
      canonicalDigest: newDigest,
      sourceDigest: oldDigest,
      migration: Object.freeze({
        fromVersion: value.schemaVersion,
        toVersion: SCENARIO_SCHEMA_VERSION,
        oldDigest,
        newDigest,
      }),
    });
  }
}

/** Applies only documented defaults to a cloned scenario; it never writes a tracked file. */
export function applyWatchScenarioDefaults(value) {
  return new WatchScenarioNormalizer().applyDefaults(value);
}

/** Validates, normalizes, digests, and freezes an in-memory scenario without executing it. */
export function normalizeWatchScenario(value) {
  return new WatchScenarioNormalizer().normalize(value);
}
