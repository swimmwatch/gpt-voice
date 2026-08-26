# 13 Representative Performance Collection Contract

## Outcome

Implement the missing bounded collector and frozen run-plan contract needed to produce real paired performance
bundles. Add per-model sample identity, a Linux collection adapter, deterministic aggregate analysis, and explicit
commands without running representative hardware or selecting a production pipeline window.

## Prerequisites

- Packets 01–12 are complete and Packet 12 is committed locally as `0885281`.
- The refreshed source baseline remains seven Linux and six Windows full-model proofs with source-proof digest
  `a8a6ede6a48ce6d8b591a46e77867ca0e2a26b5a75084b401d9159b4cdd363ee`.
- Existing CPU/CUDA hosted fixtures remain `contractOnly`; their deterministic window-4 result is test evidence only.
- The current schema-v1 `linux-state.json` remains `Pending`. This packet does not claim candidate freeze or produce
  representative evidence.

## Owned Requirements

OUT-001, SCP-003, QUAL-001, OBS-001, OBS-002, OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, RES-003,
AC-AUT-001, AC-AUT-002, AC-AUT-015.

## In Scope

- A schema-v2 private performance run plan, manifest, sample, bundle, and aggregate result contract.
- Exact model identity on every sample for `base/full`, `medium/full`, and `large-v3/q5_0`.
- A deterministic paired schedule for windows 1, 2, 4, and 8; cold/warm cache states; and before/after sides.
- A qualification-only collector orchestrator with injected process, cache-preparation, phase, resource, and platform
  ports; a real Linux adapter; and deterministic fake adapters for contract tests.
- Explicit root-contained CLI entry points for collection and aggregate analysis.
- Strict bounds, fail-closed parsing, exclusive output, privacy-safe status output, and aggregate-only retained evidence.
- A frozen Windows adapter interface and schema fixtures only. Its real implementation and execution remain Packet 17.

## Out Of Scope

- Representative Linux or Windows runs, authenticated private artifacts, candidate freeze, CI inspection, branch
  push, Windows process/resource implementation, production-window selection, production telemetry, runtime tuning,
  or any production behavior change.
- Treating hosted fixtures, synthetic timings, or one platform's result as representative evidence.

## Task Contract

1. Advance the private performance documents atomically to schema version 2. A run plan and its derived manifest bind
   exact 40-hex baseline and candidate commits, source revision and proof digest, platform, backend, architecture,
   the three exact release-1 model identities and SHA-256 values, cache preparation, windows `[1, 2, 4, 8]`, six
   planned pairs, five required successful pairs, alternating side order, a 100 ms resource interval,
   `medianOfPairedPercentages`, `medianAbsoluteDeviation`, phase/resource units, and every required metric ID.
   Mixed schema versions, commits, manifests, platforms, backends, models, or source baselines fail closed.
2. Every sample carries `{family, variant, sha256}` model identity in addition to manifest digest, candidate window,
   cache state, pair index, run order, side, status, and bounded phase/resource data. The validator rejects a missing,
   duplicate, unknown, mismatched, or out-of-order model/cell sample before analysis.
3. Add `collect:local-whisper:qualification:performance` with exactly these CLI fields:
   `--platform=<linux|win32>`, `--backend=<cpu|cuda>`, `--mode=representativeHost`,
   `--root=<absolute-disposable-root>`, `--input=<root-relative-run-plan>`, and
   `--output=<root-relative-private-bundle>`. Add a generic aggregate command using the same platform, mode, root,
   input, and output shape. Unknown, repeated, missing, empty, absolute-relative, or root-escaping values fail closed.
4. The private run plan contains only root-relative input locations plus expected sizes/digests. Before a run, verify
   root containment, regular-file/no-symlink identity, clean exact-commit worktrees, authenticated model/runtime/app
   artifacts, and unchanged identities after use. Do not accept shell fragments, arbitrary commands, inherited
   environment dumps, or an executable path supplied by retained evidence.
5. For one platform/backend invocation, schedule exactly 288 attempts: three models × four windows × two cache states
   × six pairs × two sides. Alternate before/after order deterministically. Retain a content-free failure record in
   its original cell; never append replacement attempts. Fewer than five successful pairs blocks that cell.
6. Cache preparation is an injected fixed platform operation. The Linux adapter may accept only the documented
   qualification cold/warm procedure and emits a bounded digest-linked receipt; it must not drop global caches,
   perform broad cleanup, or execute manifest-supplied commands. An unavailable cold-cache proof blocks the cell.
7. Collect phase durations only from explicit qualification hooks and resources only for the owned process tree.
   Require every platform/backend-applicable phase and resource, monotonic ordering, non-negative safe integers,
   process-settlement proof, and zero unowned process/GPU attribution. Cancellation, timeout, collector failure, or
   malformed output terminates owned children and produces one bounded failure code.
