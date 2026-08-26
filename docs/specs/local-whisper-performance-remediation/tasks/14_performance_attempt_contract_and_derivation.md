# 14 Performance Attempt Contract And Derived Source Identity

## Outcome

Close the remaining representative-collection contract gaps before any host run. Evolve the private performance
contract to schema v3 so an identical qualification-only instrumentation overlay can be applied to exact baseline
and candidate source parents, bind both derived artifacts to that overlay, and make the collector merge phase output
with independently attributed process/GPU resource measurements.

## Prerequisites

- Packet 13 is complete, reviewed, and committed as `b5101ed`.
- Baseline parent `1f6ce9c988a275f1ef9faa295b1bb04879943e89` and candidate parent are available as clean exact worktrees.
- The seven-Linux/six-Windows source proof remains
  `a8a6ede6a48ce6d8b591a46e77867ca0e2a26b5a75084b401d9159b4cdd363ee`.
- Repository inspection confirms no executable consumes `--local-whisper-performance-qualification-v2`, no runtime
  component emits the required 19 phase measurements, and the current Linux resource adapter discards its aggregate
  series without producing the required main/guard/worker/GPU resource rows.

## Owned Requirements

GAT-003, GAT-004, QUAL-001, OBS-001, OBS-002, OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, RES-003,
AC-AUT-001, AC-AUT-002, AC-AUT-015.

## In Scope

- Schema-v3 private derived-source receipt, run-plan, manifest, phase-response, sample, bundle, and aggregate identity
  contracts.
- One bounded source-derivation owner that authenticates clean parent worktrees, applies one byte-identical
  qualification overlay to private derived trees, and proves the overlay/tree identities without changing either
  parent worktree.
- Separation of attempt phase output from resource sampling, with collector-owned fail-closed merging.
- Main, guard, worker, and GPU role-attribution interfaces and deterministic fixtures for PID reuse, missing roles,
  process settlement, and resource peak calculation.
- Hosted CPU/CUDA fixtures and all focused validators/tests migrated from schema v2 to schema v3.

## Out Of Scope

- The real Linux overlay implementation, production-path phase probes, native event transport, attempt executable,
  populated private qualification cache, representative hardware, Windows adapter, CI inspection, push, production
  window selection, or changes to ordinary production behavior.

## Task Contract

1. Replace the active performance schema-v2 set with schema v3. Keep the fixed three-model, four-window, two-cache,
   six-pair, two-side ordering and all 25-percent/3-percent gates. Hosted fixtures remain `contractOnly`; schema
   migration cannot promote them to representative evidence.
2. Add a private derived-source receipt for each side containing only schema/contract versions, `side`, exact parent
   commit, source-proof digest, instrumentation-overlay SHA-256, deterministic derived-tree manifest SHA-256, and the
   executable artifact identity. Paths, usernames, source bytes, commands, environment, and host identity are
   forbidden. Both receipts in one plan must have the same overlay digest and different required parent commits.
3. Implement a state-owning derived-source producer with injected Git, filesystem, archive, and digest ports. It must
   verify an exact clean parent, export tracked files into a newly created root-contained private tree, reject links,
   absolute/traversal/duplicate/case-colliding entries and size/count overflow, apply only a fixed reviewed overlay,
   and prove the parent stayed unchanged. A partial derivation is invalid and cannot be reused.
4. Define a schema-v3 attempt request and one-line bounded response. A successful process response contains exact
   ordered phase durations and end-to-end duration, but no process/GPU resources. A failure contains only a stable
   reason code. Unknown, duplicate, missing, negative, oversized, path-bearing, or sensitive fields fail closed.
5. Extend `PerformanceResourcePort` so its terminal proof returns the exact ordered required resource measurements
   plus `ownedProcessTreeSettled`, zero unowned process attribution, and CPU `notApplicable` or zero unowned GPU
   attribution. The collector emits a successful sample only after process output, role attribution, resource
   measurements, and zero-ownership settlement all validate; otherwise it retains one failed cell.
