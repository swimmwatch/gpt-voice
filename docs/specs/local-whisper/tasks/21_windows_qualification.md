# Task 21: Windows Qualification

## Outcome

On an authorized representative Windows x64 host, consume the unchanged Task
20 shared candidate and read-only Linux branch, freeze a distinct Windows
platform input/profile graph, then execute and seal the complete Windows CPU
and NVIDIA CUDA technical qualification for all six canonical models.

Validate the real Windows filesystem, launcher/Job Object, worker, runtime
pack, installer/package, transport, lifecycle, resource, privacy, offline, and
predecessor behavior implemented by Task 19. Produce one privacy-safe Windows
result/evidence branch for Task 22 without mutating shared or Linux evidence.

## Prerequisites

- Specification revision 14 and plan revision 18 are approved.
- Task 19 cross-platform implementation readiness is complete and committed.
- Task 20 is complete and supplies one immutable `candidateInputDigest` plus
  Linux platform input/profile/graph/result/evidence-index digests. It
  explicitly created no Windows branch or aggregate root.
- The Task 17 fixture digest is
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized representative Windows x64 CPU/NVIDIA host and the exact
  pinned MSVC/CUDA/CMake/SDK/Ninja inputs are available.
- Task 21 has separate execution authorization on Windows.

## Owned Requirements

- Windows platform evidence for `REL-001`, `COMP-012`, `DIST-001`–`DIST-002`,
  `MODEL-011`, `PKG-011`, `SEC-014`, `QUAL-001`–`QUAL-004`, `PRIV-005`, and
  the Windows technical slice of `OPS-003`.
- Supporting Windows evidence for `AC-AUTO-064`–`AC-AUTO-070` and
  `AC-AUTO-072`–`AC-AUTO-075`; primary automated ownership remains Task 19
  except aggregate `AC-AUTO-071` in Task 22.
- `AC-MAN-003`; Windows `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and
  `AC-MAN-013`; Windows technical inputs for `AC-MAN-014`.
- No Linux mutation, aggregate verdict, or production authority.

## In Scope

- Validate the unchanged shared candidate and complete read-only Linux branch
  before creating any Windows identity.
- Build and freeze exact Windows application packages, qualification catalog/
  keyring/origin, CPU/CUDA runtime archives, direct-engine binaries,
  toolchains, notices/SBOM/provenance, qualification server, and predecessor in
  `platformInputDigest`.
- Freeze CPU/CUDA Windows profiles and `platformGraphDigest` before
  measurement; seal series, result, and evidence index afterward.
- Execute real Windows native build quality, filesystem/reparse safety,
  inherited handle authority, suspended launcher/Job Object ownership,
  CPU/CUDA workers, installer/package, application, IPC/UI, diagnostics,
  resource, lifecycle, privacy, offline, transport, and downgrade gates.
- Qualify all six canonical models on Windows CPU and representative NVIDIA
  CUDA using the frozen FLEURS/direct-engine methods.
- Adopt only sanitized checksum-linked evidence and hand immutable Windows
  digests to Task 22.

## Out Of Scope

- Regenerating or mutating the shared candidate or Linux branch; rerunning
  Linux qualification; changing thresholds after evidence is observed.
- Treating Wine, cross-compilation, Linux results, compile-only CI, or mocks as
  representative Windows evidence.
- Production implementation changes inside frozen evidence. A production
  defect requires separately planned correction and invalidates affected
  candidate/platform evidence.
- Physical AMD promotion, executable macOS inference, production signing,
  legal approval, final GitHub upload/origin parity, aggregate verdict,
  publication, push, PR, tag, or release.

## Task Contract

### Immutable inputs and Windows branch

Reject a different SemVer/UTC/source/model/corpus/schema/Task 17 identity,
`candidateInputDigest`, or any Linux input/profile/graph/result/index digest.
Reject legacy cycles, placeholders, backward/missing edges, mixed candidates,
duplicates, private fields, and noncanonical bytes.

The Windows `platformInputDigest` binds only earlier shared inputs plus exact
Windows package/catalog/runtime/direct-engine/toolchain/server/notices/
predecessor identities. Profiles bind shared and Windows platform inputs. The
Windows graph binds the complete sorted profile set. Series/result/index bind
only already-frozen Windows layers. No Windows document hashes or reserves the
later aggregate root.

### Exact Windows toolchain

Prove the frozen candidate values:

| Input                       | Required value  |
| --------------------------- | --------------- |
| CUDA toolkit                | `12.8.1`        |
| MSVC toolset                | v143 `14.39`    |
| Compiler macro              | `_MSC_VER 1939` |
| CMake                       | `3.31.8`        |
| Windows SDK                 | `10.0.26100.0`  |
| Ninja                       | `1.12.1`        |
| Effective CUDA architecture | `120a-real`     |

Reject ambient MSVC/toolchain substitution, a generic Visual Studio label, or
requested CUDA architecture without generated-code proof.

### Filesystem, process, runtime, and packaging

Use validated task-owned temporary roots. Exercise real containment and
identity under junction, reparse, hard-link, rename, volume, lock, quarantine,
delete, stale PID, and start-time races.

Prove arbitrary inherited model `HANDLE` mapping to logical slot `3`, one-use
authenticated bootstrap pipe, restricted inherited handle list, suspended
creation, Job assignment before resume, private acknowledgement, framing,
nested-Job compatibility/fail-closed behavior, kill-on-close, parent crash,
and descendant cleanup. No path, secret, audio, transcript, or raw device
identity enters public evidence.

Build/test native code with MSVC warnings as errors and the pinned CPU/CUDA
profiles. Validate helper manifests, ASAR/resources, on-demand runtime packs,
dependency closure, installer install/upgrade/uninstall, qualification marking,
and release-collection rejection.

### Transports and qualification matrix

Use a single-use `127.0.0.1` HTTPS origin for exact frozen Windows runtime
archives and the approved anonymous public Hugging Face redirect policy for
models. Exercise range/resume/validator/cancellation/update/deletion/offline
behavior without credentials, private headers, alternate origins, or fallback.

For each canonical model, Windows CPU and CUDA pass full load, warm-up,
application/direct-engine WER parity within 1.00 percentage point, owned RAM/
VRAM measurement, unload, and recovery. `base/full` additionally passes median
RTF `<= 1.0` over five exact 60-second fixtures. CPU proves no GPU
initialization; CUDA proves the exact selected NVIDIA adapter and no fallback.

Sample every 100 ms. RAM is exact Job-owned `PrivateUsage`; NVIDIA VRAM uses
PDH `GPU Process Memory` `Dedicated Usage` matched to Job-owned PIDs and the
selected adapter LUID. Missing access, ambiguous ownership, gaps over 500 ms,
or API failure invalidates the result. Apply the frozen rounding, tolerances,
repetitions, leak trend, and ten-second/ten-zero-sample settlement rules.

Run cancellation, crash/reload, 10 load/unload cycles, 20 transcriptions,
provider switch, suspend/resume, app exit, offline restart, and exact cleanup.

### Privacy and predecessor

Select the highest stable predecessor before Task 20's shared UTC cutoff. If
no later stable exists, execute `GPT-Voice.Setup.2.3.0.exe` with SHA-256
`0e2aa1ea97ba357db6d35f53debd01ca1c6124ae10b9f537b2af4427a0328cd0`.
It remains Not ready, preserves new namespaces, performs no Local Whisper
execution/deletion, and recovers to a known provider.

Raw host paths, identifiers, prompts, audio, transcripts, environment data,
private keys, and measurement series remain private. Repository evidence is
sanitized and digest-linked only.

## Contracts And Boundaries

- Task 21 consumes but cannot mutate Task 20's shared input or Linux branch.
- Representative Windows execution occurs only on Windows in this packet.
- Platform, hardware, deterministic, privacy, legal, and publication evidence
  are non-substitutable.
- Windows Vulkan remains `Preview · Untested`; macOS remains unavailable.
- No production signing, aggregation, upload, publication, support promotion,
  push, PR, tag, or release occurs.

## Expected Files Or Components

- Windows qualification package/input/toolchain/orchestration, loopback
  transport, resource, lifecycle, privacy, offline, installer, and predecessor
  tooling under `scripts/local-whisper/qualification/`.
- Windows native/runtime/package test infrastructure and exact pinned profiles.
- Windows platform input/profile/graph/result/evidence documents conforming to
  the corrected v2 schemas and unchanged `candidateInputDigest`.
- Registered Windows verification command plus updated `todo.md` and
  `handoff.md` with sanitized Task 22 inputs.

## Acceptance Criteria

- The shared candidate and Linux branch validate unchanged before Windows
  freeze or execution.
- The exact Windows input, complete profiles, and graph freeze before
  measurements and contain no aggregate/backward edge.
- Every required all-six-model CPU/CUDA, filesystem/process, native,
  installer, transport, lifecycle, resource, privacy, offline, and predecessor
  row passes or Task 21 remains incomplete with a precise failure.
- CPU proves no GPU use; CUDA proves exact device, real inference, owned
  allocation cleanup, and no fallback.
- Task 22 can consume both platform branches by digest without rerun.

## Verification

Run on the authorized representative Windows x64 host only:

```bash
rtk npm run test:local-whisper:acceptance-ownership
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