8. Analyze by exact platform/backend/model/window/cache cell. Compute the locked point estimate, uncertainty,
   conservative component gain, end-to-end regression, and every resource regression. A single-platform result may
   report candidate pass/fail rows but must use `selectionStatus: awaitingCrossPlatform` and a null production value.
9. Raw run plans, cache receipts, samples, paths, host details, and native output remain under the validated private
   root and are never committed. The retained aggregate may contain only bounded durations, counts, anonymized
   platform/backend class, model family/variant, candidate window, gate outcomes, and document digests. It contains
   no paths, device-native identity, model content, audio, transcript, prompt, credential, capability/environment
   dump, raw native output, or unrestricted error text.
10. Regenerate schema-v2 hosted fixtures and add malformed, oversized, sensitive, mixed-model, mixed-commit,
    duplicate-cell, failed-sample, cancellation, timeout, cleanup, and output-collision tests. Hosted fixtures remain
    `contractOnly` and cannot produce `awaitingCrossPlatform` representative claims.

## Contracts And Boundaries

- The absolute disposable root must exist, be a non-symlink directory, and not be a filesystem root. All document
  paths are relative descendants resolved through real parents. Input is a verified regular file no larger than
  8 MiB; private bundle output is exclusive, mode `0600` where supported, and no larger than 8 MiB. The sanitized
  aggregate is exclusive and no larger than 1 MiB.
- The orchestrator is a state-owning class with constructor-injected ports. No mutable module singleton or generic
  shell runner is introduced. Cleanup is deterministic and idempotent after success, failure, cancellation, timeout,
  and partial output.
- Qualification hooks remain available only under the existing explicit qualification activation purpose. Production
  composition, structured log schema, diagnostics, settings, IPC, and the serial production window remain unchanged.
- The Windows adapter interface may be compiled and fixture-tested on Linux, but any Windows API implementation,
  MSVC execution, or representative claim is deferred to Packet 17.

## Expected Files Or Components

- `scripts/local-whisper/qualification/PerformanceQualification.ts`
- `scripts/local-whisper/qualification/PerformanceQualificationResultProducer.ts`
- `scripts/local-whisper/qualification/QualificationContracts.ts`
- `scripts/local-whisper/qualification/run-performance-qualification.ts`
- New qualification-only run-plan, collector/orchestrator, Linux adapter, and CLI files under
  `scripts/local-whisper/qualification/`
- Focused tests under `tests/scripts/localWhisper/qualification/`
- Schema-v2 deterministic fixtures under the existing Local Whisper qualification fixture directory
- `package.json`, `tasks/todo.md`, and `tasks/handoff.md`

## Acceptance Criteria

- Schema-v2 validation proves each required model/backend/window/cache/pair/side cell independently and rejects every
  mixed or incomplete bundle before statistics run.
- A deterministic fake adapter produces the exact 288-attempt schedule per backend; failed attempts stay in place,
  cannot be replaced, and make a cell fail when fewer than five successful pairs remain.
- Linux adapter tests prove bounded owned-process resource sampling, explicit cold/warm receipts, cancellation,
  timeout, no-hang cleanup, exclusive output, and retry without retaining private data.
- The analyzer reports all three model rows and every window, applies the 25 percent and 3 percent rules, and cannot
  freeze a production value from hosted fixtures or Linux-only evidence.
- Existing source-count verification remains seven Linux/six Windows. No production runtime, setting, IPC, logging,
  provider, or pipeline binding changes.

## Verification

- `npm run test:local-whisper:performance-contracts`
- `npm run test:local-whisper:qualification`
- `npm run verify:local-whisper:qualification:inputs`
- `npm run verify:local-whisper:qualification:performance`
- Run the new collector CLI against deterministic disposable fake inputs and verify exact schedule, exclusive output,
  privacy rejection, cancellation/timeout cleanup, and clean retry.
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`

## Failure And Rollback

- Any missing identity, incomplete matrix, unbounded field, private output, source-baseline drift, cleanup failure, or
  production-surface change leaves Packet 13 unchecked.
- Roll back the schema/collector/fixture changes as one coherent private qualification set. Do not change or delete
  managed models, runtimes, settings, user data, or Packet 12 production implementation.

## Manual Gates

- No representative hardware or authenticated artifact run occurs in this packet.
- Commit, push, CI, external sharing, package installation, and publication remain unauthorized. Do not inspect CI.

## References

- Specification Sections 4, 5, 14.1, 14.2, and 16.
- Packet 01's qualification schema/analyzer precedent and Packet 12's operational/privacy guidance.
- `docs/agent-guides/project-conventions.md` Project And Commands, Code And Logging, Tests And Documentation, and Git
  And Releases sections.

## Completion And Handoff

After all local checks pass, mark Packet 13 complete, record changed files and concise check results, name
[14 Performance Attempt Contract And Derived Source Identity](14_performance_attempt_contract_and_derivation.md) as
the exact next packet, and stop. Do not collect representative evidence, push, inspect CI, implement Windows APIs,
or start Packet 14.
