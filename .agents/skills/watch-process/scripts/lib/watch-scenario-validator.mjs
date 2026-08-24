import {
  ADAPTERS,
  AUTHORITY_KINDS,
  COMMAND_FIELDS,
  CURRENT_SCHEMA_MAJOR,
  DELIVERY_STRATEGIES,
  ENVIRONMENT_NAME_PATTERN,
  EXECUTABLE_PATTERN,
  FORBIDDEN_ACTION_PATTERN,
  IDENTITY_FIELD_PATTERN,
  LEGACY_SCENARIO_SCHEMA_VERSIONS,
  PROVIDER_ID_PATTERN,
  REPOSITORY_PATTERN,
  REQUIRED_CHECK_MODES,
  RELEASE_AUTHORITY_OPERATIONS,
  ROOT_FIELDS,
  SCENARIO_ID_PATTERN,
  SCENARIO_SCHEMA_ID,
  SCENARIO_SCHEMA_VERSION,
  SELECTOR_KINDS,
  assertClosedObject,
  assertEnum,
  assertRequiredFields,
  fail,
  hasOwn,
  requireArray,
  requireBoolean,
  requireFiniteNumber,
  requireRecord,
  requireString,
  validateIntegerArray,
  validateStringArray,
} from './scenario-contract-support.mjs';
import { parseCommandArgument } from './scenario-command-arguments.mjs';
import { ScenarioCommandCapabilityPolicy } from './scenario-command-capability-policy.mjs';
import { validateRepairScopeDefinition } from './scenario-repair-scope.mjs';

const TARGET_FIELDS = new Set(['selectorKinds', 'identityFields', 'requireExactSourceRevision']);
const SUCCESS_FIELDS = new Set(['requiredChecksMode', 'requiredChecks', 'requiredOutputs', 'allowedSkippedChecks']);
const TIMING_FIELDS = new Set(['expectedDurationSeconds', 'minTimeoutSeconds', 'maxTimeoutSeconds', 'poll']);
const POLL_FIELDS = new Set(['initialSeconds', 'maxSeconds', 'multiplier']);
const EVIDENCE_FIELDS = new Set(['maxBytesPerAttempt', 'maxFailures', 'ttlSeconds']);
const DELIVERY_FIELDS = new Set(['strategy', 'pushCurrentUpstream']);
const AUTHORITY_FIELDS = new Set([
  'kind',
  'repository',
  'version',
  'tag',
  'baseBranch',
  'featureBranch',
  'releaseBranch',
  'workflow',
  'environment',
  'scriptEntrypoint',
  'scriptSha256',
  'allowedOperations',
]);
const DELIVERY_DEFAULTED_FIELDS = new Set(['pushCurrentUpstream']);
const DISPATCH_FIELDS = new Set(['enabled', 'workflow', 'inputs', 'idempotencyInput']);
const DISPATCH_DEFAULTED_FIELDS = new Set(['enabled']);
const GENERIC_COMMAND_FIELDS = new Set(['start', 'observe', 'evidence', 'cancel']);
const STATUS_MAP_FIELDS = new Set(['running', 'succeeded', 'failed', 'cancelled']);
const ADAPTER_CONFIG_FIELDS = Object.freeze({
  'docker-build': new Set(['buildCommand', 'imageVerification']),
  'generic-ci-cli': new Set(['providerId', 'commands', 'statusMap']),
  'github-actions': new Set(['repository', 'mode', 'workflowAllowlist', 'dispatch']),
  'local-command': new Set(['startCommand', 'successExitCodes']),
});
const GITHUB_ACTIONS_MODES = new Set(['run', 'pull-request-contract']);

/** Owns the fixed v1 scenario contract and its closed validation rules. */
export class WatchScenarioValidator {
  #capabilityPolicy;

  constructor({ capabilityPolicy = new ScenarioCommandCapabilityPolicy() } = {}) {
    if (!(capabilityPolicy instanceof ScenarioCommandCapabilityPolicy)) {
      fail('invalid-capability-policy', '$');
    }
    this.#capabilityPolicy = capabilityPolicy;
  }

