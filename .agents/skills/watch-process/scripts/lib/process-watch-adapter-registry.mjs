import { DockerBuildProcessAdapter } from './adapters/docker-build-process-adapter.mjs';
import { GenericCiCliProcessAdapter } from './adapters/generic-ci-cli-process-adapter.mjs';
import { GitHubActionsProcessAdapter } from './adapters/github-actions-process-adapter.mjs';
import { LocalCommandProcessAdapter } from './adapters/local-command-process-adapter.mjs';
import { ProcessAdapter } from './runtime-contracts.mjs';
import { freezeArray, freezeRecord, runtimeFail } from './runtime-core-support.mjs';

const BUILT_IN_ADAPTER_FACTORIES = Object.freeze({
  'docker-build': (options) => new DockerBuildProcessAdapter(options),
  'generic-ci-cli': (options) => new GenericCiCliProcessAdapter(options),
  'github-actions': (options) => new GitHubActionsProcessAdapter(options),
  'local-command': (options) => new LocalCommandProcessAdapter(options),
});

function validateAdapterName(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{2,63}$/u.test(value)) runtimeFail('invalid-process-adapter-name');
  return value;
}

/** Creates exactly one declared adapter without global registries or provider discovery. */
export class ProcessWatchAdapterRegistry {
  #factories;

  constructor({ factories = BUILT_IN_ADAPTER_FACTORIES } = {}) {
    if (factories === null || typeof factories !== 'object' || Array.isArray(factories)) {
      runtimeFail('invalid-process-adapter-registry');
    }
    const normalized = new Map();
    for (const [name, factory] of Object.entries(factories)) {
      const adapterName = validateAdapterName(name);
      if (typeof factory !== 'function' || normalized.has(adapterName)) runtimeFail('invalid-process-adapter-registry');
      normalized.set(adapterName, factory);
    }
    if (normalized.size === 0) runtimeFail('invalid-process-adapter-registry');
    this.#factories = normalized;
  }

  get adapterNames() {
    return freezeArray([...this.#factories.keys()].sort());
  }

  create({ adapterName, options } = {}) {
    const name = validateAdapterName(adapterName);
    const factory = this.#factories.get(name);
    if (factory === undefined) runtimeFail('unsupported-process-adapter');
    const adapter = factory(options);
    if (!(adapter instanceof ProcessAdapter)) runtimeFail('invalid-process-adapter-factory');
    return adapter;
  }
}

export const BUILT_IN_PROCESS_ADAPTERS = freezeRecord(
  Object.fromEntries(
    Object.keys(BUILT_IN_ADAPTER_FACTORIES)
      .sort()
      .map((name) => [name, true]),
  ),
);
