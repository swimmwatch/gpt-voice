# Task 31: Hosted Production-Equivalent CI Builders

Status: **Superseded by approved plan revision 29. Do not execute this packet.**
Its six-output hosted builder contract is owned by Task 32 and reused unchanged
by Task 34.

## Outcome

Use Task 27's immutable provisioning and disconnected-build contract on public
GitHub-hosted Linux and Windows runners to build and verify all six production
output classes—two application packages, two CPU runtime packs, and two RTX 50
`sm_120a-real` runtime packs—under read-only non-production authority.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- Tasks 25 and 27 are complete, reviewed, and committed. Both Task 27 public-
  runner preparation rows passed from an immutable workflow source, and its
  manifests, profiles, materializers, and disconnected executor are read-only.
- Existing PR checks, application package producers, runtime-pack producer,
  expected-file/SBOM/notices/provenance/signature-input generators, fixture
  packaging, and release-policy tests remain the repository baseline.
- No final signed candidate, physical qualification evidence, production
  environment approval, tag, GitHub Release asset, or publication exists.

## Owned Requirements

- `CI-001`, `CI-002`, and `CI-003`.
- Build-time portions of `PKG-002`–`PKG-004`, `PKG-009`–`PKG-010`,
  `SEC-003`, and `REL-002` without production authority.
- Primary `AC-AUTO-080`, `AC-AUTO-083`, and `AC-AUTO-084`.

## In Scope

- Add production-equivalent jobs for `ubuntu-24.04` and `windows-2025`; record
  the exact runner image metadata as bounded provenance without treating its
  ambient tools as build inputs.
- Provision only Task 27-verified objects, then execute the existing application
  and runtime producers inside the unchanged disconnected-build boundary.
- Build the Linux and Windows application package classes and verify that their
  base contents include only the two approved app-owned native helpers, never
  inference workers, CUDA libraries, runtime packs, or models.
- Build each platform's CPU and RTX 50 `sm_120a-real` runtime pack twice from
  independent clean roots and require byte-for-byte archive and metadata
  identity.
- Verify exact expected files, dependency closure, target/generated code,
  relocation/malicious-environment behavior, SBOMs, notices, provenance,
  compatibility metadata, and signature-input digests.
- Integrate the matrix into pull-request and main validation with read-only
  permissions and policy tests rejecting every production/write/hardware claim.
- Retain only bounded non-installation reports and digests for at most three
  days; discard application and runtime bytes after the job.

## Out Of Scope

- New toolchain URLs, hashes, materializers, profile capture, network-isolation
  mechanisms, or a second compiler/pack producer; regressions return to Task
  27 rather than being patched around here.
- Production secrets, native/application signatures, final release manifest,
  candidate freeze, protected environment approval, or final candidate bytes
  owned by Task 28.
- Release-branch/version/changelog/manual-registry preparation owned by Task 30.
- Physical GPU/device proof and Linux/Windows qualification owned by Tasks
  29/21.
- Commit, push, PR creation, repository-setting changes, merge, tag, GitHub
  Release staging/upload/publication, support promotion, or release.
- RTX 30/40 packs, AMD promotion, macOS execution, provider login, model
  download, application installation, or user data.

## Task Contract

The workflow uses public GitHub-hosted runners, but every build executable and
packaging component comes from the exact Task 27 manifests and materialized
roots. GitHub Actions are pinned to full commits. Provisioning may use network
only before the Task 27 controller closes it; configure, compile, test,
dependency inspection, package/pack generation, and reproducibility comparison
all run in the same proven network-denied boundary on both platforms.

Linux and Windows platform jobs may run concurrently. Within each platform,
the application package, CPU pack pair, and CUDA pack pair consume the same
reviewed source revision, app/protocol compatibility inputs, and Task 27
toolchain generation. Each runtime build uses a separate fresh source output,
build, staging, and archive root; no first-build cache or generated file may be
reused by the second build. Identical inputs must produce identical restricted
`tar.gz` bytes, installed-file manifests, archive length/SHA-256, SBOM, notices,
provenance, compatibility metadata, target identity, and artifact-signature
input digest.

The CUDA job compiles and structurally inspects exactly `120a-real` with the
Task 27 toolkit driver stub. It must reject PTX, `sm_86`, `sm_89`, another real
target, bundled driver libraries, or a physical-device claim. No GPU is needed
or queried. The final pack declares the exact reviewed CUDA user-space closure
and the real host driver prerequisite without including the build stub.

The application package verifier uses the canonical release packaging path for
the supported Linux and Windows package classes. It proves the base package
excludes native inference workers, CUDA/user-space engine libraries, models,
development activation, qualification trust, and runtime-pack archives. A
successful compile without expected-file and package-content proof is a
failure.

