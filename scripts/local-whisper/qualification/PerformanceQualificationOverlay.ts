import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { qualificationCanonicalJson } from './QualificationContracts';

const TAR_BLOCK_BYTES = 512;
const BASELINE_COMPOSITION_SHA256 = '8e1fcdc8493bfdcf9d880fd63d5a0c6680830526b55e8c8a2b40628377abb7f1';
const CANDIDATE_COMPOSITION_SHA256 = '3aa7b20fdab848cde74541cc48de2508e258ce5c61e9e0404d8387057b9e5c2f';
const COMPOSITION_PATH = 'src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts';
const HOOK_ANCHOR = `  readonly qualificationHooks?: {
    readonly artifactHttpClient?: ArtifactHttpClient;
    readonly trustedCertificateAuthorities?: readonly string[];
    readonly onSessionProcessLaunched?: (event: LocalWhisperWorkerProcessLaunchEvent) => void;
  };`;
const HOOK_REPLACEMENT = `  readonly qualificationHooks?: {
    readonly artifactHttpClient?: ArtifactHttpClient;
    readonly trustedCertificateAuthorities?: readonly string[];
    readonly onSessionProcessLaunched?: (event: LocalWhisperWorkerProcessLaunchEvent) => void;
    /** Private derived-build control; absent from ordinary production composition. */
    readonly performanceInstallationWindow?: 1 | 2 | 4 | 8;
  };`;
const PIPELINE_ANCHOR = '          maximumInFlightWrites: PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,';
const PIPELINE_REPLACEMENT = `          maximumInFlightWrites:
            activationPurpose === 'qualification' &&
            this.dependencies.qualificationHooks?.performanceInstallationWindow !== undefined
              ? this.dependencies.qualificationHooks.performanceInstallationWindow
              : PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,`;

const PROBE_INCLUDE = '#include "local_whisper/common/performance_qualification_probe.hpp"';
const NATIVE_TARGETS = Object.freeze({
  guardApplication: Object.freeze({
    path: 'runtime/local-whisper/fs-guard/src/common/guard_application.cpp',
    beforeSha256: '9a7f4655d4b25b4a7f41a0aa5409beb8b4738a712025ca8a32db42e8514a0d63',
    afterSha256: '6295d5f765407a3bcda39aeee7ee38826d268ecb2bc19afbf71cf92297351734',
  }),
  modelLaunch: Object.freeze({
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp',
    beforeSha256: '9ac4d2749e4ae0594d35bcbeb3002276930d2d86717223d2e03b9d8ee8fa07ca',
    afterSha256: '9ac4d2749e4ae0594d35bcbeb3002276930d2d86717223d2e03b9d8ee8fa07ca',
  }),
  authority: Object.freeze({
    path: 'runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp',
    beforeSha256: 'f24c3cdffc2e8c466d99f71ce8b2599704793ca2d1ce459aaaa736d1ed487d88',
    afterSha256: 'f24c3cdffc2e8c466d99f71ce8b2599704793ca2d1ce459aaaa736d1ed487d88',
  }),
  launcher: Object.freeze({
    path: 'runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp',
    beforeSha256: '511e0e25e50fdac1883983946202352ea09f482584f57d7dceffe94af7754146',
    afterSha256: '511e0e25e50fdac1883983946202352ea09f482584f57d7dceffe94af7754146',
  }),
  engine: Object.freeze({
    path: 'runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp',
    beforeSha256: 'b82a16e04941dc10af0d327fc18fbe1ddfbebe98789cd289cceb7ad8a0f0d8b8',
    afterSha256: '0ac520da531e98e3c125ec92f77004e02aa6d60ef16117589a8dfd692dafd3f9',
  }),
  worker: Object.freeze({
    path: 'runtime/local-whisper/whisper-cpp/core/worker_application.cpp',
    beforeSha256: 'aef50d73ca50d01115349183c4a30cca07fc37e6f98b7e8450a274adff86cce4',
    afterSha256: '83343e2e80c74bcff2f9a8ba4eb147299afc3548c5681f04c5c2afb5f445cb34',
  }),
});

