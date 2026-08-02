import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LocalWhisperCpuCapabilityAdapter,
  LocalWhisperCudaCapabilityAdapter,
  LocalWhisperHipCapabilityAdapter,
  LocalWhisperMetalCapabilityAdapter,
  LocalWhisperVulkanCapabilityAdapter,
} from '@main/localWhisper/capability/LocalWhisperCapabilityAdapters';
import {
  LocalWhisperCapabilityService,
  type LocalWhisperCapabilityPreflightRequest,
} from '@main/localWhisper/capability/LocalWhisperCapabilityService';
import { LocalWhisperResourcePolicy } from '@main/localWhisper/capability/LocalWhisperResourcePolicy';
import { LocalWhisperSupportPolicy } from '@main/localWhisper/capability/LocalWhisperSupportPolicy';
import {
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryConfigurationIdentity,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperPublicSettings,
} from '@shared/localWhisper';

function revision(value: string) {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid fixture revision');
  return result;
}

function deviceId(value: string) {
  const result = toLocalWhisperOpaqueDeviceId(value);
  if (!result) throw new Error('Invalid fixture device ID');
  return result;
}

const CONFIGURATION: LocalWhisperMemoryConfigurationIdentity = Object.freeze({
  target: 'gpu',
  backend: 'cuda',
  runtimePackRevision: revision('runtime-v1'),
  model: Object.freeze({
    engine: 'whisperCpp',
    logicalModel: 'base',
    sourceCheckpointRevision: revision('checkpoint-v1'),
    artifactRevision: revision('model-v1'),
    nativeFormat: 'ggml',
    variant: 'full',
  }),
});

const ESTIMATE: LocalWhisperMemoryEstimateRecord = Object.freeze({
  ...CONFIGURATION,
  estimatedPeakRamBytes: 2 * 1024 ** 3,
  estimatedPeakVramBytes: 1024 ** 3,
  evidenceBasis: 'derived',
  sourceBuildRevision: revision('estimate-v1'),
  methodologyLabel: 'Pinned deterministic fixture',
});

const CPU_CONFIGURATION: LocalWhisperMemoryConfigurationIdentity = Object.freeze({
  ...CONFIGURATION,
  target: 'cpu',
  backend: 'cpu',
});

const CPU_ESTIMATE: LocalWhisperMemoryEstimateRecord = Object.freeze({
  ...CPU_CONFIGURATION,
  estimatedPeakRamBytes: 2 * 1024 ** 3,
  estimatedPeakVramBytes: 'notApplicable',
  evidenceBasis: 'derived',
  sourceBuildRevision: revision('estimate-cpu-v1'),
  methodologyLabel: 'Pinned deterministic CPU fixture',
});

const GPU_DEVICE_ID = deviceId('device-v1-nvidia-fixture');

const GPU_SETTINGS: LocalWhisperPublicSettings = Object.freeze({
  schemaVersion: 1,
  engine: 'whisperCpp',
  runtimeRevision: CONFIGURATION.runtimePackRevision,
  model: Object.freeze({ family: 'base', revision: CONFIGURATION.model.artifactRevision, variant: 'full' }),
  language: 'auto',
  decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
  execution: Object.freeze({ target: 'gpu', backend: 'cuda', deviceId: GPU_DEVICE_ID }),
});

function capabilityRequest(
  overrides: Partial<LocalWhisperCapabilityPreflightRequest> = {},
): LocalWhisperCapabilityPreflightRequest {
  return {
    settings: GPU_SETTINGS,
    platform: 'linux',
    architecture: 'x64',
    runtimeSetup: 'Installed',
    modelSetup: 'Installed',
    device: { id: GPU_DEVICE_ID, vendor: 'nvidia', available: true },
    hipApproved: false,
    backendProbe: {
      backend: 'cuda',
      physicalNvidiaDevice: true,
      driverCompatible: true,
      computeTargetCompiled: true,
      dependencyClosureValid: true,
      allocationPassed: true,
      dispatchPassed: true,
    },
    configuration: CONFIGURATION,
    estimate: ESTIMATE,
    qualifiedPeak: null,
    availability: { freeRamBytes: null, freeVramBytes: null },
    capabilityFingerprint: 'a'.repeat(64),
    ...overrides,
  };
}

