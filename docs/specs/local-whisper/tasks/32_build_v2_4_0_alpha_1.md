# 32 Build v2.4.0-alpha.1

## Outcome

Complete the one production build system and use it to freeze a signed,
immutable `v2.4.0-alpha.1` candidate generation containing all six Linux and
Windows output classes. Pass every deterministic gate and bounded packaged
Linux/Windows CPU plus RTX 50 smoke required before alpha deployment. Produce
no merge, tag, GitHub Release, publication, final support claim, or final
`v2.4.0` candidate.

## Prerequisites

- Specification revision 21 and plan revision 29 are approved.
- Tasks 01–20 and 23–25 remain complete and unchanged. Task 26 is deferred.
- Task 27's reviewed local materializer/network-boundary baseline exists in
  commits `429aadf3` and `1a672e61`; it is an input, not completed production
  lock or hosted-build evidence.
- No alpha/final candidate, candidate graph, release branch, tag, GitHub
  Release asset, publication, or support promotion exists.
- Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.

## Owned Requirements

- Build slices of `CI-001`, `CI-002`, `CI-003`, `CI-004`, `CI-005`, `CI-006`,
  `CI-007`, `CI-008`, `PKG-002`, `PKG-003`, `PKG-004`, `PKG-009`, `PKG-010`,
  `PKG-011`, `PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-004`, `REL-001`,
  `REL-002`, `REL-003`, `REL-004`, `QUAL-001`, `QUAL-004`, `QUAL-007`,
  `COMP-012`, `COMP-013`, `OPS-003`, and `OPS-004`.
- Primary `AC-AUTO-080`, `AC-AUTO-083`, `AC-AUTO-084`, `AC-AUTO-085`, and
  `AC-AUTO-086`.
- Build portion of `AC-MAN-020`; supporting `AC-MAN-014` without merge, tag, or
  publication.
- Plan/ownership migration to specification revision 21, plan revision 29,
  Tasks 32–35, and `AC-AUTO-091` registration.

## In Scope

- Finish exact official Linux/Windows compiler, SDK, CUDA 12.8.1, packaging,
  inspection, network-probe, Node/Electron, provenance, signature, component,
  and license acquisition records; close every active toolchain/profile hash.
- Reuse the verified `xz-decompress@0.2.3` acquisition-only decoder and strict
  project-owned GZIP/XZ/TAR/ZIP materializers. Do not add an application
  dependency or ambient archive/toolchain authority.
- Prove Windows and Linux network-denied configure/build/test/inspection/pack
  boundaries and the Linux CUDA toolkit driver-stub versus physical
  `libcuda.so.1` separation.
- Add read-only public-runner Linux/Windows preparation and production-
  equivalent builder jobs. Build the Linux and Windows application installers,
  Linux/Windows CPU packs, and Linux/Windows `sm_120a-real` packs; repeat each
  runtime build in independent clean roots and require identical bytes and
  metadata.
- Implement the revision-29 task/acceptance validator and registry. Mark Tasks
  21, 22, and 27–31 superseded, Task 26 deferred, and only Tasks 32–35 active.
- Implement release preparation for exact prerelease identity
  `2.4.0-alpha.1`, branch `release/v2.4.0-alpha.1`, tag
  `v2.4.0-alpha.1`, committed `package.json`/`package-lock.json`/changelog
  consistency, complete manual-check registry, clean head/current `main` base,
  tag absence, and merge-commit-only repository policy verification.
- Remove release-time tracked version mutation and every clobbering, publish-
  triggered rebuild, duplicate YAML key, or second build path from the alpha
  candidate workflow.
- Implement protected reviewer-gated production signing and candidate freeze.
  Natively sign both application candidates, sign all four runtime packs,
  catalogs, and complete release manifest, then bind exact source, preparation,
  filename, role, platform, architecture, target, size, SHA-256, signature,
  compatibility, SBOM, notices, provenance, and expected same-tag origin.
- Freeze an alpha `candidateInputDigest`, platform inputs, bounded CPU/RTX 50
  profiles, platform graphs/results/evidence indexes, and alpha aggregate root
  in the acyclic Section 9.6 order. Every identity must bind specification 21,
  SemVer `2.4.0-alpha.1`, its dedicated head, expected tag, and UTC freeze.
- On representative Linux x64 and Windows x64 RTX 50 hosts, perform bounded
  packaged smoke for both CPU and `sm_120a-real`: clean install, exact runtime
  selection/download, pinned `base/full` model download, compatibility check,
  load/warm-up, one non-private deterministic transcription, unload, offline
  restart/reuse, cleanup, signature/origin/no-fallback/no-orphan/privacy proof.

