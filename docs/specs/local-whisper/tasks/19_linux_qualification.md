# Task 19: Linux Qualification

## Outcome

Freeze one Local Whisper release candidate and its approved qualification
profiles, then run and record the complete Linux x64 CPU/CUDA, native,
application, package, lifecycle, privacy, offline, performance, memory, and
downgrade qualification. Produce an immutable privacy-safe Linux evidence slice
that Task 20 must consume without changing the candidate or Task 17 fixture
digest. Perform no representative Windows execution.

## Prerequisites

- Specification revision 7 and plan revision 13 are approved.
- Tasks 01–18 are complete; Task 18 changes have been reviewed and committed
  before candidate freeze.
- The Task 17 public fixture bundle digest is exactly
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- Exact Linux runtime/model inputs, licenses, source locks, dependency closures,
  and required toolchains are present through approved nonsecret inputs.
- The Linux x64 NVIDIA host is authorized for bounded qualification and its
  exact OS, kernel, topology, GPU, driver, compute capability, VRAM, CPU, and
  RAM can be collected privately.
- Task 19 has separate execution authorization. Planning approval alone does
  not authorize implementation, qualification, commit, push, publication, or
  release.

## Owned Requirements

- Linux qualification slices of `OUT-001`, `BASE-001`, `ARCH-001`, `ARCH-009`,
  `COMP-001`–`COMP-004`, `CAP-001`, `CAP-011`, `LIFE-005`, `PRIV-001`–
  `PRIV-004`, `DIAG-001`–`DIAG-003`, and `DOC-001`.
- Linux platform evidence supporting every applicable deterministic acceptance
  criterion in `AC-AUTO-001`–`AC-AUTO-054` and `AC-AUTO-056`–`AC-AUTO-063`.
- Linux portions of `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`,
  and `AC-MAN-013`.
- Candidate freeze, qualification-profile validation, Linux evidence capture,
  and immutable handoff to Tasks 20 and 21.
