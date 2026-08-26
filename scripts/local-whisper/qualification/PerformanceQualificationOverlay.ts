import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { qualificationCanonicalJson } from './QualificationContracts';

const TAR_BLOCK_BYTES = 512;
const CANDIDATE_COMPOSITION_SHA256 = '4cd6f883b216970245dff2ef6e97a245cfe121eeeca7571d2ae9d4e4f6cc36ce';
const COMPOSITION_PATH = 'src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts';
const SUPERVISOR_PATH = 'src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts';
const CANDIDATE_SUPERVISOR_SHA256 = '21c84282671834377a79e685a93318c67edbe321c255a10728c45d4e396759ef';
const AFTER_HOOK_ANCHOR = `  readonly qualificationHooks?: {
    readonly artifactHttpClient?: ArtifactHttpClient;
    readonly onArtifactTransferFailure?: (
      event: Readonly<{
        readonly artifactId: string;
        readonly cleanupFailed: boolean;
        readonly primaryCode: LocalWhisperFailureCode;
      }>,
    ) => void;
    readonly onStagingCleanupStep?: (step: ManagedArtifactStagingCleanupStep) => void;
    readonly onStagingCleanupFailure?: (failure: ManagedArtifactStagingCleanupFailure) => void;
    readonly onStagingPromotionFailure?: (failure: ManagedArtifactStagingPromotionFailure) => void;
    readonly onNativeLauncherAcknowledgment?: (
      outcome: 'ready' | 'rejected' | 'malformed' | 'closed' | 'error' | 'exited' | 'timeout',
    ) => void;
    readonly trustedCertificateAuthorities?: readonly string[];
    readonly onSessionProcessLaunched?: (event: LocalWhisperWorkerProcessLaunchEvent) => void;
    readonly onLoadStage?: (
      stage: import('./LocalWhisperProductionWorkerPort').LocalWhisperQualificationLoadStage,
    ) => void;
  };`;
const AFTER_HOOK_REPLACEMENT = `  readonly qualificationHooks?: {
    readonly artifactHttpClient?: ArtifactHttpClient;
    readonly onArtifactTransferFailure?: (
      event: Readonly<{
        readonly artifactId: string;
        readonly cleanupFailed: boolean;
        readonly primaryCode: LocalWhisperFailureCode;
      }>,
    ) => void;
    readonly onArtifactInstallationStage?: (
      stage: import('../artifacts/StreamingArtifactExtractor').ArtifactInstallationDiagnosticStage,
    ) => void;
    readonly onArtifactOperationCompleted?: (event: Readonly<{
      readonly failureCode: LocalWhisperFailureCode | null;
      readonly operationId: string;
      readonly success: boolean;
    }>) => void;
    readonly onStagingCleanupStep?: (step: ManagedArtifactStagingCleanupStep) => void;
    readonly onStagingCleanupFailure?: (failure: ManagedArtifactStagingCleanupFailure) => void;
    readonly onStagingPromotionFailure?: (failure: ManagedArtifactStagingPromotionFailure) => void;
    readonly onNativeLauncherAcknowledgment?: (
      outcome: 'ready' | 'rejected' | 'malformed' | 'closed' | 'error' | 'exited' | 'timeout',
    ) => void;
    readonly trustedCertificateAuthorities?: readonly string[];
    readonly onSessionProcessLaunched?: (event: LocalWhisperWorkerProcessLaunchEvent) => void;
    readonly onLoadStage?: (
      stage: import('./LocalWhisperProductionWorkerPort').LocalWhisperQualificationLoadStage,
    ) => void;
  };`;
const AFTER_ARTIFACT_PORT_ANCHOR = `      const artifactPort = new LocalWhisperProductionArtifactPort({
        catalog: loaded.catalog,
        canAcquire: canAcquireArtifact,
        clearance: removalClearanceIssuer,
        inventory: artifactInventory,
        service: artifactService,
      });`;
const AFTER_ARTIFACT_PORT_REPLACEMENT = `      const artifactPort = new LocalWhisperProductionArtifactPort({
        catalog: loaded.catalog,
        canAcquire: canAcquireArtifact,
        clearance: removalClearanceIssuer,
        inventory: artifactInventory,
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactOperationCompleted
          ? { onOperationCompleted: this.dependencies.qualificationHooks.onArtifactOperationCompleted }
          : {}),
        service: artifactService,
      });
      const publishQualificationStage = (
        stage: import('../artifacts/StreamingArtifactExtractor').ArtifactInstallationDiagnosticStage,
      ): void => {
        if (activationPurpose !== 'qualification') return;
        try {
          this.dependencies.qualificationHooks?.onArtifactInstallationStage?.(stage);
        } catch {
          // Qualification diagnostics must never affect production behavior or attempt control flow.
        }
      };`;
const AFTER_EXTRACTOR_ANCHOR = `        extractor: new StreamingArtifactExtractor({
          clock: artifactClock,
          maximumInFlightWrites: PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
          observePipeline: null,
          store: managedStore,
        }),`;
const AFTER_EXTRACTOR_REPLACEMENT = `        extractor: new StreamingArtifactExtractor({
          clock: artifactClock,
          maximumInFlightWrites: PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
          ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactInstallationStage
            ? { onInstallationStage: this.dependencies.qualificationHooks.onArtifactInstallationStage }
            : {}),
          observePipeline: null,
          store: managedStore,
        }),`;
const AFTER_ARTIFACT_SERVICE_HOOK_ANCHOR = `        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactTransferFailure
          ? { onTransferFailure: this.dependencies.qualificationHooks.onArtifactTransferFailure }
          : {}),
        progress: artifactProgressStore,`;
const AFTER_ARTIFACT_SERVICE_HOOK_REPLACEMENT = `        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactTransferFailure
          ? { onTransferFailure: this.dependencies.qualificationHooks.onArtifactTransferFailure }
          : {}),
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactInstallationStage
          ? { onInstallationStage: this.dependencies.qualificationHooks.onArtifactInstallationStage }
          : {}),
        progress: artifactProgressStore,`;
const AFTER_LIFECYCLE_ANCHOR = `      const lifecycle = new LocalWhisperWorkerLifecycle({
        createSession: () =>
          new LocalWhisperWorkerSupervisor({
            clock: {
              clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
              setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
            },
            createTransport: (streams, callbacks) => new LocalWhisperWorkerTransport(streams, callbacks),
            nextRequestId: this.dependencies.nextRequestId,
            createNativeRuntimeLogDecoder: (processInstanceId) =>
              new NativeRuntimeLogStreamDecoder({
                ...(processInstanceId ? { expectedProcessInstanceId: processInstanceId } : {}),
                onRecord: (record) => nativeRuntimeLogRelay.accept(record),
              }),
            ownership: sessionOwnership,
          }),
      });`;
