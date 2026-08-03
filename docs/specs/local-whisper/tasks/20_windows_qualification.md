# Task 20: Windows Qualification

## Outcome

Consume the exact unchanged Task 19 shared candidate input and read-only Linux
platform graph/result/evidence index on an authorized representative Windows
x64 host. Freeze the distinct Windows application/runtime/direct-engine/
toolchain/predecessor input, profiles, and platform graph before measurement;
then execute and freeze the complete Windows CPU/CUDA, native, installer,
process, transport, lifecycle, privacy, offline, resource, and predecessor
evidence slice.

Do not redefine candidate inputs or production trust, rerun Linux
qualification, infer AMD success, or issue the aggregate production-readiness
verdict.

## Prerequisites

- Specification revision 10 and plan revision 16 are approved.
- Task 19 is complete and its handoff identifies immutable specification-10
  `candidateInputDigest`, Linux `platformInputDigest`, complete Linux profile
  set, `platformGraphDigest`, platform-result digest, and platform-evidence-
  index digest. The handoff explicitly contains no Windows branch identity.
- The Task 17 fixture digest is exactly
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized representative Windows x64 CPU/NVIDIA host is available.
  Cross-compilation, Wine, Linux, compile-only CI, source contracts, and mocks
  cannot replace this host.
- Exact Windows toolchain, package, runtime, model, corpus, measurement, and
  predecessor inputs are available to freeze against `candidateInputDigest`
  before Windows measurement. They are not Task 19-frozen Linux identities.
- Task 20 has separate execution authorization on Windows.

Production private signing/legal/upload/publication inputs are not Windows
technical-qualification prerequisites; they remain Task 21 gates.

## Owned Requirements

- Representative Windows evidence for `COMP-012`, `MODEL-011`,
  `DIST-001`–`DIST-002`, `QUAL-001`–`QUAL-004`, `PRIV-005`, `REL-001`, and
  the Windows technical slice of `OPS-003`, plus every applicable earlier
  requirement deferred to Windows.
- Supporting platform evidence for `AC-AUTO-064`–`AC-AUTO-070` and
  `AC-AUTO-072`; their primary implementation ownership remains Task 19.
- Windows evidence supporting all applicable earlier automated acceptance.
- `AC-MAN-003`; Windows slices of `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`,
  and `AC-MAN-013`; Windows technical inputs consumed by `AC-MAN-014`.
- No aggregate automated acceptance ownership. Task 21 owns cross-platform
  reconciliation and `AC-AUTO-071`.

## In Scope

- Validate the unchanged shared candidate input, read-only Linux branch,
  common model/corpus/schema/Task 17 identities, and absence of a pre-existing
  Windows branch before any Windows freeze or execution.
- Freeze Windows `platformInputDigest` over the shared candidate input and exact
  Windows application packages, qualification catalog/keyring/origin, CPU/CUDA
  runtime archives, toolchain, direct-engine binaries, qualification server,
  notices/SBOM/provenance, and predecessor selected at the shared UTC cutoff.
- Freeze every Windows CPU/CUDA `profileDigest`, then
  `platformGraphDigest`, before any measurement begins. Seal measurement series,
  Windows result, and evidence index strictly after that graph.
- Validate the exact frozen MSVC/CUDA/CMake/SDK/Ninja toolchain and effective
  CUDA architecture; reject ambient or requested-but-unproven substitutions.
- Run real Windows handle/reparse filesystem safety, launcher authority, Job
  Object ownership, native warnings/lint/tests, CPU/CUDA worker, application,
  installer/package, IPC/UI, diagnostics/privacy, offline, lifecycle, resource,
  and downgrade checks.
- Exercise `restricted-tar-gzip-v1` through a Windows single-use loopback HTTPS
  qualification origin and `pinned-raw-model-v1` through the exact public
  Hugging Face origin/redirect policy.
- Qualify all six canonical models on Windows CPU and representative NVIDIA
  CUDA using the exact frozen FLEURS/direct-engine/profile algorithms.
- Freeze a privacy-safe Windows platform result and evidence index for Task 21.

## Out Of Scope

- Linux reruns or evidence mutation; shared-candidate, threshold, common model/
  corpus/schema, Linux-branch, or production-trust regeneration.
- Wine, cross-compilation, compile-only checks, mocks, or Linux evidence as a
  substitute for representative Windows behavior.
- Repairing failed shared or Linux inputs in place. A shared-input/Linux-branch
  mismatch returns to newly authorized Task 19 work; a Windows-only input,
  profile, or evidence failure remains owned by Task 20.
- Physical AMD promotion; Windows Vulkan remains `Preview · Untested` without
  a future approved hardware profile.
- Executable macOS inference or Apple qualification.
- Production signing, legal approval, final GitHub upload/origin parity,
  aggregate verdict, publication, tag, push, PR, or release.

## Task Contract

### Shared/Linux validation and Windows graph freeze

