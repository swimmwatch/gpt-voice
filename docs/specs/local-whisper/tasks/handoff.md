# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 12 are Approved.
- Tasks 01–16 are complete and committed. Task 17 is complete and uncommitted
  for review.
- The verified public fixture bundle digest is
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 19.

## Task 17 Completed

- Extended the strict signed catalog envelope with authenticated fixture and
  production purpose binding, bounded canonical payload validation, and signed
  runtime/model artifact metadata. Duplicate or unknown fields, unsafe
  numbers, noncanonical encodings, and invalid purpose, key, signature, or
  metadata fail closed.
- Added explicit disabled, fixture, and production packaging modes. Fixture
  bundles use ephemeral in-memory Ed25519 keys and contain only synthetic,
  non-inference artifacts; production inputs require frozen manifests,
  authenticated approval metadata, approved origins and keys, source locks,
  toolchains, and pack definitions.
- Added a generate-once public fixture producer, digest-bound Linux consumer,
  and a reusable-only Windows consumer contract gated for Task 19. Release
  collection rejects fixture or incomplete production inputs.
- Enforced the base-package allowlist: Linux and Windows contain exactly the
  filesystem guard and launcher helpers outside ASAR, with no workers, models,
  accelerator SDKs or libraries, sources, or caches. macOS remains disabled
  with no executable Local Whisper helpers.
- Added deterministic manifests, hashes, signatures, licenses, notices,
  provenance, and SPDX SBOM validation; removed the committed fixture private
  key; hardened native helper builds against stale CMake caches and host
  toolchain leakage.

## Changed Components

- Catalog and artifact trust:
  `src/main/localWhisper/{catalog,artifacts}/`,
  `src/shared/localWhisper/canonicalCatalogJson.ts`, and catalog fixtures.
- Packaging implementation and documentation:
  `src/main/localWhisper/packaging/`, `scripts/local-whisper/packaging/`, and
  `runtime/local-whisper/packaging/README.md`.
- Package and release policy: `scripts/verify-packaged-runtime.mjs`,
  `scripts/collect-release-artifacts.mjs`, native helper build scripts, and
  `package.json`.
- CI and Linux smoke environment:
  `.github/workflows/local-whisper-packaging*.yml`, existing packaging
  workflows, and `build/fedora-release/`.
- Focused packaging, fixture, catalog, artifact, workflow, and release-guard
  tests under `tests/`.

## Verification

- Passed all six Task-17 packaging commands, including
  `verify:local-whisper:packaging`, with real Linux helper compilation, one
  digest-bound fixture producer/consumer flow, and release-guard validation.
- Built an unpacked Linux Electron package and verified its staged resources
  and exact two-helper policy.
- Passed source and test typechecks, ESLint with zero issues, Prettier,
  `git diff --check`, production dependency audit (**0 vulnerabilities**), and
  the complete unit suite (**1,578 passed**).
- Passed the production webpack build and Fedora smoke build. Production build
  retained only the repository's existing non-failing entrypoint-size
  warnings.
- Remote CI and all Windows execution were not run. AMD and macOS execution
  were not run and are not claimed.

## Exact Next Step

- After Task 17 review and separately authorized commit handling, execute
  [Task 18](18_migration_privacy_diagnostics_and_macos_skeleton.md) through a
  new `incremental-implementation` invocation.

## Blockers And Manual Gates

- No deterministic Task-17 implementation blocker remains.
- Production signing keys, approved origins, frozen production inputs, and
  redistribution/license approvals remain external manual gates.
- Representative Windows consumer, package, installer, helper, and
  same-digest checks remain exclusively in Task 19.
- Commit, push, pull request, production signing, publication, tag, upload, and
  release authority remain separately gated.