## Out Of Scope

- Merging the alpha release pull request, creating/moving the alpha tag,
  creating or updating a GitHub Release, uploading, final-origin deployment
  verification, publication, or release; these belong to Task 33 manual gates.
- Final `v2.4.0` source selection, candidate generation, full all-six-model
  qualification, stable publication, or Production support promotion.
- Reusing a validation-CI installer as an installation origin, publishing a
  qualification-purpose package, or copying Hugging Face model bytes into the
  release.
- RTX 30/40 delivery, AMD promotion, macOS execution, renderer/IPC product
  changes, or weakening any existing security/privacy/package contract.

## Task Contract

The alpha Build has two phases. Provisioning may acquire only manifest-named
objects from exact reviewed origins. Before the first configure, the controller
closes the proven OS network boundary and supplies only verified explicit
paths. Configure, compile, test, dependency inspection, application packaging,
runtime assembly, metadata generation, and reproducibility comparison stay in
that boundary. Missing or unverifiable input remains `Pending`; no ambient
runner tool, package manager, mirror, moving URL, observed replacement hash, or
physical driver may substitute.

The six output classes are exactly:

1. Linux x64 application installer;
2. Windows x64 application installer;
3. Linux x64 CPU runtime pack;
4. Windows x64 CPU runtime pack;
5. Linux x64 RTX 50 `sm_120a-real` runtime pack;
6. Windows x64 RTX 50 `sm_120a-real` runtime pack.

Application installers contain only the two approved app-owned native helpers,
not inference workers, CUDA libraries, runtime packs, models, development
activation, or qualification trust. CUDA packs contain only exact real
`sm_120a` generated code and reviewed user-space closure; they exclude PTX,
`sm_86`, `sm_89`, other targets, toolkit driver stubs, and host drivers. Every
runtime pack carries deterministic archive bytes, expected-file manifest,
SBOM, notices, provenance, compatibility metadata, and signature-input digest.

Ordinary PR/main builders are read-only, non-production, upload no installable
bytes, receive no production secret, and claim no hardware result. The
protected alpha candidate workflow consumes the same builder implementation
only after independently revalidating the exact release-PR head, preparation
digest, committed prerelease version, expected tag absence, manual registry,
legal/provenance inputs, and protected reviewers. Secret values and private
host evidence never enter logs or repository artifacts.

Native signing happens before candidate freeze. After freeze, any source,
base, preparation, script, catalog, metadata, signature, timestamp, or byte
change invalidates the generation and requires a fresh Build. The expected tag
is metadata only and remains absent. A CI artifact may transport protected
candidate bytes to bounded physical smoke but is not an installation origin.

The alpha evidence graph is complete only for its bounded smoke profiles. It
must not be presented as the final all-six-model performance/resource/
repetition qualification or a Production support verdict. Linux and Windows
evidence remain independent, private raw evidence remains outside the
repository, and only privacy-safe checksum-linked results may enter the graph.

## Contracts And Boundaries

- Task 32 owns candidate creation and evaluation. Task 33 consumes its exact
  head, bytes, signatures, graphs, and aggregate root read-only.
- The alpha branch/tag/version identity cannot appear in final evidence. Task
  34 must create a new generation even when inputs are unchanged.
- Production catalogs point only to exact same-tag GitHub Release asset URLs;
  pinned Hugging Face objects are the sole model-origin exception.
- Signing keys, tokens, raw hardware identifiers, paths, environment dumps,
  audio, transcripts, prompts, and private measurements are never committed or
  exposed through CI output.
- Build completion creates no end-user installation origin and grants no
  Deploy authority.

## Expected Files Or Components

- Hosted acquisition manifests/schema, materializers, closed Linux/Windows
  CPU/CUDA profiles, disconnected executor, and focused fixtures under
  `runtime/local-whisper/toolchains`, `scripts/local-whisper`, and tests.
- Read-only hosted preparation/build workflows and protected release-candidate
  workflow under `.github/workflows` with full-commit action pins.
- Shared six-output orchestration, release preparation/version identity,
  changelog/manual-registry validation, signing/candidate/release-manifest
  producers, qualification graph validators, and policy tests.
- `package.json` command registration without dependency additions or tracked
  release-version mutation.