describe('Local Whisper fixed support policy', () => {
  it('exposes only the exact CPU, CUDA, AMD Preview, and planned Metal matrix', () => {
    const policy = new LocalWhisperSupportPolicy();
    const cases = [
      [
        { platform: 'win32', architecture: 'x64', target: 'cpu', backend: 'cpu', vendor: 'cpu', hipApproved: false },
        ['Production', true, null],
      ],
      [
        {
          platform: 'linux',
          architecture: 'x64',
          target: 'gpu',
          backend: 'cuda',
          vendor: 'nvidia',
          hipApproved: false,
        },
        ['Production', true, null],
      ],
      [
        { platform: 'win32', architecture: 'x64', target: 'gpu', backend: 'vulkan', vendor: 'amd', hipApproved: false },
        ['Preview', true, null],
      ],
      [
        { platform: 'linux', architecture: 'x64', target: 'gpu', backend: 'vulkan', vendor: 'amd', hipApproved: false },
        ['Preview', true, null],
      ],
      [
        { platform: 'linux', architecture: 'x64', target: 'gpu', backend: 'hip', vendor: 'amd', hipApproved: true },
        ['Preview', true, null],
      ],
      [
        { platform: 'linux', architecture: 'x64', target: 'gpu', backend: 'hip', vendor: 'amd', hipApproved: false },
        ['Preview', false, 'DEVICE_NOT_ALLOWLISTED'],
      ],
      [
        {
          platform: 'darwin',
          architecture: 'arm64',
          target: 'gpu',
          backend: 'metal',
          vendor: 'apple',
          hipApproved: false,
        },
        ['Planned', false, 'PLANNED_UNAVAILABLE'],
      ],
      [
        { platform: 'darwin', architecture: 'arm64', target: 'cpu', backend: 'cpu', vendor: 'cpu', hipApproved: false },
        ['Unsupported', false, 'TARGET_UNSUPPORTED'],
      ],
      [
        { platform: 'linux', architecture: 'x64', target: 'gpu', backend: 'cuda', vendor: 'amd', hipApproved: false },
        ['Unsupported', false, 'BACKEND_UNSUPPORTED'],
      ],
    ] as const;
    for (const [request, expected] of cases) {
      const result = policy.evaluate(request);
      assert.deepEqual([result.tier, result.available, result.failureCode], expected);
    }
  });
});

