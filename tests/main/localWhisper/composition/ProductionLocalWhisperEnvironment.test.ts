import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ProductionLocalWhisperEnvironmentFactory,
  createLocalWhisperRendererOptions,
  createProductionLocalWhisperEnvironment,
  restoreLocalWhisperStartupDeviceTopology,
  type LocalWhisperProductionEnvironmentDependencies,
} from '@main/localWhisper/composition/createProductionLocalWhisperEnvironment';
import type { LocalWhisperAuthenticatedCatalog } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  toLocalWhisperOpaqueDeviceId,
  type LocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
} from '@shared/localWhisper';
import { getLocalWhisperRuntimeIdentityKey } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT,
  createPackagedLocalWhisperCatalogTrustPolicy,
} from '@main/localWhisper/catalog/LocalWhisperPackagedCatalog';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';
import {
  createQualificationCatalogPayload,
  createQualificationCatalogTrustPolicy,
  signQualificationCatalog,
} from '../../../fixtures/local-whisper/catalog/qualificationCatalogSigner';

function dependencies(calls: { reads: number; spawns: number }): LocalWhisperProductionEnvironmentDependencies {
  return {
    appRevision: 'fixture-app-v1',
    architecture: 'x64',
    availableMemoryBytes: () => 8 * 1024 ** 3,
    availableVramBytes: () => Promise.resolve(null),
    configurationRoot: '/tmp/local-whisper-composition-settings',
    environment: Object.freeze({ XDG_DATA_HOME: '/tmp/local-whisper-composition-data' }),
    fileSystem: {} as never,
    homeDirectory: () => '/tmp/local-whisper-composition-home',
    logicalProcessorCount: 8,
    nextRequestId: () => 'local-whisper-request-0001',
    now: () => 1,
    openPath: () => Promise.resolve('not called'),
    pid: 100,
    platform: 'linux',
    randomBytes: (size) => Buffer.alloc(size, 1),
    randomNonce: () => 'local-whisper-nonce-0001',
    readNvidiaInventory: () => Promise.resolve({ available: false, reason: 'DEVICE_NOT_FOUND' }),
    readFile: () => {
      calls.reads += 1;
      return Promise.reject(new Error('Packaged resources must not be read'));
    },
    resourcesPath: '/tmp/local-whisper-composition-resources',
    spawnProcess: () => {
      calls.spawns += 1;
      throw new Error('Native processes must not start');
    },
  };
}

