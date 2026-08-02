# 17 Signed-Envelope Packaging And Fixture CI

## Outcome

Local Whisper packaging uses the existing strict signed catalog envelope in
three fail-closed modes: disabled, credential-free fixture, and externally
supplied production. One CI producer creates and signs one fixture bundle once;
Linux consumes that exact bundle in this packet. A reusable, non-triggered
Windows consumer/package job is defined but never executed before Task 19.
Base installers contain only shared Local Whisper integration and exactly two
small native helpers; inference workers, models, and accelerator libraries
remain on-demand. Fixture trust can never enter release collection.

## Prerequisites

- Tasks 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, and 13 are complete.
- The approved specification and the plan revision containing this packet are
  authoritative.
- Task 17 has separate execution authorization.
- This packet depends only on the catalog, artifact, filesystem, native-source,
  worker, and pack contracts completed by Tasks 03 through 13. It has no
  dependency on coordinator, protected renderer IPC, settings UI, or
  main-window status work in Tasks 14, 15, or 16.
- Production origins, private signing keys, publication credentials, and real
  artifact uploads are neither selected nor implied.

## Owned Requirements

- Primary packaging: `PKG-001`, `PKG-002`, `PKG-003`, `PKG-004`, `PKG-005`,
  `PKG-008`, `PKG-009`, `PKG-010`, `SEC-008`, and `SEC-012`.
- Source/engine-lock packaging slice: `PKG-006`.
- Packaging and trust slices: `SEC-003`, `SEC-009`, `SEC-013`, `OPS-001`,
  `RUNTIME-001`, `RUNTIME-003`, `MODEL-003`, `MODEL-009`,
  `MODEL-010`, `CAP-013`, `COMP-002`, `COMP-007`, `COMP-009`, `DL-001`,
  `DL-002`, and `MAC-003`.
- Primary acceptance: `AC-AUTO-030`, `AC-AUTO-048`, `AC-AUTO-057`, and
  `AC-AUTO-061`.
- Supporting acceptance: `AC-AUTO-017`, `AC-AUTO-028`, `AC-AUTO-031`,
  `AC-AUTO-032`, `AC-AUTO-049`, `AC-AUTO-050`, and deterministic preparation
  for `AC-MAN-012`.

## In Scope

- Atomic extension of the existing signed-envelope catalog format; no parallel
  detached-signature format.
- Disabled, fixture, and production packaging-mode validation.
- Generate-once ephemeral fixture signing and digest-bound cross-job
  consumption.
- Linux package-policy execution and an unexecuted Windows consumer/package
  workflow definition whose representative execution belongs to Task 19.
- Base installer include/exclude policy and exact native-helper staging.
- Runtime/model pack identity, keyring, hash/signature, denylist, expected-file,
  SBOM, provenance, notice, and license contracts.
- Release-collection guards that reject fixture or incomplete production data.

## Out Of Scope

- A detached `catalog.sig`, a second signature format, or migration to a new
  trust root.
- Creating or storing a production private key, choosing a public production
  origin, uploading artifacts, publishing a catalog, code-signing the app,
  pushing a branch, opening a pull request, tagging, or releasing.
- Bundling drivers, complete CUDA/Vulkan/ROCm SDKs, inference workers,
  alternate inference runtimes, model weights, or macOS helpers in the base
  installer.
- Coordinator/UI work, representative Windows execution, or hardware/inference
  qualification.

## Task Contract

### Existing signed-envelope format only

Extend the existing `catalog.json` signed envelope atomically. Its strict
top-level exact-key object remains:

```text
schemaVersion, algorithm, keyId, payloadBase64, signatureBase64
```

The authenticated canonical payload includes explicit `purpose` (`fixture` or
`production`), catalog revision, supported app/protocol versions, runtime/model
entries, exact sizes, memory estimates, compatibility rows, allowlisted
origins, hashes, artifact signatures, license/provenance/SBOM notice IDs,
denylist/blocked state, and bounded display metadata. Reject unknown or
duplicate keys, unsafe numbers, noncanonical encodings, wrong algorithm,
unknown key, wrong purpose, unsupported schema, invalid signature, and
oversized members before exposing an entry.

`catalog.sha256` is package-staging integrity metadata only and never replaces
Ed25519 verification. `keyring.json` is a separate app-owned packaged public
trust input. Do not add, read, write, stage, or accept `catalog.sig`.

### Packaging modes

Implement one explicit build input with these exact modes:

- **disabled**: package the deferred-publication sentinel, an empty Local
  Whisper keyring/origin set, and no executable/model catalog action. Ordinary
  remote-provider packaging remains available.
- **fixture**: package one bounded synthetic non-inference catalog/runtime/model
  bundle signed by an ephemeral CI key. Fixture purpose, key IDs, origins, and
  bytes are accepted only by fixture package-policy builds and rejected by
  release collection.
