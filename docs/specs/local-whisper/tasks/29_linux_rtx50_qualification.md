# Task 29: Linux RTX 50 Qualification

## Outcome

On an authorized Linux x64 CPU/RTX 50 host, consume the exact Task 28 signed
Linux application and CPU/`sm_120a-real` runtime candidates, freeze the shared
candidate plus Linux platform/profile graph, execute all-six-model technical
qualification, and seal only the privacy-safe Linux branch for Task 21.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- Tasks 25, 27, 31, 30, and 28 are complete and committed or otherwise
  immutable as required by their handoffs; the Task 30 release preparation and
  Task 28 signed generation are read-only.
- The `release/v2.4.0` pull request remains open, current with `main`, and
  unchanged at the exact Task 28 head; the final tag does not exist.
- Task 20 advisory preparation is revalidated against the final Task 28 source
  and candidate identities; its prior observations are not evidence.
- The Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized Linux x64 CPU/RTX 50 host, exact pinned tools, public model and
  corpus access, private raw-evidence storage, and separate execution
  authorization are available.

## Owned Requirements

- Linux evidence for `REL-001`, `COMP-012`, `MODEL-011`, `QUAL-001`–`QUAL-005`,
  `PRIV-005`–`PRIV-006`, and Linux slices of `OPS-003`–`OPS-004`.
- Supporting Linux `AC-AUTO-064`–`AC-AUTO-070`, `AC-AUTO-072`–`AC-AUTO-082`,
  and `AC-AUTO-087`; primary ownership stays with registered implementation or
  aggregate tasks.
- Linux `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`,
  `AC-MAN-013`, `AC-MAN-017`, and Linux inputs for `AC-MAN-014`.

## In Scope

- Freeze `candidateInputDigest` over explicit SemVer/UTC/source, exact release
  PR head/base and Task 30 preparation/version/manual-registry digests, shared
  locks, schemas, trust/transport policies, exact models/corpus, Task 17
  identity, required matrix, and predecessor rule.
- Freeze Linux `platformInputDigest` over the final signed application
  candidate, embedded production catalog/keyring/origin, distinct marked
  qualification package/loopback identity, exact CPU/CUDA packs and signatures,
  release-manifest entry, toolchains, direct engines, notices/SBOM/provenance,
  and predecessor.
- Freeze CPU and RTX 50 profiles and `platformGraphDigest` before measurement;
  seal series, result, and evidence index afterward.
- Use the qualification package and single-use `127.0.0.1` HTTPS origin to test
  exact runtime bytes before publication, and separately verify the final
  signed production installer's native signature, package/install behavior,
  embedded production trust, exact runtime compatibility, and inference with
  that runtime installed.
- Qualify all six canonical models on CPU and the representative RTX 50 device,
  including transport, FLEURS/direct parity, performance, resource, lifecycle,
  cancellation, crash, privacy, offline, cleanup, package, and predecessor
  gates.
- Adopt only sanitized checksum-linked Linux evidence; keep raw machine
  evidence private.

## Out Of Scope

- Mutating Task 28 candidates, repairing production source after freeze,
  creating a Windows branch, or sealing the aggregate root.
- Updating or merging the release pull request, creating/moving the tag, or
  accepting a changed release branch/base/preparation identity.
- Final GitHub Release upload/origin verification, publication, support
  promotion, tag, push, PR, or release.
- RTX 30/40, AMD promotion, or macOS execution.

## Task Contract

The identity graph follows specification Section 9.6 exactly and binds the
unchanged release pull-request head and Task 30 preparation digest. Reject cycles,
placeholders, backward/missing edges, mixed generations, different signed
bytes, duplicate profiles, private fields, or noncanonical documents. A source
or preparation defect returns to Task 30 and creates a new Task 28 generation;
a Linux-only harness
defect may be fixed only before any affected evidence is frozen.