Every shared candidate and Linux branch identity from Task 19 is read-only.
Reject a different SemVer/UTC/source tree, model/corpus/transfer/schema/Task 17
identity, `candidateInputDigest`, or any Linux input/profile/graph/result/index
digest. Reject a legacy circular-v2 document, backward/missing edge,
placeholder, duplicate, mixed candidate/platform, private field, or unhashed
binding.

Task 20 produces only the Windows branch. Its `platformInputDigest` binds the
shared candidate and exact Windows package/catalog/runtime/direct-engine/
toolchain/server/predecessor inputs while excluding profile/evidence digests.
Profiles bind the shared candidate input and Windows platform input. The Windows platform
graph binds the complete sorted profile set. Measurement series bind that
graph/profile; result and index bind only earlier Windows evidence layers. No
Windows document mutates or hashes the later aggregate root.

The Windows toolchain must prove:

| Input                       | Required candidate value |
| --------------------------- | ------------------------ |
| CUDA toolkit                | `12.8.1`                 |
| MSVC toolset                | v143 `14.39`             |
| Compiler macro              | `_MSC_VER 1939`          |
| CMake                       | `3.31.8`                 |
| Windows SDK                 | `10.0.26100.0`           |
| Ninja                       | `1.12.1`                 |
| Effective CUDA architecture | `120a-real`              |

Reject ambient MSVC 14.44/`_MSC_VER 1944`, a generic Visual Studio label, or a
profile string without generated-code proof. Do not modify the shared candidate
input or Linux branch to fit the host.

### Filesystem, process, and native behavior

Exercise real managed-root containment and identity under junction, reparse,
hard-link, rename, volume, lock, quarantine, delete, stale PID, and start-time
races. Use validated task-owned temporary roots only.

Prove arbitrary inherited model `HANDLE` mapping to logical slot `3`, one-use
authenticated bootstrap pipe, restricted handle list, suspended creation, Job
assignment before resume, private acknowledgement, framing, nested-Job
compatibility/fail-closed behavior, parent/app crash, descendant cleanup, and
kill-on-close. No path, authority, prompt, audio, transcript, or environment
secret enters public evidence.

Run native MSVC warnings-as-errors, formatting/linting, unit/integration tests,
and CPU/CUDA worker/package equivalents required by the Windows platform input.

### Transport, model, and lifecycle qualification

The runtime qualification server binds only `127.0.0.1`, serves only exact
candidate Windows runtime archives, pins certificate/origin/range/ETag/archive
identity, and terminates with the run. The public model transfer uses the exact
anonymous Hugging Face object and signed redirect policy, with no credential or
private header. Resume, cancellation, restart, update-alongside-old-revision,
safe deletion, and offline installed behavior must match Task 19.

For Windows CPU, make GPU access absent and prove no GPU initialization. For
CUDA, prove the exact selected NVIDIA adapter and worker-owned allocation with
no fallback. Every canonical model passes load, warm-up, FLEURS/direct-engine
WER parity, RAM/VRAM, unload, recovery, repeat, crash, cancellation, provider
switch, suspend/resume, app exit, and offline restart. `base/full` additionally
passes median RTF `<= 1.0` over the five frozen 60-second fixtures.

Sample every 100 ms from before load through settlement. RAM is the sum of
`PROCESS_MEMORY_COUNTERS_EX.PrivateUsage` for exact Job-owned PIDs/start
identities. NVIDIA VRAM is the sum of PDH `GPU Process Memory` `Dedicated
Usage` counters matching those PIDs and selected adapter LUID. Missing access,
ambiguous ownership, a sample gap over 500 ms, or API failure invalidates the
result. Apply the frozen rounding, tolerances, repetitions, leak trend, and
ten-second/ten-consecutive-zero-sample settlement rules unchanged.

### Package, privacy, and predecessor

Validate the base installer, ASAR, exactly approved native helpers, on-demand
pack integrity, relocation/dependency closure, install/upgrade/uninstall,
qualification-mode marking, and release-collection rejection of fixture or
qualification trust.

Run trusted-window IPC, settings/main-window accessibility, privacy canaries,
diagnostics, process argument/environment/network inspection, provider switch,
suspend/resume, crash, exit, and offline checks.

Select the highest stable predecessor published before Task 19's shared UTC
freeze timestamp. If no later stable exists, execute
`GPT-Voice.Setup.2.3.0.exe` with release-reported
SHA-256 `0e2aa1ea97ba357db6d35f53debd01ca1c6124ae10b9f537b2af4427a0328cd0`
and independently verify its identity. It must remain Not ready, preserve new
namespaces, execute/delete no Local Whisper data, and recover to a provider it
knows.

## Contracts And Boundaries

- The shared candidate input, common model/corpus/schema/Task 17 identities,
  and complete Linux branch are immutable inputs. The Windows branch is frozen
  and owned only by Task 20.
- Every representative Windows execution occurs only in Task 20 on Windows.
- Platform, hardware, deterministic, privacy, legal, and publication evidence
  classes are non-substitutable.
