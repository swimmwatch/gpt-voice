export const SCENARIO_SCHEMA_ID = 'urn:gpt-voice:watch-process:scenario:1';
export const SCENARIO_SCHEMA_VERSION = '1.0.0';
export const SCENARIO_FILE_SUFFIX = '.watch.json';

export const CURRENT_SCHEMA_MAJOR = 1;
export const SCENARIO_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/u;
export const IDENTITY_FIELD_PATTERN = /^[a-z](?!.*_)\w{1,63}$/u;
export const FORBIDDEN_ACTION_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;
export const EXECUTABLE_PATTERN = /^(?:[\w.+/-]{1,200}|[A-Za-z]:[\\/][\w .+()@#~\\/-]{0,196})$/u;
export const ENVIRONMENT_NAME_PATTERN = /^[A-Z](?:(?![a-z])\w){0,63}$/u;
export const REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/u;
export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/u;
export const SUBSTITUTION_PATTERN =
  /^\{\{(watch|workspace|invocation|target|attempt)\.([a-z](?:(?![A-Z])\w)*(?:\.[a-z](?:(?![A-Z])\w)*)*)\}\}$/u;
export const EXT_GLOB_PATTERN = /[@+?!*]\(/u;

export const ADAPTERS = new Set(['github-actions', 'generic-ci-cli', 'docker-build', 'local-command']);
export const SELECTOR_KINDS = new Set(['run-url', 'pull-request-url', 'provider-id', 'start']);
export const REQUIRED_CHECK_MODES = new Set(['provider-required', 'listed', 'none']);
export const DELIVERY_STRATEGIES = new Set([
  'no-restart',
  'local-restart',
  'provider-retry',
  'provider-dispatch',
  'git-delivery',
]);
export const COMMAND_FIELDS = new Set(['executable', 'args', 'cwd', 'env']);
export const SUBSTITUTION_KEYS = new Set([
  'watch.id',
  'workspace.root',
  'invocation.timeout_seconds',
  'target.selector',
  'target.id',
  'target.source_sha',
  'attempt.number',
]);
export const ROOT_FIELDS = new Set([
  '$schema',
  'schemaVersion',
  'id',
  'description',
  'adapter',
  'target',
  'success',
  'timing',
  'evidence',
  'repair',
  'verification',
  'delivery',
  'forbiddenActions',
  'adapterConfig',
]);

/** Carries a stable, sanitized validation code and JSON-path-like location. */
export class ScenarioValidationError extends Error {
  constructor(code, location = '$') {
    super(`${code} at ${location}`);
    this.name = 'ScenarioValidationError';
    this.code = code;
    this.location = location;
  }
}

export function createScenarioValidationError(code, location = '$') {
  return new ScenarioValidationError(code, location);
}

export function isScenarioValidationError(error) {
  return error?.name === 'ScenarioValidationError';
}

export function fail(code, location) {
  throw createScenarioValidationError(code, location);
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function stringLength(value) {
  return [...value].length;
}

export function containsControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return true;
  }
  return false;
}

export function requireRecord(value, location) {
  if (!isRecord(value)) fail('expected-object', location);
  return value;
}

export function requireString(value, location, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  if (typeof value !== 'string') fail('expected-string', location);
  const length = stringLength(value);
  if (length < minimum || length > maximum) fail('string-length-out-of-range', location);
  return value;
}

export function requireFiniteNumber(value, location, minimum, maximum, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    fail(integer ? 'expected-integer' : 'expected-number', location);
  }
  if (value < minimum || value > maximum) fail('number-out-of-range', location);
  return value;
}

export function requireBoolean(value, location) {
  if (typeof value !== 'boolean') fail('expected-boolean', location);
  return value;
}

export function requireArray(value, location, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(value)) fail('expected-array', location);
  if (value.length < minimum || value.length > maximum) fail('array-length-out-of-range', location);
  return value;
}

export function assertClosedObject(value, fields, location) {
  const record = requireRecord(value, location);
  for (const key of Object.keys(record)) {
    if (!fields.has(key)) fail('unknown-field', `${location}.${key}`);
  }
  return record;
}

export function assertRequiredFields(record, fields, location, allowDefaultedFields, defaultedFields = new Set()) {
  for (const field of fields) {
    if (!hasOwn(record, field) && !(allowDefaultedFields && defaultedFields.has(field))) {
      fail('missing-required-field', `${location}.${field}`);
    }
  }
}

export function assertEnum(value, allowedValues, location) {
  if (!allowedValues.has(value)) fail('invalid-enum-value', location);
  return value;
}

export function assertUnique(values, location) {
  if (new Set(values).size !== values.length) fail('duplicate-array-item', location);
  return values;
}

export function validateStringArray(value, location, options = {}) {
  const {
    minimum = 0,
    maximum = Number.POSITIVE_INFINITY,
    unique = false,
    itemMinimum = 0,
    itemMaximum = Number.POSITIVE_INFINITY,
    pattern,
  } = options;
  const values = requireArray(value, location, minimum, maximum);
  for (const [index, item] of values.entries()) {
    const itemLocation = `${location}[${index}]`;
    const string = requireString(item, itemLocation, itemMinimum, itemMaximum);
    if (pattern !== undefined && !pattern.test(string)) fail('string-pattern-mismatch', itemLocation);
  }
  if (unique) assertUnique(values, location);
  return values;
}

export function validateIntegerArray(value, location, minimum, maximum, options = {}) {
  const { minimumItems = 0, unique = false } = options;
  const values = requireArray(value, location, minimumItems);
  for (const [index, item] of values.entries()) {
    requireFiniteNumber(item, `${location}[${index}]`, minimum, maximum, true);
  }
  if (unique) assertUnique(values, location);
  return values;
}