Every model passes load, warm-up, direct-engine parity within 1.00 absolute WER
percentage point, owned-resource measurement, unload, and recovery on CPU and
`sm_120a`. `base/full` also passes median RTF `<= 1.0` over the five frozen
60-second fixtures. CPU initializes no GPU; CUDA proves the selected physical
device and no fallback.

Sample at 100 ms using PSS/NVML; gaps over 500 ms, missing permission,
ambiguous ownership, or sampler failure invalidate rather than estimate.
Apply the frozen rounding, tolerance, repetition, leak, and settlement rules.
Run cancellation, crash/reload, repeated load/unload and transcription,
provider switching, suspend/resume, exit, offline reuse, package identity, and
exact cleanup gates.

## Contracts And Boundaries

- Task 29 owns the shared candidate and Linux branch. Task 21 consumes both
  unchanged and cannot rewrite them.
- Task 29 posts only the bounded Linux result/evidence identity required by the
  release PR gate; it cannot merge the PR or create the final tag.
- Qualification-purpose and production-purpose packages remain disjoint. Both
  bind the exact Task 28 runtime candidates; neither creates a user installation
  origin before Task 22.
- Raw host paths, identifiers, environment, audio, transcripts, keys, and
  measurements never enter repository evidence.
- RTX 30/40 are excluded rather than Pending.

## Expected Files Or Components

- Existing qualification schemas/runners, Linux package/runtime/model/corpus/
  direct-engine producers, samplers, loopback transport, lifecycle/privacy/
  offline/predecessor runners, and focused tests.
- Privacy-safe frozen Linux evidence only after successful audit.
- `todo.md` and `handoff.md` with sanitized identities.

## Acceptance Criteria

- One acyclic shared/Linux graph names the exact Task 30 preparation, release
  PR head, Task 28 signed candidates, and complete Linux profile set.
- Runtime builds and candidate digests match Task 28 exactly; no rebuild,
  re-sign, timestamp, package, catalog, or metadata delta is accepted.
- All CPU/RTX 50 model, transport, package, resource, lifecycle, privacy,
  offline, cleanup, and predecessor rows pass, including `AC-MAN-017`.
- Linux evidence is immutable, schema-valid, privacy-safe, and consumable by
  Task 21; no Windows or aggregate identity exists.

## Verification

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
rtk git diff --check
```

Registered command:

```bash
rtk npm run verify:local-whisper:qualification:linux
```

## Failure And Rollback

- Preserve truthful failures and exact private roots; clean only proven
  task-owned staging and owned processes/allocations.
- Missing host/tool/model/corpus/predecessor evidence is `Pending` and blocks
  Task 29. Never relax thresholds, mix generations, omit models, or fabricate
  evidence.
- Candidate/source defects return to a new Task 28 generation and invalidate
  the Linux attempt; never patch frozen bytes.
- A changed PR head/base, version/changelog/manual registry, preparation digest,
  or newly existing tag returns to Task 30 and invalidates the attempt before
  hardware execution.

## Manual Gates

- Authorized Linux CPU/RTX 50 host, pinned tools, public model/corpus network,
  private raw evidence, unchanged open release PR/preparation, candidate
  `2.4.0` confirmation, absent final tag, and fresh UTC cutoff.
- Determine the highest stable predecessor before freeze; if unchanged from
  the approved baseline, use `GPT-Voice-2.3.0.AppImage` with SHA-256
  `80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111`.
- Commit, push, PR, Windows execution, GitHub Release upload/publication,
  support promotion, tag, and release require separate authorization.

## References

- Specification revision 20 Sections 9.2, 9.6, 12.1–12.5, 18.3–18.5,
  19.1–19.3, and 22.
- Tasks 20, 25, 27, 31, 30, and 28 handoffs; Task 17 fixture identity; Linux
  evidence template.

## Completion And Handoff

Mark Task 29 complete only when the shared candidate and full Linux branch are
truthful and frozen against Task 28 exact signed candidates. Update `todo.md`
and `handoff.md`, then stop before commit, Task 21, Windows execution, release
PR merge, tag, upload, or publication.