- Raw host paths, hardware identifiers, prompts, audio, transcripts,
  environment data, and raw measurement series remain outside repository and
  chat; checked-in results contain sanitized digests only.
- Task 20 records the Windows technical verdict but does not aggregate claims
  or production authority.
- No Task 20 command signs with production material, uploads, publishes, tags,
  pushes, opens a PR, or releases.

## Expected Files Or Components

- Windows input/toolchain/candidate validators and qualification orchestration
  under `scripts/local-whisper/`.
- Windows loopback runtime transport, public model transport, native/process,
  CPU/CUDA, resource, lifecycle, installer/package, privacy, offline, and
  predecessor runners.
- Windows platform-input/profile/platform-graph/result/evidence documents
  conforming to the corrected Task 19 v2 schema family and binding the
  unchanged `candidateInputDigest`.
- `package.json` commands plus updated `todo.md` and `handoff.md` containing
  only sanitized Task 21 inputs.

## Acceptance Criteria

- The exact shared candidate input and read-only Linux branch validate; the
  Windows input/toolchain/profiles/graph freeze before execution with no shared
  or Linux identity changes.
- Windows evidence supports `AC-AUTO-064`–`AC-AUTO-070` and `AC-AUTO-072`
  using real transports, packaging, platform APIs, and frozen methods.
- Every required all-six-model Windows CPU/CUDA, filesystem/process, native,
  installer, lifecycle, privacy, resource, offline, and predecessor row passes
  or has a precise blocking technical result; substitute evidence is rejected.
- CPU proves no GPU initialization; CUDA proves exact device, real inference,
  owned resource cleanup, and no fallback.
- Windows Vulkan claims no physical AMD success.
- Task 21 can validate the shared core and both platform branches by digest
  without rerunning expensive profiles.

## Verification

Run on the separately authorized representative Windows x64 host only:

```bash
rtk npm run verify:local-whisper:qualification:inputs -- --platform=win32
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:filesystem
rtk npm run test:local-whisper:packaging
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run dist:win -- --dir
rtk npm run verify:local-whisper:qualification:windows
rtk npm run verify:local-whisper:downgrade -- --platform=win32
```

The registered Task 20 command is:

```bash
rtk npm run verify:local-whisper:qualification:windows
```

Do not run Linux qualification or `verify:local-whisper:all` in this packet.

## Failure And Rollback

- Preserve the shared candidate input, Linux branch, any already frozen Windows
  input/profile/graph, and truthful failed Windows evidence. Clean only exact
  task-owned temporary roots and proven Job-owned processes/allocations.
- A shared-input/common-model/corpus/schema/fixture or Linux-branch mismatch
  stops execution and returns to Task 19 through new authorization. A
  Windows-only input/profile/evidence failure remains Task 20 work. Never
  rewrite either platform branch.
- Privacy, cleanup, filesystem trust, process authority, toolchain identity, or
  evidence integrity failures are blocking.
- Missing representative host/device/tool/package/artifact/profile/corpus/
  predecessor evidence is `Pending` and keeps Task 20 incomplete; mocks never
  produce Pass.
- Missing production trust/legal/upload evidence remains Task 21 input and does
  not invalidate a passing Windows technical result.

## Manual Gates

- Authorized representative Windows x64 CPU/NVIDIA host and exact toolchain.
- `AC-MAN-003`, Windows `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and exact
  Windows `AC-MAN-013` predecessor execution.
- Physical AMD promotion remains future `AC-MAN-010` work and does not block
  the approved Preview/untested label.
- Production signing, legal approval, final GitHub upload, aggregation,
  publication, commit, push, PR, tag, support promotion, and release remain
  outside this packet.

## References

- `../spec.md`, especially Sections 9.2, 9.6, 12.1–12.5, 18.3, 19.1–19.3,
  and 22.
- Immutable Task 19 shared candidate input, Linux input/profile/graph/result/
  evidence handoff, common corpus/schemas, and explicit absence of a Windows
  branch.
- Project Windows packaging, native-quality, privacy, diagnostics, installer,
  and release conventions.

## Completion And Handoff

Mark Task 20 complete only when the unchanged shared candidate input and Linux
branch validate; the Windows `platformInputDigest`, complete profile set,
`platformGraphDigest`, representative technical/transport/all-six-model/
resource/lifecycle/package/privacy/offline/predecessor result, and platform-
evidence-index digests are truthful, schema-valid, and frozen. Production
key/legal/final-origin gates may remain explicit Task 21 inputs.

Update `todo.md` and `handoff.md` with the unchanged `candidateInputDigest` and
Linux branch digests plus sanitized Windows package/catalog/runtime/direct-
engine/toolchain/predecessor `platformInputDigest`, profile/
`platformGraphDigest`, result, and platform-evidence-index digests. Stop before
Task 21, commit, push, PR, production signing, upload, publication, or release
unless separately authorized.
