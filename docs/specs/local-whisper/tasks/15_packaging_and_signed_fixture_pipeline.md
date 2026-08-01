# 15 Packaging And Signed Fixture Pipeline

## Outcome

Windows and Linux package-smoke builds can consume one byte-identical,
schema-valid, signed Local Whisper fixture catalog without bundling any runtime
pack or model. Deterministic local tooling creates small immutable runtime/model
fixture archives, manifests, signatures, provenance, SBOM, and negative trust
fixtures for automated tests. Production hosting, production keys, uploads, and
catalog publication remain deliberately unavailable behind explicit Manual
Gates.

## Prerequisites

- The Local Whisper plan is approved and Task 15 has separate execution
  authorization.
- Tasks 03 through 09 are complete:
  - Task 03 owns catalog/keyring/manifest schemas and authenticated inventory;
  - Task 04 owns safe managed paths and exact-file identities;
  - Task 05 owns streaming download/install/resume verification;
  - Task 06 supplies deterministic native CMake output and quality metadata;
  - Task 07 supplies the protocol-conformant fixture worker used by small
    automated runtime fixtures;
  - Tasks 08/09 define the real runtime content-tree contracts and local build
    inputs for each engine.
- Real engine binaries and model weights are not required for package smoke or
  trust-negative tests.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- Decision `planning.artifact-publishing-target` remains
  `fixture-only-deferred-publication`. No concrete production origin, retention
  policy, signing service, or secret has been authorized.

## Owned Requirements

- `PKG-001` through `PKG-005`, `SEC-003`, `SEC-008`, and `OPS-001`
- Packaging portions of `RUNTIME-001`, `RUNTIME-002`, `RUNTIME-003`,
  `MODEL-003`, `MODEL-009`, `MODEL-010`, `CAP-013`, `COMP-002`, `COMP-007`,
  `COMP-009`, `DL-001`, and `DL-002`
- Installer/catalog-fixture portions of `AC-AUTO-017`, `AC-AUTO-030`,
  `AC-AUTO-031`, `AC-AUTO-032`, and `AC-AUTO-048`
- Signed-catalog/negative-fixture slice of `AC-AUTO-049`
- Packaging proof for `MAC-003`/`AC-AUTO-028`: macOS fixtures contain no
  executable Local Whisper catalog entry or artifact action
- Manual license, provenance, signing, origin, and release gates are explicitly
  not automated away by this packet.

## In Scope

- Deterministic fixture catalog/archive generation and Ed25519 signing with
  test-only ephemeral keys.
- Positive and negative fixture matrices for catalog, runtime archive, model
  artifact, closed memory estimates, denylist, signature/hash, protocol/app
  compatibility, and unsafe archive cases.
- Package staging of the immutable main-only catalog/keyring/schema resources.
- Deterministic release-preset build, staging, integrity metadata, and packaged
  resolver coverage for Task 06's small native filesystem guard on Windows and
  Linux; test binaries and CMake build trees remain excluded.
- Linux AppImage/deb/rpm and Windows NSIS package policy/verifier extensions.
- Package-smoke CI using fixture mode without credentials or external network.
- Release-workflow guards that prevent fixture trust roots/catalogs or bundled
  runtime/model payloads from reaching published release assets.
- Size/startup reporting for the catalog and explicit proof that base
  installers remain free of on-demand artifacts.

## Out Of Scope

- Selecting, provisioning, or operating production object storage/CDN.
- Creating or importing a production signing private key, publishing a public
  catalog, uploading runtime/model artifacts, changing a GitHub Release, tag,
  release notes, or download origin.
- Claiming the current Windows/Linux base app has universal platform code
  signing. Runtime signatures are verified under the trusted-installed-app
  assumption only.
- Building real engine packs, converting/quantizing models, hardware
  qualification, Production tier promotion, or shipping a macOS runtime.
- Download/install implementation already owned by Task 05 or catalog business
  logic owned by Task 03.