describe('Local Whisper backend prerequisite adapters', () => {
  it('checks CPU bounds without initializing a GPU', () => {
    const adapter = new LocalWhisperCpuCapabilityAdapter();
    assert.deepEqual(
      adapter.evaluate({
        backend: 'cpu',
        logicalProcessorCount: 8,
        resolvedThreads: 8,
        isaSupported: true,
        boundedComputePassed: true,
      }),
      { success: true },
    );
    assert.equal(
      adapter.evaluate({
        backend: 'cpu',
        logicalProcessorCount: 8,
        resolvedThreads: 9,
        isaSupported: true,
        boundedComputePassed: true,
      }).success,
      false,
    );
  });

  it('returns exact CUDA prerequisite, allocation, and dispatch failures', () => {
    const adapter = new LocalWhisperCudaCapabilityAdapter();
    const valid = {
      backend: 'cuda',
      physicalNvidiaDevice: true,
      driverCompatible: true,
      computeTargetCompiled: true,
      dependencyClosureValid: true,
      allocationPassed: true,
      dispatchPassed: true,
    } as const;
    assert.deepEqual(adapter.evaluate(valid), { success: true });
    assert.deepEqual(adapter.evaluate({ ...valid, driverCompatible: false }), {
      success: false,
      code: 'DRIVER_INCOMPATIBLE',
    });
    assert.deepEqual(adapter.evaluate({ ...valid, dependencyClosureValid: false }), {
      success: false,
      code: 'RUNTIME_PREREQUISITE_MISSING',
    });
    assert.deepEqual(adapter.evaluate({ ...valid, computeTargetCompiled: false }), {
      success: false,
      code: 'RUNTIME_PREREQUISITE_MISSING',
    });
    assert.deepEqual(adapter.evaluate({ ...valid, allocationPassed: false }), {
      success: false,
      code: 'ALLOCATION_FAILED',
    });
  });

  it('rejects Vulkan 1.1, software/non-AMD devices, and missing required features', () => {
    const adapter = new LocalWhisperVulkanCapabilityAdapter();
    const valid = {
      backend: 'vulkan',
      physicalAmdDevice: true,
      apiVersion: [1, 3],
      generatedShaderTarget: [1, 3],
      storageBuffer16BitAccess: true,
      requiredExtensionsPresent: true,
      allocationPassed: true,
      dispatchPassed: true,
    } as const;
    assert.deepEqual(adapter.evaluate(valid), { success: true });
    assert.deepEqual(adapter.evaluate({ ...valid, apiVersion: [1, 1] }), {
      success: false,
      code: 'DEVICE_FEATURE_MISSING',
    });
    assert.deepEqual(adapter.evaluate({ ...valid, apiVersion: [1, 2] }), {
      success: false,
      code: 'DEVICE_FEATURE_MISSING',
    });
    assert.deepEqual(adapter.evaluate({ ...valid, apiVersion: [1, 2], generatedShaderTarget: [1, 2] }), {
      success: true,
    });
    assert.deepEqual(adapter.evaluate({ ...valid, physicalAmdDevice: false }), {
      success: false,
      code: 'DEVICE_NOT_FOUND',
    });
  });

  it('requires an exact HIP row and permissions and keeps Metal unavailable', () => {
    const adapter = new LocalWhisperHipCapabilityAdapter();
    const valid = {
      backend: 'hip',
      approvedRow: true,
      exactOsKernelDriverMatch: true,
      exactRuntimeClosureMatch: true,
      exactPciAndGfxMatch: true,
      pcieAtomicsSatisfied: true,
      permissionsSatisfied: true,
      allocationPassed: true,
      dispatchPassed: true,
    } as const;
    assert.deepEqual(adapter.evaluate(valid), { success: true });
    assert.deepEqual(adapter.evaluate({ ...valid, exactPciAndGfxMatch: false }), {
      success: false,
      code: 'DEVICE_NOT_ALLOWLISTED',
    });
    assert.deepEqual(adapter.evaluate({ ...valid, permissionsSatisfied: false }), {
      success: false,
      code: 'GPU_PERMISSION_DENIED',
    });
    assert.deepEqual(new LocalWhisperMetalCapabilityAdapter().evaluate(), {
      success: false,
      code: 'PLANNED_UNAVAILABLE',
    });
  });
});