6. Define qualification-only role registration for `main`, `guard`, and `worker`. Every registration binds role,
   PID, process start identity, and expected executable digest over a private bounded channel. Reused PIDs, unknown
   descendants, duplicate/missing roles, identity changes, late registration, or post-settlement live ownership are
   failures. No PID, executable path, process name, device identity, or raw sampler series enters retained evidence.
7. Keep aggregate output limited to model family/variant, platform/backend class, candidate window/cache state,
   counts, estimates, uncertainty, conservative gates, stable outcomes, parent commits, source proof, overlay digest,
   and sanitized document digests. It must not retain derived-tree or artifact paths, raw receipts, sample IDs, model
   SHA values, failure text, or role identities.
8. Update contract-only fixtures, CLI validation, source-baseline checks, and focused tests. Prove cancellation,
   timeout, malformed output, resource failure, derivation failure, and retry leave no partial bundle or reusable
   derived-tree authority.

## Contracts And Boundaries

- Qualification overlay code is not ordinary production behavior and is never activated by a production catalog or
  renderer/API input. This packet defines identity and transport only; Packet 15 implements the Linux overlay.
- Parent worktrees remain exact and clean. Derived source, build outputs, receipts, plans, raw samples, and process
  series stay under one validated private root and are never committed, uploaded, or pasted into retained evidence.
- The same overlay bytes and contract revision apply to both parents. A side-specific patch, probe set, build flag,
  or metric definition invalidates the pair.
- All timing uses monotonic clocks; units remain integer nanoseconds. Resource peaks remain integer bytes sampled at
  the locked 100 ms interval.

## Expected Files Or Components

- `scripts/local-whisper/qualification/PerformanceQualification*.ts`
- `scripts/local-whisper/qualification/PerformanceQualificationCollector.ts`
- A source-derivation owner and narrow Git/filesystem/archive adapters under `scripts/local-whisper/qualification/`
- Active `performance-*-v3.schema.json` files under `docs/specs/local-whisper/qualification/schemas/`
- Focused schema, derivation, collector, resource-role, privacy, cancellation, and CLI tests
- `package.json`, `tasks/todo.md`, and `tasks/handoff.md`

## Acceptance Criteria

- Every schema-v3 representative plan binds exact baseline/candidate parents and one identical overlay digest before
  collection begins.
- The derived-source producer cannot mutate a parent, escape its private root, accept ambiguous archive entries, or
  reuse a partial result after failure.
- Process phase output and resource results have separate owners and merge only after complete validation and owned
  settlement; every invalid path produces one retained content-free failed cell.
- Aggregate documents remain privacy-safe and `awaitingCrossPlatform` with null production selection.
- Hosted fixtures remain deterministic `contractOnly` evidence and cannot satisfy a representative gate.

## Verification

- `npm run test:local-whisper:performance-contracts`
- Focused source-derivation and resource-role tests added by this packet
- `npm run test:local-whisper:qualification`
- `npm run verify:local-whisper:qualification:inputs`
- `npm run verify:local-whisper:qualification:performance`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`

## Failure And Rollback

- Any schema ambiguity, unequal overlay, dirty/mutated parent, unsafe derivation, incomplete metric set, attribution
  failure, privacy issue, or fixture promotion leaves Packet 14 unchecked.
- Roll back by rejecting schema-v3/derived artifacts and retaining Packet 13's committed schema-v2 collector as the
  last coherent contract. Do not weaken identity, privacy, phase, resource, or threshold rules to pass.

## Manual Gates

- No representative hardware, authenticated private model/runtime execution, Windows work, CI inspection, push,
  publication, or destructive private-root cleanup is authorized in this packet.

## References

- Specification Sections 4, 5, 13, 14.1, 14.2, and 16.
- Packet 13's schema-v2 collector and the live Linux process/resource adapters.
- `LinuxProductionQualificationOrchestrator`, `LinuxQualificationEvidenceLoader`, and `LinuxResourceSampler` source
  contracts inspected during revision-6 planning.

## Completion And Handoff

After verification, mark Packet 14 complete, record changed contract/derivation files and checks, and name
[15 Linux Performance Attempt Runner](15_linux_performance_attempt_runner.md) as the exact next packet. Stop before
implementing the overlay, building private artifacts, running representative hardware, committing, pushing, or
inspecting CI.
