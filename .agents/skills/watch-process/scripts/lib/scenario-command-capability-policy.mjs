import { fail, hasOwn } from './scenario-contract-support.mjs';

const SHELL_EXECUTABLES = new Set(['bash', 'cmd', 'dash', 'fish', 'ksh', 'powershell', 'pwsh', 'sh', 'zsh']);

const INLINE_CODE_OPTIONS = new Map([
  [
    'bun',
    Object.freeze({
      exact: new Set(['-e', '--eval', '-p', '--print']),
      long: ['--eval', '--print'],
      short: ['e', 'p'],
    }),
  ],
  ['deno', Object.freeze({ exact: new Set(['eval']), long: [], short: [] })],
  [
    'node',
    Object.freeze({
      exact: new Set(['-e', '--eval', '-p', '--print']),
      long: ['--eval', '--print'],
      short: ['e', 'p'],
    }),
  ],
  ['perl', Object.freeze({ exact: new Set(['-e']), long: [], short: ['e'] })],
  ['php', Object.freeze({ exact: new Set(['-r']), long: [], short: ['r'] })],
  ['python', Object.freeze({ exact: new Set(['-c']), long: [], short: ['c'] })],
  ['ruby', Object.freeze({ exact: new Set(['-e']), long: [], short: ['e'] })],
]);

const COMMAND_FIELDS_BY_ADAPTER = Object.freeze({
  'docker-build': Object.freeze(['buildCommand', 'imageVerification']),
  'generic-ci-cli': Object.freeze(['commands']),
  'github-actions': Object.freeze([]),
  'local-command': Object.freeze(['startCommand']),
});

function executableName(executable) {
  const name = executable.split('/').at(-1).toLowerCase();
  return name.endsWith('.exe') ? name.slice(0, -4) : name;
}

function inlineCodeFlags(executable) {
  if (/^python(?:\d+(?:\.\d+)*)?$/u.test(executable)) return INLINE_CODE_OPTIONS.get('python');
  return INLINE_CODE_OPTIONS.get(executable);
}

function isInlineCodeArgument(options, argument) {
  const value = argument.toLowerCase();
  if (options.exact.has(value)) return true;
  if (options.long.some((flag) => value.startsWith(`${flag}=`))) return true;
  return options.short.some((flag) => value.startsWith(`-${flag}`) && !value.startsWith('--'));
}

function normalizedAction(value) {
  return value.toLowerCase().replaceAll('_', '-');
}

function containsWorkflowAction(workflow, action) {
  const workflowName = workflow
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.ya?ml$/iu, '');
  const normalizedWorkflow = workflowName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
  const normalized = normalizedAction(action);
  return (
    normalizedWorkflow === normalized ||
    normalizedWorkflow.startsWith(`${normalized}-`) ||
    normalizedWorkflow.endsWith(`-${normalized}`) ||
    normalizedWorkflow.includes(`-${normalized}-`)
  );
}

function containsDeclaredAction(command, action) {
  const executable = executableName(command.executable);
  const arguments_ = command.args.map((argument) => normalizedAction(argument));
  const normalized = normalizedAction(action);
  if (normalized === 'force-push') {
    return (
      executable === 'git' &&
      arguments_.includes('push') &&
      arguments_.some(
        (argument) => /^--?f(?:orce(?:-with-lease)?)?(?:=.*)?$/u.test(argument) || argument.startsWith('+'),
      )
    );
  }
  if (normalized === 'registry-push') {
    return ['docker', 'podman'].includes(executable) && arguments_[0] === 'push';
  }
  const terms = [normalizedAction(executable), ...arguments_];
  return terms.some((term) => term === normalized || term.startsWith(`${normalized}-`));
}

function commandEntries(scenario) {
  const entries = scenario.verification.map((command, index) => [command, `$.verification[${index}]`]);
  const fields = COMMAND_FIELDS_BY_ADAPTER[scenario.adapter];
  for (const field of fields) {
    const value = scenario.adapterConfig[field];
    if (field === 'commands' && value !== undefined) {
      for (const [name, command] of Object.entries(value)) {
        entries.push([command, `$.adapterConfig.commands.${name}`]);
      }
    } else if (field === 'imageVerification' && Array.isArray(value)) {
      for (const [index, command] of value.entries()) {
        entries.push([command, `$.adapterConfig.imageVerification[${index}]`]);
      }
    } else if (value !== undefined) {
      entries.push([value, `$.adapterConfig.${field}`]);
    }
  }
  return entries;
}

/** Enforces scenario command capabilities that syntax-only validation cannot prove. */
export class ScenarioCommandCapabilityPolicy {
  validate(scenario) {
    const forbiddenActions = new Set(scenario.forbiddenActions.map(normalizedAction));
    for (const [command, location] of commandEntries(scenario)) {
      this.#validateCommand(command, location, forbiddenActions);
    }
    this.#validateDispatch(scenario, forbiddenActions);
    return scenario;
  }

  #validateCommand(command, location, forbiddenActions) {
    const executable = executableName(command.executable);
    if (SHELL_EXECUTABLES.has(executable)) fail('shell-executable-forbidden', `${location}.executable`);

    const nestedShellIndex = command.args.findIndex((argument) => SHELL_EXECUTABLES.has(executableName(argument)));
    if (nestedShellIndex >= 0) fail('shell-executable-forbidden', `${location}.args[${nestedShellIndex}]`);

    const inlineFlags = inlineCodeFlags(executable);
    if (inlineFlags !== undefined && command.args.some((argument) => isInlineCodeArgument(inlineFlags, argument))) {
      fail('inline-code-execution-forbidden', `${location}.args`);
    }
    for (const [index, argument] of command.args.entries()) {
      const nestedInlineFlags = inlineCodeFlags(executableName(argument));
      if (
        nestedInlineFlags !== undefined &&
        command.args.slice(index + 1).some((candidate) => isInlineCodeArgument(nestedInlineFlags, candidate))
      ) {
        fail('inline-code-execution-forbidden', `${location}.args`);
      }
    }

    for (const action of forbiddenActions) {
      if (containsDeclaredAction(command, action)) fail('forbidden-action-command', location);
    }
  }

  #validateDispatch(scenario, forbiddenActions) {
    if (scenario.adapter !== 'github-actions' || !hasOwn(scenario.adapterConfig, 'dispatch')) return;
    const dispatch = scenario.adapterConfig.dispatch;
    if (!dispatch.enabled || typeof dispatch.workflow !== 'string') return;
    for (const action of forbiddenActions) {
      if (containsWorkflowAction(dispatch.workflow, action)) {
        fail('forbidden-action-dispatch', '$.adapterConfig.dispatch.workflow');
      }
    }
  }
}