const AFTER_LIFECYCLE_REPLACEMENT = `      const lifecycle = new LocalWhisperWorkerLifecycle({
        createSession: () =>
          new LocalWhisperWorkerSupervisor({
            clock: {
              clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
              setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
            },
            createTransport: (streams, callbacks) => new LocalWhisperWorkerTransport(streams, callbacks),
            nextRequestId: this.dependencies.nextRequestId,
            createNativeRuntimeLogDecoder: (processInstanceId) =>
              new NativeRuntimeLogStreamDecoder({
                ...(processInstanceId ? { expectedProcessInstanceId: processInstanceId } : {}),
                onRecord: (record) => nativeRuntimeLogRelay.accept(record),
              }),
            ...(activationPurpose === 'qualification' &&
            this.dependencies.qualificationHooks?.onArtifactInstallationStage
              ? { onQualificationStage: this.dependencies.qualificationHooks.onArtifactInstallationStage }
              : {}),
            ownership: sessionOwnership,
          }),
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactInstallationStage
          ? { onFullLoadStage: this.dependencies.qualificationHooks.onArtifactInstallationStage }
          : {}),
      });`;
const AFTER_PREFLIGHT_START_ANCHOR = `          preflight: async (request) => {
            const current = selectedArtifactSetup(request.settings, inventory);`;
const AFTER_PREFLIGHT_START_REPLACEMENT = `          preflight: async (request) => {
            publishQualificationStage('coordinatorPreflightStarted');
            const current = selectedArtifactSetup(request.settings, inventory);
            publishQualificationStage('coordinatorPreflightSetupResolved');`;
const AFTER_PREFLIGHT_CATALOG_ANCHOR = `            const estimate = loaded.catalog.payload.memoryEstimates.find(
              (record) =>
                record.runtimePackRevision === request.settings.runtimeRevision &&
                record.model.logicalModel === request.settings.model.family &&
                record.model.artifactRevision === request.settings.model.revision &&
                record.backend === request.settings.execution.backend,
            );
            if (!runtime || !model || !estimate) {`;
const AFTER_PREFLIGHT_CATALOG_REPLACEMENT = `            const estimate = loaded.catalog.payload.memoryEstimates.find(
              (record) =>
                record.runtimePackRevision === request.settings.runtimeRevision &&
                record.model.logicalModel === request.settings.model.family &&
                record.model.artifactRevision === request.settings.model.revision &&
                record.backend === request.settings.execution.backend,
            );
            publishQualificationStage('coordinatorPreflightCatalogResolved');
            if (!runtime || !model || !estimate) {`;
const AFTER_PREFLIGHT_BACKEND_ANCHOR = `            let backendProbe = staticBackendProbe(request.settings, context.logicalProcessorCount);
            if (execution.target === 'gpu') {`;
const AFTER_PREFLIGHT_BACKEND_REPLACEMENT = `            let backendProbe = staticBackendProbe(request.settings, context.logicalProcessorCount);
            publishQualificationStage('coordinatorPreflightBackendPrepared');
            if (execution.target === 'gpu') {`;
const AFTER_PREFLIGHT_GPU_AUTHORITY_ANCHOR = `                  launchMode: 'registry',
                });
                const registry = await registryDiscovery?.discover(authority, request.signal);`;
const AFTER_PREFLIGHT_GPU_AUTHORITY_REPLACEMENT = `                  launchMode: 'registry',
                });
                publishQualificationStage('coordinatorPreflightGpuAuthorityAcquired');
                const registry = await registryDiscovery?.discover(authority, request.signal);`;
const AFTER_PREFLIGHT_GPU_REGISTRY_ANCHOR = `                const registry = await registryDiscovery?.discover(authority, request.signal);
                if (!registry) throw new Error('Local Whisper registry unavailable');
                const topology = deviceTopologyAuthority.update(registry);`;
const AFTER_PREFLIGHT_GPU_REGISTRY_REPLACEMENT = `                const registry = await registryDiscovery?.discover(authority, request.signal);
                if (!registry) throw new Error('Local Whisper registry unavailable');
                publishQualificationStage('coordinatorPreflightGpuRegistryDiscovered');
                const topology = deviceTopologyAuthority.update(registry);`;
const AFTER_PREFLIGHT_GPU_RESOURCES_ANCHOR = `                freeVramBytes = await selectedVram.refresh(request.settings.execution);
                facts?.update(`;
const AFTER_PREFLIGHT_GPU_RESOURCES_REPLACEMENT = `                freeVramBytes = await selectedVram.refresh(request.settings.execution);
                publishQualificationStage('coordinatorPreflightGpuResourcesSampled');
                facts?.update(`;
const AFTER_PREFLIGHT_RESULT_ANCHOR = `            return capabilityService.preflight({
              settings: request.settings,`;
const AFTER_PREFLIGHT_RESULT_REPLACEMENT = `            const freeRamBytes = Math.max(0, Math.trunc(this.dependencies.availableMemoryBytes()));
            publishQualificationStage('coordinatorPreflightAvailabilitySampled');
            const fingerprint = capabilityFingerprint(
              loaded.catalog,
              request.settings,
              inventory.revision,
              context.logicalProcessorCount,
              request.epochs,
            );
            publishQualificationStage('coordinatorPreflightFingerprintCreated');
            const result = capabilityService.preflight({
              settings: request.settings,`;
const AFTER_PREFLIGHT_AVAILABILITY_ANCHOR = `              availability: {
                freeRamBytes: Math.max(0, Math.trunc(this.dependencies.availableMemoryBytes())),
                freeVramBytes,
              },
              capabilityFingerprint: capabilityFingerprint(
                loaded.catalog,
                request.settings,
                inventory.revision,
                context.logicalProcessorCount,
                request.epochs,
              ),
            });
          },`;
const AFTER_PREFLIGHT_AVAILABILITY_REPLACEMENT = `              availability: {
                freeRamBytes,
                freeVramBytes,
              },
              capabilityFingerprint: fingerprint,
            });
            publishQualificationStage('coordinatorPreflightCompleted');
            return result;
          },`;
const SUPERVISOR_HOOK_ANCHOR = `  readonly nativeRuntimeLogDecoder?: Pick<NativeRuntimeLogStreamDecoder, 'append' | 'clear' | 'finish'>;
  readonly ownership: WorkerProcessOwnership;`;
