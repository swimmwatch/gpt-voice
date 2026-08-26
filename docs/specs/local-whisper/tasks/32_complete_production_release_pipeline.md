# 32 Complete Production Release Pipeline

## Outcome

Implement and verify the complete production Local Whisper release pipeline so
one frozen source revision can construct, authenticate, and inventory every
Linux and Windows application/runtime byte required by specification revision 26. Prove the real production builders can generate the complete physical
candidate in protected nonpublishing runs. Create no release branch, version
commit, tag, GitHub Release, public asset, deployment digest, platform-smoke
result, or support claim. Preserve and regression-test the explicit default-off
publication path that the next packet will use.

## Prerequisites

- Specification revision 26 and plan revision 34 are approved.
- Tasks 01–20 and 23–25 remain complete; Task 26 remains deferred and
  non-executable.
- Task 27 commits `429aadf3` and `1a672e61`, plus verified partial former-Task
  32 release-policy work, are inputs only and are not construction evidence.
- Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- The baseline release workflow's disabled Local Whisper preparation and
  application-only uploads are implementation gaps addressed by this packet;
  static validators still do not substitute for protected nonpublishing
  construction of the complete candidate.

## Owned Requirements

- Implementation slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`,
  `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`,
  `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`,
  `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, and
  `OPS-003`–`OPS-004` needed to construct and verify candidates without
  publishing them.
- Primary `AC-AUTO-073`, `AC-AUTO-080`, and `AC-AUTO-083`–`AC-AUTO-090`;
  supporting implementation of the shared `AC-AUTO-082` and
  `AC-AUTO-091` validators without instantiating release or smoke evidence.
- Plan/acceptance-owner migration to specification 26, plan 34, Tasks 32–36,
  public-before-smoke ordering, parallel platform tests, and the conditional
  final path.

## In Scope

- Close exact official Linux/Windows compiler, SDK, CUDA 12.8.1, packaging,
  inspection, network-probe, Node/Electron, provenance, component, signature,
  and license acquisition records for every active production profile.
- Preserve the reviewed acquisition-only XZ decoder and project-owned
  GZIP/XZ/TAR/ZIP materializers; introduce no application dependency or
  ambient archive/toolchain authority.
- Prove network-denied Linux and Windows configure/build/test/inspection/pack
  phases, including separation of the Linux CUDA toolkit driver stub from the
  physical host `libcuda.so.1`.
- Implement one source-of-truth target-aware pipeline that constructs the full
  physical inventory represented by the six logical output classes:
  1. Linux x64 application packages: `AppImage`, `deb`, and `rpm`;
  2. Windows x64 application package: NSIS installer;
  3. Linux x64 CPU `restricted-tar-gzip-v1` runtime archive;
  4. Windows x64 CPU `restricted-tar-gzip-v1` runtime archive;
  5. Linux x64 RTX 50 `sm_120a-real` runtime archive;
  6. Windows x64 RTX 50 `sm_120a-real` runtime archive.
- Construct the production catalogs and public keyring material, every
  required detached/native signature, checksum set, signed release manifest,
  SBOM, notice, provenance record, and compatibility record needed to install,
  authenticate, and final-origin verify that inventory.
- Repeat every runtime build in independent clean roots and require identical
  source/installed-file manifests, archive length/SHA-256, metadata, and
  signature-input digest. Preserve application reproducibility and native
  signing boundaries required by the platform builders.
- Replace disabled Local Whisper release preparation with fail-closed
  production-purpose collection for protected candidate jobs while keeping
  pull-request/main validation read-only and non-production-trust-only.
- Add exact physical-inventory generation and verification. Reject missing,
  extra, duplicate, synthetic, qualification-purpose, disabled, cross-tag,
  cross-platform, cross-target, unsigned, unbound, or mismatched assets before
  candidate admission.
- Complete schemas and deterministic validators for candidate, staging,
  deployment, platform-smoke, aggregate, final lineage, non-clobbering retry,
  and final-origin verification. Do not create any version-specific instance.
- Migrate the task registry, acceptance-owner manifest, readiness verifier,
  lifecycle policy, package commands, and focused tests to the five current
  packet paths and specification/plan revisions.
- Run protected, nonpublishing Linux and Windows candidate construction as
  separately authorized manual gates and verify the produced bytes against
  the exact inventory. Ephemeral CI artifacts are evidence only and never an
  installation origin or substitute for Task 33 publication.
