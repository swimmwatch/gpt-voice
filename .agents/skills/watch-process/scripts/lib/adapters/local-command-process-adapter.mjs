import { freezeArray, requireNonNegativeInteger, runtimeFail } from '../runtime-core-support.mjs';

import { OwnedProcessAdapter } from './owned-process-adapter.mjs';

const LOCAL_COMMAND_ADAPTER = 'local-command';
const PREFLIGHT_MAXIMUM_MILLISECONDS = 5_000;

function normalizeSuccessExitCodes(value) {
  if (!Array.isArray(value) || value.length === 0) runtimeFail('invalid-local-command-adapter-scenario');
  const codes = value.map((code) => requireNonNegativeInteger(code, 'invalid-local-command-adapter-scenario', 255));
  if (new Set(codes).size !== codes.length) runtimeFail('invalid-local-command-adapter-scenario');
  return freezeArray(codes);
}

/** Watches one explicit local command with receipt-bound identity and declared verification. */
export class LocalCommandProcessAdapter extends OwnedProcessAdapter {
  #startCommand;
  #successExitCodes;

  constructor(options = {}) {
    super({ ...options, adapterName: LOCAL_COMMAND_ADAPTER });
    const config = this.scenario.adapterConfig;
    if (config.startCommand === undefined) runtimeFail('invalid-local-command-adapter-scenario');
    this.#startCommand = config.startCommand;
    this.#successExitCodes = normalizeSuccessExitCodes(config.successExitCodes);
  }

  async _resolvePrimaryCommand(context) {
    return this.resolveScenarioCommand(this.#startCommand, context);
  }

  _preflightCommand(prepared) {
    return {
      ...prepared.primaryCommand,
      args: ['--version'],
      timeoutMilliseconds: Math.min(prepared.context.timeoutMilliseconds, PREFLIGHT_MAXIMUM_MILLISECONDS),
    };
  }

  _unavailableCode() {
    return 'local-command-unavailable';
  }

  _isPrimaryResultSuccessful(result) {
    return result.terminal.exitCode !== null && this.#successExitCodes.includes(result.terminal.exitCode);
  }

  _validatePreparedCommands({ primaryCommand, verificationCommands }) {
    if (primaryCommand === null || !Array.isArray(verificationCommands)) {
      runtimeFail('invalid-local-command-adapter-scenario');
    }
  }
}
