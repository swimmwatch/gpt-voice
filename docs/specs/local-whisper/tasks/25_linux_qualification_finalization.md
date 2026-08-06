# Task 25: Linux Qualification Finalization

## Outcome

After Task 20's advisory Linux preflight and Task 24's final committed Windows
delivery source, freeze one fresh shared candidate and execute authoritative
Linux x64 CPU and available NVIDIA CUDA technical qualification for all six
canonical models. Seal only the Linux platform input/profile/graph/result/
evidence branch; create no Windows identity or aggregate root.

## Prerequisites

- Specification revision 15 and plan revision 21 are approved.
- Tasks 19, 23, and 24 are complete, reviewed, and committed. Task 24's final
  source is the only source eligible for the shared candidate.
- Task 20 is complete and supplies only advisory preparation results. Recheck
  every source, toolchain, package, runtime, model, corpus, direct-engine, and
  predecessor observation; none may be adopted without revalidation.
- No `candidateInputDigest`, platform branch/result/evidence index,
  predecessor result, or aggregate root is frozen.
- The Task 17 fixture digest is
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized Linux x64 CPU/NVIDIA host, exact pinned toolchains, public
  inputs, private raw-evidence storage, and separate execution authorization
  are available.

## Owned Requirements

- Linux platform evidence for `REL-001`, `COMP-012`, `MODEL-011`,
  `QUAL-001`–`QUAL-004`, `PRIV-005`, and the Linux technical slice of
  `OPS-003`.
- Supporting Linux evidence for `AC-AUTO-064`–`AC-AUTO-070` and
  `AC-AUTO-072`–`AC-AUTO-077`; primary automated ownership remains with its
  existing implementation packets.