const SUPERVISOR_HOOK_REPLACEMENT = `  readonly nativeRuntimeLogDecoder?: Pick<NativeRuntimeLogStreamDecoder, 'append' | 'clear' | 'finish'>;
  readonly onQualificationStage?: (
    stage: import('../artifacts/StreamingArtifactExtractor').ArtifactInstallationDiagnosticStage,
  ) => void;
  readonly ownership: WorkerProcessOwnership;`;
const SUPERVISOR_LAUNCH_ANCHOR = `      this.process = await this.dependencies.ownership.launch(authority);
      if (authority.workerInputBootstrap && !authority.modelGuardAuthority) {`;
const SUPERVISOR_LAUNCH_REPLACEMENT = `      this.process = await this.dependencies.ownership.launch(authority);
      this.publishQualificationStage('supervisorLaunchReturned');
      if (authority.workerInputBootstrap && !authority.modelGuardAuthority) {`;
const SUPERVISOR_BIND_ANCHOR = `      this.bindProcess(this.process);
    } catch {`;
const SUPERVISOR_BIND_REPLACEMENT = `      this.bindProcess(this.process);
      this.publishQualificationStage('supervisorTransportBound');
    } catch {`;
const SUPERVISOR_HANDSHAKE_TIMER_ANCHOR = `      const timer = this.dependencies.clock.setTimeout(() => {
        void this.failTerminal('OPERATION_TIMEOUT', 'workerStart');`;
const SUPERVISOR_HANDSHAKE_TIMER_REPLACEMENT = `      const timer = this.dependencies.clock.setTimeout(() => {
        this.publishQualificationStage('supervisorHandshakeTimedOut');
        void this.failTerminal('OPERATION_TIMEOUT', 'workerStart');`;
const SUPERVISOR_HELLO_ANCHOR = `    try {
      await this.requireTransport().sendControl({
        type: 'hello',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      });
    } catch {`;
const SUPERVISOR_HELLO_REPLACEMENT = `    try {
      this.publishQualificationStage('supervisorHelloSendStarted');
      await this.requireTransport().sendControl({
        type: 'hello',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      });
      this.publishQualificationStage('supervisorHelloSent');
    } catch {`;
const SUPERVISOR_HANDSHAKE_RECEIVED_ANCHOR = `    this.handshake = null;
    this.stateValue = 'handshaken';
    handshake.resolve(this.success(EMPTY_VALUE));`;
const SUPERVISOR_HANDSHAKE_RECEIVED_REPLACEMENT = `    this.handshake = null;
    this.stateValue = 'handshaken';
    this.publishQualificationStage('supervisorHandshakeReceived');
    handshake.resolve(this.success(EMPTY_VALUE));`;
const SUPERVISOR_CLEANUP_START_ANCHOR = `  private async runCleanup(): Promise<boolean> {
    const process = this.process;`;
const SUPERVISOR_CLEANUP_START_REPLACEMENT = `  private async runCleanup(): Promise<boolean> {
    this.publishQualificationStage('supervisorCleanupStarted');
    const process = this.process;`;
const SUPERVISOR_TERMINATION_ANCHOR = `    if (!exited) {
      await process.requestTreeTermination().catch(() => undefined);
      exited = await process.waitForExit(LOCAL_WHISPER_TERMINATE_TIMEOUT_MS).catch(() => false);`;
const SUPERVISOR_TERMINATION_REPLACEMENT = `    if (!exited) {
      await process.requestTreeTermination().catch(() => undefined);
      this.publishQualificationStage('supervisorTerminationRequested');
      exited = await process.waitForExit(LOCAL_WHISPER_TERMINATE_TIMEOUT_MS).catch(() => false);`;
const SUPERVISOR_FORCE_TERMINATION_ANCHOR = `      process.closeOwnershipControl();
      await process.forceTreeTermination().catch(() => undefined);
      exited = await process.waitForExit(LOCAL_WHISPER_KILL_CONFIRMATION_TIMEOUT_MS).catch(() => false);`;
const SUPERVISOR_FORCE_TERMINATION_REPLACEMENT = `      process.closeOwnershipControl();
      await process.forceTreeTermination().catch(() => undefined);
      this.publishQualificationStage('supervisorForceTerminationRequested');
      exited = await process.waitForExit(LOCAL_WHISPER_KILL_CONFIRMATION_TIMEOUT_MS).catch(() => false);`;
const SUPERVISOR_EXIT_FAILURE_ANCHOR = `    if (!exited) {
      this.dependencies.ownership.retainFailedOwnership();
      this.stateValue = 'cleanupFailed';
      return false;
    }`;
const SUPERVISOR_EXIT_FAILURE_REPLACEMENT = `    if (!exited) {
      this.dependencies.ownership.retainFailedOwnership();
      this.stateValue = 'cleanupFailed';
      this.publishQualificationStage('supervisorCleanupFailed');
      return false;
    }`;
const SUPERVISOR_RELEASE_FAILURE_ANCHOR = `    } catch {
      this.dependencies.ownership.retainFailedOwnership();
      this.stateValue = 'cleanupFailed';
      return false;
    }
    this.process = null;`;
const SUPERVISOR_RELEASE_FAILURE_REPLACEMENT = `    } catch {
      this.dependencies.ownership.retainFailedOwnership();
      this.stateValue = 'cleanupFailed';
      this.publishQualificationStage('supervisorCleanupFailed');
      return false;
    }
    this.process = null;`;
const SUPERVISOR_CLEANUP_COMPLETE_ANCHOR = `    this.stateValue = 'idle';
    this.terminal = false;
    return true;
  }

  private async releaseModelLease(): Promise<void> {`;
const SUPERVISOR_CLEANUP_COMPLETE_REPLACEMENT = `    this.stateValue = 'idle';
    this.terminal = false;
    this.publishQualificationStage('supervisorCleanupCompleted');
    return true;
  }

  private publishQualificationStage(
    stage: import('../artifacts/StreamingArtifactExtractor').ArtifactInstallationDiagnosticStage,
  ): void {
    try {
      this.dependencies.onQualificationStage?.(stage);
    } catch {
      // Qualification diagnostics are observational and cannot control supervisor behavior.
    }
  }

  private async releaseModelLease(): Promise<void> {`;