- Committing generated catalogs, fixture private keys, archives, model bytes,
  inference runtime binaries, release artifacts, or signing output.

## Task Contract

### Fixture and production modes

1. Define two strictly separated modes:
   - `fixture`: allowed only for tests, local verification, and package-smoke
     artifacts that are never published as a GPT-Voice release;
   - `production`: consumes an externally frozen signed catalog and installed
     public keyring only after all Manual Gates below. This packet does not
     create those production inputs.
2. Fixture generation creates an ephemeral Ed25519 key pair in a unique
   temporary/build directory, signs the fixture catalog/runtime archives, runs
   tests, and removes private material. No private key or seed is checked in.
3. Every fixture catalog carries an authenticated purpose/channel marker and
   immutable revision. Production verification rejects `fixture`, test origin,
   unqualified pack, or ephemeral key IDs before packaging/publishing.
4. Use allowlisted non-routable fixture URLs such as an authenticated
   `https://local-whisper-fixtures.invalid/...` identity with an injected byte
   transport. Tests never contact that hostname and never weaken production
   HTTPS/allowlist validation to accept `file:` URLs.
5. A package-smoke catalog may describe small signed protocol/model fixtures,
   but the archive bytes themselves remain outside the installer and are
   supplied only by the injected test transport.

### Fixture artifact matrix

Generate bounded local fixtures for both engine IDs:

- one protocol-conformant runtime archive per `whisperCpp` and
  `fasterWhisper`, containing the Task-07 fixture peer—not a real inference
  claim;
- one small engine-native-shaped model artifact per engine with non-model
  synthetic bytes and explicit `fixture` provenance;
- an older installed revision plus a newer `Update available` revision;
- blocked/denylisted revisions;
- wrong size, hash, signature, key ID, protocol, app compatibility, engine,
  backend, expected-file metadata, and actual worker digest;
- one valid closed selected-configuration memory-estimate matrix per fixture
  model plus one-property negatives for missing/duplicate keys, negative or
  unsafe byte counts, unit ambiguity, GPU-without-VRAM, CPU-with-VRAM,
  precision/backend/runtime identity mismatch, and stale qualified evidence;
- traversal, absolute-path, symlink, hard-link, device-node/FIFO/socket,
  duplicate-name, unexpected-file, file-count, and expanded-size-overflow
  archives where the fixture format supports them;
- valid/invalid resume validators and truncated/mutated byte streams.

All positive fixtures use immutable identities and exact expected-file hashes.
Negative fixtures mutate one trust property at a time and must never be
promotable or executable.

### Catalog staging and app packaging

1. Production packaging consumes one already-frozen catalog tuple:
   `catalog.json`, `catalog.sig`, `catalog.sha256`, public `keyring.json`, and
   versioned schemas. Both OS jobs must verify and package byte-identical input
   digests.
2. Stage generated package inputs under
   `build/generated/common/local-whisper/` and map them as a main-only Electron
   resource, expected at `resources/local-whisper/catalog/` in unpacked/install
   layouts. Do not put them under renderer-facing `assets/`.
3. Main receives the resource path through a dedicated composition-root-owned
   resolver. Renderer/preload never receives an absolute catalog path, public
   key file authority, artifact URL, or executable path.
4. Extend packaged-runtime policy to require the exact catalog resource set,
   validate schema/signature/app version/protocol/purpose, and reject unexpected
   files. Installer checks must verify the same files after real extraction or
   silent install.
5. Explicitly reject any base package containing Local Whisper inference worker
   executables, CUDA/cuDNN/ROCm/Vulkan runtime libraries, Python environment,
   model weights/conversions, staging partials, fixture private key, or
   production secret.
6. Keep existing Electron fuses, locale policy, CloakBrowser checks, installer
   metadata, and remote-provider files unchanged.
7. Add a separate size metric for the catalog resource. Do not hide a base-app
   size regression by changing the global threshold or baseline without
   reviewed evidence.

### Native filesystem helper packaging