- **production**: require an externally supplied, approved, frozen payload,
  public keyring, exact per-platform artifact envelope, provenance, license,
  and approval metadata. Any absent, malformed, unapproved, or fixture-derived
  input fails before collection.

Never generate a production key, silently fall back between modes, or trust a
key shipped inside a downloaded artifact. Key rotation and denylist changes
arrive only through a newly trusted installed application under the existing
distribution policy; this packet does not claim a signed updater.

### Generate one fixture bundle once

One credential-free producer job creates the complete fixture bundle and
ephemeral key pair in a validated private temporary root, signs the canonical
payload and synthetic pack, records one canonical bundle manifest and SHA-256,
destroys the private key, and uploads only public fixture output. The producer
runs exactly once per workflow invocation.

The Linux consumer downloads that producer artifact, verifies its declared
manifest, digest, purpose, and public key ID before use, packages in fixture
mode, and asserts the same values without regenerating, resigning, or mutating
the bundle. A second producer attempt, changed byte, missing manifest, wrong
purpose, wrong key, or digest mismatch fails.

Define an equivalent non-triggered reusable/manual Windows consumer/package
job. It must require the already produced artifact and declared digest as
inputs, have no ordinary push/pull-request trigger, and contain no producer or
signing step. Task 17 validates only the workflow contract. Every execution of
that Windows consumer, installer, helper, or package check occurs exclusively
in Task 19 on the representative Windows phase.

Release collection rejects fixture purpose, fixture key IDs/origins, synthetic
runtime/model bytes, absent production approval metadata, and any bundle not
derived from the protected production-input contract. No private key or secret
may enter repository files, workflow artifacts, cache keys, command lines, or
logs.

### Base installer policy

Windows and Linux base packages may include only:

- shared TypeScript/UI/domain/catalog/inventory integration;
- immutable disabled or approved catalog and public-keyring resources;
- exactly two app-owned native helper roles outside ASAR: the process-owned
  filesystem authority guard and the operation-scoped platform launcher;
- helper expected-file, hash, manifest, and license metadata; and
- non-executable macOS-unavailable shared stubs where the ordinary app package
  requires them.

They must exclude every inference worker; CUDA, cuBLAS, cuDNN, ROCm, HIP, and
Vulkan inference library; alternate inference runtime; model artifact; driver;
full SDK/toolkit; shader compiler; package installer; cache; source tree;
build tool; fixture private input; and arbitrary local build output. macOS gets
no executable Local Whisper helper or runtime/model catalog action.

Build the two helpers for the exact package platform, stage them outside ASAR,
and verify expected identity before spawn. Test runtime resolution without
exposing a path to renderer. The guard's one-use Windows control endpoint stays
the only addressed local-control exception; no third helper role, daemon,
listener, or service is introduced.

### Runtime/model pack contract

Runtime packs are immutable, on-demand, and specific to platform,
architecture, engine, target, backend, protocol, and app component. Catalog
entries authenticate exact archive/expanded size, SHA-256, artifact signature,
expected files, runtime dependencies, minimum/allowlisted driver/ISA/device
rows, model formats, RAM/VRAM estimates, license notice IDs, provenance notice
IDs, SBOM identity, and support tier. Model artifacts are separate immutable
engine-native artifacts with exact size and SHA-256; no implicit conversion or
format interchange is allowed.

Origins are project-controlled allowlisted HTTPS. Revalidate every redirect;
requests contain no device identity, settings, prompt, audio, or transcript.
Revalidate executable/library integrity before every spawn and model identity
before first load per app process and after identity/metadata change.
Denylisting blocks execution without auto-delete, auto-update, or fallback.

Production pack assembly may consume only the canonical source/toolchain locks
and worker/pack definitions from Tasks 09, 10, 11, and 12. A successful CMake
install, link, or build-host run is not a complete pack.
Windows `whisper.cpp` staging is project-owned and must not rely on incomplete
upstream runtime-install rules.

### Licenses, SBOM, provenance, and claims

Generate deterministic per-pack notices, SPDX or CycloneDX-compatible SBOM
data, source commit/tree/subset/patch/toolchain identities, exact build options
and accelerator architectures, dynamic dependency closure, artifact hashes and
signatures, redistribution-review state, and license identities. Account for
every retained CUDA, cuBLAS, cuDNN, ROCm, HIP, `whisper.cpp`, nlohmann, model,
quantization, and other component.
An upstream MIT license never waives vendor or model obligations.

The base application is not universally code-signed. UI, documentation, and
tests describe pack signatures under the trusted-installed-app assumption and
make no false app-signing, updater, Windows qualification, AMD Production, or
macOS executable claim.

## Contracts And Boundaries

- Packaging consumes authenticated immutable inputs and never invents trust
  from build output.
- Fixture and production purposes, keys, origins, and approval metadata are
  non-interchangeable and fail closed.
