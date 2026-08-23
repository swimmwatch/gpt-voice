import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as scenarioContract from '../../../.agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs';
import {
  SCENARIO_FILE_SUFFIX,
  SCENARIO_SCHEMA_ID,
  SCENARIO_SCHEMA_VERSION,
  WatchScenarioRegistry,
  assertPathWithinRepairScope,
  assertRepairPatchWithinScope,
  canonicalizeJson,
  digestCanonicalJson,
  isPathInRepairScope,
  matchesRepairGlob,
  normalizeWatchScenario,
  parseCommandArgument,
  resolveCommandArguments,
  validateRepairGlob,
} from '../../../.agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs';

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_PATH = path.resolve(TEST_DIRECTORY, '../../..');
const SCHEMA_PATH = path.join(
  WORKSPACE_PATH,
  '.agents/skills/watch-process/references/process-watch-scenario.schema.json',
);
const SCENARIOS_PATH = path.join(WORKSPACE_PATH, '.codex/process-watch/scenarios');
const REGISTRY_PATH = path.join(WORKSPACE_PATH, '.agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs');
const LIBRARY_PATH = path.dirname(REGISTRY_PATH);
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function command(executable = 'node', args = []) {
  return { executable, args };
}

function makeAdapterConfig(adapter) {
  switch (adapter) {
    case 'github-actions':
      return { repository: 'owner/repository', mode: 'run' };
    case 'generic-ci-cli':
      return {
        providerId: 'acme-ci',
        commands: { observe: command('acme-ci', ['run', 'show']), evidence: command('acme-ci', ['run', 'logs']) },
        statusMap: { running: ['running'], succeeded: ['passed'], failed: ['failed'], cancelled: ['cancelled'] },
      };
    case 'docker-build':
      return { buildCommand: command('docker', ['build', '.']) };
    case 'local-command':
      return { startCommand: command(), successExitCodes: [0] };
    default:
      throw new Error('Unknown test adapter');
  }
}

function makeScenario(adapter = 'github-actions') {
  return {
    $schema: SCENARIO_SCHEMA_ID,
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: 'valid-scenario',
    adapter,
    target: { selectorKinds: ['start'], identityFields: ['sourceSha'] },
    success: {
      requiredChecksMode: 'none',
      requiredChecks: [],
      requiredOutputs: [],
      allowedSkippedChecks: [],
    },
    timing: {
      expectedDurationSeconds: 60,
      minTimeoutSeconds: 30,
      maxTimeoutSeconds: 120,
      poll: { initialSeconds: 1, maxSeconds: 10, multiplier: 1.5 },
    },
    evidence: { maxBytesPerAttempt: 1024, maxFailures: 1, ttlSeconds: 60 },
    repair: { includeGlobs: ['src/**'] },
    verification: [command('node', ['--version'])],
    delivery: { strategy: 'no-restart' },
    forbiddenActions: [],
    adapterConfig: makeAdapterConfig(adapter),
  };
}

function expectValidationFailure(value, expectedCode) {
  assert.throws(
    () => normalizeWatchScenario(value),
    (error) => error?.name === 'ScenarioValidationError' && error.code === expectedCode,
  );
}

function fullRepairScope(overrides = {}) {
  return {
    includeGlobs: ['src/**'],
    excludeGlobs: ['src/private/**'],
    allowCreate: false,
    allowDelete: false,
    maxFiles: 2,
    maxBytesChanged: 64,
    ...overrides,
  };
}