The registered Task 21 command is:

```bash
rtk npm run verify:local-whisper:qualification:windows
```

Do not run Linux qualification or `verify:local-whisper:all`.

## Failure And Rollback

- Preserve shared/Linux identities and truthful failed Windows evidence. Clean
  only exact task-owned roots and proven Job-owned processes/allocations.
- Shared or Linux mismatch stops and returns to the owning packet; Windows-only
  test infrastructure stays Task 21 work. A production defect invalidates
  affected evidence and requires separately planned correction.
- Missing representative host/tool/package/model/corpus/predecessor evidence is
  `Pending`; mocks cannot produce Pass.
- Missing production trust/legal/upload evidence remains Task 22 input and does
  not invalidate a technical Pass.

## Manual Gates

- Authorized representative Windows x64 CPU/NVIDIA host and exact toolchain.
- `AC-MAN-003`, Windows `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and
  Windows `AC-MAN-013` execution.
- Production signing, legal approval, final upload, aggregation, publication,
  commit, push, PR, tag, support promotion, and release remain outside.

## References

- Specification revision 14 Sections 9.2, 9.6, 12.1–12.5, 18.3,
  19.1–19.3, and 22.
- Immutable Task 20 shared/Linux handoff and Task 19 implementation-readiness
  handoff.
- Project Windows native-quality, packaging, installer, privacy, diagnostics,
  and release conventions.

## Completion And Handoff

Mark Task 21 complete only when the unchanged shared/Linux inputs validate and
the Windows `platformInputDigest`, complete profiles, `platformGraphDigest`,
result, evidence-index digest, and every required Windows technical row are
truthful and frozen. No aggregate root or Production authority exists yet.

Update `todo.md` and `handoff.md` with unchanged shared/Linux digests and
sanitized Windows package/catalog/runtime/direct-engine/toolchain/predecessor/
graph/result/index identities. Stop before Task 22, commit, push, PR,
production signing, upload, publication, or release unless separately
authorized.
