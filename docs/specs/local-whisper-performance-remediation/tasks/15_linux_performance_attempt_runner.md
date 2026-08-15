# 15 Linux Performance Attempt Runner

## Outcome

Implement the schema-v3 Linux qualification overlay, attempt executable, role-aware sampler, private input preflight,
and run-plan producer required to execute the exact baseline/candidate matrix without modifying clean parent
worktrees or ordinary production behavior.

## Prerequisites

- Packet 14 is complete, reviewed, and committed. Schema-v3 derived-source, attempt, resource, and aggregate
  contracts pass all focused checks.
- Exact baseline parent `1f6ce9c988a275f1ef9faa295b1bb04879943e89` and the current candidate parent are available.
- Packet 12's rollback/privacy guidance and Packet 13's collection ordering remain unchanged.

## Owned Requirements

GAT-002, GAT-003, GAT-004, QUAL-001, OBS-001, OBS-002, OBS-003, PERF-001, PERF-002, PERF-003, PERF-004,
PERF-005, RES-002, PRIV-001, RES-003, AC-AUT-001, AC-AUT-002, AC-AUT-003, AC-AUT-004, AC-AUT-007,
AC-AUT-008, AC-AUT-009, AC-AUT-010, AC-AUT-014, AC-AUT-015.

## In Scope

- One reviewed qualification-only overlay that applies byte-identically to private derived exports of both parents.
- A Linux attempt executable consuming the fixed schema-v3 request and driving the real production app-to-guard,
  install, launcher, worker, model load, and warm-up path.
- Monotonic qualification-only probes for all required phase IDs, a bounded private native event channel, and a
  role-aware Linux PSS/NVML sampler producing main/guard/worker/GPU peaks with settlement proof.
- A read-only preflight for the populated production-qualification cache and the orchestrator-owned absent private
  child path.
- A private run-plan producer that builds/authenticates both derived attempt artifacts and emits CPU/CUDA plans bound
  to their receipts, exact models/runtimes/input, source proof, and overlay digest.
- Contract-only and disposable synthetic integration tests; no representative measurement claim.

## Out Of Scope

- Representative Linux attempts, canonical qualification freeze, retained performance evidence, Windows code or
  execution, CI inspection, push, production-window selection, public/IPC changes, production telemetry, or a
  shipped diagnostic/performance mode.

## Task Contract

1. Store one fixed overlay definition under the qualification tooling boundary. The derivation owner must apply the
   same bytes to both exact parents and fail if any expected source anchor differs. Overlay application occurs only in
   newly created private derived trees; tracked parent files and Git objects are never changed.
2. Add an executable that accepts only `--local-whisper-performance-qualification-v3`, reads exactly one bounded
   canonical request line from stdin, and writes exactly one bounded canonical response line to stdout with empty
   stderr on success. It validates every referenced runtime/model/input identity using no-follow regular-file opens,
   keeps paths private, owns its process group, and returns only stable content-free failure codes.
3. Drive the real production composition and app-to-guard install/load path. For `side: before`, keep the legacy
   serial install window regardless of the candidate cell; for `side: after`, inject the requested candidate window
   only through the qualification overlay. Do not change the ordinary production binding or permit a renderer,
   environment variable, config file, catalog, or command-line alias to activate the window.
4. Emit each applicable phase exactly once and in canonical order:
   `directoryProofRuntimeAcquisition`, `directoryProofModelAcquisition`, `directoryProofRuntimePreSpawn`,
   `directoryProofModelPreSpawn`, `directoryProofModelPreLoad`, `nativeModelGuardDigest`, `nativeAuthorityDigest`,
   `workerPreflightDigest`, `workerLoaderDigest`, `guardedProcessCreation`, `authorityTransfer`, `modelPreflight`,
   `whisperLoad`, `inferenceWarmup`, `gpuUploadAllocation`, `installationEncode`, `installationPipeWait`,
   `installationDecode`, and `installationWrite`. CPU marks the schema-declared GPU-only phase as not applicable; it
   must not invent a duration. All other required phases use monotonic integer nanoseconds and cannot be sourced from
   production logs or diagnostics.
5. Carry native phase events over a qualification-only inherited private channel with fixed framing, bounded event
   count/bytes, exact role/sequence IDs, and no paths, digests, native handles, device identities, output text, or
   arbitrary metadata. Missing, duplicate, reordered, late, malformed, or post-terminal events fail the attempt.
6. Extend the Linux sampler so the attempt runner registers main, guard, and worker PIDs with start identities and
   expected executable digests over the private role channel. Attribute PSS separately per role, attribute CUDA VRAM
   only to registered owned PIDs, reject unknown/reused identities, and require ten settled zero-ownership samples.
   Retained output contains only the four required peaks and the existing content-free proof enums.
7. Add `verify:local-whisper:qualification:linux-private-inputs`. It requires an absolute existing nonsymlink
   populated cache, invokes the real `LinuxQualificationEvidenceLoader` read-only, validates model/FLEURS,
   CPU/CUDA runtime-pack/direct-engine identities plus the required sibling native-source notice, snapshots the input
   manifest digest, validates an existing nonsymlink mode-0700 disposable parent, and requires the proposed
   `private-run-root` child not to exist. It must prove no cache entry changed.