1. Build Task 06's `fs-guard` from its checked-in CMake release preset on the
   target OS; never cross-label a Linux artifact as Windows or vice versa.
2. Stage exactly one production helper outside ASAR at
   `resources/local-whisper/native/<platform>-x64/fs-guard[.exe]` with an
   app-owned build/protocol/SHA-256 manifest. Do not stage GoogleTest, CTest,
   fuzz, coverage, debug, compiler, CMake, or intermediate files.
3. Resolve the helper through one main-owned packaged-resource resolver and pass
   only its absolute verified path to the existing Task 04 transport. Renderer
   and preload receive neither the path nor execution authority.
4. Package verification must hash the helper and validate its build/protocol
   manifest in unpacked Linux/Windows layouts and extracted/silently installed
   artifacts. A missing, extra, changed, wrong-platform, or non-executable
   helper fails package verification.
5. This helper is application infrastructure, not a downloadable inference
   runtime. It does not weaken the ban on bundled models or unrequested
   accelerator packs and does not create a macOS executable path.

### Workflow contract

1. Add a credential-free fixture workflow/job used by pull requests or manual
   CI. It generates/signs local fixtures, runs trust tests, builds package-smoke
   layouts, verifies them, uploads only ordinary short-lived CI artifacts, and
   never invokes GitHub Release publication.
2. Linux uses the existing Fedora package-smoke path; Windows uses the existing
   `windows-latest` directory/NSIS verifier path. Both consume the same fixture
   catalog digest.
3. Update `.github/workflows/release-builds.yml` only to:
   - accept/verify a frozen production catalog artifact when a Local Whisper
     release is authorized;
   - reject fixture-purpose catalogs and test key IDs;
   - prove no runtime/model is collected by the base release collector;
   - stop before `gh release upload` when production inputs/gates are absent.
4. Do not add runtime/model outputs to `release/` or
   `scripts/collect-release-artifacts.mjs`. Its broad Windows `GPT-Voice*.exe`
   match must not be able to collect worker executables.
5. A future protected publishing workflow must happen in order:
   build candidate → verify/SBOM/license review → sign → upload immutable object
   → freeze final URLs/hashes catalog → sign catalog → build base installers.
   This sequence is documented as a Manual Gate, not implemented with placeholder
   origins or credentials here.

### License, SBOM, and provenance contract

1. Validate every real staging pack from Tasks 08/09 contains an exact
   expected-file manifest, `sbom.spdx.json`, provenance, notices, and license
   inventory before it can be signed even as a local fixture.
2. Fixture SBOM/provenance clearly identifies synthetic fixture components and
   cannot be mistaken for hardware or redistribution evidence.
3. Runtime and model manifests record source/build/conversion revisions, file
   sizes/hashes, compatibility, prerequisites, key ID, and the complete exact
   configuration memory-estimate matrix required by Task 03. Estimates bind
   to target/backend/runtime/artifact/variant/precision and keep qualified
   peaks separate; no estimate is derived from file size. No `latest`, mutable
   redirect, GitHub API digest fallback, or unsigned archive is accepted.
4. Public verifier keys and rotation/denylist metadata are reviewable app
   inputs; private keys never enter repository, application, diagnostics,
   workflow artifacts, or logs.

## Contracts And Boundaries

- Task 03 remains authoritative for catalog parsing/trust and Task 05 for
  download/install behavior. Fixture tools consume those public contracts; they
  do not fork validators.
- Runtime fixture peers conform to Task 07 but do not prove Tasks 08/09 real
  inference. Manifests label them unqualified fixtures.
- Package scripts may read generated catalog resources but must not download or
  sign during Electron application startup.
- Runtime/model catalog data is immutable per app release; application updates,
  not a remote floating catalog, rotate the trusted keyring/denylist.
- A signed runtime artifact does not imply the unsigned/currently trust-based
  base installer is platform-signed. UI/docs/tests must preserve this boundary.
- Fixture execution uses temporary, owner-private directories and removes them
  after tests. It never touches a user's real Local Whisper storage root.