- Task 19 owns no aggregate automated acceptance result. Primary ownership of
  cross-platform assertions `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, and
  `AC-AUTO-040` belongs to Task 21.

## In Scope

- Add strict versioned candidate, profile, platform-result, and evidence-index
  schemas plus bounded privacy-safe validators required to execute Linux
  qualification and later reconcile the same candidate on Windows.
- Before candidate freeze, align active documentation, validation messages,
  and source-contract test descriptions with the Task 20 Windows execution
  boundary. Preserve already-issued immutable profile IDs containing the legacy
  `candidate-task19` token unless a separately approved profile revision is
  required; those IDs do not authorize execution.
- Freeze the application commit/package identity, approved source/runtime/model
  identities, Task 17 fixture digest, qualification profiles, and nonsecret
  tool identities before the first platform run.
- Run deterministic application, native C++, source, artifact, package,
  lifecycle, UI/accessibility, migration, privacy, diagnostics, and offline
  checks applicable to Linux.
- Run every approved Linux x64 CPU and NVIDIA CUDA profile, including direct
  pinned-engine comparison, accuracy, timing, RTF, RAM/VRAM, repetition, crash,
  cancellation, unload, cleanup, provider-switch, suspend/resume, app-exit,
  and offline restart behavior.
- Run the exact immediately preceding Linux packaged binary against the
  approved nonprivate downgrade fixture and record its identity and outcome.
- Record unavailable inputs or external approvals as `Pending`; never infer a
  pass from source, mocks, compilation, another device, or another platform.
- Update task checklist and handoff with the frozen candidate identity, Linux
  Pass/Fail/Pending results, evidence digests, and exact Task 20 inputs.

## Out Of Scope

- Any representative Windows command, Windows CI/job execution, Wine run,
  cross-compiled Windows substitute, or Windows support conclusion.
- Physical AMD promotion evidence or a Production AMD claim.
- Executable macOS inference, Metal, Core ML, signing, or notarization.
- Final cross-platform reconciliation, aggregate acceptance ownership result,
  release-blocker report, support-claim promotion, publication, tag, upload,
  push, pull request, or release.
- Repairing a failed owner packet, changing a profile threshold after observing
  results, or regenerating the frozen candidate in place.

## Task Contract

### Frozen candidate and evidence foundation

Create the candidate once. Its manifest must bind the exact source commit,
application/package hashes, approved profile digests, runtime/model/source-lock
identities, fixture digest, schema versions, and sanitized tool identities.
Raw host paths, unique hardware identifiers, environment data, audio,
transcripts, prompts, and private logs remain outside the repository and chat.

Every result row uses exactly `Pass`, `Fail`, `Pending`, or `Not Applicable`, a
stable reason code, candidate digest, profile digest when applicable, evidence
digest, platform, and evidence class. Validators reject merged candidates,
unknown statuses, missing units/bounds, fabricated hardware evidence, and a
fixture digest different from Task 17.

Task 20 must be able to consume the checked-in schemas, commands, sanitized
candidate identity, and immutable evidence index without executing Linux again.

### Deterministic and native Linux sweep

Run all deterministic checks needed to establish the Linux slice, including:

- settings, validation, provider selection, IPC, catalog, inventory, artifact
  download/resume/install/update/delete/quarantine, and residency/lifecycle;
- descriptor-anchored filesystem safety, locks, races, worker framing, model
  authority, process-group/parent-death cleanup, cancellation, and crash reload;
- `whisperCpp` fixed-engine, CPU/CUDA isolation, no fallback, no inference
  network, no ambient/path loader resolution, terminal cleanup, and fresh load;
- source/patch/license/SBOM/provenance/expected-file/dependency-closure checks,
  disconnected build/configure, relocation, malicious CWD/environment, and
  Task 17 fixture consumption;
- migration, legacy chooser, UI/accessibility, privacy/audit/diagnostics, base
  package boundary, and macOS/AMD presentation contracts where deterministic.

Source inspection, compilation, mocks, or source-contract checks remain their
actual evidence class and cannot satisfy a real Linux platform/hardware row.

### Linux production profiles

Before execution, validate each profile's exact OS family/build, architecture,
reference hardware, driver/runtime/ISA, engine/backend, source/runtime/model
identities, fixture hashes/licenses, repetitions, algorithms, tool versions,
units, tolerances, warm-up/discard rules, and pass limits. Reject an incomplete
profile before measurement.

For each applicable profile:

- every worker stage stays within its preapproved bound;
- normalized WER is no worse than one absolute percentage point above the
  pinned direct-engine reference on nonpersonal reference audio;
- output has no missing, duplicated, partial, or cross-request text;
- `base` median RTF is at most 1.0 over at least five 60-second fixtures after
  warm-up on the declared reference hardware;
- measured peak RAM/VRAM stays within the published qualified peak plus the
  predefined tolerance;
- 10 load/unload cycles and 20 sequential transcriptions complete without a
  crash, orphan, or monotonically growing owned memory;
- no owned process or GPU allocation remains after unload/forced termination
  and the predefined settling interval;
- injected crash recovery, provider switch, suspend/resume, app-exit cleanup,
  and offline restart/load/transcription pass.

Run CUDA profiles only for the exact claimed NVIDIA cells and prove selected
device identity without exposing unique hardware data. Run CPU profiles with
GPU access explicitly absent and prove no GPU initialization. A missing pack,
profile, origin, redistribution approval, device, or toolchain is `Pending`.

### Linux downgrade

Obtain the exact immediately preceding Linux package from the approved release
source and record version, hash, signature/provenance where available. Against
the nonprivate fixture, the older binary must remain Not ready, execute and
delete no Local Whisper data, preserve the namespaces, and recover through its
known-provider chooser. A current-code legacy fixture is preparation only and
does not satisfy `AC-MAN-013`.

## Contracts And Boundaries

- One frozen candidate and one Task 17 fixture digest cross Tasks 19–21.
- Task 19 may create the shared evidence foundation but records only Linux
  execution results; it does not issue the final aggregate verdict.
- Platform, hardware, deterministic, manual, and external evidence classes are
  distinct and non-substitutable.
- Expensive profiles are immutable evidence producers; Task 21 validates their
  digests and results instead of rerunning them.
- Any representative Windows execution is prohibited until Task 20.
- Qualification tooling performs no publication or support-matrix mutation.

## Expected Files Or Components

- Versioned candidate, profile, platform-result, and evidence-index schemas and
  validators under `docs/specs/local-whisper/qualification/` and
  `scripts/local-whisper/`.
- Active Local Whisper documentation, validation messages, and source-contract
  test descriptions consistently name Task 20 as the Windows executor while
  treating legacy immutable profile IDs as opaque identifiers.
- A Linux-specific evidence template derived from the Task 18 qualification
  seed template; the existing Task 18 file may be renamed only with all links
  updated in the same packet.
- Linux native, engine, package, lifecycle, privacy, performance, and downgrade
  orchestration with validated task-owned temporary roots.
- `package.json` commands required by Verification.
- Updated `todo.md` and `handoff.md` containing sanitized identities and exact
  Task 20 prerequisites, never raw evidence.

## Acceptance Criteria

- The candidate/profile/evidence schemas reject mutation, mixed candidates,
  missing required algorithms/units/bounds, private fields, and an altered Task
  17 fixture digest.
- Every applicable Linux deterministic and platform row has evidence tied to
  the frozen candidate or a precise `Pending` reason.
- Linux CPU runs prove no GPU initialization; Linux CUDA runs prove exact NVIDIA
  selection, real inference, lifecycle cleanup, and no fallback.
- Accuracy, RTF, peak memory, repeat, crash, cancellation, unload, cleanup,
  offline, package, privacy, and diagnostics gates follow preapproved profiles.
- Exact previous-Linux-binary downgrade evidence is recorded truthfully.
- No representative Windows execution or Windows claim occurs.
- No active prose or validation message incorrectly assigns representative
  Windows execution to Task 19; legacy opaque profile IDs are documented rather
  than silently rewritten.
- Task 20 can consume the same candidate, profiles, schemas, evidence index,
  and fixture digest without regenerating any input.

## Verification

Run on the authorized Linux x64 host only:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:filesystem
rtk npm run verify:local-whisper:ui
rtk npm run verify:local-whisper:packaging
rtk npm run verify:local-whisper:migration-privacy
rtk npm run verify:local-whisper:qualification:linux
rtk npm run verify:local-whisper:downgrade -- --platform=linux
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
```