- Preserve one publication job that depends on the verified complete candidate,
  is disabled by default, requires an explicit matching release tag, alone owns
  `contents: write`, rejects an existing tag/release, and publishes that exact
  candidate when Task 33 explicitly enables it. Add regression failures for a
  missing gate, default-enabled publication, bypassed verification, alternate
  release trigger, candidate-job write authority, or clobbering.

## Out Of Scope

- Changing `package.json` to `2.4.0-alpha.1`, preparing a release branch or
  changelog, preserving a release head through merge, creating a tag, staging
  a GitHub Release, enabling or invoking the publication gate,
  uploading/publishing assets, or sealing release candidate,
  staging, deployment, smoke, aggregate, or final-lineage digests for a real
  version.
- Physical Linux/Windows installation, model download, transcription, offline
  reuse, cleanup, feedback selection, or support promotion.
- Alpha.2 or later, final release execution, RTX 30/40, AMD promotion, macOS,
  renderer/IPC product behavior, dependency additions, or weakened trust,
  privacy, packaging, and compatibility rules.
- Copying the six pinned Hugging Face model objects into a GPT-Voice release.

## Task Contract

The pipeline has one construction graph shared by validation and protected
release execution. Pull-request/main jobs may build with non-production trust
but remain read-only, secret-free, and nonpublishable. Protected candidate
jobs use reviewed production inputs/signers, revalidate the frozen source, and
stop after a fully verified private candidate; they cannot create or mutate a
branch, tag, release, or public asset.

That nonexecution boundary limits Task 32's invocation and authority; it does
not authorize removal of the Task 33 capability. The shared protected workflow
keeps publication false by default and candidate jobs read-only. Exactly one
publication job remains present behind an explicit boolean gate and consumes
only the verified complete candidate plus a matching release tag.

Provisioning accepts only manifest-named objects from exact reviewed origins.
Before configure, the controller closes the proven operating-system network
boundary and supplies explicit verified paths. Missing or unverifiable input
remains `Pending`; ambient tools, package managers, mirrors, moving URLs,
observed replacement hashes, and physical drivers cannot substitute.

Base installers contain only approved app integration and the two app-owned
native helper roles. Inference workers, runtime packs, models, CUDA libraries,
development activation, and qualification trust remain outside. CUDA packs
contain real `sm_120a` generated code and the reviewed CUDA 12.8.1 user-space
closure, with no PTX, `sm_86`, `sm_89`, toolkit driver stub, or host driver.

The signed manifest is the canonical physical inventory. Logical class counts,
workflow/job names, static policy checks, synthetic metadata, and qualification
packs cannot prove construction. Secrets, private signing material, and private
host evidence never enter logs, repository files, public artifacts, or
untrusted jobs.

## Contracts And Boundaries

- Task 32 owns reusable construction and verification, not any release
  identity or external promotion. It must preserve the guarded publication
  capability while leaving it disabled. Task 33 consumes the reviewed pipeline
  and is the first packet permitted to enable that capability.
- Task 33 remains the sole alpha.1 Build + Deploy owner; Tasks 34 and 35 can
  consume only its public same-tag assets; Task 36 owns final.
- Production catalogs accept only same-tag GitHub Release application/runtime
  assets. The six pinned Hugging Face model objects are the sole external
  installation origins.
- Runtime archives remain separate per platform and target. Application
  packages never embed inference workers or runtime packs.
- No renderer/user input can select an origin, path, executable, environment,
  signer, catalog purpose, or release identity.

## Expected Files Or Components

- Hosted acquisition manifests/schema, verified materializers, closed
  Linux/Windows CPU/CUDA profiles, disconnected executor, and fixtures under
  `runtime/local-whisper/toolchains`, `scripts/local-whisper`, and tests.
- Shared target-aware application/runtime builders and protected
  nonpublishing candidate jobs under `.github/workflows`, using immutable
  action pins and fail-closed least privilege.
- Production-purpose packaging/catalog/keyring/signature/checksum/manifest/
  SBOM/notice/provenance/compatibility producers and exact-inventory verifier.
- Release-evidence schemas/validators for construction, promotion, origin,
  retry, smoke ordering, aggregate, and final lineage.