- `tasks/acceptance-owners.json`, its schema,
  `scripts/local-whisper/validate-task-plan.mjs`, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-080`, `AC-AUTO-083`, and `AC-AUTO-084` prove all six hosted output
  classes, exact `sm_120a-real` closure, read-only authority, independent clean
  reproducibility, expected contents, and rejection of ambient/networked/
  cross-platform/cross-target inputs.
- `AC-AUTO-085` admits exact prerelease SemVer/branch/tag preparation and
  rejects dirty/stale/mismatched/incomplete versions, changelog, registry,
  script, base/head, tag, permissions, or merge policy.
- `AC-AUTO-086` admits exactly one complete same-tag six-output alpha set and
  rejects missing, extra, duplicate, renamed, cross-tag, cross-platform,
  wrong-size/hash/signature/compatibility objects.
- Both platform bounded smokes satisfy the build portion of `AC-MAN-020` with
  exact signed packaged candidates and no fallback, private-data disclosure,
  orphan, wrong origin, or Production claim.
- The alpha graph is canonical, acyclic, specification-21-bound, and usable by
  Task 33 without regeneration; the release PR stays open and unchanged, and
  the tag/GitHub Release remain absent.
- Existing Local Whisper, native, packaging, security, type, lint, format,
  dependency-audit, unit, and production-build checks remain passing.

## Verification

Implement and register any not-yet-existing target-aware commands below before
claiming completion:

```bash
rtk npm run test:local-whisper:hosted-toolchains
rtk npm run verify:local-whisper:hosted-toolchains
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:build -- --target=v2.4.0-alpha.1
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:alpha -- --platform=linux
rtk npm run verify:local-whisper:qualification:alpha -- --platform=win32
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Registered ownership commands:

```bash
rtk npm run test:local-whisper:hosted-toolchains
rtk npm run verify:local-whisper:hosted-toolchains
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:build -- --target=v2.4.0-alpha.1
```

## Failure And Rollback

- Missing official input, profile closure, isolation proof, hosted platform,
  deterministic output, legal/signing authority, physical host, bounded smoke
  result, or exact identity blocks Task 32. It never authorizes a smaller
  matrix, unsigned candidate, ambient tool, synthetic hash, or skipped smoke.
- A post-freeze defect creates a new alpha generation. Never patch, overwrite,
  re-sign, retimestamp, repackage, or rebind frozen candidates or evidence.
- Preserve truthful sanitized failure digests and private raw evidence. Clean
  only proven attempt-owned roots/processes/allocations; never broadly delete
  shared caches or user data.
- Roll back workflow, manifest, profile, orchestration, preparation, and
  candidate-policy changes as coherent boundaries; do not restore clobbering,
  tracked version mutation, ambient discovery, or publish-triggered rebuilds.

## Manual Gates

- `MANUAL GATE`: network research/acquisition of exact public build inputs and
  licenses/provenance; no credentials or mirrors are implied.
- `MANUAL GATE`: immutable commit/push/PR or approved-main source before public
  hosted preparation/build rows; planning or packet approval does not grant it.
- `MANUAL GATE`: repository merge-setting verification/change, creation and
  committed preparation of `release/v2.4.0-alpha.1`, version/changelog/manual
  review, push, and release-PR creation/update.
- `MANUAL GATE`: protected reviewers, Windows/Linux signing authority, legal/
  redistribution/SBOM/notice/provenance approval, and actual candidate run.
- `MANUAL GATE`: authorized Linux RTX 50 and Windows RTX 5090 hosts, public
  pinned model access, private evidence storage, and bounded packaged smoke.
- Commit, push, merge, tag, GitHub Release creation/upload/publication, support
  promotion, and release require separate explicit authority. Task 32 may not
  execute Task 33 actions.

## References

- Mandatory: specification revision 21 Sections 9.6, 18.1–18.5, 19.1
  (`AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-086`), `AC-MAN-020`, and 22.1.
- Mandatory local inputs: completed Task 25 handoff and Task 27 commits
  `429aadf3`/`1a672e61`; existing hosted-toolchain, native-build, packaging,
  release, qualification, and task-plan validators.
- Historical context only: superseded Tasks 27, 31, 30, and 28.

## Completion And Handoff

After all deterministic checks, both hosted platform rows, protected candidate
freeze, and bounded physical smokes pass, update `todo.md` and `handoff.md` with
the exact privacy-safe alpha preparation, head, candidate, manifest, platform,
and aggregate digests plus blockers. Stop before commit or every Task 33 merge,
tag, GitHub Release, upload, final-origin, publication, support, or release
action. A later explicit incremental-implementation invocation is required.
