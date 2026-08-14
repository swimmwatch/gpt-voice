# 14 Native Structured Logging And Diagnostics

## Outcome

One compatible change set adds project-owned cross-platform native structured logging to every Local Whisper production native process, validates and forwards approved records through the main-process logger, exports bounded canonical native-runtime evidence in diagnostics archives, and proves thread safety, privacy, failure containment, and Linux/Windows parity without changing public APIs or adding a dependency.

## Prerequisites

- Packets 01–13 are checked complete and their runtime identity, source manifests, sanitizer/analyzer graphs, worker TSan graph, and fixed Ubuntu 24.04/Windows Server 2025 workflow are the active baseline.
- Specification approval **APPROVAL-006**, revised plan approval, and revised execution authorization are recorded.
- This packet is started by a new explicit `incremental-implementation` invocation and no other packet is in progress.
- Preserve all unrelated dirty worktree content, especially other specification bundles and `docs/reviews/`.

## Owned Requirements

- Primary: OUT-005, GAT-005, ARC-004–ARC-005, LOG-001–LOG-008, SEC-007, OPS-005, TST-011.
- Cross-cutting: CMP-001, CMP-004, SCP-001–SCP-003, SEC-001, SEC-004, OPS-001, OPS-004, RUN-002–RUN-005, TST-001–TST-003, TST-005, TST-007.
- Acceptance: AC-AUT-043–AC-AUT-048. Packet 19 owns AC-MAN-010; Packet 20 owns AC-MAN-011.

## In Scope

- One injected C++20 logger contract, canonical schema-v1 JSONL serializer, deterministic filter/rate policy, process configuration, and standard-error sink shared by the common, filesystem-guard/model-launcher, launcher, and Whisper-worker build graphs.
- Strict private launch propagation of development/CI `debug` or production/default `info` plus a parent-generated opaque process-instance identifier.
- Stable lifecycle, handshake, state, request, cancellation, model-load, inference, cleanup, control-EOF, protocol-rejection, and native-failure events in all relevant composition roots.
- One bounded TypeScript native-log stream decoder/validator, private invalid-record counters/tail, scoped `electron-log` forwarder, and composition-root wiring for worker, launcher, and filesystem-guard `stderr`.
- A canonical `diagnostics/native-runtime.jsonl` member, native-runtime manifest summary/schema version, current/rotated main-log extraction, ZIP/tar producer inspection, and archive-reader validation.
- Shared golden fixtures, C++ and TypeScript unit/integration tests, privacy canaries, fault injection, multithreaded stress, source-manifest/coverage updates, and applicable Linux/Windows CI execution.
- Atomic runtime-identity and fixture regeneration for the private launch/schema set, including mixed old/new rejection.

## Out Of Scope

- Public IPC, renderer/preload APIs, settings, diagnostic-capture categories or clear targets, UI, remote upload, telemetry, a second log file, or dynamic log-level changes.
- Logging audio, transcripts, prompts, model content or paths, usernames, environment values, raw IPC, credentials, sessions, capabilities/leases, native device identifiers, stack traces, raw OS errors, unrestricted exceptions, or caller-supplied message strings.
- `spdlog`, another product/runtime dependency, a mutable global logger, a service locator, constructed module-level runtime instances, or logging from destructors.
- macOS/ARM support, `clang-cl`, Windows TSan/UBSan/clang-tidy claims, supported-host Windows manual validation, candidate qualification, signing, publication, or release.

## Task Contract