## Expected Files Or Components

- `scripts/local-whisper/generate-signed-fixtures.mjs`
- `scripts/local-whisper/verify-signed-fixtures.mjs`
- `scripts/local-whisper/stage-packaged-catalog.mjs`
- `scripts/local-whisper/verify-frozen-catalog.mjs`
- `tests/scripts/localWhisperSignedFixtures.test.ts`
- small declarative fixture recipes under `tests/fixtures/local-whisper/`;
  generated keys/archives remain outside source control
- generated package inputs under `build/generated/common/local-whisper/`
- a dedicated main-owned catalog resource resolver under
  `src/main/localWhisper/` and focused resolver tests
- Task 06 release-preset helper staging plus a main-owned native-helper resolver,
  exact build/protocol/hash manifest, and focused packaged-path tests
- updates to:
  - `package.json` build scripts and main-only `extraResources` mapping;
  - `scripts/packaged-runtime-policy.mjs`;
  - `scripts/verify-packaged-runtime.mjs`;
  - `scripts/verify-installers.mjs`;
  - `scripts/build-size-cli.mjs`;
  - `scripts/collect-release-artifacts.mjs` tests/guardrails, not its output
    scope;
  - `build/fedora-release/fedora-release-entrypoint.mjs`;
  - `.github/workflows/pr-checks.yml`;
  - `.github/workflows/release-builds.yml`;
  - `.github/workflows/local-whisper-fixtures.yml` or an equivalently named
    credential-free workflow.

Expected commands added to `package.json`:

- `generate:local-whisper:fixtures`;
- `verify:local-whisper:fixtures`;
- `stage:local-whisper:catalog`;
- `verify:local-whisper:catalog`.

## Acceptance Criteria

- Re-running fixture generation with identical declarative inputs produces
  equivalent manifests/artifact contents; signatures verify against only that
  run's ephemeral public key and no private key remains afterward.
- Every one-property trust mutation fails with its exact safe catalog/archive
  error before promotion or execution.
- Every positive fixture has a complete valid matching estimate matrix; every
  missing/duplicate/unsafe/unit-invalid/backend- or precision-mismatched
  estimate mutation fails catalog verification before packaging or execution.
- Linux and Windows package-smoke layouts contain the same catalog digest and
  no Local Whisper runtime, model, staging, private key, or unlisted resource.
- Linux and Windows package-smoke layouts contain exactly one Task 06
  `fs-guard` at the canonical outside-ASAR path; its build/protocol/hash manifest
  verifies, main alone resolves it, and no native test/build artifact is shipped.
- AppImage/deb/rpm/NSIS verification checks catalog presence, purpose,
  signature, app/protocol compatibility, and base-installer exclusions.
- A release-mode invocation with fixture purpose, fixture key ID, missing frozen
  catalog, mutable origin, or absent Manual Gate evidence stops before package
  collection/publication.
- The current release collector cannot pick up an inference-worker `.exe`;
  worker/runtime output is isolated outside `release/`. The packaged
  infrastructure `fs-guard.exe` is collected only inside the verified installer.
- macOS packaging fixtures expose only Planned/unavailable types and contain no
  executable/model catalog entry.
- Catalog verification and ordinary application startup do not probe hardware,
  allocate, download, load a model, or block Electron main on large I/O.
- License/SBOM/provenance validation fails closed for an undeclared file or
  missing notice.

## Verification

Run fixture and package-policy checks without secrets or network:

```text
rtk npm run generate:local-whisper:fixtures
rtk npm run verify:local-whisper:fixtures
rtk npm run verify:local-whisper:catalog -- --mode=fixture
rtk npm run build:local-whisper:fs-guard
rtk npm run verify:packaged
rtk node --import tsx --test tests/scripts/localWhisperSignedFixtures.test.ts
rtk node --import tsx --test tests/scripts/packagedRuntimePolicy.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk lint
rtk prettier --check
```

On matching package hosts additionally run:

