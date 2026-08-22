# 32 Release v2.4.0-alpha.1

## Outcome

Complete one target-aware production release implementation and use it to
build, sign, stage, final-origin verify, and publish the immutable public
`v2.4.0-alpha.1` prerelease. The release contains exactly six Linux/Windows
application and CPU/RTX 50 outputs and is public before any physical platform
smoke begins. Produce `candidateInputDigest`, `releaseCandidateDigest`,
`releaseStagingDigest`, and alpha `deploymentDigest`; produce no
platform-smoke result, alpha aggregate, final lineage, or Production support
claim.

## Prerequisites

- Specification revision 23 and plan revision 31 are approved.
- Tasks 01–20 and 23–25 remain complete; Task 26 remains deferred.
- Verified partial implementation from the former Task 32 and Task 27 commits
  `429aadf3`/`1a672e61` is preserved as input, not release evidence.
- Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- No `v2.4.0-alpha.1` branch, candidate generation, tag, GitHub Release, or
  deployment digest exists.

## Owned Requirements

- Release slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`,
  `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`,
  `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`,
  `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, and
  `OPS-003`–`OPS-004`.
- Primary `AC-AUTO-080`, `AC-AUTO-082`, `AC-AUTO-083`, `AC-AUTO-084`,
  `AC-AUTO-085`, `AC-AUTO-086`, `AC-AUTO-087`, `AC-AUTO-088`,
  `AC-AUTO-089`, and `AC-AUTO-090`; supporting `AC-AUTO-073` and
  `AC-AUTO-091`. Task 32 implements the shared
  `AC-AUTO-082` schema/validator but does not create a physical result.
- `AC-MAN-012`, `AC-MAN-014`, and `AC-MAN-020`.
- Plan/ownership migration to specification 23, plan 31, the four current
  packet paths, public-before-smoke ordering, parallel platform packets,
  feedback transition, and final-without-platform-test policy.

## In Scope

- Finish exact official Linux/Windows compiler, SDK, CUDA 12.8.1, packaging,
  inspection, network-probe, Node/Electron, provenance, signature, component,
  and license acquisition records; close every active toolchain/profile hash.
- Preserve the verified acquisition-only XZ decoder and strict project-owned
  GZIP/XZ/TAR/ZIP materializers. Add no application dependency or ambient
  archive/toolchain authority.
- Prove Linux and Windows network-denied configure/build/test/inspection/pack
  boundaries and Linux CUDA toolkit driver-stub versus physical
  `libcuda.so.1` separation.
- Finish one shared target-aware builder and read-only PR/main validation jobs
  for the exact six output classes:
  1. Linux x64 application installer;
  2. Windows x64 application installer;
  3. Linux x64 CPU runtime pack;
  4. Windows x64 CPU runtime pack;
  5. Linux x64 RTX 50 `sm_120a-real` runtime pack;
  6. Windows x64 RTX 50 `sm_120a-real` runtime pack.
- Repeat each runtime build in independent clean roots and require identical
  source manifest, installed-file manifest, archive length/SHA-256, metadata,
  and signature-input digest.
- Migrate the task validator, acceptance-owner manifest, readiness verifier,
  lifecycle policy, and focused tests to specification 23 and plan 31. The
  registry SHALL name Tasks 32–35 exactly as linked by `plan.md`/`todo.md`,
  keep Task 26 deferred and Tasks 21/22/27–31 superseded, permit Tasks 33 and
  34 only after 32, and keep Task 35 conditional.
- Implement/reconcile exact prerelease preparation for SemVer
  `2.4.0-alpha.1`, branch `release/v2.4.0-alpha.1`, and absent expected tag
  `v2.4.0-alpha.1`: committed version/changelog/manual-script registry,
  clean/current release head, merge-commit-only policy, and complete
  signing/legal/provenance inputs.
- Remove tracked release-version mutation, publish-triggered build or signing,
  duplicate build paths, duplicate workflow keys, mutable action pins,
  `--clobber`, and every path that can publish a partial or rebuilt set.
