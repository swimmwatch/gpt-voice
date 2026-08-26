import { runtimeFail } from '../runtime-core-support.mjs';

import { assertDockerBuildCommandAllowed, assertDockerVerificationCommandAllowed } from './docker-command-policy.mjs';
import { OwnedProcessAdapter } from './owned-process-adapter.mjs';

const DOCKER_BUILD_ADAPTER = 'docker-build';
const PREFLIGHT_MAXIMUM_MILLISECONDS = 5_000;
const DOCKER_DAEMON_FORMAT = '{{.Server.Version}}';

/** Watches one declared local Docker build and proves success through every declared image verification command. */
export class DockerBuildProcessAdapter extends OwnedProcessAdapter {
  #buildCommand;
  #imageVerification;

  constructor(options = {}) {
    super({ ...options, adapterName: DOCKER_BUILD_ADAPTER });
    const config = this.scenario.adapterConfig;
    if (config.buildCommand === undefined || !Array.isArray(config.imageVerification)) {
      runtimeFail('invalid-docker-build-adapter-scenario');
    }
    this.#buildCommand = config.buildCommand;
    this.#imageVerification = config.imageVerification;
  }

  _verificationDefinitions() {
    return this.#imageVerification;
  }

  async _resolvePrimaryCommand(context) {
    return this.resolveScenarioCommand(this.#buildCommand, context);
  }

  _preflightCommand(prepared) {
    return {
      ...prepared.primaryCommand,
      args: ['version', '--format', DOCKER_DAEMON_FORMAT],
      timeoutMilliseconds: Math.min(prepared.context.timeoutMilliseconds, PREFLIGHT_MAXIMUM_MILLISECONDS),
    };
  }

  _unavailableCode() {
    return 'docker-daemon-unavailable';
  }

  _isPrimaryResultSuccessful(result) {
    return result.terminal.classification === 'succeeded' && result.terminal.exitCode === 0;
  }

  _validatePreparedCommands({ primaryCommand, verificationCommands }) {
    assertDockerBuildCommandAllowed(primaryCommand);
    for (const command of verificationCommands) assertDockerVerificationCommandAllowed(command);
  }
}