  validate(value, options = {}) {
    const { allowDefaultedFields = false } = options;
    const scenario = assertClosedObject(value, ROOT_FIELDS, '$');
    assertRequiredFields(
      scenario,
      [
        '$schema',
        'schemaVersion',
        'id',
        'adapter',
        'target',
        'success',
        'timing',
        'evidence',
        'repair',
        'verification',
        'delivery',
        'authority',
        'forbiddenActions',
        'adapterConfig',
      ],
      '$',
      allowDefaultedFields,
      new Set(['authority']),
    );

    if (requireString(scenario.$schema, '$.$schema', 1) !== SCENARIO_SCHEMA_ID) {
      fail('unsupported-schema-id', '$.$schema');
    }
    this.#validateSchemaVersion(scenario.schemaVersion, '$.schemaVersion', allowDefaultedFields);
    const id = requireString(scenario.id, '$.id', 3, 64);
    if (!SCENARIO_ID_PATTERN.test(id)) fail('string-pattern-mismatch', '$.id');
    if (hasOwn(scenario, 'description')) requireString(scenario.description, '$.description', 0, 300);

    const adapter = requireString(scenario.adapter, '$.adapter', 1);
    assertEnum(adapter, ADAPTERS, '$.adapter');
    this.#validateTarget(scenario.target, '$.target', allowDefaultedFields);
    this.#validateSuccess(scenario.success, '$.success');
    this.#validateTiming(scenario.timing, '$.timing');
    this.#validateEvidence(scenario.evidence, '$.evidence');
    validateRepairScopeDefinition(scenario.repair, '$.repair', allowDefaultedFields);

    const verification = requireArray(scenario.verification, '$.verification', 1, 20);
    for (const [index, command] of verification.entries()) {
      this.#validateCommand(command, `$.verification[${index}]`, allowDefaultedFields);
    }
    this.#validateDelivery(scenario.delivery, '$.delivery', allowDefaultedFields);
    if (hasOwn(scenario, 'authority')) this.#validateAuthority(scenario.authority, '$.authority');
    else if (!allowDefaultedFields) fail('missing-required-field', '$.authority');
    validateStringArray(scenario.forbiddenActions, '$.forbiddenActions', {
      unique: true,
      itemMinimum: 2,
      itemMaximum: 64,
      pattern: FORBIDDEN_ACTION_PATTERN,
    });
    this.#validateAdapterConfig(scenario.adapterConfig, '$.adapterConfig', adapter, allowDefaultedFields);
    this.#capabilityPolicy.validate(scenario);
    return scenario;
  }