1. Add a narrow `NativeLogger` interface to the project-owned common native library. The concrete logger owns filtering, sequence allocation, monotonic timing, fixed-key rate state, canonical JSON serialization, one synchronized sink, and explicit non-throwing shutdown. Native composition roots own its lifetime and inject references; tests inject clocks, identifiers, and sinks.
2. Use one schema-v1 record with mandatory `component`, `event`, `level`, `processInstanceId`, `schemaVersion`, and `sequence` fields. Optional fields are only `elapsedMs`, `errorCode`, `requestId`, and `suppressedCount`. Canonical JSON object keys are lexicographically ordered; strings are valid UTF-8; integers are nonnegative safe values within their declared widths; the record plus newline is at most 4,096 bytes.
3. Accept only canonical lowercase UUIDs for `processInstanceId` and the existing bounded opaque request-ID contract for `requestId`. The TypeScript owner generates a fresh process-instance UUID for each launched native process and propagates it with the validated private log level. Do not derive it from PID, path, device, account, or session data.
4. Close the schema over components `filesystemGuard`, `launcher`, `modelLauncher`, and `whisperWorker`; levels `debug`, `info`, `warn`, and `error`; and events `processStarted`, `processReady`, `processStopping`, `processStopped`, `handshakeAccepted`, `handshakeRejected`, `stateCold`, `stateWarming`, `stateWarmed`, `stateBusy`, `stateStopping`, `requestAccepted`, `requestCompleted`, `requestCancelled`, `requestCancelTooLate`, `controlEof`, `protocolRejected`, `modelLoadStarted`, `modelLoadCompleted`, `modelLoadFailed`, `inferenceStarted`, `inferenceCompleted`, `inferenceFailed`, `resourceCleanupStarted`, `resourceCleanupCompleted`, and `nativeFailure`.
5. Close log-only error classifications over `cancelConflict`, `controlClosed`, `invalidConfiguration`, `invalidInput`, `ioFailure`, `modelLoadFailure`, `protocolMismatch`, `resourceLimit`, `runtimeFailure`, and `unsupported`. Map existing typed native failures to these values explicitly; never derive classifications from message text or forward `what()`, `errno`, `GetLastError`, or library log text.
6. Assign event severity in one shared policy table. Lifecycle readiness/completion/cancellation events are `info`; detailed handshakes, state transitions, request acceptance, inference start, and cleanup are `debug`; rejected input/control anomalies are `warn`; failed model load/inference and unhandled native failures are `error`. A call cannot override the canonical severity for its event.
7. Resolve `debug` for development and CI and `info` for packaged production. Missing, malformed, duplicated, or unsupported private configuration resolves to `info` without logging the rejected value. Keep worker protocol version 1 and all public contracts unchanged; update private launch validation, fixtures, and runtime identity atomically so a mixed set fails before accepting work.
8. Use a 60-second monotonic fixed window and a maximum of 10 emitted records per `(component, event, errorCode-or-none)` key. Later accepted output or explicit non-throwing logger shutdown reports the prior omitted count in `suppressedCount` on the same stable event/code without emitting user data. The finite closed-key state is bounded and injected-clock tests cover both edges.
9. Prepare and validate immutable event fields before locking. Under the logger-owned recursive write mutex, reject same-thread sink re-entry with a logger-instance guard, allocate the final sequence, serialize the canonical bounded record, and perform the write; other threads remain serialized rather than dropped. Do not call model, protocol, supervisor, platform lifecycle, or another logger while holding the mutex. A serialization/short/failed sink disables further writes for that logger instance, contains the failure, and never changes protocol results or cleanup; the TypeScript decoder treats any incomplete fragment as invalid private diagnostics.
10. Keep native `stdout` exclusively protocol-owned. Send only project-owned native records to `stderr`; suppress or isolate third-party library diagnostics under the existing native library callback controls. Linux and Windows use the same common standard-error sink where portable; any required OS primitive remains behind an injected sink backend and shares the same contract tests.
11. Replace discard-only `stderr` handling with a bounded incremental parser that uses fatal UTF-8 decoding, a 4,096-byte line ceiling, CR/LF normalization defined by the canonical fixture, and the existing 64 KiB private invalid tail. It preserves split code points/lines and multiple records per chunk, rejects a non-newline EOF fragment, resynchronizes after an overlong line, and tracks only bounded aggregate invalid/overlong/UTF-8/schema counters without exposing rejected bytes.
12. Validate exact keys, canonical serialization, UUID/request bounds, safe integers, allowed optional-field combinations, and every closed enum before forwarding. Valid records receive one main-process `observedAt` timestamp, are wrapped in one canonical archive record, and are passed to the dedicated `local-whisper-native-runtime` scoped logger at matching severity with prefix `[native-runtime] `. Never treat arbitrary `stderr` as a record or format string, and never terminate a healthy native process only because diagnostics were invalid.
13. Add native-runtime archive schema version 1 and member `diagnostics/native-runtime.jsonl`. Each archive line contains canonical `observedAt` plus the validated native event. Deduplicate by `(processInstanceId, sequence)`, preserve rotated-before-current and in-file order, and retain the newest complete records within both 10,000 records and 4 MiB. Record valid, invalid, duplicate, included, bytes, first/last observed time, and truncation in the manifest.
14. Bump the diagnostics archive schema and exact member inventory/order once. Preserve provider audit, diagnostic text actions, and Local Whisper snapshot bytes and semantics. Update ZIP/tar writer verification, archive readers, manifest guards, legacy-version handling, hashes, schema maps, outer/member totals, and malformed/mixed-schema failures. Empty native history omits the member and reports a consistent zero summary.
15. Create one versioned golden fixture set under `tests/fixtures/local-whisper/native-runtime-log/v1/` for valid canonical records and every invalid boundary. Consume the same bytes from C++ and TypeScript tests. Include exact/over 4,096-byte cases, every enum/optional shape, duplicate/unknown keys, invalid UTF-8, split multibyte data, unsafe numbers, rate windows, sink failure, privacy canaries, archive bounds, and mixed-runtime identity.
16. Wire new sources into ordinary, Clang analyzer, ASan/UBSan, hardened STL, TSan-applicable worker, focused GCC-applicable, ordinary MSVC, MSVC `/analyze`, MSVC ASan, Linux/Windows C++ CodeQL, hardening, source inventory, and coverage manifests according to actual host applicability. Keep warnings as errors and existing resource-aware parallel build/test settings.
17. Add one canonical `npm run test:local-whisper:native-logging` command that runs host-applicable native logger/schema tests plus TypeScript stream/forwarding/archive tests. Add a dedicated MSVC-ASan form only if existing profile dispatch cannot select it safely; do not duplicate host-independent tests across jobs.

