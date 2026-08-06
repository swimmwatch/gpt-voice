import {
  ImplementationReadinessError,
  type ImplementationReadinessRepository,
  type LocalWhisperImplementationReadiness,
} from './ImplementationReadinessTypes';

interface SourceContract {
  readonly id: string;
  readonly path: string;
  readonly markers: readonly string[];
}

const SOURCE_CONTRACTS: readonly SourceContract[] = Object.freeze([
  Object.freeze({
    id: 'production-entrypoint',
    path: 'src/main/main.ts',
    markers: Object.freeze([
      "process.platform === 'darwin'",
      'createDeferredLocalWhisperEnvironment({',
      'new LocalWhisperDevelopmentActivationLoader({',
      "activation.status === 'active'",
      'new ProductionLocalWhisperEnvironmentFactory(',
      'await createProductionLocalWhisperEnvironment(localWhisperDependencies)',
    ]),
  }),
  Object.freeze({
    id: 'development-activation',
    path: 'src/main/localWhisper/development/LocalWhisperDevelopmentActivation.ts',
    markers: Object.freeze([
      '--local-whisper-development-activation=',
      'this.dependencies.isPackaged',
      'fileConstants.O_NOFOLLOW',
      'serializeCanonicalLocalWhisperCatalogJson(descriptor) !== documentText',
      "purpose: 'qualification'",
      "status: 'active'",
    ]),
  }),
  Object.freeze({
    id: 'development-session',
    path: 'scripts/local-whisper/development/LocalWhisperDevelopmentSession.ts',
    markers: Object.freeze([
      'export class LocalWhisperDevelopmentSession',
      'DevelopmentRuntimeInputLoader',
      'QualificationHttpsArtifactServer',
      'LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT',
      'await server?.stop()',
      'await tls?.destroy()',
    ]),
  }),
  Object.freeze({
    id: 'catalog-unavailable-ui',
    path: 'src/renderer/localWhisper/LocalWhisperSettingsPage.tsx',
    markers: Object.freeze([
      "snapshot?.runtime.blockingCode === 'CATALOG_UNAVAILABLE'",
      'Catalog unavailable',
      'Development qualification artifacts',
    ]),
  }),
  Object.freeze({
    id: 'six-model-development-catalog',
    path: 'scripts/local-whisper/development/DevelopmentActivationDescriptorProducer.ts',
    markers: Object.freeze([
      'LocalWhisperQualificationCatalogProducer',
      "qualificationStatus: 'estimateOnly'",
      'trustedCertificateAuthorities',
    ]),
  }),
  Object.freeze({
    id: 'production-composition',
    path: 'src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts',
    markers: Object.freeze([
      'export class ProductionLocalWhisperEnvironmentFactory',
      "this.dependencies.platform !== 'linux' && this.dependencies.platform !== 'win32'",
      'this.catalogInput.trustPolicy?.purpose !== activationPurpose',
      "activationPurpose === 'production' && this.dependencies.qualificationHooks !== undefined",
      'new LinuxManagedFilesystemAdapter(transport)',
      'new WindowsManagedFilesystemAdapter(transport)',
      'new LinuxProcessGroupOwner({',
      'new WindowsJobObjectOwner({',
      'new LocalWhisperRuntimeLaunchAuthorityFactory(managedStore)',
      'new LocalWhisperModelLaunchAuthorityFactory({',
      'new LocalWhisperProductionWorkerPort({',
      'new LocalWhisperArtifactService({',
    ]),
  }),
  Object.freeze({
    id: 'catalog-purpose-isolation',
    path: 'src/main/localWhisper/catalog/LocalWhisperCatalogRepository.ts',
    markers: Object.freeze([
      'payload.purpose !== trustPolicy.purpose',
      "payload.purpose === 'production'",
      "payload.purpose === 'qualification'",
    ]),
  }),
  Object.freeze({
    id: 'authenticated-transfer-profiles',
    path: 'src/main/localWhisper/artifacts/ArtifactCatalogResolver.ts',
    markers: Object.freeze(["'restricted-tar-gzip-v1'", "'pinned-raw-model-v1'", 'credentialForwarding: false']),
  }),
  Object.freeze({
    id: 'streaming-artifact-materialization',
    path: 'src/main/localWhisper/artifacts/FileBackedArtifactStreamingWorker.ts',
    markers: Object.freeze([
      'export class FileBackedArtifactStreamingWorker',
      "input.transferProfile === 'pinned-raw-model-v1'",
      'createInflateRaw()',
      'safeSpoolPath',
    ]),
  }),
  Object.freeze({
    id: 'packaged-helper-authentication',
    path: 'src/main/localWhisper/packaging/LocalWhisperPackagedResourceResolver.ts',
    markers: Object.freeze([
      "const HELPER_ROLES = ['filesystem-authority-guard', 'operation-scoped-launcher'] as const",
      "const extension = platform === 'win32' ? '.exe' : ''",
      'PACKAGED_HELPER_IDENTITY_MISMATCH',
    ]),
  }),
  Object.freeze({
    id: 'linux-process-ownership',
    path: 'runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp',
    markers: Object.freeze(['PR_SET_CHILD_SUBREAPER', 'PR_SET_PDEATHSIG', 'setpgid']),
  }),
  Object.freeze({
    id: 'windows-process-ownership',
    path: 'runtime/local-whisper/launcher/src/platform/windows/windows_launcher.cpp',
    markers: Object.freeze([
      'PROC_THREAD_ATTRIBUTE_HANDLE_LIST',
      'JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE',
      'CreateProcessW',
      'AssignProcessToJobObject',
      'ResumeThread',
    ]),
  }),
  Object.freeze({
    id: 'linux-filesystem-authority',
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp',
    markers: Object.freeze(['SYS_openat2', 'RESOLVE_BENEATH', 'RESOLVE_NO_SYMLINKS', 'O_NOFOLLOW']),
  }),
  Object.freeze({
    id: 'windows-filesystem-authority',
    path: 'runtime/local-whisper/fs-guard/src/platform/windows/windows_backend.cpp',
    markers: Object.freeze(['NtCreateFile', 'FILE_FLAG_OPEN_REPARSE_POINT']),
  }),
  Object.freeze({
    id: 'runtime-backend-mapping',
    path: 'runtime/local-whisper/whisper-cpp/CMakeLists.txt',
    markers: Object.freeze([
      'whisper-cpp-linux-x64-cpu-baseline-v1',
      'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
      'whisper-cpp-windows-x64-cpu-v1',
      'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
    ]),
  }),
  Object.freeze({
    id: 'deterministic-runtime-pack-producer',
    path: 'scripts/local-whisper/qualification/DeterministicRuntimePackProducer.ts',
    markers: Object.freeze(['export class DeterministicRuntimePackProducer', 'assertReproducibleRuntimePacks']),
  }),
  Object.freeze({
    id: 'deterministic-qualification-inputs',
    path: 'scripts/local-whisper/qualification/QualificationInputProducer.ts',
    markers: Object.freeze(['export class LocalWhisperQualificationInputProducer', 'produceCandidate']),
  }),
  Object.freeze({
    id: 'deterministic-qualification-results',
    path: 'scripts/local-whisper/qualification/QualificationResultProducer.ts',
    markers: Object.freeze(['export class LocalWhisperQualificationResultProducer', 'measurementSeriesDigest']),
  }),
  Object.freeze({
    id: 'qualification-schema-validator',
    path: 'scripts/local-whisper/qualification/QualificationContracts.ts',
    markers: Object.freeze([
      'export class LocalWhisperQualificationValidator',
      "profileByBackend.has('cpu')",
      "profileByBackend.has('cuda')",
    ]),
  }),
  Object.freeze({
    id: 'qualification-corpus-materializer',
    path: 'scripts/local-whisper/qualification/fleurs_materializer.py',
    markers: Object.freeze(['FLEURS', 'sha256']),
  }),
]);

