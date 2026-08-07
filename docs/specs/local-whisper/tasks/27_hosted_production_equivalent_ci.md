# Task 27: Hosted Production-Equivalent CI Builders

## Outcome

Implement read-only hosted Linux and Windows CI that builds and verifies all
six production output classes—two application packages, two CPU runtime packs,
and two RTX 50 `sm_120a-real` runtime packs—without production secrets,
physical-GPU claims, installation origins, or publication authority.

## Prerequisites

- Specification revision 20 and plan revision 26 are approved.
- Task 25 is complete, reviewed, and committed; its clean source is the only
  implementation input.
- Existing PR, fixture-packaging, native-source, Fedora packaging, Windows
  packaging, and release workflows remain the repository baseline.
- No final signed candidate or platform qualification evidence exists.

## Owned Requirements

- `CI-001`, `CI-002`, and `CI-003`.
- Primary `AC-AUTO-080`, `AC-AUTO-083`, and `AC-AUTO-084`.
- Build-time portions of `PKG-002`–`PKG-004`, `PKG-009`–`PKG-010`,
  `SEC-003`, and `REL-002` without production authority.

## In Scope

- Add production-equivalent hosted Linux and Windows build matrices for the
  base application, CPU pack, and RTX 50 pack.
- Reuse exact pinned source objects, toolchain profiles, pack producers,
  packaging policy, expected-file manifests, SBOMs, notices, provenance, and
  compatibility metadata.
- Provision verified build prerequisites before the network-denied configure,
  compile, test, and pack phases; reject ambient or moving toolchains.
- Build every runtime pack twice in independent clean roots and compare archive
  bytes plus manifests, signature-input digests, SBOMs, notices, provenance,
  target, dependency closure, and app/protocol compatibility.
- Add workflow-policy tests proving PR/main permissions are read-only and no
  production environment, secret, source push, tag, release, signing, upload,
  or hardware qualification is reachable.
- Permit short-retention GitHub Actions artifacts only as bounded
  build/qualification inputs with explicit non-installation metadata.

## Out Of Scope

- Release-branch/version/changelog/manual-registry preparation owned by Task 30;
  production signing credentials, native signatures, final release manifest,
  candidate freeze, protected environment approval, or final candidates owned
  by Task 28.
- Physical GPU execution or Linux/Windows qualification owned by Tasks 29/21.
- GitHub Release staging, final-origin verification, publication, deploy,
  support promotion, tag creation, source commit/push, or PR creation.
- RTX 30/40 packs, AMD promotion, macOS execution, or new dependencies outside
  the approved toolchain inputs.

## Task Contract

PR and main jobs use `contents: read` and least read-only permissions. Forks,
pull requests, branch pushes, and ordinary dispatches cannot select a
production environment or receive any signing/publishing secret. Workflows
must never invoke `git commit`, `git push`, tag mutation, GitHub Release APIs,
or installers from CI-artifact URLs.

Each platform produces the application package and exact CPU/`sm_120a-real`
runtime packs from the same reviewed source revision. The base installer keeps
workers, CUDA libraries, and models out. CUDA compilation and structural pack
verification require no physical GPU; workflows must not report device proof
or Production eligibility.

The build phase is disconnected from first configure onward. All source,
compiler, SDK, CUDA 12.8.1, MSVC/VC Runtime, CMake, Ninja, dependency, and
packaging inputs are explicit and verified. A network-capable build step,
ambient resolution, target drift, missing closure, nondeterministic archive,
or cross-platform substitution fails the job.

## Contracts And Boundaries

- Reuse one builder contract across hosted validation and later protected
  candidate production; Task 30 may bind its exact source/version identity and
  Task 28 may add signatures, but neither may add a second compiler or pack
  implementation.
- CI artifacts are immutable attempt inputs with bounded retention, never
  catalog origins or end-user downloads.
- Existing fixture trust stays isolated and byte-compatible.
- Optional self-hosted RTX 50 diagnostics remain disabled/nonblocking and
  receive no secret or write authority.

## Expected Files Or Components

- `.github/workflows/pr-checks.yml` and focused Local Whisper reusable workflow
  definitions where separation improves reviewability.
- Existing Linux/Windows application and runtime-pack producers plus new
  production-equivalent orchestration/policy verifiers.
- `package.json`, tests under existing script/native/packaging boundaries, and
  task-plan ownership artifacts.

## Acceptance Criteria

- `AC-AUTO-080` and `AC-AUTO-084` prove the Linux/Windows RTX 50 packs and all
  runtime metadata are deterministic across independent clean builds and reject
  changed or cross-target inputs.
- `AC-AUTO-083` proves all six output classes build under read-only validation
  without source/release mutation, production secrets, installable upload, or
  hardware claim.
- Runtime byte reproducibility rejects ambient, networked, missing,
  cross-platform, and cross-target inputs.
- Linux and Windows outputs contain exact expected files and metadata, while
  base installers exclude native inference packs and models.
- Existing application, fixture, native quality, type, lint, format, audit,
  and package checks remain passing.

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

- A missing hosted toolchain or nondeterministic output blocks Task 27; it does
  not authorize a reduced matrix or synthetic pack.
- Preserve logs/artifact digests without secrets or private host data. Remove
  only task-owned ephemeral CI staging through normal retention/cleanup.
- Roll back workflow and builder changes together; do not weaken existing
  fixture/native/package gates to make validation pass.

## Manual Gates

- Network access used to provision exact public toolchain/source inputs must be
  separately authorized when a local verification run needs it; production
  build phases remain disconnected.
- Actual GitHub-hosted Linux/Windows workflow execution is required before
  completion but needs no physical GPU or production secret.
- Commit, push, PR, signing, qualification, upload, publication, tag, support
  promotion, and release remain separately authorized.

## References

- Specification revision 20 Sections 12.1, 18.1–18.5, 19.1
  (`AC-AUTO-083`–`AC-AUTO-084`), and 22.
- Existing PR checks, Local Whisper fixture packaging, release builds, and
  Linux/Windows runtime-pack producers.

## Completion And Handoff

After hosted verification, update `todo.md` and `handoff.md` with workflow runs,
exact non-sensitive output identities, and any blocker. Hand the unchanged
builder contract to Task 30 and then Task 28, and stop before commit, release
preparation, protected environment use, signing, candidate freeze, or Task 30.