  #validateSchemaVersion(value, location, allowLegacy) {
    const version = requireString(value, location, 1);
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(version);
    if (match === null) fail('invalid-schema-version', location);
    if (Number(match[1]) !== CURRENT_SCHEMA_MAJOR) fail('unsupported-schema-major', location);
    if (version !== SCENARIO_SCHEMA_VERSION && !(allowLegacy && LEGACY_SCENARIO_SCHEMA_VERSIONS.has(version))) {
      fail('unsupported-schema-version', location);
    }
    return version;
  }

  #validateAuthority(value, location) {
    const authority = assertClosedObject(value, AUTHORITY_FIELDS, location);
    assertRequiredFields(authority, ['kind'], location, false);
    const kind = requireString(authority.kind, `${location}.kind`, 1);
    assertEnum(kind, AUTHORITY_KINDS, `${location}.kind`);
    if (kind === 'standard') {
      if (Object.keys(authority).length !== 1) fail('standard-authority-fields-forbidden', location);
      return;
    }
    const required = [
      'repository',
      'version',
      'tag',
      'baseBranch',
      'featureBranch',
      'releaseBranch',
      'workflow',
      'environment',
      'scriptEntrypoint',
      'scriptSha256',
      'allowedOperations',
    ];
    assertRequiredFields(authority, required, location, false);
    const repository = requireString(authority.repository, `${location}.repository`, 1, 200);
    if (!REPOSITORY_PATTERN.test(repository)) fail('string-pattern-mismatch', `${location}.repository`);
    const version = requireString(authority.version, `${location}.version`, 1, 64);
    if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\dA-Za-z.-]+)?$/u.test(version)) {
      fail('string-pattern-mismatch', `${location}.version`);
    }
    if (authority.tag !== `v${version}` || authority.releaseBranch !== `release/v${version}`) {
      fail('release-authority-version-mismatch', location);
    }
    for (const field of ['baseBranch', 'featureBranch', 'releaseBranch']) {
      const branch = requireString(authority[field], `${location}.${field}`, 1, 128);
      if (!/^[A-Za-z0-9][\w./-]*$/u.test(branch) || branch.includes('..') || branch.includes('//')) {
        fail('string-pattern-mismatch', `${location}.${field}`);
      }
    }
    for (const field of ['workflow', 'environment', 'scriptEntrypoint']) {
      requireString(authority[field], `${location}.${field}`, 1, 200);
    }
    if (!/^[a-f\d]{64}$/u.test(requireString(authority.scriptSha256, `${location}.scriptSha256`, 64, 64))) {
      fail('string-pattern-mismatch', `${location}.scriptSha256`);
    }
    const operations = validateStringArray(authority.allowedOperations, `${location}.allowedOperations`, {
      minimum: 1,
      unique: true,
      itemMinimum: 2,
    });
    for (const [index, operation] of operations.entries()) {
      assertEnum(operation, RELEASE_AUTHORITY_OPERATIONS, `${location}.allowedOperations[${index}]`);
    }
  }

  #validateTarget(value, location, allowDefaultedFields) {
    const target = assertClosedObject(value, TARGET_FIELDS, location);
    assertRequiredFields(target, ['selectorKinds', 'identityFields'], location, allowDefaultedFields);

    const selectorKinds = validateStringArray(target.selectorKinds, `${location}.selectorKinds`, {
      minimum: 1,
      unique: true,
    });
    for (const [index, selectorKind] of selectorKinds.entries()) {
      assertEnum(selectorKind, SELECTOR_KINDS, `${location}.selectorKinds[${index}]`);
    }
    validateStringArray(target.identityFields, `${location}.identityFields`, {
      minimum: 1,
      unique: true,
      pattern: IDENTITY_FIELD_PATTERN,
    });
    if (hasOwn(target, 'requireExactSourceRevision')) {
      requireBoolean(target.requireExactSourceRevision, `${location}.requireExactSourceRevision`);
    } else if (!allowDefaultedFields) {
      fail('missing-required-field', `${location}.requireExactSourceRevision`);
    }
  }

  #validateSuccess(value, location) {
    const success = assertClosedObject(value, SUCCESS_FIELDS, location);
    assertRequiredFields(
      success,
      ['requiredChecksMode', 'requiredChecks', 'requiredOutputs', 'allowedSkippedChecks'],
      location,
      false,
    );
    const requiredChecksMode = requireString(success.requiredChecksMode, `${location}.requiredChecksMode`, 1);
    assertEnum(requiredChecksMode, REQUIRED_CHECK_MODES, `${location}.requiredChecksMode`);
    for (const field of ['requiredChecks', 'requiredOutputs', 'allowedSkippedChecks']) {
      validateStringArray(success[field], `${location}.${field}`, { unique: true, itemMinimum: 1 });
    }
  }

  #validateTiming(value, location) {
    const timing = assertClosedObject(value, TIMING_FIELDS, location);
    assertRequiredFields(
      timing,
      ['expectedDurationSeconds', 'minTimeoutSeconds', 'maxTimeoutSeconds', 'poll'],
      location,
      false,
    );
    for (const field of ['expectedDurationSeconds', 'minTimeoutSeconds', 'maxTimeoutSeconds']) {
      requireFiniteNumber(timing[field], `${location}.${field}`, 1, 604800, true);
    }

    const poll = assertClosedObject(timing.poll, POLL_FIELDS, `${location}.poll`);
    assertRequiredFields(poll, ['initialSeconds', 'maxSeconds', 'multiplier'], `${location}.poll`, false);
    requireFiniteNumber(poll.initialSeconds, `${location}.poll.initialSeconds`, 1, 300, true);
    requireFiniteNumber(poll.maxSeconds, `${location}.poll.maxSeconds`, 1, 900, true);
    requireFiniteNumber(poll.multiplier, `${location}.poll.multiplier`, 1, 4);
  }

  #validateEvidence(value, location) {
    const evidence = assertClosedObject(value, EVIDENCE_FIELDS, location);
    assertRequiredFields(evidence, ['maxBytesPerAttempt', 'maxFailures', 'ttlSeconds'], location, false);
    requireFiniteNumber(evidence.maxBytesPerAttempt, `${location}.maxBytesPerAttempt`, 1024, 10485760, true);
    requireFiniteNumber(evidence.maxFailures, `${location}.maxFailures`, 1, 100, true);
    requireFiniteNumber(evidence.ttlSeconds, `${location}.ttlSeconds`, 60, 604800, true);
  }

  #validateCommand(value, location, allowDefaultedFields) {
    const command = assertClosedObject(value, COMMAND_FIELDS, location);
    assertRequiredFields(command, ['executable', 'args'], location, allowDefaultedFields);
    const executable = requireString(command.executable, `${location}.executable`, 1, 200);
    if (!EXECUTABLE_PATTERN.test(executable)) fail('string-pattern-mismatch', `${location}.executable`);

    const args = requireArray(command.args, `${location}.args`, 0, 200);
    for (const [index, argument] of args.entries()) {
      const argumentLocation = `${location}.args[${index}]`;
      requireString(argument, argumentLocation, 0, 1000);
      parseCommandArgument(argument, argumentLocation);
    }

    if (hasOwn(command, 'cwd')) requireString(command.cwd, `${location}.cwd`, 0, 200);
    else if (!allowDefaultedFields) fail('missing-required-field', `${location}.cwd`);
    if (hasOwn(command, 'env')) this.#validateCommandEnvironment(command.env, `${location}.env`);
    else if (!allowDefaultedFields) fail('missing-required-field', `${location}.env`);
  }

  #validateCommandEnvironment(value, location) {
    const environment = requireArray(value, location, 0, 100);
    const canonicalNames = new Set();
    for (const [index, name] of environment.entries()) {
      const itemLocation = `${location}[${index}]`;
      requireString(name, itemLocation, 1, 64);
      if (!ENVIRONMENT_NAME_PATTERN.test(name)) fail('string-pattern-mismatch', itemLocation);
      const canonicalName = name.toUpperCase();
      if (canonicalNames.has(canonicalName)) fail('duplicate-array-item', location);
      canonicalNames.add(canonicalName);
    }
  }

  #validateDelivery(value, location, allowDefaultedFields) {
    const delivery = assertClosedObject(value, DELIVERY_FIELDS, location);
    assertRequiredFields(
      delivery,
      ['strategy', 'pushCurrentUpstream'],
      location,
      allowDefaultedFields,
      DELIVERY_DEFAULTED_FIELDS,
    );
    const strategy = requireString(delivery.strategy, `${location}.strategy`, 1);
    assertEnum(strategy, DELIVERY_STRATEGIES, `${location}.strategy`);
    if (hasOwn(delivery, 'pushCurrentUpstream')) {
      requireBoolean(delivery.pushCurrentUpstream, `${location}.pushCurrentUpstream`);
    }
  }

  #validateDispatch(value, location, allowDefaultedFields) {
    const dispatch = assertClosedObject(value, DISPATCH_FIELDS, location);
    assertRequiredFields(dispatch, ['enabled', 'inputs'], location, allowDefaultedFields, DISPATCH_DEFAULTED_FIELDS);
    if (hasOwn(dispatch, 'enabled')) requireBoolean(dispatch.enabled, `${location}.enabled`);
    if (hasOwn(dispatch, 'workflow')) requireString(dispatch.workflow, `${location}.workflow`, 0);
    if (hasOwn(dispatch, 'idempotencyInput'))
      requireString(dispatch.idempotencyInput, `${location}.idempotencyInput`, 0);

    const inputs = requireRecord(dispatch.inputs, `${location}.inputs`);
    for (const [key, input] of Object.entries(inputs)) {
      const inputLocation = `${location}.inputs.${key}`;
      if (typeof input === 'string' || typeof input === 'boolean') continue;
      requireFiniteNumber(input, inputLocation, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    }
  }

  #validateGenericCommands(value, location, allowDefaultedFields) {
    const commands = assertClosedObject(value, GENERIC_COMMAND_FIELDS, location);
    assertRequiredFields(commands, ['observe', 'evidence'], location, allowDefaultedFields);
    for (const field of ['start', 'observe', 'evidence', 'cancel']) {
      if (hasOwn(commands, field)) this.#validateCommand(commands[field], `${location}.${field}`, allowDefaultedFields);
    }
  }

  #validateStatusMap(value, location) {
    const statusMap = assertClosedObject(value, STATUS_MAP_FIELDS, location);
    assertRequiredFields(statusMap, ['running', 'succeeded', 'failed', 'cancelled'], location, false);
    for (const field of ['running', 'succeeded', 'failed', 'cancelled']) {
      validateStringArray(statusMap[field], `${location}.${field}`);
    }
  }

  #validateAdapterConfig(value, location, adapter, allowDefaultedFields) {
    const adapterConfig = assertClosedObject(value, ADAPTER_CONFIG_FIELDS[adapter], location);
    if (adapter === 'github-actions') {
      this.#validateGitHubConfig(adapterConfig, location, allowDefaultedFields);
    } else if (adapter === 'generic-ci-cli') {
      this.#validateGenericConfig(adapterConfig, location, allowDefaultedFields);
    } else if (adapter === 'docker-build') {
      this.#validateDockerConfig(adapterConfig, location, allowDefaultedFields);
    } else {
      this.#validateLocalConfig(adapterConfig, location, allowDefaultedFields);
    }
  }

  #validateGitHubConfig(adapterConfig, location, allowDefaultedFields) {
    assertRequiredFields(adapterConfig, ['repository', 'mode'], location, allowDefaultedFields);
    const repository = requireString(adapterConfig.repository, `${location}.repository`, 1);
    if (!REPOSITORY_PATTERN.test(repository)) fail('string-pattern-mismatch', `${location}.repository`);
    const mode = requireString(adapterConfig.mode, `${location}.mode`, 1);
    assertEnum(mode, GITHUB_ACTIONS_MODES, `${location}.mode`);
    if (hasOwn(adapterConfig, 'workflowAllowlist')) {
      validateStringArray(adapterConfig.workflowAllowlist, `${location}.workflowAllowlist`, {
        unique: true,
        itemMinimum: 1,
      });
    }
    if (hasOwn(adapterConfig, 'dispatch')) {
      this.#validateDispatch(adapterConfig.dispatch, `${location}.dispatch`, allowDefaultedFields);
    }
  }

  #validateGenericConfig(adapterConfig, location, allowDefaultedFields) {
    assertRequiredFields(adapterConfig, ['providerId', 'commands', 'statusMap'], location, allowDefaultedFields);
    const providerId = requireString(adapterConfig.providerId, `${location}.providerId`, 1);
    if (!PROVIDER_ID_PATTERN.test(providerId)) fail('string-pattern-mismatch', `${location}.providerId`);
    this.#validateGenericCommands(adapterConfig.commands, `${location}.commands`, allowDefaultedFields);
    this.#validateStatusMap(adapterConfig.statusMap, `${location}.statusMap`);
  }

  #validateDockerConfig(adapterConfig, location, allowDefaultedFields) {
    assertRequiredFields(adapterConfig, ['buildCommand'], location, allowDefaultedFields);
    this.#validateCommand(adapterConfig.buildCommand, `${location}.buildCommand`, allowDefaultedFields);
    if (hasOwn(adapterConfig, 'imageVerification')) {
      const imageVerification = requireArray(adapterConfig.imageVerification, `${location}.imageVerification`);
      for (const [index, command] of imageVerification.entries()) {
        this.#validateCommand(command, `${location}.imageVerification[${index}]`, allowDefaultedFields);
      }
    } else if (!allowDefaultedFields) {
      fail('missing-required-field', `${location}.imageVerification`);
    }
  }

  #validateLocalConfig(adapterConfig, location, allowDefaultedFields) {
    assertRequiredFields(adapterConfig, ['startCommand', 'successExitCodes'], location, allowDefaultedFields);
    this.#validateCommand(adapterConfig.startCommand, `${location}.startCommand`, allowDefaultedFields);
    validateIntegerArray(adapterConfig.successExitCodes, `${location}.successExitCodes`, 0, 255, {
      minimumItems: 1,
      unique: true,
    });
  }
}

/** Validates raw or normalized data against the closed first-version contract. */
export function validateWatchScenario(value, options = {}) {
  return new WatchScenarioValidator().validate(value, options);
}