const REQUIRED_FILES = Object.freeze([
  'src/main/localWhisper/composition/LocalWhisperModelLaunchAuthorityFactory.ts',
  'src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts',
  'src/main/localWhisper/composition/LocalWhisperRuntimeLaunchAuthorityFactory.ts',
  'src/main/localWhisper/filesystem/LinuxManagedFilesystemAdapter.ts',
  'src/main/localWhisper/filesystem/WindowsManagedFilesystemAdapter.ts',
  'src/main/localWhisper/supervisor/LinuxProcessGroupOwner.ts',
  'src/main/localWhisper/supervisor/WindowsJobObjectOwner.ts',
  'runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp',
  'runtime/local-whisper/fs-guard/src/platform/windows/windows_model_authority_server.cpp',
  'runtime/local-whisper/launcher/src/platform/linux/model_authority_client.cpp',
  'runtime/local-whisper/launcher/src/platform/windows/windows_model_authority_client.cpp',
  'scripts/local-whisper/qualification/DirectEngineQualificationRunner.ts',
  'scripts/local-whisper/qualification/QualificationBundleProducer.ts',
  'scripts/local-whisper/qualification/QualificationCatalogProducer.ts',
  'scripts/local-whisper/qualification/produce-direct-engine.mjs',
  'scripts/local-whisper/qualification/produce-runtime-packs.mjs',
  'scripts/local-whisper/qualification/verify-qualification-inputs.ts',
  'scripts/local-whisper/development/DevelopmentActivationDescriptorProducer.ts',
  'scripts/local-whisper/development/DevelopmentResourceStager.ts',
  'scripts/local-whisper/development/DevelopmentRuntimeInputs.ts',
  'scripts/local-whisper/development/start-local-whisper-development.ts',
  'tests/main/localWhisper/development/LocalWhisperDevelopmentActivation.test.ts',
  'tests/scripts/localWhisper/development/DevelopmentActivationDescriptorProducer.test.ts',
]);