- CI transports only the public generate-once fixture bundle; signing secrets
  and private production inputs never enter ordinary jobs.
- Linux fixture consumption is executable in Task 17. Windows consumption is
  definition-only here and executable only in Task 19.
- The base package boundary is enforced by allowlist and denylist inspection,
  including ASAR and extra-resource contents.

## Expected Files Or Components

- Existing signed-envelope catalog/keyring schemas and strict validators.
- Packaging mode resolver and fail-closed production-input validator.
- Fixture producer, manifest, consumer, and bounded synthetic fixture assets.
- Base-installer policy/manifests and helper staging/inspection scripts.
- Runtime/model pack manifest, signature, SBOM, provenance, notice, license,
  and release-collection validators.
- `.github/workflows/` generate-once producer, Linux consumer, non-triggered
  Windows consumer, and release-collection guard definitions.
- Focused packaging/integrity/security tests and concise packaging README
  updates.
- `package.json` scripts `test:local-whisper:packaging`,
  `test:local-whisper:packaging:fixtures`,
  `verify:local-whisper:packaging:policy`,
  `verify:local-whisper:packaging:linux`,
  `verify:local-whisper:packaging:release-guard`, and
  `verify:local-whisper:packaging`.

## Acceptance Criteria

- Disabled mode preserves ordinary application packaging and exposes no Local
  Whisper executable or model action.
- The existing signed envelope is the only accepted catalog signature format;
  detached `catalog.sig` data is absent and rejected.
- One producer creates one fixture bundle. Linux consumes that exact declared
  digest without regeneration. The Windows workflow contract requires the same
  producer artifact/digest and cannot execute before Task 19.
- Strict envelope validation rejects duplicate, unknown, malformed, wrong
  purpose/key/schema/signature/hash data, fixture trust in release collection,
  and production mode without frozen approved inputs.
- Base-package inspection finds only shared integration and the two approved
  helpers, and none of the prohibited workers, libraries, alternate runtimes,
  models, SDKs, private fixture material, or arbitrary build outputs.
- Runtime pack policy requires complete source/build/dependency/license/SBOM/
  provenance evidence and exact signed compatibility rows.
- Release collection cannot publish fixture or incomplete production output.

## Verification

Task 17 must add the named `package.json` scripts and make each command below
directly executable from the repository root:

```bash
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:packaging:fixtures
rtk npm run verify:local-whisper:packaging:policy
rtk npm run verify:local-whisper:packaging:linux
rtk npm run verify:local-whisper:packaging:release-guard
rtk npm run verify:local-whisper:packaging
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
```

`test:local-whisper:packaging:fixtures` must invoke exactly one producer in its
test workflow and prove that a second generation, changed byte, wrong digest,
wrong purpose, wrong key, or leaked private key fails. The policy test must
parse the deferred Windows workflow and prove it consumes producer outputs and
has no producer/signing or ordinary trigger. Do not run
`rtk npm run dist:win -- --dir` or any Windows consumer in Task 17.

## Failure And Rollback

- A fixture or production validation failure stops before package collection;
  never fall back to unsigned, detached, fixture, production, or disabled data
  implicitly.
- Explicit disabled mode keeps ordinary public packaging buildable while real
  Local Whisper production inputs are unavailable.
- Remove only task-owned temporary fixture/package outputs. Preserve canonical
  source objects, pack locks, unrelated build products, and implementation
  work owned by earlier packets.

## Manual Gates

- `MANUAL GATE - production signing and origins`: external authority must
  provide approved payload, public keyring, origins, signatures, key rotation,
  and denylist policy; no private credential is requested or stored here.
- `MANUAL GATE - licenses and redistribution`: `AC-MAN-012` requires approval
  for every real runtime/model component before catalog inclusion.
- `MANUAL GATE - representative Windows`: every Windows consumer, package,
  installer, helper, and same-digest execution is exclusively Task 19.
- `MANUAL GATE - publication`: upload, publication, tag, and release remain
  separately unauthorized.
- No commit, push, or pull request is authorized by this packet.

## References

- `../spec.md`: Sections 12, 13, 14, 17, 18, and 22; acceptance rows
  `AC-AUTO-017`, `AC-AUTO-028`, `AC-AUTO-030`, `AC-AUTO-031`,
  `AC-AUTO-032`, `AC-AUTO-048`, `AC-AUTO-049`, `AC-AUTO-050`,
  `AC-AUTO-057`, `AC-AUTO-061`, and `AC-MAN-012`.
- Tasks 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, and 13 source, artifact,
  filesystem, worker, and pack contracts.
- Existing project Windows/Linux packaging and CI conventions.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with the envelope mode,
fixture digest, Linux consumer evidence, base-package inspection, deferred
Windows job contract, and remaining production/manual gates. Stop before Task
18 execution, representative Windows execution, commit, push, pull request,
publication, or release.
