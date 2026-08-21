# 34 Build v2.4.0

## Outcome

After the public alpha is final-origin verified and any alpha feedback fixes are
reviewed, freeze a distinct `v2.4.0` release head, freshly rebuild and sign all
six Linux/Windows outputs, run the complete all-six-model CPU/RTX 50 Linux and
Windows qualification contract, and seal new final platform branches and an
aggregate root. Reuse no alpha candidate or evidence as final evidence, and
perform no final merge, tag, upload, publication, or release.

## Prerequisites

- Specification revision 21 and plan revision 29 are approved.
- Task 33 is complete: public `v2.4.0-alpha.1` is immutable, marked prerelease,
  final-origin verified, and independently preserved.
- Alpha feedback has been triaged. Any accepted change is implemented,
  reviewed, verified, committed, and included in the intended final source
  before candidate freeze. No uncommitted or unreviewed fix enters Build.
- Task 32's immutable acquisition, disconnected builder, release-preparation,
  signing, candidate, and evidence tooling is the sole build implementation.
- Representative Linux RTX 50 and Windows RTX 5090 hosts, exact pinned tools,
  public model/corpus access, private evidence storage, and external authorities
  remain manual gates.

## Owned Requirements

- Final-build slices of `CI-001`, `CI-002`, `CI-003`, `CI-004`, `CI-005`,
  `CI-006`, `CI-007`, `CI-008`, `PKG-002`, `PKG-003`, `PKG-004`, `PKG-009`,
  `PKG-010`, `PKG-011`, `PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `REL-001`,
  `REL-002`, `REL-003`, `REL-004`, `QUAL-001`, `QUAL-002`, `QUAL-003`,
  `QUAL-004`, `QUAL-005`, `QUAL-006`, `QUAL-007`, `MODEL-011`, `PRIV-005`,
  `PRIV-006`, `COMP-012`, `COMP-013`, `OPS-003`, and `OPS-004`.
- Primary `AC-AUTO-082`; supporting reruns of Task 32-primary
  `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-086` for the final generation.
- `AC-MAN-017`, `AC-MAN-018`, and the Build portion of `AC-MAN-021`;
  supporting final inputs for `AC-MAN-014` and `AC-MAN-019`.

## In Scope

- Revalidate every immutable hosted input, closed profile, materializer,
  disconnected boundary, six-output builder, release-preparation rule, manual
  registry, signing policy, candidate schema, and workflow action pin used by
  Task 32. A changed dependency requires reviewed lock/provenance updates before
  final freeze; ambient substitution is forbidden.
- Create/validate exact final identity: committed SemVer `2.4.0`, branch
  `release/v2.4.0`, tag `v2.4.0`, package-lock/changelog/catalog compatibility,
  clean exact head/current `main` base, complete manual registry, and tag
  absence.
- Use protected reviewers and authentic signing/legal/provenance inputs to
  freshly build and natively sign Linux/Windows application installers, sign
  Linux/Windows CPU and `sm_120a-real` runtime packs, catalogs, and one complete
  final release manifest.
- Freeze a new `candidateInputDigest` and new Linux/Windows platform inputs,
  profiles, graphs, results, evidence indexes, and aggregate root in acyclic
  order. Every document binds specification 21, SemVer `2.4.0`, its distinct
  head, expected tag, new UTC freeze, exact new signed bytes, and final matrix.
- On Linux x64, qualify all six canonical model artifacts on CPU and
  representative RTX 50, including public Hugging Face transport, package and
  exact runtime identity, FLEURS/direct-engine parity, performance, resource,
  repetition/leak, lifecycle, cancellation, crash, privacy, offline reuse,
  cleanup, and exact stable predecessor AppImage gates.
- On Windows x64 RTX 5090, consume the unchanged final shared/Linux branch and
  independently qualify all six models on CPU/RTX 50 plus native quality,
  filesystem/reparse safety, inherited model authority, suspended launcher/Job
  Object ownership, installer, PDH resource measurement, lifecycle, privacy,
  offline, cleanup, and exact stable predecessor installer gates.
- Reconcile both fresh platform branches and all signing/legal/provenance/
  manual evidence into a final aggregate pre-merge readiness root without
  merging or creating the tag.

## Out Of Scope

- Reusing, rebinding, renaming, or copying alpha candidates, signatures,
  catalogs, manifests, platform graphs/results/indexes, aggregate root, or tag
  as final evidence.
- Merging the final release PR, creating `v2.4.0`, staging/uploading/publishing
  a GitHub Release, clean final-origin deployment, or support promotion; Task 35
  owns those actions.
- Changing qualification thresholds after observation, omitting a model or
  platform, substituting Linux evidence for Windows, or treating bounded alpha
  smoke as full final qualification.
- RTX 30/40, AMD promotion, macOS execution, or unrelated application work.

## Task Contract

Task 34 reuses only immutable build infrastructure and reviewed source/input
locks from Task 32. It does not reuse alpha output or evidence identities.
Every final application installer and runtime pack is rebuilt from clean roots,
signed for `v2.4.0`, compared to its own repeat build where deterministic, and
bound into a new signed manifest. A final byte identical by coincidence to an
alpha input still receives a new final identity, signature/evidence binding,
and measurement; embedded version/tag identity must match final.

The final release branch is dedicated and current with `main`. Any accepted
alpha feedback fix must precede freeze. A later source, base, version,
changelog, registry, toolchain, catalog, signing, metadata, or candidate change
invalidates the generation and both platform branches. The expected tag remains
absent metadata until Task 35.

Linux owns the final shared candidate input and Linux branch. Windows consumes
that shared digest and immutable Linux branch read-only, adds only its Windows
platform branch, and cannot rebuild or rewrite Linux. The aggregate root
consumes both without changing them. Canonical schemas reject cycles,
placeholders, backward/missing edges, mixed alpha/final identities, duplicate
profiles, incomplete matrices, private fields, or cross-platform substitution.

Each canonical model passes load, warm-up, application/direct parity within
1.00 absolute WER percentage point, resource ownership, unload, and recovery
on CPU and `sm_120a`. `base/full` also passes median RTF `<= 1.0` over five
frozen 60-second fixtures. CPU initializes no GPU; CUDA proves the selected
physical device and no fallback. Sampling remains 100 ms with the frozen
PSS/NVML or Job-owned PrivateUsage/PDH algorithms; gaps over 500 ms or ambiguous
ownership invalidate instead of estimate.

Raw host paths, device identifiers, audio, transcripts, prompts, environment,
keys, and measurement series stay private. Only canonical privacy-safe
checksum-linked result/evidence indexes may enter repository evidence.

## Contracts And Boundaries

- Task 34 owns all final candidate creation and evaluation. Task 35 consumes
  its exact head, bytes, branches, and aggregate root read-only.
- Alpha remains immutable and public; a final failure never mutates, retags, or
  republishes `v2.4.0-alpha.1`.
- Production and qualification trust remain disjoint but bind the same exact
  final runtime candidates. Qualification packages are never publishable.
- The stable predecessor is the highest non-draft, non-prerelease release
  before the final freeze. The alpha itself is not a stable predecessor.
- Build completion authorizes no Deploy action or Production support label.

## Expected Files Or Components

- Reused Task 32 hosted input/build/release-preparation/signing/candidate
  components with target-aware final fixtures and policy tests.
- Final Linux and Windows qualification inputs, profiles, orchestration,
  package/runtime/model/corpus/direct-engine/resource/lifecycle/privacy/offline/
  predecessor checks, canonical platform evidence, and aggregate validator.
- Protected final candidate workflow and read-only qualification workflows.
- `package.json` commands, acceptance ownership, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- Final release preparation binds only `release/v2.4.0`, SemVer `2.4.0`, tag
  `v2.4.0`, a distinct clean head/new UTC freeze, and a freshly signed complete
  six-output set; any alpha identity or stale input is rejected.
- Supporting `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-086` reruns pass against the
  final generation without changing their sole builder/policy implementation.
- `AC-AUTO-082` admits only complete Linux and Windows `sm_120a-real` final
  profiles/results/indexes and rejects missing, substituted, cross-OS,
  cross-target, mixed-generation, `sm_86`, or `sm_89` evidence.
- Full Linux `AC-MAN-017` and Windows `AC-MAN-018` pass for all six models on
  CPU and RTX 50 with exact signed final candidates and no fallback or private
  evidence disclosure.
- The Build portion of `AC-MAN-021` proves alpha feedback fixes were reviewed,
  all final outputs/evidence are fresh, both platform branches and aggregate
  root are complete, and no final merge/tag/upload/publication occurred.
- Existing product, native, package, security, type, lint, format, audit, unit,
  and production-build checks remain passing.

## Verification

Run against exact final inputs and authorized platform hosts:

```bash
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:build -- --target=v2.4.0
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run verify:local-whisper:qualification:linux
rtk npm run verify:local-whisper:downgrade -- --platform=linux
rtk npm run verify:local-whisper:qualification:windows
rtk npm run verify:local-whisper:downgrade -- --platform=win32
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
rtk npm run verify:installers -- --platform=win32
rtk git diff --check
```

Registered ownership commands:

```bash
rtk npm run verify:local-whisper:build -- --target=v2.4.0
rtk npm run verify:local-whisper:qualification:linux
rtk npm run verify:local-whisper:qualification:windows
```

## Failure And Rollback

- Missing reviewed fix, immutable input, signer/legal authority, physical host,
  model/corpus/predecessor evidence, complete platform row, or exact identity is
  `Pending` and blocks Task 34. Never reduce the matrix or relax thresholds.
- Candidate/source defects require a new final generation and invalidate both
  branches. A platform harness defect may be repaired only before its affected
  evidence freezes; it cannot patch candidates or the other platform branch.
- Preserve truthful failures and private evidence. Clean only exact task-owned
  roots/processes/allocations; never mutate the published alpha or user data.
- Rollback of final work leaves `v2.4.0` absent and the alpha unchanged. A
  future retry freezes a new final head/generation.

## Manual Gates

- `MANUAL GATE`: review/accept alpha feedback fixes and separately authorize
  their implementation, commits, pushes, and inclusion in final source.
- `MANUAL GATE`: create and prepare `release/v2.4.0`, commit exact version/
  changelog/manual-registry data, push, open/update release PR, and verify merge
  settings; none is implied by packet approval.
- `MANUAL GATE`: protected reviewers, Windows/Linux signing, legal/
  redistribution/SBOM/notice/provenance approval, and protected candidate run.
- `MANUAL GATE`: authorized Linux RTX 50 and Windows RTX 5090 hosts, exact
  tools, public pinned model/corpus network, private evidence, predecessor
  selection, and full platform qualification execution.
- Commit, push, merge, tag, GitHub Release, upload, publication, support
  promotion, and release remain separately authorized; Task 34 may not execute
  Task 35 actions.

## References

- Mandatory: specification revision 21 Sections 9.6, 18.1–18.5, 19.1–19.3,
  `AC-MAN-017`–`AC-MAN-019`, `AC-MAN-021`, and 22.1.
- Mandatory inputs: Task 33 public-alpha handoff, Task 32 immutable builder/
  preparation/signing contracts, Task 17 fixture identity, and existing Linux/
  Windows qualification schemas and private-evidence templates.
- Historical context only: superseded Tasks 29 and 21.

## Completion And Handoff

Mark Task 34 complete only when a fresh exact final candidate, full immutable
Linux branch, unchanged-shared-input Windows branch, and final aggregate root
truthfully pass with the final tag absent. Update `todo.md` and `handoff.md`
with privacy-safe identities and blockers. Stop before commit or any Task 35
merge, tag, GitHub Release, upload, origin, publication, clean-install, support,
or release action.