8. Add a private plan producer that derives/builds both attempt artifacts, writes exclusive mode-0600 receipts and
   CPU/CUDA run plans under the validated private root, and binds exact parent commits, common overlay digest, derived
   tree/artifact identities, populated-cache snapshot, models, runtimes, input fixture, cold/warm procedure, 288
   attempts per backend, timeout, and source proof. It never prints expanded paths or private identities.
9. Add focused tests for both-parent overlay application, source-anchor mismatch, path/symlink/archive attacks,
   request/output bounds, every phase, CPU/GPU applicability, role/PID reuse, process and GPU settlement, candidate
   windows 1/2/4/8, failure/cancellation/timeout cleanup, cache immutability, absent-child retry, and privacy. A small
   synthetic real-process smoke may prove the transport but cannot claim representative performance.
10. Re-run source counts and option inventory. The attempt overlay must preserve seven Linux/six Windows post-reuse
    full-model proofs, every retained freshness/load proof, zero unexplained backend-option drift, and ordinary serial
    production behavior when qualification activation is absent.

## Contracts And Boundaries

- Overlay activation exists only in private derived builds produced by the qualification tool. No shipped package,
  production catalog, renderer/preload/main IPC, settings document, provider API, environment value, or ordinary CLI
  path can activate it.
- The derived trees, attempt binaries, populated cache, model/runtime/input artifacts, receipts, plans, native event
  stream, raw samples, and process series are private and uncommitted. Only bounded aggregate evidence may later be
  retained by Packet 16.
- The populated qualification cache is immutable input. The production command's private child is orchestrator-owned
  and must be absent before invocation; retry uses a fresh sibling after failure.
- No shell execution, mutable global runtime state, unchecked path, unbounded output, production log telemetry, audio
  or transcript retention, or device-native identity is permitted.

## Expected Files Or Components

- Qualification overlay/derivation/build modules under `scripts/local-whisper/qualification/`
- `PerformanceQualificationAttempt*.ts`, Linux role/resource adapters, private-input and run-plan CLIs
- Qualification-only TypeScript/native probe interfaces and fixed private event protocol
- Narrow derived-source overlay files for affected main, guard, launcher, and worker boundaries
- Focused TypeScript, Python, and native tests; package command registrations
- `tasks/todo.md` and `tasks/handoff.md`
- No generated derived tree, executable, package, cache, model, runtime, raw evidence, or private receipt

## Acceptance Criteria

- Both exact parents produce authenticated attempt artifacts from one common overlay digest without parent worktree
  mutation, and a deliberate anchor or overlay difference blocks the pair.
- The runner exercises real production boundaries and emits the exact complete phase set; the external sampler emits
  exact role peaks and settlement proof. Missing or ambiguous evidence cannot become a successful sample.
- Input preflight accepts the authenticated populated cache, rejects an empty or changed cache, accepts only an
  absent child under a validated private parent, and leaves every input byte unchanged.
- Candidate-window control is qualification-only, baseline remains serial, and ordinary production composition
  remains serial with no new activation surface.
- All focused failure, cleanup, privacy, source-count, option-drift, strict build, sanitizer, and race checks pass.

## Verification

- `npm run test:local-whisper:performance-contracts`
- `npm run test:local-whisper:qualification`
- New derived-overlay, attempt-runner, phase-event, role-resource, private-input, and plan-producer focused commands
- `npm run test:local-whisper:filesystem`
- `npm run test:local-whisper:artifacts`
- `npm run test:local-whisper:worker-common:native`
- `npm run test:local-whisper:whisper-cpp-core`
- `npm run test:local-whisper:whisper-cpp-cancellation`
- `npm run test:local-whisper:native-build-audits`
- Applicable GCC, ASan/UBSan, TSan, clang-format, and clang-tidy checks for changed native code
- `npm run verify:local-whisper:qualification:inputs`
- `npm run verify:local-whisper:qualification:performance`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`

## Failure And Rollback

- A parent mismatch, overlay asymmetry, incomplete phase/resource evidence, unsafe path, cache mutation, activation
  leak, native failure, race, sanitizer issue, or cleanup failure leaves Packet 15 unchecked and blocks Packet 16.
- Roll back by rejecting the derived artifacts and schema-v3 evidence and retaining Packet 13's committed collector
  plus Packet 14's contract for repair. Do not reuse partial derived roots or weaken probes, roles, privacy, or gates.

## Manual Gates

- No representative model/runtime execution, production qualification freeze, Windows work, CI inspection, push,
  publication, or destructive cleanup is authorized. Generated private roots remain operator-owned.

## References

- Specification Sections 4, 5, 13, 14.1, 14.2, and 16.
- Packet 14's schema-v3 derived-source and resource-merging contract.
- Live production composition, filesystem guard, launcher, worker, qualification direct-engine protocol,
  `LinuxQualificationEvidenceLoader`, and `LinuxResourceSampler` boundaries.

## Completion And Handoff

After verification, mark Packet 15 complete, record the exact overlay/contract digests and checks without private
paths, and name [16 Representative Linux Host Qualification](16_representative_linux_host_qualification.md) as the
exact next packet. Stop before representative execution, commit, push, CI inspection, Windows implementation, or
production selection.