const PROBE_INCLUDE = '#include "local_whisper/common/performance_qualification_probe.hpp"';
const NATIVE_TARGETS = Object.freeze({
  guardApplication: Object.freeze({
    path: 'runtime/local-whisper/fs-guard/src/common/guard_application.cpp',
    beforeSha256: '9a7f4655d4b25b4a7f41a0aa5409beb8b4738a712025ca8a32db42e8514a0d63',
    afterSha256: '85b764f793ea9673ba1cd413880ae5f756c9c2db5551646e14f0e712ab0555a1',
  }),
  modelLaunch: Object.freeze({
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp',
    beforeSha256: '9ac4d2749e4ae0594d35bcbeb3002276930d2d86717223d2e03b9d8ee8fa07ca',
    afterSha256: '5f7d9598923fc1717cf02c687e77f80f854bbf322ebc9be144479521a187e15c',
  }),
  authority: Object.freeze({
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp',
    beforeSha256: 'f24c3cdffc2e8c466d99f71ce8b2599704793ca2d1ce459aaaa736d1ed487d88',
    afterSha256: 'f24c3cdffc2e8c466d99f71ce8b2599704793ca2d1ce459aaaa736d1ed487d88',
  }),
  launcher: Object.freeze({
    path: 'runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp',
    beforeSha256: '511e0e25e50fdac1883983946202352ea09f482584f57d7dceffe94af7754146',
    afterSha256: 'fc3970f983e72fe2de49adb40850ead1f16ad5641ebf6f5a54c4b2a0ba8d96b2',
  }),
  engine: Object.freeze({
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    beforeSha256: 'b82a16e04941dc10af0d327fc18fbe1ddfbebe98789cd289cceb7ad8a0f0d8b8',
    afterSha256: '0ac520da531e98e3c125ec92f77004e02aa6d60ef16117589a8dfd692dafd3f9',
  }),
  worker: Object.freeze({
    path: 'runtime/local-whisper/whisper-cpp/core/worker_application.cpp',
    beforeSha256: 'aef50d73ca50d01115349183c4a30cca07fc37e6f98b7e8450a274adff86cce4',
    afterSha256: 'de2fc5208cdd13b16808d6a181675045a35bcd398fa45e46f0dab39ff918de8f',
  }),
  workerMain: Object.freeze({
    path: 'runtime/local-whisper/whisper-cpp/core/main.cpp',
    beforeSha256: 'b078d126d7e436b27a520678560fb84dc93e0a4b96379a23ff731f546c93c0e3',
    afterSha256: 'd0d46251f1134a6088150fee18ccda2115272918d6ce0760347df4de9be17b95',
  }),
});

const INCLUDE_ANCHORS = Object.freeze({
  guardApplication: '#include "local_whisper/fs_guard/guard_application.hpp"',
  modelLaunch: '#include "local_whisper/fs_guard/model_authority_server.hpp"',
  authority: '#include "local_whisper/fs_guard/model_authority_server.hpp"',
  launcher: '#include "local_whisper/launcher/platform_launcher.hpp"',
  engine: '#include "local_whisper/whisper_cpp/engine.hpp"',
  worker: '#include "local_whisper/whisper_cpp/worker_application.hpp"',
  workerMain: '#include "local_whisper/whisper_cpp/worker_protocol.hpp"',
});

const GUARD_RUN_ANCHOR = `    try {
      const Request request = parse_request(line.payload, request_id);
      output << serialize_response(request.id, true, dispatch_command(backend_, request.command));
    } catch (const GuardError& error) {`;
const GUARD_RUN_REPLACEMENT = `    try {
      const local_whisper::common::PerformanceQualificationTimer decode_timer(
          "installationDecode");
      const Request request = parse_request(line.payload, request_id);
      const auto decode_nanoseconds = decode_timer.elapsed_nanoseconds();
      const local_whisper::common::PerformanceQualificationTimer write_timer(
          "installationWrite");
      if (std::holds_alternative<WriteFileCommand>(request.command)) {
        installation_decode_nanoseconds += decode_nanoseconds;
        installation_write_nanoseconds += write_timer.elapsed_nanoseconds();
      }
      if (std::holds_alternative<PromoteCommand>(request.command) &&
          installation_decode_nanoseconds > 0U && installation_write_nanoseconds > 0U) {
        if (!local_whisper::common::emit_performance_qualification_probe(
                "phase", "installationDecode", installation_decode_nanoseconds) ||
            !local_whisper::common::emit_performance_qualification_probe(
                "phase", "installationWrite", installation_write_nanoseconds)) {
          throw GuardError("IO_FAILED");
        }
        installation_decode_nanoseconds = 0U;
        installation_write_nanoseconds = 0U;
      }
      // Emit qualification-only timing before promotion so an unavailable probe cannot
      // report an error after the staging directory has been atomically moved.
      const auto response = dispatch_command(backend_, request.command);
      output << serialize_response(request.id, true, response);
    } catch (const GuardError& error) {`;
const GUARD_LOOP_ANCHOR = `  BoundedLineReader reader(`;
const GUARD_LOOP_REPLACEMENT = `  std::uint64_t installation_decode_nanoseconds = 0U;
  std::uint64_t installation_write_nanoseconds = 0U;
#if defined(__linux__)
  if (dup2(local_whisper::common::kPerformanceQualificationProbeSourceDescriptor,
           local_whisper::common::kPerformanceQualificationProbeDescriptor) !=
      local_whisper::common::kPerformanceQualificationProbeDescriptor)
    return 1;
#endif
  BoundedLineReader reader(`;

const MODEL_DIGEST_ANCHOR = `  if (hash_descriptor(model.file.get(), request.model_size_bytes) != request.model_sha256)
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch model digest changed");`;
const MODEL_LAUNCH_START_ANCHOR = `int run_linux_model_launch(const int control_descriptor, const int acknowledgment_descriptor) {
  termination_requested = 0;`;
const MODEL_LAUNCH_START_REPLACEMENT = `int run_linux_model_launch(const int control_descriptor, const int acknowledgment_descriptor) {
  termination_requested = 0;
  if (dup2(local_whisper::common::kPerformanceQualificationProbeSourceDescriptor,
           local_whisper::common::kPerformanceQualificationProbeDescriptor) !=
      local_whisper::common::kPerformanceQualificationProbeDescriptor) {
    throw ModelLaunchError(ModelLaunchErrorCode::kPipeIoFailed,
                           "model launch performance probe descriptor unavailable");
  }
  if (!local_whisper::common::emit_performance_qualification_probe(
          "stage", "modelGuardEntered", 1U)) {
    throw ModelLaunchError(ModelLaunchErrorCode::kPipeIoFailed,
                           "model launch performance probe unavailable");
  }`;
const MODEL_DIGEST_REPLACEMENT = `  const local_whisper::common::PerformanceQualificationTimer model_digest_timer(
      "nativeModelGuardDigest");
  if (hash_descriptor(model.file.get(), request.model_size_bytes) != request.model_sha256)
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch model digest changed");
  if (!model_digest_timer.emit())
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch performance probe failed");`;
const MODEL_EVENT_DESCRIPTOR_ANCHOR = `    map_descriptor(acknowledgment_descriptor, kLauncherAcknowledgmentDescriptor);
    map_descriptor(launcher_authority.get(), kLauncherAuthorityDescriptor);`;