describe('watch-process scenario schema', () => {
  it('keeps the scenario contract facade stable while implementation responsibilities move internally', () => {
    assert.deepEqual(Object.keys(scenarioContract).sort(), [
      'SCENARIO_FILE_SUFFIX',
      'SCENARIO_SCHEMA_ID',
      'SCENARIO_SCHEMA_VERSION',
      'WatchScenarioRegistry',
      'applyWatchScenarioDefaults',
      'assertPathWithinRepairScope',
      'assertRepairPatchWithinScope',
      'canonicalizeJson',
      'createScenarioValidationError',
      'digestCanonicalJson',
      'isPathInRepairScope',
      'matchesRepairGlob',
      'normalizeWatchScenario',
      'parseCommandArgument',
      'resolveCommandArguments',
      'validateRepairGlob',
      'validateWatchScenario',
    ]);
  });

  it('records the exact Draft 2020-12 identity, closed fields, adapter variants, and defaults', async () => {
    const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));

    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.$id, SCENARIO_SCHEMA_ID);
    assert.deepEqual(schema.properties.$schema, { const: SCENARIO_SCHEMA_ID });
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.schemaVersion, { const: SCENARIO_SCHEMA_VERSION });
    assert.deepEqual(schema.properties.adapter.enum, [
      'github-actions',
      'generic-ci-cli',
      'docker-build',
      'local-command',
    ]);
    assert.equal(schema.$defs.target.properties.requireExactSourceRevision.default, true);
    assert.deepEqual(schema.$defs.repair.properties.excludeGlobs.default, []);
    assert.equal(schema.$defs.repair.properties.allowCreate.default, false);
    assert.equal(schema.$defs.repair.properties.allowDelete.default, false);
    assert.equal(schema.$defs.repair.properties.maxFiles.default, 50);
    assert.equal(schema.$defs.repair.properties.maxBytesChanged.default, 1048576);
    assert.equal(schema.$defs.command.properties.cwd.default, '.');
    assert.deepEqual(schema.$defs.command.properties.env.default, []);
    assert.equal(schema.$defs.delivery.properties.pushCurrentUpstream.default, false);
    assert.equal(schema.$defs.dispatch.properties.enabled.default, false);
    assert.deepEqual(schema.$defs.dockerBuildAdapterConfig.properties.imageVerification.default, []);
    assert.deepEqual(schema.$defs.repair.required, ['includeGlobs']);
    assert.deepEqual(schema.$defs.delivery.required, ['strategy']);
  });
});