- Build and natively sign both application candidates; sign all four runtime
  packs, production catalogs, and one complete release manifest. Bind exact
  role/platform/architecture/target/length/SHA-256/signature/compatibility,
  SBOM, notices, provenance, and expected same-tag origins.
- Freeze `candidateInputDigest` and `releaseCandidateDigest` in the Section
  9.6 order. Implement the later platform-smoke input/result and
  alpha-aggregate validators, but leave them uninstantiated until Tasks 33/34
  and the feedback gate.
- Under separate external authorities, preserve the frozen release-PR head
  through merge, create the immutable tag on that exact head, stage without
  clobbering, download and structurally final-origin verify every staged asset,
  publish the complete GitHub prerelease, and seal `releaseStagingDigest` and
  alpha `deploymentDigest`.

## Out Of Scope

- Any physical Linux or Windows install/runtime smoke, model transcription,
  `platformSmokeInputDigest`, platform result, or `alphaAggregateDigest`;
  Tasks 33/34 and the feedback gate own those states.
- Feedback selection, alpha.2 or later, final release construction, physical
  final tests, or Production support promotion.
- Reusing CI artifacts as installation origins, publishing
  qualification-purpose packages, or copying pinned Hugging Face model bytes
  into the release.
- RTX 30/40 delivery, AMD promotion, macOS execution, renderer/IPC product
  changes, dependencies, or weakened privacy/security/package rules.

## Task Contract

The Release packet has ordered internal phases: prepare and build; sign and
freeze candidates; preserve the release head; create the exact tag; stage and
structurally final-origin verify; publish. These phases remain one packet but
each external action is a separate `MANUAL GATE`. A later phase may consume
only the immutable output of the preceding phase and may never rebuild,
re-sign, retimestamp, repackage, regenerate catalogs, or rewrite evidence.

Provisioning may acquire only manifest-named objects from exact reviewed
origins. Before configure, the controller closes the proven OS network
boundary and supplies verified explicit paths. Missing or unverifiable input
remains `Pending`; no runner ambient tool, package manager, mirror, moving
URL, observed replacement hash, or physical driver may substitute.

Base installers contain only approved app integration and the two app-owned
native helper roles. Inference workers, runtime packs, models, CUDA libraries,
development activation, and qualification trust remain outside. CUDA packs
contain real `sm_120a` generated code and the reviewed user-space closure,
with no PTX, `sm_86`, `sm_89`, toolkit driver stub, or host driver.

PR/main jobs stay read-only, use non-production trust, expose no production
secret, upload no user-installable asset, and create no branch/tag/release.
Protected release jobs revalidate the exact frozen head and every approval.
Secrets and private signer data never enter logs or repository artifacts.

Staging is non-installable. Existing tags, release names, or asset filenames
fail closed. An authorized retry may reuse only unchanged verified candidates;
it removes or quarantines only attempt-owned incomplete staging and never
overwrites a published object. Publication creates a public immutable
prerelease but does not imply either platform smoke passed.

## Contracts And Boundaries

- Task 32 owns all alpha.1 release bytes and graph steps 1–4. Tasks 33 and 34
  receive only the public `deploymentDigest` and final-origin asset identities.
- The release workflow cannot call either physical platform-smoke workflow.
  The smoke workflows cannot receive release secrets or `contents: write`.
- Alpha.1 identities cannot satisfy a later alpha or final generation.
- Production catalogs accept only same-tag GitHub Release assets; the six
  pinned Hugging Face model objects remain the sole non-release origin.
- Signing keys, tokens, raw hardware identifiers, paths, environments, audio,
  transcripts, prompts, private logs, and private measurements are never
  committed or exposed.

## Expected Files Or Components

- Hosted acquisition manifests/schema, materializers, closed Linux/Windows
  CPU/CUDA profiles, disconnected executor, and fixtures under
  `runtime/local-whisper/toolchains`, `scripts/local-whisper`, and tests.
- Target-aware read-only build jobs and protected release workflow under
  `.github/workflows`, with immutable action pins and fail-closed permissions.
- Release preparation/version/manual-registry validators; signing, candidate,
  manifest, staging, exact-head/tag, final-origin, deployment, retry, and
  lifecycle components plus deterministic tests.