const MODEL_EVENT_DESCRIPTOR_REPLACEMENT = `    map_descriptor(acknowledgment_descriptor, kLauncherAcknowledgmentDescriptor);
    map_descriptor(local_whisper::common::kPerformanceQualificationProbeSourceDescriptor,
                   local_whisper::common::kPerformanceQualificationProbeDescriptor);
    map_descriptor(launcher_authority.get(), kLauncherAuthorityDescriptor);`;
const BEFORE_MODEL_EVENT_DESCRIPTOR_ANCHOR = `    map_descriptor(acknowledgment_descriptor, 4);
    map_descriptor(launcher_authority.get(), kLauncherAuthorityDescriptor);`;
const BEFORE_MODEL_EVENT_DESCRIPTOR_REPLACEMENT = `    map_descriptor(acknowledgment_descriptor, 4);
    map_descriptor(local_whisper::common::kPerformanceQualificationProbeSourceDescriptor,
                   local_whisper::common::kPerformanceQualificationProbeDescriptor);
    map_descriptor(launcher_authority.get(), kLauncherAuthorityDescriptor);`;
const MODEL_CLOSE_RANGE_ANCHOR = `    if (syscall(SYS_close_range, 7U, std::numeric_limits<unsigned int>::max(), 0U) != 0)`;
const MODEL_CLOSE_RANGE_REPLACEMENT = `    if (syscall(SYS_close_range,
                static_cast<unsigned int>(
                    local_whisper::common::kPerformanceQualificationProbeDescriptor + 1),
                std::numeric_limits<unsigned int>::max(), 0U) != 0)`;
const MODEL_LAUNCHER_EXEC_ANCHOR = `    fexecve(kLauncherExecutableDescriptor, arguments.data(), environment.data());`;
const MODEL_LAUNCHER_EXEC_REPLACEMENT = `    if (!local_whisper::common::emit_performance_qualification_probe(
            "stage", "modelLauncherExecRequested", 1U)) {
      _exit(common::kChildExecBootstrapFailureExitCode);
    }
    fexecve(kLauncherExecutableDescriptor, arguments.data(), environment.data());`;

const AUTHORITY_DIGEST_ANCHOR = `  validate_regular_file_evidence(model_descriptor_, expected_binding_);`;
const AUTHORITY_DIGEST_REPLACEMENT = `  const local_whisper::common::PerformanceQualificationTimer digest_timer(
      "nativeAuthorityDigest");
  validate_regular_file_evidence(model_descriptor_, expected_binding_);
  if (!digest_timer.emit())
    throw std::runtime_error("model authority performance probe failed");`;
const AUTHORITY_TRANSFER_ANCHOR = `  send_transfer(channel_descriptor, model_descriptor_, received.request.binding);`;
const AUTHORITY_TRANSFER_REPLACEMENT = `  const local_whisper::common::PerformanceQualificationTimer transfer_timer(
      "authorityTransfer");
  send_transfer(channel_descriptor, model_descriptor_, received.request.binding);
  if (!transfer_timer.emit())
    throw std::runtime_error("model authority performance probe failed");`;

const LAUNCHER_FORK_ANCHOR = `    const pid_t child = fork();`;
const LAUNCHER_FORK_REPLACEMENT = `    const local_whisper::common::PerformanceQualificationTimer creation_timer(
        "guardedProcessCreation");
    const pid_t child = fork();`;
const LAUNCHER_CHILD_ENTERED_ANCHOR = `    if (child == 0) {
      const pid_t launcher_pid = getppid();`;
const LAUNCHER_CHILD_ENTERED_REPLACEMENT = `    if (child == 0) {
      if (!local_whisper::common::emit_performance_qualification_probe(
              "stage", "workerChildStarted", 1U)) {
        _exit(common::kChildExecBootstrapFailureExitCode);
      }
      const pid_t launcher_pid = getppid();`;
const LAUNCHER_EXEC_REQUESTED_ANCHOR = `      fexecve(worker.get(), arguments.data(), environ);`;
const LAUNCHER_EXEC_REQUESTED_REPLACEMENT = `      if (!local_whisper::common::emit_performance_qualification_probe(
              "stage", "workerExecRequested", 1U)) {
        _exit(common::kChildExecBootstrapFailureExitCode);
      }
      fexecve(worker.get(), arguments.data(), environ);`;
const LAUNCHER_ENTERED_ANCHOR = `    const bool full_load = request.launch_mode == WorkerLaunchMode::full_load;`;
const LAUNCHER_ENTERED_REPLACEMENT = `    const bool full_load = request.launch_mode == WorkerLaunchMode::full_load;
    if (!local_whisper::common::emit_performance_qualification_probe(
            "stage", "launcherEntered", 1U)) {
      throw LauncherError(LauncherErrorCode::kPipeIoFailed,
                          "launcher performance probe unavailable");
    }`;
const LAUNCHER_WORKER_VERIFIED_ANCHOR = `    termination_requested = 0;`;
const LAUNCHER_WORKER_VERIFIED_REPLACEMENT = `    if (!local_whisper::common::emit_performance_qualification_probe(
            "stage", "launcherWorkerVerified", 1U)) {
      throw LauncherError(LauncherErrorCode::kPipeIoFailed,
                          "launcher performance probe unavailable");
    }
    termination_requested = 0;`;
const LAUNCHER_PARENT_ANCHOR = `    try {
      if (setpgid(child, child) != 0 && errno != EACCES)`;
const LAUNCHER_PARENT_REPLACEMENT = `    if (!creation_timer.emit() ||
        !local_whisper::common::emit_performance_qualification_probe(
            "worker", "pid", static_cast<std::uint64_t>(child)) ||
        !local_whisper::common::emit_performance_qualification_probe(
            "stage", "launcherWorkerCreated", 1U)) {
      terminate_and_reap_owned_group(child);
      throw LauncherError(LauncherErrorCode::kWorkerCreationFailed,
                          "launcher performance probe failed");
    }
    try {
      if (setpgid(child, child) != 0 && errno != EACCES)`;
const LAUNCHER_READY_ANCHOR = `    write_acknowledgment(acknowledgment_descriptor, child);`;
const LAUNCHER_READY_REPLACEMENT = `    if (!local_whisper::common::emit_performance_qualification_probe(
            "stage", "launcherAcknowledged", 1U)) {
      throw LauncherError(LauncherErrorCode::kPipeIoFailed,
                          "launcher performance probe unavailable");
    }
    write_acknowledgment(acknowledgment_descriptor, child);`;