- `package.json` command registration without dependencies or version changes.
- `tasks/acceptance-owners.json`, its schema,
  `scripts/local-whisper/validate-task-plan.mjs`, readiness verification/tests,
  `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`, and `AC-AUTO-084` prove
  production-equivalent target-aware builders, disconnected deterministic
  runtime construction, immutable inputs, and appropriate read-only/protected
  workflow boundaries.
- Expanded `AC-AUTO-086` accepts exactly the configured Linux AppImage/deb/rpm,
  Windows NSIS, four runtime archives, and every required trust/verification
  asset. It rejects partial, extra, synthetic, qualification-only, disabled,
  unsigned, unbound, or substituted candidates.
- `AC-AUTO-085`, `AC-AUTO-087`, `AC-AUTO-088`, `AC-AUTO-089`, and
  `AC-AUTO-090` prove protected policy, frozen-byte promotion design,
  non-clobbering recovery, closed origins, and final-origin parity without
  executing a publication.
- Protected nonpublishing Linux and Windows runs construct actual application
  packages, runtime archives, and ancillary assets and pass the same exact
  inventory verifier. Static validators alone cannot complete the task.
- Workflow-policy tests prove publication defaults off, candidate jobs remain
  read-only, the publication job cannot bypass exact-candidate verification,
  and removal of the Task 33 publication path fails closed.
- Shared `AC-AUTO-082`/`AC-AUTO-091` validators preserve public-before-smoke,
  independent platform branches, feedback, next-alpha, and final lineage
  without creating evidence for those later states.
- Existing application/native/package/security/type/lint/format/audit/unit/
  production-build checks remain passing.

## Verification

Implement or register target-aware commands where absent:

```bash
rtk npm run test:local-whisper:hosted-toolchains
rtk npm run verify:local-whisper:hosted-toolchains
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run test:local-whisper:release-lifecycle
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run verify:local-whisper:implementation-readiness
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

The separately authorized protected nonpublishing runs execute the same
production Linux and Windows builders and exact-inventory verifier. Do not run
a release/tag/upload command or a physical platform smoke.

## Failure And Rollback

- Missing input, closed profile, isolation proof, hosted platform, signer,
  deterministic output, or complete physical inventory leaves Task 32 pending;
  policy-only success never upgrades it to complete.
- A protected dry-run failure creates no release state. Preserve sanitized
  evidence and clean only validated attempt-owned roots, processes, and
  ephemeral artifacts; never delete shared caches or user data.
- Roll back workflow/profile/catalog/release-policy changes as coherent units.
  Never restore disabled production packaging, ambient discovery, clobbering,
  mutable inputs, or a validator that counts logical classes as physical files.
- No retry may hide a deterministic or concurrency-specific failure.

## Manual Gates

- `MANUAL GATE`: acquire/review exact public toolchain, license, component,
  provenance, catalog, and signer inputs without persisting secrets.
- `MANUAL GATE`: authorize hosted Linux/Windows protected nonpublishing
  candidate construction and private evidence retention.
- Outside an active exact `local-whisper-alpha-release` invocation, every
  commit, push, workflow dispatch, protected-environment access, signing
  operation, repository-setting change, or private runner use requires
  separate authority. The exact six-hour invocation is the sole exception: it
  authorizes this packet's protected nonpublishing completion and may continue
  immediately into Task 33 under `OPS-005`; repository settings, destructive
  history, deploy, and physical platform tests remain forbidden.

## References

- Mandatory: specification revision 26 Sections 9.6, 18.1–18.5, 19.1
  (`AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-091`), and 22.1.
- Mandatory local inputs: completed Task 25 handoff; Task 27 commits
  `429aadf3`/`1a672e61`; current hosted-toolchain, native-build, packaging,
  release-policy, workflow, and task-plan validators.
- Historical context only: superseded plan-31 Task 32; its policy work is an
  input, while its combined implementation/publication boundary is rejected.

## Completion And Handoff

Mark Task 32 complete only after the production pipeline is implemented, all
local checks pass, and separately authorized nonpublishing Linux and Windows
runs have constructed and verified the complete physical candidate. Update
`todo.md` and `handoff.md`. Ordinary incremental execution stops before
version/changelog preparation, release branch work, merge, tag, staging,
upload, publication, platform smoke, feedback, final work, or support
promotion. An already active exact `local-whisper-alpha-release` Watch is the
sole exception: after recording Task 32 success it proceeds directly to Task
33 within the same target and remaining deadline, without a second approval.