- Linux `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and
  `AC-MAN-013`, plus Linux technical inputs for `AC-MAN-014`. Consume but do
  not replace `AC-MAN-015`–`AC-MAN-016`.
- No Windows qualification, aggregate verdict, production authority, upload,
  signing, publication, or support promotion.

## In Scope

- Revalidate Task 20 preparation against the final clean committed source, then
  freeze `candidateInputDigest` over SemVer `2.4.0`, one UTC cutoff, source,
  patches, schemas, trust/transfer/redirect/algorithm revisions, all six exact
  models, FLEURS/performance fixtures, required matrix, Task 17 digest, and
  predecessor-selection rule.
- Build exact Linux CPU/CUDA runtime packs twice in independent clean
  network-denied roots; require identical archives, manifests, signature
  inputs, provenance, SBOM, and notices. Verify/materialize exact model and
  FLEURS bytes and direct-engine binaries.
- Build AppImage, DEB, and RPM qualification candidates; freeze Linux
  `platformInputDigest`, CPU/CUDA profiles, then `platformGraphDigest` before
  measuring. Seal series, result, and evidence index only afterward.
- Execute all six-model CPU/CUDA transport, application/direct-engine parity,
  performance, resource, lifecycle, offline, cancellation, crash, cleanup,
  privacy, exact-file-guard, package, and predecessor gates.
- Audit and adopt only sanitized checksum-linked Linux evidence; preserve raw
  machine evidence privately.

## Out Of Scope

- Production implementation correction. A defect requires a separately planned
  correction and invalidates this candidate before qualification restarts.
- Windows packages, runtime/direct-engine/toolchain identities, representative
  Windows execution, Task 21 qualification, or Task 22 aggregation.
- Production signing/legal/upload/publication authority, AMD promotion, macOS
  execution, push, PR, tag, or release.

## Task Contract

### Fresh shared candidate and Linux branch

The shared candidate is frozen only after Tasks 19, 20, 23, and 24's final
clean committed source exists. It contains no platform package/runtime/direct-
engine/toolchain, profile, result, evidence-index, platform-graph, or aggregate
digest. The Linux platform input binds exact Linux application packages,
qualification catalog/keyring/origin, CPU/CUDA runtime archives, toolchains,
direct engines, qualification server, notices/SBOM/provenance, and the
predecessor selected at the shared cutoff.

Profiles bind only shared/Linux input digests and frozen methods, hardware
class, tools, algorithms, repetitions, units, tolerances, and bounds. The graph
binds the complete sorted profile set. Series/result/index bind only earlier
layers. Reject cycles, placeholders, backward/missing edges, mixed candidates,
duplicates, private fields, and noncanonical bytes. The interrupted earlier
Linux run and Task 20 preflight are diagnostic only.

### Trust, matrix, packages, and privacy

Use an isolated temporary qualification key and a `127.0.0.1` HTTPS origin for
only frozen runtime objects. Exercise one exact public Hugging Face transfer
through the approved anonymous redirect policy, including fresh CDN URL,
resume, cancellation, range/validator behavior, privacy, and whole-object
verification. No token, cookie, private header, moving revision, mirror, or
fallback is allowed.

Every canonical model passes load, bounded warm-up, FLEURS/direct-engine parity
within 1.00 absolute WER percentage point, owned-resource measurement, unload,
and recovery on CPU and available NVIDIA CUDA. `base/full` also passes median
RTF `<= 1.0` over five exact 60-second fixtures. CPU proves no GPU
initialization; CUDA proves the exact selected device and owned VRAM. Sample at
100 ms using PSS/NVML; missing permission, ambiguous ownership, a gap over
500 ms, or sampler failure invalidates rather than estimates. Apply upward
64-MiB rounding, frozen tolerances/repetitions/leak trend, and ten-second/
ten-zero-sample settlement.

Run cancellation, crash/reload, 10 load/unload cycles, 20 sequential
transcriptions, provider switch, suspend/resume, app exit, offline restart,
and exact cleanup. Validate AppImage, DEB, and RPM identities, ASAR/resources,
native-helper/runtime closure, qualification marking, release-collection
rejection, and the selected predecessor. Repository evidence excludes raw host
paths/identities, environment, audio, transcripts, keys, and measurements.

## Contracts And Boundaries

- Task 25 owns the shared candidate and Linux branch only. Task 21 consumes
  them unchanged and cannot mutate them.
- Task 20 preparation is reusable only after final-source revalidation; it is
  never a qualification identity or substitute for any required row.
- Platform, hardware, deterministic, privacy, legal, and publication evidence
  are non-substitutable. No production trust authority is created.

## Expected Files Or Components

- Linux qualification orchestration, package/runtime/model/corpus/direct-engine
  producers, resource sampler, loopback server, transport, lifecycle, privacy,
  offline, and predecessor runners under `scripts/local-whisper/qualification/`.
- Corrected qualification schemas/canonical graph-result producers; focused
  tests; privacy-safe frozen Linux artifacts only after the successful audit.
- Updated `todo.md` and `handoff.md` with sanitized immutable identities.

## Acceptance Criteria

- One fresh acyclic shared/Linux graph is frozen from Task 24's final committed
  implementation identity, and Task 20 preflight observations are revalidated.
- Two clean network-denied CPU/CUDA runtime builds are byte-identical; all
  model/corpus/direct-engine/package inputs match frozen identities.
- All six CPU/CUDA rows and every transport/resource/lifecycle/offline/privacy/
  cleanup/predecessor gate pass, or Task 25 remains incomplete with a precise
  failure.
- Linux evidence is privacy-safe, schema-valid, checksum-linked, immutable, and
  consumable unchanged by Task 21; no Windows identity exists.

## Verification

Run on the authorized Linux x64 host only:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:composition:activation
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
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

The registered Task 25 command is:

```bash
rtk npm run verify:local-whisper:qualification:linux
```

Do not invoke the Windows qualification command or
`verify:local-whisper:all` in this packet.

## Failure And Rollback

- Preserve truthful failed evidence and exact private roots for diagnosis. Clean
  only proven task-owned staging and owned processes/allocations.
- A production defect invalidates the candidate and returns to a separately
  planned correction. A Linux-only harness defect remains Task 25 work.
- Missing host/tool/artifact/model/corpus/predecessor evidence is `Pending` and
  blocks Task 25. Never relax thresholds, mix runs, omit models, or fabricate
  sanitized evidence after observing results.

## Manual Gates

- Authorized Linux x64 CPU/NVIDIA host, exact pinned toolchains, public model
  and corpus access, candidate SemVer `2.4.0`, fresh UTC cutoff, and private raw
  evidence storage.
- `AC-MAN-001`, Linux `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and Linux
  `AC-MAN-013` execution.
- Commit, push, PR, production signing, legal approval, upload, publication,
  tag, support promotion, and release remain outside this packet.

## References

- Specification revision 15 Sections 9.2, 9.6, 12.1–12.5, 18.3, 19.1–19.3,
  and 22.
- Task 20 advisory preflight, Tasks 19/23/24 final committed handoffs, Task 17
  fixture identity, versioned qualification schemas, and Linux evidence template.

## Completion And Handoff

Mark Task 25 complete only when `candidateInputDigest`, Linux
`platformInputDigest`, complete profiles, `platformGraphDigest`, result, and
evidence-index digest are truthful and frozen, every required Linux row passes,
and no Windows branch or aggregate root exists. Update `todo.md` and
`handoff.md` with sanitized SemVer/UTC/source/package/catalog/runtime/model/
corpus/direct-engine/toolchain/predecessor/graph/result/index identities.

Stop before Task 21, commit, push, PR, production signing, upload, publication,
tag, support promotion, or release unless separately authorized.