const ENGINE_PREFLIGHT_ANCHOR = `    ModelFormatPreflight preflight{LoaderLimits()};
    static_cast<void>(preflight.validate(reader, family, variant));
    reader.rewind_after_verified_pass();`;
const ENGINE_PREFLIGHT_REPLACEMENT = `    const local_whisper::common::PerformanceQualificationTimer preflight_timer(
        "modelPreflight");
    ModelFormatPreflight preflight{LoaderLimits()};
    static_cast<void>(preflight.validate(reader, family, variant));
    reader.rewind_after_verified_pass();
    const auto preflight_nanoseconds = preflight_timer.elapsed_nanoseconds();
    if (!local_whisper::common::emit_performance_qualification_probe(
            "phase", "workerPreflightDigest", preflight_nanoseconds) ||
        !local_whisper::common::emit_performance_qualification_probe(
            "phase", "modelPreflight", preflight_nanoseconds)) {
      throw CoreError(FailureCode::model_load_failed, "model preflight performance probe failed");
    }`;
const ENGINE_LOADER_ANCHOR = `    whisper_model_loader loader{&reader, exact_loader_read, exact_loader_eof, exact_loader_close};
    whisper_context* loaded = whisper_init_with_params(&loader, parameters);`;
const ENGINE_LOADER_REPLACEMENT = `    whisper_model_loader loader{&reader, exact_loader_read, exact_loader_eof, exact_loader_close};
    const local_whisper::common::PerformanceQualificationTimer loader_timer("whisperLoad");
    whisper_context* loaded = whisper_init_with_params(&loader, parameters);`;
const STANDARD_ENGINE_LOADER_ANCHOR = `    whisper_context* loaded = whisper_init_from_file_with_params(model_path.c_str(), parameters);`;
const STANDARD_ENGINE_LOADER_REPLACEMENT = `    const local_whisper::common::PerformanceQualificationTimer loader_timer(
        "whisperLoad");
    whisper_context* loaded = whisper_init_from_file_with_params(model_path.c_str(), parameters);`;
const ENGINE_CONTEXT_ANCHOR = `    context_.reset(loaded);`;
const STANDARD_ENGINE_CONTEXT_ANCHOR = `    context_.reset(loaded);
  }

  void load_legacy_authenticated`;
const STANDARD_ENGINE_CONTEXT_REPLACEMENT = `    context_.reset(loaded);
    if (!loader_timer.emit()) {
      throw CoreError(FailureCode::model_load_failed, "worker model-load performance probe failed");
    }
  }

  void load_legacy_authenticated`;
const ENGINE_CONTEXT_REPLACEMENT = `    context_.reset(loaded);
    const auto loader_nanoseconds = loader_timer.elapsed_nanoseconds();
    if (!local_whisper::common::emit_performance_qualification_probe(
            "phase", "workerLoaderDigest", loader_nanoseconds) ||
        !local_whisper::common::emit_performance_qualification_probe(
            "phase", "whisperLoad", loader_nanoseconds) ||
        (kGpuWorker && !local_whisper::common::emit_performance_qualification_probe(
                           "phase", "gpuUploadAllocation", loader_nanoseconds))) {
      throw CoreError(FailureCode::model_load_failed, "model load performance probe failed");
    }`;

const BEFORE_WARMUP_ANCHOR = `  engine_.load(reader, load.family, load.variant, load.device_authority, cancellation_);
  engine_.warm_up(probe_evidence.resolved_threads, cancellation_);`;
const BEFORE_WARMUP_REPLACEMENT = `  engine_.load(reader, load.family, load.variant, load.device_authority, cancellation_);
  const local_whisper::common::PerformanceQualificationTimer warmup_timer("inferenceWarmup");
  engine_.warm_up(probe_evidence.resolved_threads, cancellation_);
  if (!warmup_timer.emit())
    throw CoreError(FailureCode::model_load_failed, "warm-up performance probe failed");`;
const AFTER_WARMUP_ANCHOR = `      try {
        engine_.warm_up(probe_evidence.resolved_threads, cancellation_);`;
const AFTER_WARMUP_REPLACEMENT = `      try {
        const local_whisper::common::PerformanceQualificationTimer warmup_timer(
            "inferenceWarmup");
        engine_.warm_up(probe_evidence.resolved_threads, cancellation_);
        if (!warmup_timer.emit())
          throw CoreError(FailureCode::warmup_failed, "warm-up performance probe failed");`;
const WORKER_MAIN_ENTERED_ANCHOR = `int main(int argc, char** argv) {
  auto logger = local_whisper::common::make_native_logger_from_environment();`;
const WORKER_MAIN_ENTERED_REPLACEMENT = `int main(int argc, char** argv) {
  if (!local_whisper::common::emit_performance_qualification_probe(
          "stage", "workerEntered", 1U)) {
    return 20;
  }
  auto logger = local_whisper::common::make_native_logger_from_environment();`;

const COMMON_OVERLAY_FILES = Object.freeze([
  'scripts/local-whisper/qualification/PerformanceQualificationAttemptRunner.ts',
  'scripts/local-whisper/qualification/PerformanceQualificationEventProtocol.ts',
  'scripts/local-whisper/qualification/PerformanceQualification.ts',
  'src/main/localWhisper/composition/LocalWhisperProductionArtifactPort.ts',
  'src/main/localWhisper/artifacts/StreamingArtifactExtractor.ts',
  'src/main/localWhisper/artifacts/LocalWhisperArtifactService.ts',
  'src/main/localWhisper/supervisor/LocalWhisperWorkerLifecycle.ts',
  'scripts/local-whisper/qualification/PerformanceQualificationCollector.ts',
  'scripts/local-whisper/qualification/QualificationContracts.ts',
  'scripts/local-whisper/qualification/LinuxPerformanceAttemptProbe.ts',
  'scripts/local-whisper/qualification/LinuxPerformanceAttemptApplication.ts',
  'scripts/local-whisper/qualification/PerformanceAttemptDiagnosticProtocol.ts',
  'scripts/local-whisper/qualification/PerformanceRuntimeArchiveInspector.ts',
  'scripts/local-whisper/qualification/run-linux-performance-attempt.ts',
  'runtime/local-whisper/common/include/local_whisper/common/performance_qualification_probe.hpp',
  'docs/specs/local-whisper/qualification/schemas/performance-attempt-response-v3.schema.json',
] as const);