describe('WatchScenarioRegistry normalization', () => {
  it('applies documented defaults after validating input, preserves source data, and records both digests', () => {
    const source = makeScenario();
    source.adapterConfig.dispatch = { inputs: {} };
    const beforeNormalization = clone(source);
    const normalized = normalizeWatchScenario(source);

    assert.deepEqual(source, beforeNormalization);
    assert.equal(normalized.scenario.description, '');
    assert.equal(normalized.scenario.target.requireExactSourceRevision, true);
    assert.deepEqual(normalized.scenario.repair.excludeGlobs, []);
    assert.equal(normalized.scenario.repair.allowCreate, false);
    assert.equal(normalized.scenario.repair.allowDelete, false);
    assert.equal(normalized.scenario.repair.maxFiles, 50);
    assert.equal(normalized.scenario.repair.maxBytesChanged, 1048576);
    assert.equal(normalized.scenario.verification[0].cwd, '.');
    assert.deepEqual(normalized.scenario.verification[0].env, []);
    assert.equal(normalized.scenario.delivery.pushCurrentUpstream, false);
    assert.equal(normalized.scenario.adapterConfig.dispatch.enabled, false);
    assert.equal(Object.hasOwn(normalized.scenario.adapterConfig, 'imageVerification'), false);

    const normalizedDocker = normalizeWatchScenario(makeScenario('docker-build'));
    assert.deepEqual(normalizedDocker.scenario.adapterConfig.imageVerification, []);
    assert.equal(normalized.migration.fromVersion, SCENARIO_SCHEMA_VERSION);
    assert.equal(normalized.migration.toVersion, SCENARIO_SCHEMA_VERSION);
    assert.equal(normalized.migration.oldDigest, normalized.sourceDigest);
    assert.equal(normalized.migration.newDigest, normalized.canonicalDigest);
    assert.match(normalized.canonicalDigest, /^[a-f0-9]{64}$/u);
    assert.notEqual(normalized.sourceDigest, normalized.canonicalDigest);
    assert.equal(Object.isFrozen(normalized.scenario), true);
  });

  it('produces the same canonical digest regardless of object key order', () => {
    const original = makeScenario();
    const reordered = Object.fromEntries(Object.entries(original).reverse());
    const first = normalizeWatchScenario(original);
    const second = normalizeWatchScenario(reordered);

    assert.equal(first.canonicalJson, second.canonicalJson);
    assert.equal(first.canonicalDigest, second.canonicalDigest);
    assert.equal(canonicalizeJson({ b: 1, a: [true, null] }), '{"a":[true,null],"b":1}');
    assert.equal(digestCanonicalJson(first.canonicalJson), first.canonicalDigest);
  });

  it('rejects unknown capabilities, ambiguous versions, and every adapter conditional omission', () => {
    const unknownRoot = makeScenario();
    unknownRoot.unexpected = true;
    expectValidationFailure(unknownRoot, 'unknown-field');

    const unknownNested = makeScenario();
    unknownNested.target.unexpected = true;
    expectValidationFailure(unknownNested, 'unknown-field');

    const missingVersion = makeScenario();
    delete missingVersion.schemaVersion;
    expectValidationFailure(missingVersion, 'missing-required-field');

    const unsupportedMinor = makeScenario();
    unsupportedMinor.schemaVersion = '1.0.1';
    expectValidationFailure(unsupportedMinor, 'unsupported-schema-version');

    const unsupportedMajor = makeScenario();
    unsupportedMajor.schemaVersion = '2.0.0';
    expectValidationFailure(unsupportedMajor, 'unsupported-schema-major');

    for (const adapter of ['github-actions', 'generic-ci-cli', 'docker-build', 'local-command']) {
      const invalid = makeScenario(adapter);
      invalid.adapterConfig = {};
      expectValidationFailure(invalid, 'missing-required-field');
    }

    const shellText = makeScenario();
    shellText.verification[0].shell = true;
    expectValidationFailure(shellText, 'unknown-field');

    const invalidEnvironment = makeScenario();
    invalidEnvironment.verification[0].env = ['bad_name'];
    expectValidationFailure(invalidEnvironment, 'string-pattern-mismatch');

    const tooManyRepairGlobs = makeScenario();
    tooManyRepairGlobs.repair.includeGlobs = Array.from({ length: 101 }, (_, index) => `src/${index}`);
    expectValidationFailure(tooManyRepairGlobs, 'array-length-out-of-range');
  });

  it('keeps the normative schema and runtime validator aligned for source defaults and adapter closure', async () => {
    const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
    const adapterDefinitionByName = Object.fromEntries(
      schema.allOf.map((conditional) => [
        conditional.if.properties.adapter.const,
        conditional.then.properties.adapterConfig.$ref,
      ]),
    );
    assert.deepEqual(adapterDefinitionByName, {
      'docker-build': '#/$defs/dockerBuildAdapterConfig',
      'generic-ci-cli': '#/$defs/genericCiAdapterConfig',
      'github-actions': '#/$defs/githubActionsAdapterConfig',
      'local-command': '#/$defs/localCommandAdapterConfig',
    });

    for (const adapter of ['github-actions', 'generic-ci-cli', 'docker-build', 'local-command']) {
      const source = makeScenario(adapter);
      assert.doesNotThrow(() => normalizeWatchScenario(source));
      const definitionName = adapterDefinitionByName[adapter].split('/').at(-1);
      assert.equal(schema.$defs[definitionName].additionalProperties, false);
    }

    const foreignCapability = makeScenario('github-actions');
    foreignCapability.adapterConfig.buildCommand = command('docker', ['build', '.']);
    assert.equal(Object.hasOwn(schema.$defs.githubActionsAdapterConfig.properties, 'buildCommand'), false);
    expectValidationFailure(foreignCapability, 'unknown-field');

    const wrongSchema = makeScenario();
    wrongSchema.$schema = 'https://attacker.invalid/not-the-contract';
    assert.equal(schema.properties.$schema.const, SCENARIO_SCHEMA_ID);
    expectValidationFailure(wrongSchema, 'unsupported-schema-id');
  });

  it('rejects shell execution, inline code, forbidden actions, and credential-valued environments', () => {
    const shell = makeScenario('local-command');
    shell.adapterConfig.startCommand = command('bash', ['-c', 'gh release create v9.9.9']);
    shell.forbiddenActions = ['release'];
    expectValidationFailure(shell, 'shell-executable-forbidden');

    const inlineCode = makeScenario('local-command');
    inlineCode.adapterConfig.startCommand = command('node', ['--eval', 'process.exit(0)']);
    expectValidationFailure(inlineCode, 'inline-code-execution-forbidden');

    for (const attachedFlag of ['--eval=process.exit(0)', '-eprocess.exit(0)', '-p1+1']) {
      const attachedInlineCode = makeScenario('local-command');
      attachedInlineCode.adapterConfig.startCommand = command('node', [attachedFlag]);
      expectValidationFailure(attachedInlineCode, 'inline-code-execution-forbidden');
    }

    const indirectShell = makeScenario('local-command');
    indirectShell.adapterConfig.startCommand = command('env', ['bash', '-c', 'exit 0']);
    expectValidationFailure(indirectShell, 'shell-executable-forbidden');

    const indirectInlineCode = makeScenario('local-command');
    indirectInlineCode.adapterConfig.startCommand = command('env', ['python3.12', '-c', 'raise SystemExit(0)']);
    expectValidationFailure(indirectInlineCode, 'inline-code-execution-forbidden');

    const indirectAttachedInlineCode = makeScenario('local-command');
    indirectAttachedInlineCode.adapterConfig.startCommand = command('env', ['python3.12', '-craise SystemExit(0)']);
    expectValidationFailure(indirectAttachedInlineCode, 'inline-code-execution-forbidden');

    const forbiddenRelease = makeScenario('local-command');
    forbiddenRelease.adapterConfig.startCommand = command('gh', ['release', 'create', 'v9.9.9']);
    forbiddenRelease.forbiddenActions = ['release'];
    expectValidationFailure(forbiddenRelease, 'forbidden-action-command');

    for (const forceArgument of ['--force-with-lease=main:deadbeef', '+main:main']) {
      const forbiddenForcePush = makeScenario('local-command');
      forbiddenForcePush.adapterConfig.startCommand = command('git', ['push', 'origin', forceArgument]);
      forbiddenForcePush.forbiddenActions = ['force-push'];
      expectValidationFailure(forbiddenForcePush, 'forbidden-action-command');
    }

    const forbiddenDispatch = makeScenario('github-actions');
    forbiddenDispatch.adapterConfig.dispatch = {
      enabled: true,
      idempotencyInput: 'watch_id',
      inputs: { watch_id: '{{watch.id}}' },
      workflow: 'ci-release.yml',
    };
    forbiddenDispatch.forbiddenActions = ['release'];
    expectValidationFailure(forbiddenDispatch, 'forbidden-action-dispatch');

    const credentialValue = makeScenario();
    credentialValue.verification[0].env = { GITHUB_TOKEN: 'review-secret-fixture' };
    expectValidationFailure(credentialValue, 'expected-array');

    const allowlistedEnvironment = makeScenario();
    allowlistedEnvironment.verification[0].env = ['PATH', 'GITHUB_TOKEN'];
    const normalized = normalizeWatchScenario(allowlistedEnvironment);
    assert.deepEqual(normalized.scenario.verification[0].env, ['PATH', 'GITHUB_TOKEN']);
    assert.equal(normalized.canonicalJson.includes('review-secret-fixture'), false);
  });

  it('loads only filename-bound UTF-8 JSON scenarios and leaves no parser ambiguity', async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'watch-scenario-contract-'));
    try {
      const source = makeScenario();
      await writeFile(
        path.join(temporaryDirectory, `valid-scenario${SCENARIO_FILE_SUFFIX}`),
        JSON.stringify(source),
        'utf8',
      );
      await writeFile(path.join(temporaryDirectory, `invalid-utf8${SCENARIO_FILE_SUFFIX}`), Buffer.from([0xff]));
      await writeFile(
        path.join(temporaryDirectory, `different-name${SCENARIO_FILE_SUFFIX}`),
        JSON.stringify(source),
        'utf8',
      );

      const registry = new WatchScenarioRegistry(temporaryDirectory);
      assert.equal((await registry.load('valid-scenario')).scenario.id, 'valid-scenario');
      await assert.rejects(registry.load('invalid-utf8'), (error) => error.code === 'invalid-scenario-utf8');
      await assert.rejects(
        registry.loadFile(path.join(temporaryDirectory, `different-name${SCENARIO_FILE_SUFFIX}`)),
        (error) => error.code === 'scenario-file-id-mismatch',
      );
      await assert.rejects(
        registry.loadFile(path.join(temporaryDirectory, '../outside.watch.json')),
        (error) => error.code === 'scenario-file-outside-directory',
      );
      await assert.rejects(
        registry.loadFile(path.join(temporaryDirectory, 'nested', `valid-scenario${SCENARIO_FILE_SUFFIX}`)),
        (error) => error.code === 'scenario-file-outside-directory',
      );
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});