## Contracts And Boundaries

- `stdout` is protocol data; `stderr` is untrusted until a complete canonical native record validates.
- The native logger is diagnostic-only. Failure, filtering, rate limiting, or archive extraction cannot authorize work, alter cancellation/result ordering, keep a resource alive, or change a typed product failure.
- Only immutable enum values, bounded numbers, and opaque validated UUID/request IDs cross the native-log boundary. User-controlled and platform-message strings never do.
- Main-process composition owns UUID/clock/scoped-logger/archive dependencies. Native process composition owns logger/sink lifetime. No renderer, preload, public IPC, settings, or diagnostic-clear surface changes.
- Current and rotated `electron-log` files remain the only retained production store. Archive export is local, user-initiated, privately permissioned, and contains no new diagnostic text category.
- All fixtures are synthetic. Tests use validated temporary roots and never retain raw rejected streams, native artifacts, or private runtime data.

## Expected Files Or Components

- `runtime/local-whisper/common/` logger interface/implementation/tests and its CMake graph.
- `runtime/local-whisper/fs-guard/`, `runtime/local-whisper/launcher/`, and `runtime/local-whisper/whisper-cpp/` composition roots, private launch/configuration types, CMake graphs, and focused tests.
- `src/shared/localWhisper/` native-log schema/validator types and `src/main/localWhisper/` stream decoder, forwarder, supervisor/filesystem/launcher integration, and process composition.
- `src/main/logger.ts`, main-process composition roots, `src/main/services/diagnosticsArchive.ts`, `diagnosticsManifest.ts`, `diagnosticsArchiveFormat.ts`, archive readers, and `src/shared/diagnosticsArchive.ts`.
- Supervisor/filesystem/composition/logger/archive tests under `tests/main/`, native tests under each runtime project, and golden fixtures under `tests/fixtures/local-whisper/native-runtime-log/v1/`.
- Native build drivers, `package.json`, source/coverage manifests, and `.github/workflows/pr-checks.yml` only as required to execute the new sources and tests on both fixed runners.
- Worker/runtime identity evidence and generated protocol/native-log fixtures updated atomically; no generated build output committed.

## Acceptance Criteria

- AC-AUT-043 passes shared schema vectors on Linux and Windows with byte-equivalent canonical output, strict TypeScript acceptance/rejection, exact 4,096-byte handling, and unchanged protocol `stdout`.
- AC-AUT-044 passes multithreaded sequence/write stress, reentrant/short/failing sink injection, non-throwing cleanup, and the worker TSan graph without races, deadlocks, interleaving, or protocol effects.
- AC-AUT-045 proves development/CI `debug`, production/default-invalid `info`, the exact 10-per-60-second finite-key policy, bounded suppression reporting, and no behavior change.
- AC-AUT-046 proves split UTF-8/line handling, overlong/malformed resynchronization, bounded private counters/tail, correct scoped severity/order, later valid-record recovery, and worker residency.
- AC-AUT-047 proves every prohibited-data canary absent from native output, counters/tails, main logs, CI/test evidence, and both archive formats.
- AC-AUT-048 proves empty/present native member behavior, current/rotated ordering, deduplication, newest-record bounds, exact counts/time/bytes/hash/schema/truncation, legacy compatibility, tamper rejection, and unchanged existing members.
- Linux Clang/GCC-applicable and Windows MSVC ordinary, analysis, ASan, source-manifest, coverage, hardening, and C++ CodeQL gates include the new owned sources and pass; no required Windows stage is skipped.
- Runtime identity rejects mixed old/new launch/logging peers before work, and no product dependency, public API, setting, clear target, or remote service is added.

## Verification