export interface ReviewedPerformanceQualificationOverlay {
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly manifestSha256: string;
}

function writeString(target: Buffer, offset: number, length: number, value: string): void {
  const source = Buffer.from(value, 'utf8');
  if (source.byteLength > length) throw new Error('PERFORMANCE_OVERLAY_ARCHIVE_INVALID');
  source.copy(target, offset);
}

function writeOctal(target: Buffer, offset: number, length: number, value: number): void {
  const encoded = value.toString(8).padStart(length - 1, '0');
  if (encoded.length !== length - 1) throw new Error('PERFORMANCE_OVERLAY_ARCHIVE_INVALID');
  writeString(target, offset, length, `${encoded}\0`);
}

function tarEntry(relativePath: string, bytes: Buffer, mode: number): Buffer {
  if (!/^[\w./-]+$/u.test(relativePath) || relativePath.length > 100 || bytes.byteLength > 64 * 1024 * 1024) {
    throw new Error('PERFORMANCE_OVERLAY_ARCHIVE_INVALID');
  }
  const header = Buffer.alloc(TAR_BLOCK_BYTES);
  writeString(header, 0, 100, relativePath);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, bytes.byteLength);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  const checksum = header.reduce((sum, value) => sum + value, 0);
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  const padding = Buffer.alloc((TAR_BLOCK_BYTES - (bytes.byteLength % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES);
  return Buffer.concat([header, bytes, padding]);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/gu, '\n');
}

function canonicalOverlayFile(bytes: Buffer): Buffer {
  try {
    return Buffer.from(normalizeLineEndings(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), 'utf8');
  } catch {
    throw new Error('PERFORMANCE_OVERLAY_ARCHIVE_INVALID');
  }
}