```text
rtk npm run smoke:fedora
rtk npm run dist:win -- --dir
rtk npm run verify:packaged
```

Do not run a release event, production-mode signing, upload, or external origin
test as automated completion of this packet. Record unavailable platform smoke
checks in `handoff.md`.

## Failure And Rollback

- If fixture/public trust roots cannot be mechanically separated, stop; never
  ship or trust a checked-in private/test key in a release build.
- If a catalog cannot be frozen before base packaging, release-mode packaging
  fails closed. Do not fetch a mutable catalog during application startup.
- If package staging would bundle a runtime/model or broaden renderer path
  authority, revert the staging change and return to `/plan`.
- Rollback removes fixture tooling/generated temporary data and package
  mappings while leaving current remote-provider installers/workflows intact.
- Already installed immutable real revisions are never rewritten or deleted by
  packaging rollback; rollback selects an older app/catalog only through the
  documented compatibility path.

## Manual Gates

- `MANUAL GATE — production hosting`: choose and approve a project-controlled,
  allowlisted HTTPS origin with immutable object naming, capacity for the model
  catalog, TLS/redirect/range behavior, retention, rollback, access control,
  incident response, and cost ownership. No target is selected in this packet.
- `MANUAL GATE — production signing`: provision protected signing service/key,
  reviewers, audit trail, rotation, revocation/denylist, backup/recovery, and
  frozen-catalog handoff. Private material must never enter the repository or
  general package jobs.
- `MANUAL GATE — publication`: AC-MAN-007 and AC-MAN-012 must pass against the
  real origin and every real runtime/model artifact before enabling the
  production sequence or publishing a Local Whisper-enabled release.
- `MANUAL GATE — licenses/redistribution`: separately approve whisper.cpp,
  Faster-Whisper, CTranslate2, Python, NumPy, PyAV, CUDA/cuBLAS/cuDNN, ROCm/HIP,
  Vulkan-related payloads, model checkpoints/conversions, notices, SBOM, and
  provenance.
- `MANUAL GATE — platform packages`: run real Linux AppImage/deb/rpm and Windows
  NSIS install/uninstall verification. A successful host cannot substitute for
  the other OS.
- `MANUAL GATE — base trust disclosure`: confirm release UI/docs do not claim
  Authenticode, signed-update, or universal base-app verification that current
  packaging does not provide (`AC-AUTO-048`).
- No upload, release mutation, tag, publication, signing credential, or public
  endpoint action is authorized by Task 15 execution.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 4, 5, 7.4, 9, 12, 17.2–18, and 19;
  - `../decisions.yaml` entries `operations.runtime-distribution`,
    `models.version-update-policy`, `operations.download-recovery`,
    `security.worker-protocol-boundary`,
    `compatibility.runtime-prerequisites`,
    `planning.artifact-publishing-target`, and
    `planning.openwhispr-adaptation-boundary`, plus
    `resources.model-estimate-presentation`.
- Packaging infrastructure:
  - `package.json` electron-builder configuration and scripts;
  - `.github/workflows/release-builds.yml` and `pr-checks.yml`;
  - `scripts/collect-release-artifacts.mjs`;
  - `scripts/packaged-runtime-policy.mjs`;
  - `scripts/verify-packaged-runtime.mjs`;
  - `scripts/verify-installers.mjs`;
  - `build/fedora-release/fedora-release-entrypoint.mjs`.
- Runtime content contracts from Tasks 08/09, native build/output contract from
  Task 06, and artifact/path contracts from Tasks 03–05.

## Completion And Handoff

- Mark Task 15 complete in `todo.md` and record fixture mode, catalog digest,
  exact generated/ignored outputs, package-smoke evidence, unavailable platform
  checks, and every still-closed production Manual Gate in `handoff.md`.
- Name Task 16 as the next packet if it remains unchecked. Do not execute it.
- Present the packaging/fixture diff and verification evidence, then stop. Do
  not commit, publish, upload, mutate a release, or begin another packet in the
  same invocation.