Run the smallest focused check after each layer, then before every candidate or fix commit run all applicable local checks, including at minimum:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:native-logging
npm run test:local-whisper:worker-common:native
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:launcher:native
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:supervisor
npm run test:local-whisper:filesystem
npm run test:local-whisper:composition
npm run test:local-whisper:diagnostics
npm run test:local-whisper:native-analysis
npm run test:local-whisper:worker-tsan
npm run test:local-whisper:native-hardening
npm run test:local-whisper:native-sources
npm run test:local-whisper:native-build-audits
npm run test:local-whisper:native-ci-workflow
npm run test:security:codeql-policy
npm run test:local-whisper:runner-policy
npm run validate:workflows
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run validate:dependabot
npm run audit:prod
npm run build:prod
```

Run the applicable Linux sanitizer and focused GCC commands if the common/guard/launcher graph owns the new source. On Windows CI, run ordinary MSVC, `/analyze`, dedicated MSVC ASan, exact source coverage, hardening, and C++ CodeQL. Use canonical command names established by implementation and update this packet before completion if a safer existing command owns the same coverage.

## Remote Completion Gate

1. Run every available applicable check locally before the candidate or any fix commit. Leave Packet 14 unchecked, update `handoff.md`, stage only Packet 14 paths, create a conventional packet-scoped commit, and push without force to the verified pull-request head.
2. Confirm CI launched for the exact candidate SHA. Require Quality Gates, Ubuntu 24.04 native quality, Windows Server 2025 native quality, JavaScript/TypeScript and both C++ CodeQL analyses, sanitizer/analyzer/TSan/GCC-applicable stages, source/coverage policy, package smoke, fixture packaging, workflow/security checks, and every other selected required job to conclude `success`.
3. The Windows job must compile and execute the logger/schema/integration sources under ordinary MSVC, `/analyze`, and dedicated MSVC ASan and validate the final source manifest. No required Windows job or stage may be skipped; Linux execution is not Windows evidence.
4. Fix every packet-caused in-scope failure with a focused regression, rerun all applicable local checks before each fix commit, push, and repeat the complete exact-SHA gate until green. Do not request separate permission for an in-scope fix commit. Record unrelated/out-of-scope failures as blockers.
5. After the code-bearing SHA is green, check Packet 14, update `handoff.md`, create and push a documentation-only completion commit, and confirm its CI run launches. Do not wait for that documentation-only run because it changes no C++ or TypeScript implementation.

## Failure And Rollback

- Keep Packet 14 unchecked until all local checks and the complete exact-SHA Linux/Windows gate pass. Record the exact requirement, acceptance ID, command/job, and bounded failure classification.
- Roll back the complete compatible logging set together: native schema/logger/configuration, TypeScript validator/forwarder, archive schema/member, fixtures, and runtime identity. Never leave mixed validators or identities.
- A sink/logger failure is contained and may reduce diagnostics only; it must not fail or terminate a healthy operation. A malformed archive record selected for inclusion fails archive creation rather than exporting ambiguous evidence.
- If implementation needs a dependency, public or IPC change, setting, retention-policy change, new platform claim, or broader data collection, stop and return to specification.

## Manual Gates

- Hosted Ubuntu 24.04 and Windows Server 2025 CI execution and non-force PR-head pushes are required remote gates after local verification.
- **MANUAL GATE DEFERRED:** AC-MAN-010 packaged supported-Linux inspection remains in Packet 19.
- **MANUAL GATE DEFERRED:** AC-MAN-011 real supported-Windows inspection remains exclusively in Packet 20; hosted Windows Server CI is mandatory here but is not that evidence.
- Manual workflow dispatch, required-check mutation, supported-host qualification, signing, publication, and release are not authorized.

## References

- Approved specification Sections 4, 10.13, 11, 12.1 AC-AUT-043–AC-AUT-048, and 12.2 AC-MAN-010–AC-MAN-011.
- Decisions `outcome.native-structured-logging`, `compatibility.native-logging-platforms`, `operations.native-production-capture-policy`, `architecture.native-log-retention-path`, and `operations.native-log-purge-policy`, all revision 1.
- [`docs/agent-guides/project-conventions.md`](../../../agent-guides/project-conventions.md): Code And Logging; Dependency Injection And Runtime Ownership; Tests And Documentation; Git And Releases.

## Completion And Handoff

- Record exact changed files, schema/runtime identities, local checks, candidate and fix SHAs, every selected CI run/job, no-required-Windows-skip evidence, privacy-canary result, and any blocker in `handoff.md`.
- Check Packet 14 only after the code-bearing exact-SHA gate is fully green and the documentation-only completion record has been pushed with CI launch confirmed.
- Set `Exact next packet: 15 — Focused GCC Quality` and stop. Do not begin Packet 15 in the same invocation.
