# Task 21: Windows RTX 50 Qualification

Status: **Superseded by approved plan revision 31. Do not execute this packet.**
Its remaining final Windows qualification contract is owned by Task 34.

## Outcome

On the authorized Windows x64 RTX 50 host, consume the unchanged Task 28 signed
Windows candidates plus Task 29 shared/Linux branch, freeze the Windows
platform/profile graph, execute all-six-model CPU/`sm_120a` qualification, and
seal one privacy-safe Windows branch for Task 22.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- Tasks 24, 25, 27, 31, 30, 28, and 29 are complete; Task 30 preparation, Task
  28 candidates, and the Task 29 shared/Linux identities are immutable and
  read-only.
- The `release/v2.4.0` pull request remains open, current with `main`, and
  unchanged at the exact Task 28 head; the final tag does not exist.
- The available RTX 5090 is the representative `sm_120a` host. RTX 30/40 are
  excluded and Task 26 remains deferred.
- Exact pinned Windows tools, public model/corpus access, private raw-evidence
  storage, and separate Task 21 execution authorization are available.

## Owned Requirements

- Windows evidence for `REL-001`, `COMP-012`–`COMP-013`, `MODEL-011`,
  `QUAL-001`–`QUAL-006`, `PRIV-005`–`PRIV-006`, and Windows slices of
  `OPS-003`–`OPS-004`.
- Supporting Windows `AC-AUTO-064`–`AC-AUTO-070`, `AC-AUTO-072`–`AC-AUTO-082`,
  and `AC-AUTO-087`.
- `AC-MAN-003`; Windows `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`,
  `AC-MAN-013`, `AC-MAN-018`, and Windows inputs for `AC-MAN-014`.

## In Scope

- Validate the exact Task 30 release preparation, release PR head/base, Task 28
  generation, and complete read-only Task 29 branch before creating any Windows
  identity.
- Freeze Windows `platformInputDigest` over the final Authenticode-signed
  installer, embedded production catalog/keyring/origin, distinct marked
  qualification package/loopback identity, exact CPU/CUDA packs and signatures,
  release-manifest entry, toolchains, direct engines, notices/SBOM/provenance,
  and predecessor.
- Freeze CPU/RTX 50 profiles and `platformGraphDigest` before measurement; seal
  series, result, and evidence index afterward.
- Execute native build quality, filesystem/reparse safety, inherited-handle
  authority, suspended launcher/Job Object ownership, worker, installer,
  transport, resource, lifecycle, privacy, offline, cleanup, and downgrade
  gates on real Windows.
- Qualify all six models on CPU and RTX 50 using the frozen
  FLEURS/direct-engine methods and adopt only sanitized evidence.

## Out Of Scope

- Mutating/rebuilding/re-signing Task 28 candidates or Task 29 evidence,
  rerunning Linux qualification, or repairing frozen production source.
- Aggregate root, final GitHub Release upload/origin verification, publication,
  support promotion, release PR merge/update, tag, push, or release.
- Wine/cross-compile/mock substitution, RTX 30/40, AMD promotion, or macOS.

## Task Contract

Reject a different SemVer, release PR head/base, Task 30 preparation/version/
manual-registry identity, source, catalog, release manifest, model/corpus,
Task 17 identity, signed application/runtime byte, shared digest, or Linux
branch. Reject cycles, placeholders, mixed generations, duplicate profiles,
private fields, and noncanonical documents.

Required Windows toolchain:

| Input             | Required value   |
| ----------------- | ---------------- |
| CUDA toolkit      | `12.8.1`         |
| MSVC toolset      | v143 `14.39`     |
| Compiler macro    | `_MSC_VER 1939`  |
| CMake             | `3.31.8`         |
| Windows SDK       | `10.0.26100.0`   |
| Ninja             | `1.12.1`         |
| CUDA architecture | `120a-real` only |

Reject ambient substitution, generic Visual Studio labels, requested-only CUDA
architecture, or missing generated-code/dependency proof.

Use validated task-owned roots. Exercise junction/reparse/hard-link/rename/
volume/lock/quarantine/delete races; inherited model handle slot `3`; one-use
bootstrap; restricted handle list; suspended creation; Job assignment before
resume; acknowledgement; framing; nested-Job behavior; kill-on-close; parent
crash; and descendant cleanup.

