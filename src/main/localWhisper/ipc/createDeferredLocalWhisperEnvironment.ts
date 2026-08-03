import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_MODEL_FAMILIES,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  validateLocalWhisperSettings,
  type LocalWhisperFailureCode,
  type LocalWhisperPlatform,
  type LocalWhisperRendererOption,
  type LocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
} from '@shared/localWhisper';

import { LocalWhisperSupportPolicy } from '../capability/LocalWhisperSupportPolicy';
import type { LocalWhisperCoordinatorDependencies } from '../coordinator/LocalWhisperCoordinatorTypes';
import type {
  LocalWhisperArtifactCommandPort,
  LocalWhisperArtifactReferencePort,
  LocalWhisperManagedFolderPort,
} from './LocalWhisperIpcController';
import type { LocalWhisperSnapshotFactsPort } from './LocalWhisperSnapshotService';
import { StaticLocalWhisperSnapshotFacts } from './StaticLocalWhisperSnapshotFacts';

export interface DeferredLocalWhisperEnvironment {
  readonly coordinator: LocalWhisperCoordinatorDependencies;
  readonly facts: LocalWhisperSnapshotFactsPort;
  readonly artifacts: LocalWhisperArtifactCommandPort;
  readonly managedFolder: LocalWhisperManagedFolderPort;
  readonly references: LocalWhisperArtifactReferencePort;
  readonly refreshDevices: (configurationEpoch: number) => Promise<void>;
  readonly dispose: () => Promise<void>;
}

function revision(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid deferred Local Whisper revision');
  return parsed;
}

function deviceId(value: string) {
  const parsed = toLocalWhisperOpaqueDeviceId(value);
  if (!parsed) throw new Error('Invalid deferred Local Whisper device identifier');
  return parsed;
}

function platform(value: NodeJS.Platform): LocalWhisperPlatform {
  return value === 'win32' || value === 'linux' || value === 'darwin' ? value : 'other';
}

function architecture(value: string): 'x64' | 'arm64' | 'other' {
  return value === 'x64' || value === 'arm64' ? value : 'other';
}

const DEFERRED_RUNTIME_REVISION = revision('catalog-publication-pending-runtime');
const DEFERRED_MODEL_REVISION = revision('catalog-publication-pending-model');
const DEFERRED_MACOS_DEVICE_ID = deviceId('planned-apple-metal-device');

const DEFERRED_SETTINGS: LocalWhisperSettings = Object.freeze({
  schemaVersion: 1,
  engine: 'whisperCpp',
  runtimeRevision: DEFERRED_RUNTIME_REVISION,
  model: Object.freeze({ family: 'base', revision: DEFERRED_MODEL_REVISION, variant: 'full' }),
  language: 'auto',
  initialPrompt: '',
  decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
  execution: Object.freeze({
    target: 'cpu',
    backend: 'cpu',
    cpuThreads: LOCAL_WHISPER_AUTO_CPU_THREADS,
  }),
});

const DEFERRED_MACOS_SETTINGS: LocalWhisperSettings = Object.freeze({
  ...DEFERRED_SETTINGS,
  execution: Object.freeze({
    target: 'gpu',
    backend: 'metal',
    deviceId: DEFERRED_MACOS_DEVICE_ID,
  }),
});

function option(
  input: Pick<LocalWhisperRendererOption, 'group' | 'id' | 'label' | 'available' | 'tier' | 'reason' | 'selected'>,
): LocalWhisperRendererOption {
  return Object.freeze({
    ...input,
    selectedButUnavailable: input.selected && !input.available,
    saved: false,
    default: input.selected,
    recommended: input.selected,
    remembered: false,
  });
}