interface RuntimeProfileContract {
  readonly backend: 'cpu' | 'cuda';
  readonly id: string;
  readonly os: 'linux' | 'windows';
}

const RUNTIME_PROFILES: readonly RuntimeProfileContract[] = Object.freeze([
  Object.freeze({ backend: 'cpu', id: 'linux-x64-cpu-baseline-v1', os: 'linux' }),
  Object.freeze({ backend: 'cuda', id: 'linux-x64-cuda-12.8.1-sm120a-v1', os: 'linux' }),
  Object.freeze({ backend: 'cpu', id: 'windows-x64-cpu-msvc-19.39-v1', os: 'windows' }),
  Object.freeze({ backend: 'cuda', id: 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1', os: 'windows' }),
]);

const REQUIRED_PACKAGE_SCRIPTS = Object.freeze([
  'test:local-whisper:acceptance-ownership',
  'test:local-whisper:artifacts',
  'test:local-whisper:catalog',
  'test:local-whisper:packaging',
  'test:local-whisper:composition',
  'test:local-whisper:fs-guard:native',
  'test:local-whisper:launcher:native',
  'test:local-whisper:supervisor',
  'test:local-whisper:qualification',
  'produce:local-whisper:qualification:direct-engine:cpu',
  'produce:local-whisper:qualification:direct-engine:cuda',
  'produce:local-whisper:qualification:runtime-pack:cpu',
  'produce:local-whisper:qualification:runtime-pack:cuda',
  'verify:local-whisper:qualification:inputs',
  'verify:local-whisper:implementation-readiness',
  'test:local-whisper:windows-readiness',
  'verify:local-whisper:windows-readiness',
  'test:local-whisper:development',
  'start:local-whisper:development',
]);

const IMPLEMENTATION_READINESS_SPECIFICATION_REVISION = 17;
const IMPLEMENTATION_READINESS_PLAN_REVISION = 23;
const IMPLEMENTATION_READINESS_TASK_COUNT = 26;
const ACCEPTANCE_REGISTRY_CONTRACT_ID = 'revision-23-acceptance-registry';
const QUALIFICATION_ROOT = 'docs/specs/local-whisper/qualification';
const FROZEN_EVIDENCE_FILE_PATTERN =
  /(?:^|\/)(?:candidate-input|platform-input|profile-(?:cpu|cuda)|platform-graph|platform-result|evidence-index|aggregate-result)\.json$/u;

function record(value: unknown, contractId: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', contractId);
  }
  return value as Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function json(text: string, contractId: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', contractId);
  }
}

function hasResource(value: unknown, from: string, to: string): boolean {
  return (
    Array.isArray(value) && value.some((entry: unknown) => isRecord(entry) && entry.from === from && entry.to === to)
  );
}

function expectedAcceptanceIds(): readonly string[] {
  return Object.freeze([
    ...Array.from({ length: 54 }, (_, index) => `AC-AUTO-${String(index + 1).padStart(3, '0')}`),
    ...Array.from({ length: 27 }, (_, index) => `AC-AUTO-${String(index + 56).padStart(3, '0')}`),
  ]);
}

/** Proves deterministic implementation contracts without claiming platform qualification. */
export class LocalWhisperImplementationReadinessVerifier {
  public constructor(private readonly repository: ImplementationReadinessRepository) {}

  public async verify(): Promise<LocalWhisperImplementationReadiness> {
    await this.verifySourceContracts();
    await this.verifyRequiredFiles();
    await this.verifyRuntimeProfiles();
    await this.verifyPackageConfiguration();
    await this.verifyTaskRegistry();
    await this.verifyQualificationPending();
    return Object.freeze({
      implementationReady: true,
      linuxQualification: 'Pending',
      windowsQualification: 'Pending',
      productionReady: false,
    });
  }

  private async verifySourceContracts(): Promise<void> {
    for (const contract of SOURCE_CONTRACTS) {
      const source = await this.readRequired(contract.path, contract.id);
      if (contract.markers.some((marker) => !source.includes(marker))) {
        throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', contract.id);
      }
    }
  }

  private async verifyRequiredFiles(): Promise<void> {
    for (const file of REQUIRED_FILES) await this.readRequired(file, `required-file:${file}`);
  }

  private async verifyRuntimeProfiles(): Promise<void> {
    for (const contract of RUNTIME_PROFILES) {
      const profile = record(
        json(
          await this.readRequired(
            `runtime/local-whisper/toolchains/profiles/${contract.id}.json`,
            `runtime-profile:${contract.id}`,
          ),
          `runtime-profile:${contract.id}`,
        ),
        `runtime-profile:${contract.id}`,
      );
      const target = record(profile.target, `runtime-profile:${contract.id}`);
      const cache = record(profile.cmakeCache, `runtime-profile:${contract.id}`);
      const acceleratorKeys = [
        'GGML_BLAS',
        'GGML_CANN',
        'GGML_CUDA',
        'GGML_HIP',
        'GGML_METAL',
        'GGML_MUSA',
        'GGML_OPENCL',
        'GGML_SYCL',
        'GGML_VULKAN',
        'GGML_ZDNN',
      ];
      const enabledAccelerators = acceleratorKeys.filter((key) => cache[key] === 'ON');
      const expectedAccelerators = contract.backend === 'cuda' ? ['GGML_CUDA'] : [];
      if (
        profile.profileId !== contract.id ||
        target.os !== contract.os ||
        target.architecture !== 'x64' ||
        JSON.stringify(enabledAccelerators) !== JSON.stringify(expectedAccelerators) ||
        cache.GGML_NATIVE !== 'OFF' ||
        (contract.backend === 'cuda' &&
          (cache.CMAKE_CUDA_ARCHITECTURES !== '120a-real' ||
            JSON.stringify(profile.architectureTargets) !== JSON.stringify(['120a-real']))) ||
        (contract.os === 'windows' &&
          (profile.qualificationState !== 'pending-windows-qualification' ||
            profile.qualificationFixture !== null ||
            profile.evidenceDigest !== null))
      ) {
        throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', `runtime-profile:${contract.id}`);
      }
    }
  }

  private async verifyPackageConfiguration(): Promise<void> {
    const packageJson = record(
      json(await this.readRequired('package.json', 'package-configuration'), 'package-configuration'),
      'package-configuration',
    );
    const build = record(packageJson.build, 'package-configuration');
    const scripts = record(packageJson.scripts, 'package-configuration');
    const linux = record(build.linux, 'package-configuration');
    const windows = record(build.win, 'package-configuration');
    const mac = record(build.mac, 'package-configuration');
    const nativeFrom = 'build/generated/local-whisper/native';
    const nativeTo = 'local-whisper/native';
    if (
      !hasResource(build.extraResources, 'build/generated/local-whisper/shared', 'local-whisper') ||
      !hasResource(linux.extraResources, nativeFrom, nativeTo) ||
      !hasResource(windows.extraResources, nativeFrom, nativeTo) ||
      hasResource(mac.extraResources, nativeFrom, nativeTo) ||
      REQUIRED_PACKAGE_SCRIPTS.some((name) => typeof scripts[name] !== 'string' || scripts[name].length === 0)
    ) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'package-configuration');
    }
  }

  private async verifyTaskRegistry(): Promise<void> {
    const manifest = record(
      json(
        await this.readRequired(
          'docs/specs/local-whisper/tasks/acceptance-owners.json',
          ACCEPTANCE_REGISTRY_CONTRACT_ID,
        ),
        ACCEPTANCE_REGISTRY_CONTRACT_ID,
      ),
      ACCEPTANCE_REGISTRY_CONTRACT_ID,
    );
    const schema = record(
      json(
        await this.readRequired(
          'docs/specs/local-whisper/tasks/acceptance-owners.schema.json',
          ACCEPTANCE_REGISTRY_CONTRACT_ID,
        ),
        ACCEPTANCE_REGISTRY_CONTRACT_ID,
      ),
      ACCEPTANCE_REGISTRY_CONTRACT_ID,
    );
    const taskFiles = record(manifest.taskFiles, ACCEPTANCE_REGISTRY_CONTRACT_ID);
    const expectedTasks = Array.from({ length: IMPLEMENTATION_READINESS_TASK_COUNT }, (_, index) =>
      String(index + 1).padStart(2, '0'),
    );
    const owners = manifest.automatedAcceptanceOwners;
    const commands = manifest.verificationCommands;
    const properties = record(schema.properties, ACCEPTANCE_REGISTRY_CONTRACT_ID);
    const specificationRevision = record(properties.specificationRevision, ACCEPTANCE_REGISTRY_CONTRACT_ID);
    const planRevision = record(properties.planRevision, ACCEPTANCE_REGISTRY_CONTRACT_ID);
    if (!Array.isArray(owners) || !Array.isArray(commands)) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', ACCEPTANCE_REGISTRY_CONTRACT_ID);
    }
    const ownerRecords = owners.map((owner) => record(owner, ACCEPTANCE_REGISTRY_CONTRACT_ID));
    const commandRecords = commands.map((command) => record(command, ACCEPTANCE_REGISTRY_CONTRACT_ID));
    const task23Commands = commandRecords
      .filter((command) => command.task === '23')
      .map((command) => [command.id, command.command]);
    if (
      manifest.schemaVersion !== 1 ||
      manifest.specificationRevision !== IMPLEMENTATION_READINESS_SPECIFICATION_REVISION ||
      manifest.planRevision !== IMPLEMENTATION_READINESS_PLAN_REVISION ||
      JSON.stringify(Object.keys(taskFiles).sort()) !== JSON.stringify(expectedTasks) ||
      taskFiles['23'] !== '23_main_window_residency_control.md' ||
      taskFiles['25'] !== '25_linux_qualification_finalization.md' ||
      taskFiles['26'] !== '26_hardware_matched_nvidia_cuda_runtime_expansion.md' ||
      JSON.stringify(ownerRecords.map((owner) => owner.acceptanceId)) !== JSON.stringify(expectedAcceptanceIds()) ||
      !commandRecords.some((value) => {
        return (
          value.id === 'task-19-implementation-readiness' &&
          value.task === '19' &&
          value.command === 'rtk npm run verify:local-whisper:implementation-readiness'
        );
      }) ||
      !commandRecords.some(
        (value) =>
          value.id === 'task-26-hardware-matched-cuda-tests' &&
          value.task === '26' &&
          value.command === 'rtk npm run test:local-whisper:hardware-matched-cuda',
      ) ||
      JSON.stringify(task23Commands) !==
        JSON.stringify([
          ['task-23-main-residency-ipc', 'rtk npm run test:local-whisper:ipc'],
          ['task-23-main-residency-composition', 'rtk npm run test:local-whisper:composition'],
          ['task-23-main-residency-ui', 'rtk npm run verify:local-whisper:ui'],
        ]) ||
      ['AC-AUTO-059', 'AC-AUTO-076', 'AC-AUTO-077'].some(
        (acceptanceId) => ownerRecords.find((owner) => owner.acceptanceId === acceptanceId)?.primaryTask !== '23',
      ) ||
      ['AC-AUTO-078', 'AC-AUTO-079', 'AC-AUTO-080', 'AC-AUTO-081', 'AC-AUTO-082'].some(
        (acceptanceId) => ownerRecords.find((owner) => owner.acceptanceId === acceptanceId)?.primaryTask !== '26',
      ) ||
      specificationRevision.const !== IMPLEMENTATION_READINESS_SPECIFICATION_REVISION ||
      planRevision.const !== IMPLEMENTATION_READINESS_PLAN_REVISION
    ) {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_INVALID', ACCEPTANCE_REGISTRY_CONTRACT_ID);
    }
  }

  private async verifyQualificationPending(): Promise<void> {
    let files: readonly string[];
    try {
      files = await this.repository.listFiles(QUALIFICATION_ROOT);
    } catch {
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_MISSING', 'qualification-pending-state');
    }
    if (files.some((file) => FROZEN_EVIDENCE_FILE_PATTERN.test(file))) {
      throw new ImplementationReadinessError('QUALIFICATION_EVIDENCE_NOT_PENDING', 'platform-qualification');
    }
    const linuxState = record(
      json(
        await this.readRequired(`${QUALIFICATION_ROOT}/linux-state.json`, 'qualification-pending-state'),
        'qualification-pending-state',
      ),
      'qualification-pending-state',
    );
    if (
      linuxState.schemaVersion !== 1 ||
      linuxState.platform !== 'linux' ||
      linuxState.candidateState !== 'Pending' ||
      linuxState.profileState !== 'Pending' ||
      linuxState.previousPackageState !== 'Pending' ||
      linuxState.representativeWindowsExecution !== 'NotRun'
    ) {
      throw new ImplementationReadinessError('QUALIFICATION_EVIDENCE_NOT_PENDING', 'qualification-pending-state');
    }
  }

  private async readRequired(relativePath: string, contractId: string): Promise<string> {
    try {
      return await this.repository.readText(relativePath);
    } catch (error) {
      if (error instanceof ImplementationReadinessError) throw error;
      throw new ImplementationReadinessError('IMPLEMENTATION_CONTRACT_MISSING', contractId);
    }
  }
}