The marked qualification package may use the single-use loopback server for
the exact runtime bytes. Separately verify the final signed production
installer's Authenticode signature, install/upgrade/uninstall behavior,
embedded production trust/catalog, exact installed runtime compatibility, and
inference. Final GitHub origin parity remains Task 22.

Every model passes load, warm-up, application/direct WER parity within 1.00
absolute percentage point, resource measurement, unload, and recovery on CPU
and RTX 50. `base/full` passes median RTF `<= 1.0` over five 60-second fixtures.
Sample every 100 ms using Job-owned `PrivateUsage` and PDH dedicated GPU memory
matched to Job PIDs and adapter LUID. Missing/ambiguous data or gaps over 500 ms
invalidate rather than estimate. Run the frozen repetition, leak, lifecycle,
offline, cancellation, crash, and settlement matrix.

## Contracts And Boundaries

- Task 21 adds only the Windows branch; shared, signed-candidate, and Linux
  identities remain unchanged.
- Task 21 posts only the bounded Windows result/evidence identity required by
  the release PR gate; it cannot merge the PR or create the final tag.
- Production and qualification purposes stay disjoint and bind the same exact
  runtime candidate bytes.
- Raw host paths, identifiers, audio, transcripts, environment, keys, and
  measurement series remain private.
- Windows Vulkan remains Preview/Untested; macOS remains unavailable.

## Expected Files Or Components

- Existing Windows qualification orchestration, resource/lifecycle/privacy/
  offline/installer/predecessor tooling, exact profiles, and tests.
- Windows platform input/profile/graph/result/evidence documents.
- `package.json`, `todo.md`, and `handoff.md` updates.

## Acceptance Criteria

- One schema-valid Windows branch names the exact Task 30 preparation, release
  PR head, Task 28 candidates, and unchanged Task 29 shared/Linux identities.
- Real Windows CPU/RTX 50 native, installer, model, transport, parity,
  performance, resource, lifecycle, privacy, offline, cleanup, and predecessor
  gates pass, including `AC-MAN-018`.
- No Linux mutation, post-sign byte delta, final-origin claim, or aggregate
  verdict occurs.

## Verification

Run on the authorized Windows host:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run verify:local-whisper:qualification:windows
rtk npm run verify:local-whisper:downgrade -- --platform=win32
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run verify:installers -- --platform=win32
rtk git diff --check
```

Registered command:

```bash
rtk npm run verify:local-whisper:qualification:windows
```

## Failure And Rollback

- Preserve truthful failures and private evidence; clean only exact task-owned
  staging/processes/allocations.
- A candidate or production defect requires a new Task 28 generation and
  invalidates affected branches. A Windows harness defect may be fixed only
  before affected evidence freezes.
- A changed PR head/base, version/changelog/manual registry, preparation digest,
  or newly existing tag returns to Task 30 and invalidates both platform
  branches rather than rebinding them.
- Never relax thresholds, substitute Linux/mocks, or rewrite Task 29.

## Manual Gates

- Authorized Windows CPU/RTX 5090 host, exact tools, public model/corpus access,
  private evidence storage, unchanged open release PR/preparation, absent final
  tag, and candidate generation confirmation.
- Determine the predecessor at the Task 29 UTC cutoff; if unchanged, use
  `GPT-Voice.Setup.2.3.0.exe` SHA-256
  `0e2aa1ea97ba357db6d35f53debd01ca1c6124ae10b9f537b2af4427a0328cd0`.
- Commit, push, PR, GitHub Release upload/publication, support promotion, tag,
  and release remain separately authorized.

## References

- Specification revision 20 Sections 9.6, 12.1–12.5, 18.3–18.5, 19.1–19.3,
  and 22.
- Tasks 24, 25, 27, 31, 30, 28, and 29 handoffs and Windows evidence template.

## Completion And Handoff

Mark Task 21 complete only when its immutable privacy-safe Windows branch
passes and names the exact signed generation. Update `todo.md` and `handoff.md`,
then stop before commit, Task 22, release PR merge, tag, upload, publication, or
release.