Do not invoke `verify:local-whisper:qualification:windows`, `dist:win`, or any
representative Windows job in this packet. The registered Task 19 command is:

```bash
rtk npm run verify:local-whisper:qualification:linux
```

## Failure And Rollback

- Preserve the frozen manifest and failed evidence. Clean only exact
  task-owned temporary roots and proven task-owned processes/allocations.
- A privacy, cleanup, path-trust, signature, candidate-integrity, or
  evidence-integrity failure stops Linux qualification and returns to the
  primary owner through newly authorized work.
- Missing hardware, toolchain, previous binary, artifact, or external approval
  remains `Pending`; it is not repaired with a mock or inferred pass.
- Any candidate/input change invalidates existing evidence and requires a new
  freeze; never combine evidence from different candidates.

## Manual Gates

- `AC-MAN-001`: exact Linux NVIDIA Production profile.
- Linux slices of `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and `AC-MAN-013`.
- Exact source/runtime/model inputs, licenses, origins, redistribution approval,
  toolchains, and the immediately preceding Linux package may remain external
  blockers.
- Physical AMD promotion, physical macOS review, representative Windows, final
  aggregation, commit, push, PR, tag, signing, upload, publication, and release
  remain outside this packet.

## References

- `../spec.md`, especially Sections 19.2, 20, 21, and 22 plus all automated and
  manual acceptance rows.
- Tasks 01–18 and their recorded handoffs.
- `../qualification/task19-evidence-template.md` as the Task 18 seed input to
  be split into platform-specific and aggregate evidence during Tasks 19–21.
- Project Linux packaging, native-quality, privacy, diagnostics, and release
  conventions.

## Completion And Handoff

Update `todo.md` and `handoff.md` with candidate/profile/fixture digests, Linux
Pass/Fail/Pending/Not Applicable summaries, exact previous-binary status, and
the immutable inputs Task 20 must consume. Mark Task 19 complete when the
packet has produced truthful Linux results and a valid handoff; qualification
failures and external blockers remain explicit and are not converted to Pass.
Stop before Task 20, commit, push, PR, publication, or release unless separately
authorized.