const INCLUDE_ANCHORS = Object.freeze({
  guardApplication: '#include "local_whisper/fs_guard/guard_application.hpp"',
  modelLaunch: '#include "local_whisper/fs_guard/model_authority_server.hpp"',
  authority: '#include "local_whisper/fs_guard/model_authority_server.hpp"',
  launcher: '#include "local_whisper/launcher/platform_launcher.hpp"',
  engine: '#include "local_whisper/whisper_cpp/engine.hpp"',
  worker: '#include "local_whisper/whisper_cpp/worker_application.hpp"',
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
      const auto response = dispatch_command(backend_, request.command);
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
      output << serialize_response(request.id, true, response);
    } catch (const GuardError& error) {`;
const GUARD_LOOP_ANCHOR = `  BoundedLineReader reader(`;
const GUARD_LOOP_REPLACEMENT = `  std::uint64_t installation_decode_nanoseconds = 0U;
  std::uint64_t installation_write_nanoseconds = 0U;
  BoundedLineReader reader(`;

const MODEL_DIGEST_ANCHOR = `  if (hash_descriptor(model.file.get(), request.model_size_bytes) != request.model_sha256)
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch model digest changed");`;
const MODEL_DIGEST_REPLACEMENT = `  const local_whisper::common::PerformanceQualificationTimer model_digest_timer(
      "nativeModelGuardDigest");
  if (hash_descriptor(model.file.get(), request.model_size_bytes) != request.model_sha256)
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch model digest changed");
  if (!model_digest_timer.emit())
    throw ModelLaunchError(ModelLaunchErrorCode::kDigestRejected,
                           "model launch performance probe failed");`;

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
const LAUNCHER_PARENT_ANCHOR = `    try {
      if (setpgid(child, child) != 0 && errno != EACCES)`;
const LAUNCHER_PARENT_REPLACEMENT = `    if (!creation_timer.emit() ||
        !local_whisper::common::emit_performance_qualification_probe(
            "worker", "pid", static_cast<std::uint64_t>(child))) {
      terminate_and_reap_owned_group(child);
      throw LauncherError(LauncherErrorCode::kWorkerCreationFailed,
                          "launcher performance probe failed");
    }
    try {
      if (setpgid(child, child) != 0 && errno != EACCES)`;

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

const COMMON_OVERLAY_FILES = Object.freeze([
  'scripts/local-whisper/qualification/PerformanceQualificationAttemptRunner.ts',
  'scripts/local-whisper/qualification/PerformanceQualificationEventProtocol.ts',
  'scripts/local-whisper/qualification/PerformanceQualification.ts',
  'scripts/local-whisper/qualification/PerformanceQualificationCollector.ts',
  'scripts/local-whisper/qualification/QualificationContracts.ts',
  'scripts/local-whisper/qualification/LinuxPerformanceAttemptProbe.ts',
  'scripts/local-whisper/qualification/LinuxPerformanceAttemptApplication.ts',
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

function transformManifest(): Readonly<Record<string, unknown>> {
  const operation = (
    side: 'before' | 'after',
    targetPath: string,
    expectedSha256: string,
    replacements: readonly Readonly<{ readonly anchor: string; readonly replacement: string }>[],
  ) => Object.freeze({ side, targetPath, expectedSha256, replacements: Object.freeze(replacements) });
  const include = (anchor: string) => Object.freeze({ anchor, replacement: `${anchor}\n\n${PROBE_INCLUDE}` });
  const native = (
    side: 'before' | 'after',
    target: (typeof NATIVE_TARGETS)[keyof typeof NATIVE_TARGETS],
    replacements: readonly Readonly<{ readonly anchor: string; readonly replacement: string }>[],
  ) => operation(side, target.path, side === 'before' ? target.beforeSha256 : target.afterSha256, replacements);
  return Object.freeze({
    schemaVersion: 1,
    operations: Object.freeze([
      operation('before', COMPOSITION_PATH, BASELINE_COMPOSITION_SHA256, [
        Object.freeze({ anchor: HOOK_ANCHOR, replacement: HOOK_REPLACEMENT }),
      ]),
      operation('after', COMPOSITION_PATH, CANDIDATE_COMPOSITION_SHA256, [
        Object.freeze({ anchor: HOOK_ANCHOR, replacement: HOOK_REPLACEMENT }),
        Object.freeze({ anchor: PIPELINE_ANCHOR, replacement: PIPELINE_REPLACEMENT }),
      ]),
      ...(['before', 'after'] as const).flatMap((side) => [
        native(side, NATIVE_TARGETS.guardApplication, [
          include(INCLUDE_ANCHORS.guardApplication),
          Object.freeze({ anchor: GUARD_LOOP_ANCHOR, replacement: GUARD_LOOP_REPLACEMENT }),
          Object.freeze({ anchor: GUARD_RUN_ANCHOR, replacement: GUARD_RUN_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.modelLaunch, [
          include(INCLUDE_ANCHORS.modelLaunch),
          Object.freeze({ anchor: MODEL_DIGEST_ANCHOR, replacement: MODEL_DIGEST_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.authority, [
          include(INCLUDE_ANCHORS.authority),
          Object.freeze({ anchor: AUTHORITY_DIGEST_ANCHOR, replacement: AUTHORITY_DIGEST_REPLACEMENT }),
          Object.freeze({ anchor: AUTHORITY_TRANSFER_ANCHOR, replacement: AUTHORITY_TRANSFER_REPLACEMENT }),
        ]),
        native(side, NATIVE_TARGETS.launcher, [
          include(INCLUDE_ANCHORS.launcher),
          Object.freeze({ anchor: LAUNCHER_FORK_ANCHOR, replacement: LAUNCHER_FORK_REPLACEMENT }),
          Object.freeze({ anchor: LAUNCHER_PARENT_ANCHOR, replacement: LAUNCHER_PARENT_REPLACEMENT }),
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
          tarEntry(relativePath, await readFile(path.join(workspaceRoot, relativePath)), 0o644),
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