describe('production Local Whisper environment activation', () => {
  it('does not project a CUDA acquisition action before trusted hardware inventory succeeds', () => {
    const payload = createQualificationCatalogPayload();
    const sourceRuntime = payload.runtimes[0];
    const model = payload.models[0];
    assert.ok(sourceRuntime);
    assert.ok(model);
    const cudaRuntime = Object.freeze({
      ...sourceRuntime,
      applicability: {
        computeTarget: 'sm_120a-real' as const,
        minimumDriverVersion: '570.65',
        minimumComputeCapability: '12.0' as const,
        maximumComputeCapability: '12.0' as const,
        minimumTotalVramBytes: 6 * 1024 ** 3,
        policyRevision: 'rtx50-sm120a-policy-v1' as never,
      },
      identity: Object.freeze({
        ...sourceRuntime.identity,
        architecture: 'x64' as const,
        backend: 'cuda' as const,
        computeTargets: Object.freeze(['sm_120a-real']),
        dependencyFamily: 'windows-msvc' as const,
        platform: 'win32' as const,
        target: 'gpu' as const,
      }),
    });
    const catalog: LocalWhisperAuthenticatedCatalog = Object.freeze({
      signingKeyId: cudaRuntime.identity.signingKeyId,
      payload: Object.freeze({ ...payload, runtimes: Object.freeze([cudaRuntime]) }),
      isModelDenylisted: () => false,
      isRuntimeDenylisted: () => false,
    });
    const context: LocalWhisperSettingsValidationContext = Object.freeze({
      architecture: 'x64',
      eligibleGpuCombinations: Object.freeze([]),
      knownDevices: Object.freeze([]),
      knownModelSelections: Object.freeze([
        {
          engine: 'whisperCpp' as const,
          family: model.identity.logicalModel,
          recommended: model.recommended,
          revision: model.identity.artifactRevision,
          variant: model.identity.variant,
        },
      ]),
      knownRuntimeSelections: Object.freeze([
        {
          backend: 'cuda' as const,
          engine: 'whisperCpp' as const,
          recommended: true,
          revision: cudaRuntime.identity.packRevision,
          target: 'gpu' as const,
        },
      ]),
      logicalProcessorCount: 8,
      platform: 'win32',
    });
    const settings: LocalWhisperSettings = Object.freeze({
      decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
      engine: 'whisperCpp',
      execution: Object.freeze({ backend: 'cpu', cpuThreads: 'auto', target: 'cpu' }),
      initialPrompt: '',
      language: 'auto',
      model: Object.freeze({
        family: model.identity.logicalModel,
        revision: model.identity.artifactRevision,
        variant: model.identity.variant,
      }),
      runtimeRevision: null,
      schemaVersion: 1,
    });

    const options = createLocalWhisperRendererOptions(catalog, context, settings, false);
    const cudaRuntimeOption = options.find(
      (option) => option.group === 'runtime' && option.id === cudaRuntime.identity.packRevision,
    );
    const cudaBackendOption = options.find((option) => option.group === 'backend' && option.id === 'cuda');
    const gpuTargetOption = options.find((option) => option.group === 'target' && option.id === 'gpu');

    assert.equal(cudaRuntimeOption, undefined);
    assert.equal(cudaBackendOption, undefined);
    assert.equal(gpuTargetOption?.available, false);
    assert.equal(gpuTargetOption?.reason, 'RUNTIME_INCOMPATIBLE');

    const deviceId = toLocalWhisperOpaqueDeviceId(`device-v1-${'a'.repeat(64)}`)!;
    const eligibleContext: LocalWhisperSettingsValidationContext = Object.freeze({
      ...context,
      knownDevices: Object.freeze([
        Object.freeze({
          id: deviceId,
          label: 'NVIDIA GPU 1',
          vendor: 'nvidia',
          available: true,
          eligibleBackends: Object.freeze(['cuda'] as const),
        }),
      ]),
      eligibleGpuCombinations: Object.freeze([Object.freeze({ engine: 'whisperCpp', backend: 'cuda', deviceId })]),
    });
    const eligibleSettings: LocalWhisperSettings = Object.freeze({
      ...settings,
      runtimeRevision: cudaRuntime.identity.packRevision,
      execution: Object.freeze({ target: 'gpu', backend: 'cuda', deviceId }),
    });
    const eligibleOptions = createLocalWhisperRendererOptions(
      catalog,
      eligibleContext,
      eligibleSettings,
      false,
      Object.freeze([getLocalWhisperRuntimeIdentityKey(cudaRuntime.identity)]),
    );

    assert.equal(
      eligibleOptions.find((option) => option.group === 'runtime' && option.id === cudaRuntime.identity.packRevision)
        ?.available,
      true,
    );
  });

  it('restores startup topology when CUDA is already installed for the current host', async () => {
    const refreshes: number[] = [];

    await restoreLocalWhisperStartupDeviceTopology(
      {
        revision: 7,
        runtimes: [{ architecture: 'x64', backend: 'cuda', platform: 'linux', state: 'Installed', target: 'gpu' }],
      },
      { architecture: 'x64', platform: 'linux' },
      {
        refreshAvailableDevices: (revision) => {
          refreshes.push(revision);
          return Promise.resolve();
        },
      },
    );

    assert.deepEqual(refreshes, [7]);
  });

  it('does not start topology discovery without a matching installed CUDA runtime', async () => {
    let refreshes = 0;
    const worker = {
      refreshAvailableDevices: () => {
        refreshes += 1;
        return Promise.resolve();
      },
    };

    for (const runtimes of [
      [
        {
          architecture: 'x64' as const,
          backend: 'cuda' as const,
          platform: 'linux' as const,
          state: 'Missing' as const,
          target: 'gpu' as const,
        },
      ],
      [
        {
          architecture: 'x64' as const,
          backend: 'cpu' as const,
          platform: 'linux' as const,
          state: 'Installed' as const,
          target: 'cpu' as const,
        },
      ],
      [
        {
          architecture: 'x64' as const,
          backend: 'cuda' as const,
          platform: 'win32' as const,
          state: 'Installed' as const,
          target: 'gpu' as const,
        },
      ],
    ]) {
      await restoreLocalWhisperStartupDeviceTopology(
        { revision: 7, runtimes },
        { architecture: 'x64', platform: 'linux' },
        worker,
      );
    }

    assert.equal(refreshes, 0);
  });

  it('keeps composition fail-closed when startup topology discovery fails', async () => {
    await assert.doesNotReject(
      restoreLocalWhisperStartupDeviceTopology(
        {
          revision: 7,
          runtimes: [{ architecture: 'x64', backend: 'cuda', platform: 'linux', state: 'Installed', target: 'gpu' }],
        },
        { architecture: 'x64', platform: 'linux' },
        { refreshAvailableDevices: () => Promise.reject(new Error('synthetic discovery failure')) },
      ),
    );
  });

  it('keeps the disabled packaged publication fail-closed without touching native resources', async () => {
    const calls = { reads: 0, spawns: 0 };
    const environment = await createProductionLocalWhisperEnvironment(dependencies(calls));

    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 0, spawns: 0 });
    assert.deepEqual(await environment.artifacts.execute({} as never), {
      success: false,
      code: 'CATALOG_UNAVAILABLE',
    });
    await Promise.all([environment.dispose(), environment.dispose()]);
  });

  it('rejects fixture-purpose trust before catalog parsing or helper resolution', async () => {
    const calls = { reads: 0, spawns: 0 };
    const environment = await new ProductionLocalWhisperEnvironmentFactory(dependencies(calls), {
      document: signFixtureCatalog(createFixtureCatalogPayload()),
      trustPolicy: createFixtureCatalogTrustPolicy(),
    }).create();

    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 0, spawns: 0 });
    await environment.dispose();
  });

  it('rejects qualification trust unless the isolated activation purpose is explicit', async () => {
    const calls = { reads: 0, spawns: 0 };
    const environment = await new ProductionLocalWhisperEnvironmentFactory(dependencies(calls), {
      document: signQualificationCatalog(createQualificationCatalogPayload()),
      trustPolicy: createQualificationCatalogTrustPolicy(),
    }).create();

    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 0, spawns: 0 });
    await environment.dispose();
  });

  it('admits explicit qualification activation through the production composition boundary', async () => {
    const calls = { reads: 0, spawns: 0 };
    const environment = await new ProductionLocalWhisperEnvironmentFactory(dependencies(calls), {
      activationPurpose: 'qualification',
      document: signQualificationCatalog(createQualificationCatalogPayload()),
      trustPolicy: createQualificationCatalogTrustPolicy(),
    }).create();

    // The fixture deliberately has no packaged helper manifest. Reaching its
    // authenticated read proves the explicit qualification mode crossed the
    // catalog boundary without granting fixture or production trust.
    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 1, spawns: 0 });
    await environment.dispose();
  });

  it('rejects qualification hooks on the packaged production activation path', async () => {
    const calls = { reads: 0, spawns: 0 };
    const environment = await new ProductionLocalWhisperEnvironmentFactory(
      {
        ...dependencies(calls),
        qualificationHooks: { trustedCertificateAuthorities: ['qualification-only'] },
      },
      {
        document: signQualificationCatalog({ ...createQualificationCatalogPayload(), purpose: 'production' }),
        trustPolicy: { ...createQualificationCatalogTrustPolicy(), purpose: 'production' },
      },
    ).create();

    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 0, spawns: 0 });
    await environment.dispose();
  });

  it('treats a malformed production document as unavailable before native resource resolution', async () => {
    const calls = { reads: 0, spawns: 0 };
    const environment = await new ProductionLocalWhisperEnvironmentFactory(dependencies(calls), {
      document: Buffer.from('not-a-signed-envelope', 'utf8'),
      trustPolicy: createPackagedLocalWhisperCatalogTrustPolicy('fixture-app-v1', 1),
    }).create();

    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 0, spawns: 0 });
    await environment.dispose();
  });

  it('rejects a schema-v1 payload relabeled as production before packaged helper access', async () => {
    const calls = { reads: 0, spawns: 0 };
    const fixturePolicy = createFixtureCatalogTrustPolicy();
    const fixturePayload = createFixtureCatalogPayload();
    const environment = await new ProductionLocalWhisperEnvironmentFactory(dependencies(calls), {
      document: signFixtureCatalog({ ...fixturePayload, purpose: 'production' }),
      trustPolicy: { ...fixturePolicy, purpose: 'production' },
    }).create();

    assert.equal(environment.facts.snapshot.catalogRevision, null);
    assert.deepEqual(calls, { reads: 0, spawns: 0 });
    await environment.dispose();
  });

  it('ships only the immutable disabled production sentinel in this candidate', () => {
    assert.match(PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT.toString('utf8'), /disabled-deferred-publication/u);
  });
});