- Section 9.6 release-evidence schemas/validators for generation, candidate,
  staging, deployment, platform-smoke, aggregate, and final lineage.
- `package.json` command registration without dependency additions or
  release-time tracked mutation.
- `tasks/acceptance-owners.json`, its schema,
  `scripts/local-whisper/validate-task-plan.mjs`, implementation-readiness
  verification/tests, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`, `AC-AUTO-084`,
  `AC-AUTO-085`, and `AC-AUTO-086` prove complete implementation readiness,
  exact six-output builders, reproducibility, protected policy, preparation
  identity, and candidate completeness without prepublication platform smoke.
- `AC-AUTO-087`, `AC-AUTO-088`, `AC-AUTO-089`, and `AC-AUTO-090` prove frozen-byte promotion,
  non-clobbering recovery, closed origins, and final-origin parity without
  physical install/runtime assertions.
- `AC-AUTO-091` admits only
  `Release alpha.N → platform smokes → feedback → next alpha or final`,
  rejects prepublication smoke and invalid numbering/order/reuse, and exposes
  no final physical-test branch.
- `AC-MAN-012` and `AC-MAN-014` pass for the exact alpha.1 generation.
  Optional FLEURS legal/diagnostic work remains nonblocking.
- `AC-MAN-020` produces a public immutable prerelease containing all six
  exact signed outputs before Tasks 33/34 become eligible. It creates no smoke
  pass and no Production claim.
- Existing application/native/package/security/type/lint/format/audit/unit/
  production-build checks remain passing.

## Verification

Implement/register target-aware commands where absent:

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
rtk npm run verify:local-whisper:build -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0-alpha.1
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Do not run a Linux or Windows alpha-smoke verifier in Task 32.

## Failure And Rollback

- Missing input, closed profile, isolation proof, hosted platform, deterministic
  output, legal/signing authority, complete candidate, merge identity, tag
  absence, staging integrity, or publication authority blocks the next phase.
- A defect before publication invalidates the current alpha.1 generation and
  requires a clean alpha.1 retry. A defect discovered after publication never
  mutates alpha.1; an accepted fix requires alpha.2 through a new plan.
- Preserve truthful sanitized failures and private evidence. Clean only
  attempt-owned roots/processes/staging; never broadly delete shared caches,
  published assets, tags, or user data.
- Roll back workflow/profile/release-policy changes as coherent units. Never
  restore clobbering, ambient discovery, tracked version mutation, or
  publish-triggered build/signing.

## Manual Gates

- `MANUAL GATE`: exact public input/license/provenance acquisition.
- `MANUAL GATE`: immutable source commit/push and hosted Linux/Windows build
  rows.
- `MANUAL GATE`: create/prepare/push `release/v2.4.0-alpha.1`, update the
  release pull request, and verify merge settings.
- `MANUAL GATE`: protected reviewers, Linux/Windows signing, legal/SBOM/
  notice/provenance approval, and protected candidate execution.
- `MANUAL GATE`: preserving merge, exact immutable tag creation, recoverable
  GitHub Release staging/upload, final-origin verification, and public
  prerelease publication—each separately authorized.
- Commit, push, pull-request change, merge, tag, release action, publication,
  support promotion, and release are not authorized by plan or packet approval.

## References

- Mandatory: specification revision 23 Sections 9.6, 18.1–18.5, 19.1
  (`AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-091`),
  `AC-MAN-012`, `AC-MAN-014`, `AC-MAN-020`, and 22.1.
- Mandatory local inputs: completed Task 25 handoff; Task 27 commits
  `429aadf3`/`1a672e61`; current hosted-toolchain, native-build, package,
  release, and task-plan validators.
- Historical context only: superseded revision-30 Tasks 32 and 33.

## Completion And Handoff

Mark Task 32 complete only when the exact public prerelease and
`deploymentDigest` exist and all required privacy-safe release identities are
recorded. Update `todo.md` and `handoff.md`; stop before commit, either
platform smoke, feedback selection, later-alpha planning, final source work,
or support promotion. A later explicit incremental-implementation invocation
is required for Task 33 or Task 34.