/** Fail-closed startup graph until Task 17 supplies authenticated production catalog/pack inputs. */
export function createDeferredLocalWhisperEnvironment(input: {
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly logicalProcessorCount: number;
  readonly nextRequestId: () => string;
}): DeferredLocalWhisperEnvironment {
  const currentPlatform = platform(input.platform);
  const currentArchitecture = architecture(input.architecture);
  const plannedMacOS = currentPlatform === 'darwin' && currentArchitecture === 'arm64';
  const settings = plannedMacOS ? DEFERRED_MACOS_SETTINGS : DEFERRED_SETTINGS;
  const support = new LocalWhisperSupportPolicy().evaluate({
    platform: currentPlatform,
    architecture: currentArchitecture,
    target: plannedMacOS ? 'gpu' : 'cpu',
    backend: plannedMacOS ? 'metal' : 'cpu',
    vendor: plannedMacOS ? 'apple' : 'cpu',
    hipApproved: false,
  });
  const failureCode: LocalWhisperFailureCode = support.failureCode ?? 'RUNTIME_MISSING';
  const validationContext: LocalWhisperSettingsValidationContext = Object.freeze({
    platform: currentPlatform,
    architecture: currentArchitecture,
    logicalProcessorCount: Math.max(1, Math.trunc(input.logicalProcessorCount)),
    knownDevices: plannedMacOS
      ? Object.freeze([
          Object.freeze({
            id: DEFERRED_MACOS_DEVICE_ID,
            label: 'Apple Silicon (planned)',
            vendor: 'apple' as const,
            available: false,
            eligibleBackends: Object.freeze(['metal' as const]),
          }),
        ])
      : Object.freeze([]),
    knownRuntimeSelections: Object.freeze([
      Object.freeze({
        engine: 'whisperCpp' as const,
        target: plannedMacOS ? ('gpu' as const) : ('cpu' as const),
        backend: plannedMacOS ? ('metal' as const) : ('cpu' as const),
        revision: DEFERRED_RUNTIME_REVISION,
        recommended: true,
      }),
    ]),
    knownModelSelections: Object.freeze([
      Object.freeze({
        engine: 'whisperCpp' as const,
        family: 'base' as const,
        revision: DEFERRED_MODEL_REVISION,
        variant: 'full' as const,
        recommended: true,
      }),
    ]),
    eligibleGpuCombinations: plannedMacOS
      ? Object.freeze([
          Object.freeze({
            engine: 'whisperCpp' as const,
            backend: 'metal' as const,
            deviceId: DEFERRED_MACOS_DEVICE_ID,
          }),
        ])
      : Object.freeze([]),
  });
  const settingsPort = Object.freeze({
    validate: (candidate: unknown): LocalWhisperSettings | null => {
      const result = validateLocalWhisperSettings(candidate, validationContext);
      return result.success ? result.settings : null;
    },
    defaultSettings: (): LocalWhisperSettings => settings,
    save: (): Promise<void> => Promise.reject(new Error('Authenticated Local Whisper catalog unavailable')),
    reset: (): Promise<void> => Promise.resolve(),
  });
  const coordinator: LocalWhisperCoordinatorDependencies = {
    settings: settingsPort,
    capability: {
      preflight: () =>
        Promise.resolve({
          success: false as const,
          supportTier: support.tier,
          runtimeSetup: 'Missing' as const,
          modelSetup: 'Missing' as const,
          code: failureCode,
          resources: null,
        }),
    },
    workers: {
      probeFresh: () => Promise.resolve({ success: false as const, code: failureCode }),
      loadFresh: () => Promise.resolve({ success: false as const, code: failureCode }),
    },
    artifacts: {
      removeSelected: (command) =>
        Promise.resolve({
          success: false as const,
          runtimeSetup: 'Missing' as const,
          modelSetup: 'Missing' as const,
          inventoryEpoch: command.epochs.inventory,
          code: failureCode,
        }),
    },
    cache: { context: () => Object.freeze(['catalog-publication-pending']) },
    nextRequestId: input.nextRequestId,
    initial: {
      settings,
      configured: false,
      inventoryEpoch: 0,
      runtimeSetup: 'Missing',
      modelSetup: 'Missing',
    },
  };
  const options: readonly LocalWhisperRendererOption[] = Object.freeze([
    option({
      group: 'engine',
      id: 'whisperCpp',
      label: 'Whisper.cpp',
      available: true,
      tier: support.tier,
      reason: null,
      selected: true,
    }),
    option({
      group: 'target',
      id: 'cpu',
      label: 'CPU',
      available: plannedMacOS ? false : support.available,
      tier: plannedMacOS ? 'Planned' : support.tier,
      reason: plannedMacOS ? 'TARGET_UNSUPPORTED' : support.failureCode,
      selected: !plannedMacOS,
    }),
    option({
      group: 'target',
      id: 'gpu',
      label: 'GPU',
      available: false,
      tier: currentPlatform === 'darwin' ? 'Planned' : 'Production',
      reason: currentPlatform === 'darwin' ? 'PLANNED_UNAVAILABLE' : 'DEVICE_NOT_FOUND',
      selected: plannedMacOS,
    }),
    ...(plannedMacOS
      ? [
          option({
            group: 'backend',
            id: 'metal',
            label: 'Metal (planned)',
            available: false,
            tier: 'Planned',
            reason: 'PLANNED_UNAVAILABLE',
            selected: true,
          }),
        ]
      : []),
    ...LOCAL_WHISPER_MODEL_FAMILIES.map((family) =>
      option({
        group: 'modelFamily',
        id: family,
        label: family,
        available: false,
        tier: support.tier,
        reason: 'MODEL_MISSING',
        selected: family === 'base',
      }),
    ),
  ]);
  const facts = new StaticLocalWhisperSnapshotFacts(
    Object.freeze({
      catalogRevision: null,
      options,
      validationIssues: Object.freeze([]),
      host: Object.freeze({
        label: plannedMacOS
          ? 'Apple Silicon · Local Whisper planned'
          : `CPU · ${Math.max(1, Math.trunc(input.logicalProcessorCount))} logical processors`,
        logicalProcessorCount: Math.max(1, Math.trunc(input.logicalProcessorCount)),
      }),
      memory: Object.freeze({ selectedEstimate: null, qualifiedPeak: null, exactEstimateUnavailable: true }),
      storage: Object.freeze({ label: 'Local Whisper managed storage', installedArtifactCount: 0, installedBytes: 0 }),
      artifacts: Object.freeze([]),
      progress: Object.freeze([]),
      prerequisites: Object.freeze([]),
      lastValidatedAtMs: null,
    }),
  );
  const unavailable = Object.freeze({
    execute: () => Promise.resolve({ success: false as const, code: failureCode }),
  });
  return Object.freeze({
    coordinator,
    facts,
    artifacts: unavailable,
    managedFolder: { open: () => Promise.resolve({ success: false as const, code: failureCode }) },
    references: { open: () => Promise.resolve({ success: false as const, code: failureCode }) },
    refreshDevices: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
  });
}