PR and main jobs use `contents: read` plus the least read-only permissions, no
protected environment, and no signing/publication secret. Forks, pull requests,
branch pushes, reusable callers, and ordinary dispatch cannot reach a
production environment or a write-capable job. The workflow never invokes
source commit/push, tag/release APIs, signing, qualification, installation, or
artifact promotion. It may upload only sanitized reports marked
`non-installation-evidence`; application installers and runtime packs are never
uploaded by validation CI.

## Contracts And Boundaries

- Task 27 owns and freezes build input acquisition and network isolation. Task
  31 composes the six hosted validation outputs without changing that contract.
- Task 30 may bind the resulting builder identity to exact release preparation,
  and Task 28 may invoke the same builder under protected signing authority;
  neither may create a second build implementation.
- Hosted output bytes are disposable validation products, not candidates,
  catalog origins, end-user downloads, or Production evidence.
- Existing fixture trust remains isolated and byte-compatible; synthetic trust
  cannot enter production catalog/signature fields.
- Reports expose only public source/tool/profile/builder/output digests and
  sanitized statuses, never secrets, private runner state, paths, sessions,
  installer URLs, or raw errors.

## Expected Files Or Components

- `.github/workflows/pr-checks.yml` and a focused reusable Local Whisper hosted-
  build workflow where separation improves reviewability.
- Existing application and runtime-pack producers plus production-equivalent
  orchestration and deterministic comparison/report code.
- Workflow permission/trigger/environment/output policy verifier and negative
  fixtures under existing CI/test boundaries.
- `package.json`, acceptance ownership, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-080` proves both Linux and Windows RTX 50 packs contain only the
  exact deterministic `sm_120a` real target and reviewed CUDA closure and reject
  PTX, `sm_86`, `sm_89`, another target, driver bundling, or cross-platform
  substitution.
- `AC-AUTO-083` proves all six output classes compile and pass their applicable
  structural/package checks on public hosted runners with read-only
  non-production trust, no source/release mutation, no production secret, no
  installable upload, and no hardware claim.
- `AC-AUTO-084` proves independent clean CPU/CUDA runtime builds have identical
  archive bytes and metadata and reject changed, ambient, missing, networked,
  cross-platform, cross-target, expected-file, dependency, SBOM, notice,
  provenance, or signature-input state.
- Both base application packages exclude inference workers, engine/CUDA
  libraries, runtime packs, models, development activation, and qualification
  trust while retaining exactly the approved app-owned native helpers.
- PR/main workflow policy tests prove no production environment, write token,
  source push, tag, release, signing, qualification, installation, or
  user-installable artifact upload is reachable.
- Existing application, fixture, native quality, type, lint, format, dependency
  audit, and production package checks remain passing.

## Verification

```bash
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
rtk npm run test:local-whisper:packaging
rtk npm run verify:local-whisper:packaging:policy
rtk npm run test:local-whisper:native-sources
rtk npm run test:local-whisper:native-build-audits
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Registered commands:

```bash
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
```

## Failure And Rollback

- Any Task 27 manifest/profile/isolation mismatch, missing hosted platform,
  nondeterministic runtime output, package-content leak, unauthorized workflow
  capability, or failed actual hosted row blocks Task 31 and Task 30. It does
  not authorize a reduced matrix, synthetic output, ambient tool, networked
  build, installable validation artifact, or hardware claim.
- Preserve only sanitized report/digest evidence. Let bounded retention remove
  reports and clean attempt-owned roots; never delete shared caches or user data
  broadly.
- Roll back workflow and six-output orchestration together. Return toolchain or
  isolation defects to Task 27; do not weaken source, fixture, native, package,
  or workflow-policy gates.

## Manual Gates

- Actual GitHub-hosted Linux and Windows six-output workflow execution is
  required before Task 31 completion. It requires a separately authorized
  immutable commit/push/PR or approved main source, but no physical GPU or
  production secret.
- Network access is limited to Task 27 provisioning of exact public inputs;
  local re-runs that need those objects require separate authorization.
- Commit, push, PR, Task 30, repository-setting mutation, signing, candidate
  freeze, physical qualification, merge, tag, upload, publication, support
  promotion, and release remain separately authorized.

## References

- Specification revision 20 Sections 12.1, 18.1–18.5, 19.1
  (`AC-AUTO-080`, `AC-AUTO-083`, `AC-AUTO-084`), and 22.
- Task 27 immutable hosted-toolchain handoff and decisions
  `planning.hosted-toolchain-provisioning` and
  `planning.hosted-toolchain-packet-decomposition` revision 2.
- Existing PR checks, application packaging, runtime-pack producers, fixture
  packaging, and release/project conventions.

## Completion And Handoff

After both hosted platform rows and all deterministic/policy checks pass,
update `todo.md` and `handoff.md` with workflow run identities, exact
non-sensitive builder/tool/profile/output/report digests, and any blocker. Hand
the unchanged builder contract to Task 30 and then Task 28, and stop before
commit, release preparation, protected environment use, signing, candidate
freeze, qualification, or Task 30.