function transformManifest(): Readonly<Record<string, unknown>> {
  const operation = (
    side: 'before' | 'after',
    targetPath: string,
    expectedSha256: string,
    replacements: readonly Readonly<{ readonly anchor: string; readonly replacement: string }>[],
  ) =>
    Object.freeze({
      side,
      targetPath,
      expectedSha256,
      replacements: Object.freeze(
        replacements.map(({ anchor, replacement }) =>
          Object.freeze({
            anchor: normalizeLineEndings(anchor),
            replacement: normalizeLineEndings(replacement),
          }),
        ),
      ),
    });
  const include = (anchor: string) => Object.freeze({ anchor, replacement: `${anchor}\n\n${PROBE_INCLUDE}` });
  const native = (
    side: 'before' | 'after',
    target: (typeof NATIVE_TARGETS)[keyof typeof NATIVE_TARGETS],
    replacements: readonly Readonly<{ readonly anchor: string; readonly replacement: string }>[],
  ) => operation(side, target.path, side === 'before' ? target.beforeSha256 : target.afterSha256, replacements);
  return Object.freeze({
    schemaVersion: 1,
    operations: Object.freeze([
      operation('after', COMPOSITION_PATH, CANDIDATE_COMPOSITION_SHA256, [
        Object.freeze({ anchor: AFTER_HOOK_ANCHOR, replacement: AFTER_HOOK_REPLACEMENT }),
        Object.freeze({ anchor: AFTER_ARTIFACT_PORT_ANCHOR, replacement: AFTER_ARTIFACT_PORT_REPLACEMENT }),
        Object.freeze({ anchor: AFTER_EXTRACTOR_ANCHOR, replacement: AFTER_EXTRACTOR_REPLACEMENT }),
        Object.freeze({
          anchor: AFTER_ARTIFACT_SERVICE_HOOK_ANCHOR,
          replacement: AFTER_ARTIFACT_SERVICE_HOOK_REPLACEMENT,
        }),
        Object.freeze({ anchor: AFTER_LIFECYCLE_ANCHOR, replacement: AFTER_LIFECYCLE_REPLACEMENT }),
        Object.freeze({ anchor: AFTER_PREFLIGHT_START_ANCHOR, replacement: AFTER_PREFLIGHT_START_REPLACEMENT }),
        Object.freeze({ anchor: AFTER_PREFLIGHT_CATALOG_ANCHOR, replacement: AFTER_PREFLIGHT_CATALOG_REPLACEMENT }),
        Object.freeze({ anchor: AFTER_PREFLIGHT_BACKEND_ANCHOR, replacement: AFTER_PREFLIGHT_BACKEND_REPLACEMENT }),
        Object.freeze({
          anchor: AFTER_PREFLIGHT_GPU_AUTHORITY_ANCHOR,
          replacement: AFTER_PREFLIGHT_GPU_AUTHORITY_REPLACEMENT,
        }),
        Object.freeze({
          anchor: AFTER_PREFLIGHT_GPU_REGISTRY_ANCHOR,
          replacement: AFTER_PREFLIGHT_GPU_REGISTRY_REPLACEMENT,
        }),
        Object.freeze({
          anchor: AFTER_PREFLIGHT_GPU_RESOURCES_ANCHOR,
          replacement: AFTER_PREFLIGHT_GPU_RESOURCES_REPLACEMENT,
        }),
        Object.freeze({ anchor: AFTER_PREFLIGHT_RESULT_ANCHOR, replacement: AFTER_PREFLIGHT_RESULT_REPLACEMENT }),
        Object.freeze({
          anchor: AFTER_PREFLIGHT_AVAILABILITY_ANCHOR,
          replacement: AFTER_PREFLIGHT_AVAILABILITY_REPLACEMENT,
        }),
      ]),
      operation('after', SUPERVISOR_PATH, CANDIDATE_SUPERVISOR_SHA256, [
        Object.freeze({ anchor: SUPERVISOR_HOOK_ANCHOR, replacement: SUPERVISOR_HOOK_REPLACEMENT }),
        Object.freeze({ anchor: SUPERVISOR_LAUNCH_ANCHOR, replacement: SUPERVISOR_LAUNCH_REPLACEMENT }),
        Object.freeze({ anchor: SUPERVISOR_BIND_ANCHOR, replacement: SUPERVISOR_BIND_REPLACEMENT }),
        Object.freeze({
          anchor: SUPERVISOR_HANDSHAKE_TIMER_ANCHOR,
          replacement: SUPERVISOR_HANDSHAKE_TIMER_REPLACEMENT,
        }),
        Object.freeze({ anchor: SUPERVISOR_HELLO_ANCHOR, replacement: SUPERVISOR_HELLO_REPLACEMENT }),
        Object.freeze({
          anchor: SUPERVISOR_HANDSHAKE_RECEIVED_ANCHOR,
          replacement: SUPERVISOR_HANDSHAKE_RECEIVED_REPLACEMENT,
        }),
        Object.freeze({ anchor: SUPERVISOR_CLEANUP_START_ANCHOR, replacement: SUPERVISOR_CLEANUP_START_REPLACEMENT }),
        Object.freeze({ anchor: SUPERVISOR_TERMINATION_ANCHOR, replacement: SUPERVISOR_TERMINATION_REPLACEMENT }),
        Object.freeze({
          anchor: SUPERVISOR_FORCE_TERMINATION_ANCHOR,
          replacement: SUPERVISOR_FORCE_TERMINATION_REPLACEMENT,
        }),
        Object.freeze({ anchor: SUPERVISOR_EXIT_FAILURE_ANCHOR, replacement: SUPERVISOR_EXIT_FAILURE_REPLACEMENT }),
        Object.freeze({
          anchor: SUPERVISOR_RELEASE_FAILURE_ANCHOR,
          replacement: SUPERVISOR_RELEASE_FAILURE_REPLACEMENT,
        }),
        Object.freeze({
          anchor: SUPERVISOR_CLEANUP_COMPLETE_ANCHOR,
          replacement: SUPERVISOR_CLEANUP_COMPLETE_REPLACEMENT,
        }),
      ]),
      ...(['before', 'after'] as const).flatMap((side) => [
        native(side, NATIVE_TARGETS.guardApplication, [
          include(INCLUDE_ANCHORS.guardApplication),
          Object.freeze({ anchor: GUARD_LOOP_ANCHOR, replacement: GUARD_LOOP_REPLACEMENT }),
          Object.freeze({ anchor: GUARD_RUN_ANCHOR, replacement: GUARD_RUN_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.modelLaunch, [
          include(INCLUDE_ANCHORS.modelLaunch),
          Object.freeze({ anchor: MODEL_LAUNCH_START_ANCHOR, replacement: MODEL_LAUNCH_START_REPLACEMENT }),
          Object.freeze({ anchor: MODEL_DIGEST_ANCHOR, replacement: MODEL_DIGEST_REPLACEMENT }),
          Object.freeze({
            anchor: side === 'before' ? BEFORE_MODEL_EVENT_DESCRIPTOR_ANCHOR : MODEL_EVENT_DESCRIPTOR_ANCHOR,
            replacement:
              side === 'before' ? BEFORE_MODEL_EVENT_DESCRIPTOR_REPLACEMENT : MODEL_EVENT_DESCRIPTOR_REPLACEMENT,
          }),
          Object.freeze({ anchor: MODEL_CLOSE_RANGE_ANCHOR, replacement: MODEL_CLOSE_RANGE_REPLACEMENT }),
          Object.freeze({ anchor: MODEL_LAUNCHER_EXEC_ANCHOR, replacement: MODEL_LAUNCHER_EXEC_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.authority, [
          include(INCLUDE_ANCHORS.authority),
          Object.freeze({ anchor: AUTHORITY_DIGEST_ANCHOR, replacement: AUTHORITY_DIGEST_REPLACEMENT }),
          Object.freeze({ anchor: AUTHORITY_TRANSFER_ANCHOR, replacement: AUTHORITY_TRANSFER_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.launcher, [
          include(INCLUDE_ANCHORS.launcher),
          Object.freeze({ anchor: LAUNCHER_ENTERED_ANCHOR, replacement: LAUNCHER_ENTERED_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_WORKER_VERIFIED_ANCHOR, replacement: LAUNCHER_WORKER_VERIFIED_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_FORK_ANCHOR, replacement: LAUNCHER_FORK_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_CHILD_ENTERED_ANCHOR, replacement: LAUNCHER_CHILD_ENTERED_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_EXEC_REQUESTED_ANCHOR, replacement: LAUNCHER_EXEC_REQUESTED_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_PARENT_ANCHOR, replacement: LAUNCHER_PARENT_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_READY_ANCHOR, replacement: LAUNCHER_READY_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.engine, [
          include(INCLUDE_ANCHORS.engine),
          ...(side === 'before'
            ? [
                Object.freeze({ anchor: ENGINE_PREFLIGHT_ANCHOR, replacement: ENGINE_PREFLIGHT_REPLACEMENT }),
                Object.freeze({ anchor: ENGINE_LOADER_ANCHOR, replacement: ENGINE_LOADER_REPLACEMENT }),
              ]
            : [
                Object.freeze({
                  anchor: STANDARD_ENGINE_LOADER_ANCHOR,
                  replacement: STANDARD_ENGINE_LOADER_REPLACEMENT,
                }),
              ]),
          Object.freeze({
            anchor: side === 'before' ? ENGINE_CONTEXT_ANCHOR : STANDARD_ENGINE_CONTEXT_ANCHOR,
            replacement: side === 'before' ? ENGINE_CONTEXT_REPLACEMENT : STANDARD_ENGINE_CONTEXT_REPLACEMENT,
          }),
        ]),
        native(side, NATIVE_TARGETS.worker, [
          include(INCLUDE_ANCHORS.worker),
          Object.freeze({
            anchor: side === 'before' ? BEFORE_WARMUP_ANCHOR : AFTER_WARMUP_ANCHOR,
            replacement: side === 'before' ? BEFORE_WARMUP_REPLACEMENT : AFTER_WARMUP_REPLACEMENT,
          }),
        ]),
        native(side, NATIVE_TARGETS.workerMain, [
          include(INCLUDE_ANCHORS.workerMain),
          Object.freeze({ anchor: WORKER_MAIN_ENTERED_ANCHOR, replacement: WORKER_MAIN_ENTERED_REPLACEMENT }),
        ]),
      ]),
    ]),
  });
}

/** Builds the one deterministic reviewed overlay consumed identically by both exact parents. */
export class PerformanceQualificationOverlayProducer {
  public async produce(workspaceRoot: string): Promise<ReviewedPerformanceQualificationOverlay> {
    if (!path.isAbsolute(workspaceRoot)) throw new Error('PERFORMANCE_OVERLAY_ROOT_INVALID');
    const manifestBytes = Buffer.from(qualificationCanonicalJson(transformManifest()), 'utf8');
    const entries = [
      tarEntry('.local-whisper-performance-overlay-v3.json', manifestBytes, 0o600),
      ...(await Promise.all(
        COMMON_OVERLAY_FILES.map(async (relativePath) =>
          tarEntry(relativePath, canonicalOverlayFile(await readFile(path.join(workspaceRoot, relativePath))), 0o644),
        ),
      )),
    ];
    const bytes = Buffer.concat([...entries, Buffer.alloc(TAR_BLOCK_BYTES * 2)]);
    return Object.freeze({
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    });
  }
}