describe('watch-process scenarios', () => {
  it('validates and canonicalizes one complete tracked example per supported adapter', async () => {
    const registry = new WatchScenarioRegistry(SCENARIOS_PATH);
    const expected = [
      ['github-pr-required-checks', 'github-actions'],
      ['generic-ci-run', 'generic-ci-cli'],
      ['local-docker-build', 'docker-build'],
      ['local-long-test', 'local-command'],
    ];

    for (const [id, adapter] of expected) {
      const normalized = await registry.load(id);
      assert.equal(normalized.scenario.id, id);
      assert.equal(normalized.scenario.adapter, adapter);
      assert.equal(normalized.canonicalDigest, digestCanonicalJson(normalized.canonicalJson));
    }
  });

  it('binds the GitHub PR scenario to this repository and its fail-closed repair loop', async () => {
    const scenario = (await new WatchScenarioRegistry(SCENARIOS_PATH).load('github-pr-required-checks')).scenario;

    assert.equal(scenario.adapterConfig.repository, 'swimmwatch/gpt-voice');
    assert.equal(scenario.adapterConfig.mode, 'pull-request-contract');
    assert.deepEqual(scenario.adapterConfig.workflowAllowlist, [
      'actionlint.yml',
      'dependency-review.yml',
      'local-whisper-packaging.yml',
      'pr-checks.yml',
      'repository-security.yml',
      'watch-process-compatibility.yml',
    ]);
    assert.deepEqual(scenario.delivery, { strategy: 'git-delivery', pushCurrentUpstream: true });
    assert.equal(scenario.target.requireExactSourceRevision, true);
    assert.equal(scenario.success.requiredChecksMode, 'provider-required');
    assert.equal(scenario.repair.excludeGlobs.includes('.agents/skills/watch-process/**'), true);
    assert.equal(scenario.repair.excludeGlobs.includes('.codex/**'), true);
    assert.deepEqual(
      scenario.verification.map((command) => command.args.join(' ')),
      [
        'run format:check',
        'run lint',
        'run test:types',
        'run test:unit:ci',
        'run build:prod',
        'run verify:renderer-bundle',
        'run validate:workflows',
        'run validate:dependabot',
      ],
    );
  });
});

