# Task 20: Linux Qualification Preparation

## Outcome

Execute the Linux side first, but only as a candidate-independent preflight.
Validate the deterministic qualification tooling, known public inputs, host and
toolchain readiness, and reusable local materialization paths without freezing
or adopting any qualification identity or evidence. Task 25 alone later freezes
the final shared candidate and produces authoritative Linux qualification.

## Prerequisites

- Specification revision 15 and plan revision 21 are approved.
- Tasks 19 and 23, including their follow-up fixes and `AC-MAN-015`–
  `AC-MAN-016`, are complete and committed.
- No `candidateInputDigest`, Linux/Windows platform input, profile, graph,
  series, result, evidence index, predecessor result, or aggregate root exists.
- The Task 17 fixture digest is
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized Linux x64 CPU/NVIDIA host and the existing pinned Linux
  toolchain inputs are available. Network, model/corpus transfer, and hardware
  preparation remain manual gates.
- Task 20 has separate Linux preflight execution authorization.

## Owned Requirements

- Candidate-independent preparation for the Linux slices of `REL-001`,
  `COMP-012`, `MODEL-011`, `QUAL-001`–`QUAL-004`, `PRIV-005`, and `OPS-003`.
- Preparation evidence for Linux `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–
  `AC-MAN-008`, and `AC-MAN-013`; it creates no requirement-satisfying
  qualification verdict. Task 25 owns the authoritative Linux evidence.
- No primary automated acceptance owner, platform qualification, aggregate
  verdict, production authority, or Windows scope.

## In Scope

- Run deterministic Linux qualification-tooling, artifact, package,
  filesystem-guard, launcher, supervisor, composition-activation, type, lint,
  format, and diff checks against the current committed source.
- Verify the static identity and availability of the six required model objects,
  pinned FLEURS `en_us`/`ru_ru` fixtures, direct-engine build inputs, Linux CPU
  and CUDA runtime-pack inputs, package inputs, toolchain locks, algorithms,
  rounding/tolerance methods, and predecessor-selection inputs.
- Prepare task-owned local, disposable model/corpus/runtime/direct-engine
  materialization and host/toolchain readiness only when the manual gates are
  authorized. Record raw paths, host identifiers, private keys, logs, audio,
  transcripts, and measurements only outside the repository.
- Exercise candidate-independent failure paths for unavailable inputs, denied
  network, missing tools, and unsupported host capability. Preserve only safe
  status and remediation data in the Task 20 handoff.
- Produce an advisory preflight handoff for Task 24 and Task 25. Revalidation
  against Task 24's final source identity is mandatory; neither packet may use
  this handoff as a frozen qualification input.

## Out Of Scope

- Freezing a SemVer/UTC, source digest, `candidateInputDigest`, platform input,
  profile, graph, series, result, evidence index, predecessor result, or
  aggregate root.
- Adopting a package/model/runtime/corpus/direct-engine artifact or host result
  as authoritative Linux qualification evidence.
- Production/runtime/package/catalog/provider changes, representative Windows
  work, Windows package/runtime identities, Task 24 delivery readiness, Task
  25 finalization, Task 21 qualification, or Task 22 aggregation.
- Production signing, legal approval, upload, publication, support promotion,
  commit, push, PR, tag, or release.

## Task Contract

### Preflight-only identity rule

Task 20 begins before Task 24, so every observation is mutable preparation. It
MUST NOT name, reserve, or calculate a future `candidateInputDigest`; it MUST
NOT choose the final UTC cutoff, SemVer, source/package identity, runtime
archive, direct-engine binary, profile, or predecessor. Any local manifest may
bind only a task-owned preflight run ID and current observed inputs. It is
private/disposable and cannot enter checked-in qualification evidence.

Task 24 may change source, runtime, catalog, activation, native-helper, or
package behavior. Task 25 MUST discard stale Task 20 observations, re-run all
identity checks against the final clean committed source, and then freeze the
shared candidate before any Linux evidence is measured or adopted.

### Inputs, tooling, and privacy

Use only the six canonical objects `tiny/full`, `base/full`, `small/full`,
`medium/full`, `large-v3/q5_0`, and `large-v3-turbo/q5_0`; pinned FLEURS
fixtures; the Task 17 fixture digest; the already pinned Linux CPU/CUDA
toolchains; and the existing qualification scripts. Public model/corpus access
uses the approved anonymous policy only. No token, cookie, private header,
mirror, moving revision, arbitrary URL, or user audio is permitted.

Host, device, filesystem, environment, toolchain, transfer, and measurement
details remain private. Repository records may contain only safe pass/fail
codes and canonical non-sensitive logical identifiers. A missing input or host
capability is `Pending`, not a substituted mock, fallback, or Pass.

## Contracts And Boundaries

- Renderer access remains through `window.electronAPI`; this packet grants no
  renderer authority over files, URLs, processes, devices, or qualification
  trust.
- Existing main-owned catalog, artifact, process, device, and privacy contracts
  remain unchanged. No new production implementation is authorized.
- Task 20 completion is a prerequisite for Task 24 execution but never permits
  candidate freeze. Task 24 completion and commit are mandatory before Task 25.
- Preserve the `Preview · Untested` AMD and `Planned · Unavailable` macOS
  boundaries.

## Expected Files Or Components

- Existing Linux qualification scripts and focused tests under
  `scripts/local-whisper/qualification/` and their test directories, exercised
  without changing production behavior.
- Private task-owned temporary materialization, staging, and raw-evidence roots
  outside the repository, cleaned only after ownership/marker validation.
- Updated `todo.md` and `handoff.md` containing only safe preflight state,
  checks, blockers, cleanup, and the Task 24 handoff.

## Acceptance Criteria

- All deterministic preflight checks pass or Task 20 stays incomplete with a
  precise safe blocker.
- The exact logical model, corpus, toolchain, package, runtime, and
  direct-engine inputs can be checked or prepared without a candidate freeze.
- No candidate/platform/profile/graph/result/evidence/predecessor/aggregate
  identity or Production claim is created or adopted.
- Task 24 can start on Windows after this handoff, and Task 25 will have an
  explicit list of observations it must revalidate after Task 24 commits.

## Verification

Run on the authorized Linux x64 host only:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:composition:activation
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

The registered Task 20 command is:

```bash
rtk npm run test:local-whisper:qualification
```

Do not invoke `run:local-whisper:qualification:linux`,
`verify:local-whisper:qualification:linux`, any Windows qualification command,
or `verify:local-whisper:all` in this packet.

## Failure And Rollback

- Preserve only task-owned private raw observations for diagnosis. Remove only
  validated task-owned temporary roots and proven owned processes/allocations.
- A production defect returns to a separately planned and authorized corrective
  implementation packet. A preflight/tooling defect remains Task 20 work.
- Missing host, toolchain, model, corpus, runtime, package, or predecessor is
  `Pending`; it never authorizes an alternate source, mock, fallback, or
  evidence claim.
- Do not relax thresholds or convert preparation into qualification after
  observing a result.

## Manual Gates

- Authorized Linux x64 CPU/NVIDIA host, exact pinned toolchains, and private
  raw-evidence storage.
- Anonymous public access only to exact pinned model/corpus inputs when needed;
  no credentials, mirrors, uploads, or private audio.
- Commit, push, PR, signing, upload, publication, support promotion, tag, and
  release remain outside this packet.

## References

- Specification revision 15 Sections 9.2, 9.6, 12.1–12.5, 18.3, 19.1–19.3,
  and 22.
- Tasks 19 and 23 committed handoffs; Task 24 Windows readiness packet; Task
  25 final Linux qualification packet; Task 17 fixture identity.

## Completion And Handoff

Mark Task 20 complete only after the candidate-independent preflight has passed
or recorded a precise safe blocker, all private temporary material has been
handled safely, and no authoritative identity/evidence exists. Update `todo.md`
and `handoff.md` with safe checks, logical input status, revalidation duties,
and exact next packet `24_windows_runtime_delivery_readiness.md`.

Stop before Task 24 execution on this host, candidate freeze, Task 25, Task 21,
commit, push, PR, signing, upload, publication, tag, support promotion, or
release unless separately authorized.