describe('Local Whisper exact resource policy', () => {
  it('prefers a matching qualified peak and applies max(20%, 512 MiB) headroom', () => {
    const policy = new LocalWhisperResourcePolicy();
    const result = policy.evaluate({
      configuration: CONFIGURATION,
      estimate: ESTIMATE,
      qualifiedPeak: {
        configuration: CONFIGURATION,
        measuredPeakRamBytes: 4 * 1024 ** 3,
        measuredPeakVramBytes: 2 * 1024 ** 3,
      },
      availability: { freeRamBytes: 5 * 1024 ** 3, freeVramBytes: 3 * 1024 ** 3 },
    });
    assert.equal(result.evidence, 'qualified');
    assert.equal(result.requiredRamBytes, 4 * 1024 ** 3 + Math.ceil((4 * 1024 ** 3) / 5));
    assert.equal(result.requiredVramBytes, 2 * 1024 ** 3 + 512 * 1024 ** 2);
    assert.equal(result.success, true);
  });

  it('blocks known below-threshold RAM/VRAM, accepts equality, and preserves unknown values', () => {
    const policy = new LocalWhisperResourcePolicy();
    const baseline = policy.evaluate({
      configuration: CONFIGURATION,
      estimate: ESTIMATE,
      qualifiedPeak: null,
      availability: { freeRamBytes: null, freeVramBytes: null },
    });
    assert.equal(baseline.success, true);
    assert.equal(baseline.freeRamBytes, null);
    assert.equal(baseline.freeVramBytes, null);
    assert.equal(
      policy.evaluate({
        configuration: CONFIGURATION,
        estimate: ESTIMATE,
        qualifiedPeak: null,
        availability: { freeRamBytes: baseline.requiredRamBytes, freeVramBytes: baseline.requiredVramBytes as number },
      }).success,
      true,
    );
    assert.equal(
      policy.evaluate({
        configuration: CONFIGURATION,
        estimate: ESTIMATE,
        qualifiedPeak: null,
        availability: { freeRamBytes: baseline.requiredRamBytes - 1, freeVramBytes: null },
      }).failureCode,
      'INSUFFICIENT_RAM',
    );
    assert.equal(
      policy.evaluate({
        configuration: CONFIGURATION,
        estimate: ESTIMATE,
        qualifiedPeak: null,
        availability: { freeRamBytes: null, freeVramBytes: (baseline.requiredVramBytes as number) - 1 },
      }).failureCode,
      'INSUFFICIENT_VRAM',
    );
  });

  it('rejects a peak for a different selected configuration', () => {
    const policy = new LocalWhisperResourcePolicy();
    assert.throws(() =>
      policy.evaluate({
        configuration: { ...CONFIGURATION, backend: 'vulkan' },
        estimate: ESTIMATE,
        qualifiedPeak: null,
        availability: { freeRamBytes: null, freeVramBytes: null },
      }),
    );
  });

  it('uses free system RAM for CPU and treats VRAM as not applicable', () => {
    const result = new LocalWhisperResourcePolicy().evaluate({
      configuration: CPU_CONFIGURATION,
      estimate: CPU_ESTIMATE,
      qualifiedPeak: null,
      availability: { freeRamBytes: 1, freeVramBytes: 0 },
    });
    assert.equal(result.success, false);
    assert.equal(result.failureCode, 'INSUFFICIENT_RAM');
    assert.equal(result.requiredVramBytes, 'notApplicable');
  });
});

describe('LocalWhisperCapabilityService', () => {
  it('composes support, exact setup, backend proof, resources, and selected device evidence', () => {
    const result = new LocalWhisperCapabilityService().preflight(capabilityRequest());
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.assessment.supportTier, 'Production');
    assert.equal(result.assessment.selectedDeviceId, GPU_DEVICE_ID);
    assert.equal(result.assessment.resources.success, true);
  });

  it('preserves exact artifact, backend, resource, and proof failures', () => {
    const service = new LocalWhisperCapabilityService();
    const cases: readonly [Partial<LocalWhisperCapabilityPreflightRequest>, string][] = [
      [{ runtimeSetup: 'Missing' }, 'RUNTIME_MISSING'],
      [{ device: null }, 'DEVICE_NOT_FOUND'],
      [{ modelSetup: 'Blocked' }, 'MODEL_BLOCKED'],
      [
        {
          backendProbe: {
            backend: 'cuda',
            physicalNvidiaDevice: true,
            driverCompatible: false,
            computeTargetCompiled: true,
            dependencyClosureValid: true,
            allocationPassed: true,
            dispatchPassed: true,
          },
        },
        'DRIVER_INCOMPATIBLE',
      ],
      [{ availability: { freeRamBytes: null, freeVramBytes: 1 } }, 'INSUFFICIENT_VRAM'],
      [{ capabilityFingerprint: 'not-private-proof' }, 'DEVICE_PROOF_FAILED'],
    ];
    for (const [overrides, code] of cases) {
      const result = service.preflight(capabilityRequest(overrides));
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.code, code);
    }
  });

  it('keeps Apple Silicon Metal planned and unavailable regardless of probe input', () => {
    const appleDeviceId = deviceId('device-v1-apple-fixture');
    const result = new LocalWhisperCapabilityService().preflight(
      capabilityRequest({
        settings: {
          ...GPU_SETTINGS,
          execution: { target: 'gpu', backend: 'metal', deviceId: appleDeviceId },
        },
        platform: 'darwin',
        architecture: 'arm64',
        device: { id: appleDeviceId, vendor: 'apple', available: true },
        backendProbe: { backend: 'metal' },
      }),
    );
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.supportTier, 'Planned');
      assert.equal(result.code, 'PLANNED_UNAVAILABLE');
    }
  });
});