describe('substitutions and repair scope', () => {
  it('accepts only whole allowlisted substitution tokens and resolves them once', () => {
    assert.deepEqual(parseCommandArgument('{{target.source_sha}}'), {
      kind: 'substitution',
      key: 'target.source_sha',
    });
    assert.deepEqual(parseCommandArgument('--json'), { kind: 'literal', value: '--json' });
    assert.deepEqual(
      resolveCommandArguments(['run', '{{target.id}}', '{{attempt.number}}'], {
        watch: { id: 'watch-123' },
        workspace: { root: '/workspace' },
        invocation: { timeout_seconds: 120 },
        target: { selector: 'target-selector', id: 'target-1', source_sha: 'a'.repeat(40) },
        attempt: { number: 2 },
      }),
      ['run', 'target-1', '2'],
    );

    for (const argument of [
      'prefix-{{target.id}}',
      '{{target.id}}-suffix',
      '{{target.unlisted}}',
      '{{environment.secret}}',
      '{{provider.output}}',
      '{{watch.id',
      'value}}',
    ]) {
      assert.throws(
        () => parseCommandArgument(argument),
        (error) => error?.name === 'ScenarioValidationError',
      );
    }
    assert.throws(
      () =>
        resolveCommandArguments(['{{watch.id}}'], {
          watch: { id: '{{target.id}}' },
          workspace: { root: '/workspace' },
          invocation: { timeout_seconds: 120 },
          target: { selector: 'target-selector', id: 'target-1', source_sha: 'a'.repeat(40) },
          attempt: { number: 2 },
        }),
      (error) => error?.name === 'ScenarioValidationError' && error.code === 'invalid-substitution-value',
    );
  });

  it('validates POSIX repair globs, lets exclusions win, and enforces patch authority', () => {
    assert.equal(validateRepairGlob('src/**'), 'src/**');
    assert.equal(validateRepairGlob('package*.json'), 'package*.json');
    assert.equal(validateRepairGlob('src/файл?.mjs'), 'src/файл?.mjs');
    assert.equal(matchesRepairGlob('src/**', 'src/nested/file.mjs'), true);
    assert.equal(matchesRepairGlob('src/*.mjs', 'src/nested/file.mjs'), false);

    for (const glob of [
      '../src/**',
      '/src/**',
      'C:/src/**',
      '//server/share/**',
      'src\\**',
      'src//**',
      'src/./**',
      'src/../**',
      'src/{a,b}.mjs',
      'src/[ab].mjs',
      'src/@(a).mjs',
      '!src/**',
      `src/${String.fromCharCode(0)}file`,
    ]) {
      assert.throws(
        () => validateRepairGlob(glob),
        (error) => error?.name === 'ScenarioValidationError',
      );
    }

    const repair = fullRepairScope();
    assert.equal(isPathInRepairScope(repair, 'src/file.mjs'), true);
    assert.equal(isPathInRepairScope(repair, 'src/private/token.mjs'), false);
    assert.equal(isPathInRepairScope(repair, 'tests/file.mjs'), false);
    assert.equal(
      assertRepairPatchWithinScope(repair, {
        files: [{ path: 'src/file.mjs', operation: 'modify' }],
        bytesChanged: 64,
      }),
      true,
    );
    assert.throws(
      () =>
        assertRepairPatchWithinScope(repair, {
          files: [{ path: 'src/new-file.mjs', operation: 'create' }],
          bytesChanged: 1,
        }),
      (error) => error?.name === 'ScenarioValidationError' && error.code === 'repair-create-not-allowed',
    );
    assert.throws(
      () =>
        assertRepairPatchWithinScope(repair, {
          files: [{ path: 'src/file.mjs', operation: 'delete' }],
          bytesChanged: 1,
        }),
      (error) => error?.name === 'ScenarioValidationError' && error.code === 'repair-delete-not-allowed',
    );
    assert.throws(
      () => assertRepairPatchWithinScope(repair, { files: [], bytesChanged: 65 }),
      (error) => error?.name === 'ScenarioValidationError' && error.code === 'repair-patch-limit-exceeded',
    );
    assert.throws(
      () =>
        assertRepairPatchWithinScope(repair, {
          files: [
            { path: 'src/one.mjs', operation: 'modify' },
            { path: 'src/two.mjs', operation: 'modify' },
            { path: 'src/three.mjs', operation: 'modify' },
          ],
          bytesChanged: 1,
        }),
      (error) => error?.name === 'ScenarioValidationError' && error.code === 'repair-patch-limit-exceeded',
    );
  });

  it('rejects symlink or reparse-point escapes while accepting an in-scope real path', async (context) => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'watch-repair-scope-'));
    const workspaceRoot = path.join(temporaryDirectory, 'workspace');
    const externalRoot = path.join(temporaryDirectory, 'external');
    const repair = fullRepairScope({ includeGlobs: ['**'], excludeGlobs: [] });
    try {
      await mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
      await mkdir(externalRoot, { recursive: true });
      await writeFile(path.join(workspaceRoot, 'src', 'inside.mjs'), 'export {};', 'utf8');
      await writeFile(path.join(externalRoot, 'outside.mjs'), 'export {};', 'utf8');

      const insidePath = await assertPathWithinRepairScope({
        workspaceRoot,
        repair,
        candidatePath: 'src/inside.mjs',
      });
      assert.equal(insidePath, path.join(workspaceRoot, 'src', 'inside.mjs'));

      try {
        await symlink(externalRoot, path.join(workspaceRoot, 'linked'), 'dir');
      } catch (error) {
        if (error?.code === 'EPERM' || error?.code === 'EACCES') {
          context.skip('The host does not permit test symlink creation.');
          return;
        }
        throw error;
      }
      await assert.rejects(
        assertPathWithinRepairScope({ workspaceRoot, repair, candidatePath: 'linked/outside.mjs' }),
        (error) => error?.name === 'ScenarioValidationError' && error.code === 'repair-path-through-link',
      );
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});

describe('scenario runtime boundary', () => {
  it('uses only Node built-ins and internal modules and has no GitLab-specific surface', async () => {
    const librarySources = await Promise.all(
      (await readdir(LIBRARY_PATH, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
        .map((entry) => readFile(path.join(LIBRARY_PATH, entry.name), 'utf8')),
    );
    const activeArtifacts = [
      ...librarySources,
      await readFile(SCHEMA_PATH, 'utf8'),
      ...(await Promise.all(
        ['github-pr-required-checks', 'generic-ci-run', 'local-docker-build', 'local-long-test'].map((id) =>
          readFile(path.join(SCENARIOS_PATH, `${id}${SCENARIO_FILE_SUFFIX}`), 'utf8'),
        ),
      )),
    ].join('\n');
    const imports = librarySources.flatMap((source) =>
      [...source.matchAll(/from\s+['"]([^'"]+)['"]/gu)].map((match) => match[1]),
    );

    assert.equal(
      imports.every((specifier) => specifier.startsWith('node:') || specifier.startsWith('./')),
      true,
    );
    assert.doesNotMatch(activeArtifacts, /(?:gitlab|\bglab\b)/iu);
  });
});
