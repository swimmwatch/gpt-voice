# Task 27: Immutable Hosted Toolchain Inputs And Disconnected Build Enforcement

Status: **Superseded by approved plan revision 31. Do not execute this packet.**
Its verified completed work remains evidence; every unfinished gate is owned by
Task 32.

## Outcome

Make public GitHub-hosted Linux and Windows runners safe inputs to the later
production-equivalent builders by committing complete checksum/signature-locked
acquisition manifests, deterministic raw/ZIP/XZ-to-TAR materializers, closed
toolchain profiles, and enforced network-denied configure/build/test/pack
execution. Use one reviewed acquisition-only WASM XZ decoder for the official
Linux CUDA `.tar.xz` objects. Produce no application installer, runtime-pack
candidate, hardware proof, or release artifact in this packet.

## Prerequisites

- Specification revision 20 and plan revision 28 are approved.
- Decision `planning.hosted-tar-xz-materializer` revision 2 selects one
  checksum/provenance-locked WASM XZ decoder plus project-owned TAR parsing;
  ambient archive commands and package-manager installation remain forbidden.
- Task 25 is complete, reviewed, and committed; its exact RTX 50 profiles and
  catalog applicability remain unchanged.
- Existing source locks, Linux/Windows CPU and CUDA profiles, native build core,
  runtime-pack producer, application packaging scripts, and CI workflows are
  the repository baseline.
- No final signed candidate, hosted six-output result, or platform
  qualification evidence exists.

## Owned Requirements

- Toolchain-preparation portions of `CI-001`, `CI-002`, and `CI-003`.
- Acquisition, build-input, closure, and disconnected-build portions of
  `PKG-002`–`PKG-004`, `PKG-009`–`PKG-010`, and `SEC-003`.
- Supporting preparation for `AC-AUTO-080`, `AC-AUTO-083`, and `AC-AUTO-084`;
  Task 31 remains their primary owner.

## In Scope

- Research official primary sources and commit one versioned acquisition
  manifest/schema for every Linux and Windows compiler, linker, SDK, CUDA
  12.8.1 component, CMake, Ninja, inspection tool, runtime closure, Node/
  Electron packaging input, and helper binary invoked by the six-output build.
- Materialize those objects into fresh bounded platform roots only after exact
  origin, length, SHA-256, vendor signature/provenance, component inventory,
  extraction rules, and license identity pass.
- Lock, review, and materialize the acquisition-only XZ decoder before it is
  loaded; stream every declared Linux `.tar.xz` object through it into one
  strict project-owned TAR parser with bounded output and no ambient `tar`,
  `xz`, package-manager, native binding, or mutable dependency resolution.
- Close every currently uncaptured Windows tool/runtime/profile hash and remove
  ambient MSVC/SDK discovery as build authority.
- Separate Linux CUDA build-time driver-stub linking from the real system NVIDIA
  driver prerequisite; never package the stub or claim device execution.
- Enforce the same network-denied boundary on Linux and Windows from the first
  configure command through compile, test, dependency inspection, metadata
  generation, and archive assembly.
- Add deterministic negative fixtures for moving/mirrored URLs, changed bytes,
  wrong signatures, missing licenses/components, malformed/truncated XZ,
  decompression overflow, TAR header/path/type/link/collision attacks, ambient
  archive tools, network probes, incomplete Windows capture, real-driver
  substitution, and cross-platform/cross-target inputs.
- Add a read-only public-runner preparation workflow that proves each
  materializer and minimal CPU/CUDA link fixture without producing or retaining
  any application installer or runtime pack.

## Out Of Scope

- Full Linux/Windows application packaging or CPU/RTX 50 runtime-pack
  reproducibility; those six output classes belong to Task 31.
- Production signing, native signatures, final release manifests, candidate
  freeze, protected environments, qualification, merge, tag, GitHub Release
  upload/publication, support promotion, or release.
- Physical GPU execution, installation, provider login, model download,
  transcript/audio handling, renderer or IPC changes, RTX 30/40 support, AMD
  promotion, or macOS execution.
- Invented URLs, observed-hash lock refresh, third-party mirrors, moving package
  feeds, ambient package-manager resolution, or redistribution approval.

## Task Contract

Public GitHub-hosted runners remain the execution environment, but no
preinstalled runner tool is trusted merely because it exists. The networked
provisioning phase may fetch only objects named by reviewed manifests from
their exact official origins. Every object record binds a stable ID, platform,
architecture, component/version, immutable origin, expected byte length and
SHA-256, vendor signature or repository-provenance policy, canonical extracted
manifest digest, bounded extraction limits, license path/digest, and its
permitted build/runtime role. A field that cannot be verified remains `Pending`
and blocks Task 27; the implementation must not fill it from unreviewed
observations or relax the schema.

The manifests must cover all invoked user-space build and packaging inputs,
including transitive Electron/electron-builder/AppImage/Windows packaging
helpers. Exact package-lock integrity is necessary but not sufficient for a
separately downloaded executable. GitHub Actions used by the preparation
workflow are pinned to full commits. Mutable aliases such as `latest`, a branch,
an unversioned vendor bootstrap result, `winget`, Chocolatey, or ambient
`apt`/Visual Studio discovery cannot become build authority.

The selected decoder candidate is `xz-decompress@0.2.3`, acquired only as the
exact npm registry object
`https://registry.npmjs.org/xz-decompress/-/xz-decompress-0.2.3.tgz`: 14,444
bytes, SHA-256
`b590b7ea774bd82e812d74c572d6c9fcd4abef4da752c974e8d335439f63e69c`, npm
SRI
`sha512-O8v6HG8T0PrKBcpyWA13GkSYWFvncwzuzcLx5A7++l3HsE3atmoetXjIxrZ/JV/nbvSZ7WS4+3XvREZuVn+rEA==`,
and upstream `gitHead` `02e7ec3ee164de24cd3d1baf76911dd0be68a7c0`.
Its package signature, five-entry inventory, bundled JS/WASM bytes, upstream
source tree, `xz-embedded` commit
`6f0e0c41e3682254c2e0be245f275f77df821ffe`, `walloc` commit
`a93409f5ebd49c875514c5fee30d3b151f7b0882`, and their applicable license
records remain bound provenance. Decision
`planning.hosted-tar-xz-materializer` revision 2 accepts the exact published
package's declared `MIT` license for this acquisition-only use; the absence of
a standalone upstream license file does not keep its production record
`Pending`.
The package is not added as an application dependency, cannot resolve another
package, cannot access the network while executing, and is never shipped in an
application, runtime pack, candidate, or release asset.

The acquisition controller verifies the compressed object before opening it,
materializes only the declared decoder member from the npm `.tgz` through a
bounded project-owned GZIP/TAR path, rehashes that member, and then loads it only
from the fresh verified root. XZ decoding is streaming and backpressured. It
rejects malformed, truncated, checksum-invalid, concatenated, trailing-data, or
unsupported-filter streams and aborts before filesystem admission when the
record's decoded-byte ceiling is exceeded. No complete CUDA TAR or component
may be buffered in memory.

The TAR parser accepts only the explicitly declared USTAR/PAX subset needed by
reviewed official objects and rejects GNU/sparse or unknown extensions. It
validates header checksums, numeric fields, padding, terminal zero blocks,
declared entry count, per-entry and aggregate sizes, normalized paths, exact
types/modes, duplicate and case-fold collisions, and complete input
consumption. Regular files and directories are admitted only when declared.
Hard links and special files are forbidden. A symbolic link is admitted only
when its exact relative target is declared, remains inside the same component
root, forms a bounded acyclic chain ending at a declared regular file, and is
created after targets through no-follow filesystem operations. Every file and
link is reverified into the canonical materialized manifest.

The reviewed NVIDIA CUDA 12.8.1 redistribution catalog is the authority for the
four required component versions on each platform: `cuda_nvcc` 12.8.93,
`cuda_cudart` 12.8.90, `cuda_cccl` 12.8.90, and `libcublas` 12.8.4.1. Linux
records use the catalog's `.tar.xz` paths and SHA-256 values
`9961b3484b6b71314063709a4f9529654f96782ad39e72bf1e00f070db8210d3`,
`8d566b5fe745c46842dc16945cf36686227536decd2302c372be86da37faca68`,
`0740e9e01e4f15e17c5ab8d68bba4f8ec0eb6b84edccba4ac45112d2d2174e4b`, and
`21718957c2cf000bacd69d36c95708a2319199e39e056f8b4f0f68e3b9f323bb`.
Windows records use the catalog's ZIP paths and SHA-256 values
`9fdc70b4271ed9aad4d64cd7076a7d96ec36512d074b9995fe638de669197391`,
`4a39058fd8519444a81cfc7ae055d136f48d1a31ffa41ae255b35b2edd61e13b`,
`bd8548fa1ae82f92910bebc3079e14bd58c5a92aa64596d46bd610a478cb39d7`, and
`57a470112cec7e112c95253dde8b3c7184d795dbd92b0bde77a4cb7f8c94c8aa`.
The production lock must copy exact catalog paths, sizes, and component license
identities and must still block on any unresolved redistribution or provenance
field.

Materialization uses a fresh attempt-owned root and rejects absolute, drive,
UNC, traversal, duplicate, case-fold-colliding, undeclared or unsafe links,
special files, unexpected modes, count/size overflow, overwrite, undeclared
entries, or post-verification mutation. Windows vendor Authenticode and catalog
validation must bind the expected publisher and signed object before
extraction; Linux repository/package signatures and exact object hashes must be
verified before use. The canonical materialized-file manifest and tool/runtime
hashes must close the existing profile `null` fields.

Linux CUDA configuration links against only the reviewed CUDA 12.8.1 toolkit
driver stub inside the verified toolchain root. The stub is a build input, is
excluded from runtime-pack files, and cannot satisfy runtime device proof. The
resulting worker continues to declare `libcuda.so.1` plus the approved minimum
driver as a system-owned physical-host prerequisite. A captured driver library
from a development machine is not a hosted build input.

After provisioning, the build controller closes network access before the
first configure and keeps it closed through archive assembly. Linux uses its
existing OS isolation only after verifying the named harness. Windows gains an
OS-enforced, attempt-scoped isolation boundary plus a same-boundary failing
network probe; proxy-only environment variables or a boolean flag without
enforcement are insufficient. The controller supplies a closed environment and
explicit acquired paths on both platforms, rejects undeclared executables and
generated fetch/download steps, handles cleanup in `finally`, and fails if the
isolation capability is absent or cannot be proven.

The preparation workflow runs with `contents: read`, no protected environment,
no production secret, and no write/release authority. It may retain only
bounded non-installation reports and digests for at most three days. Minimal
CPU/CUDA link fixtures prove that the acquired tools and CUDA stub are usable;
they are not application/runtime outputs, device evidence, or Production
eligibility.

## Contracts And Boundaries

- Task 27 owns acquisition/materialization and the disconnected executor. Task
  31 owns the production-equivalent builder matrix and all six output claims.
- The WASM decoder and project-owned GZIP/XZ/TAR paths are provisioning tools
  only. They may not become runtime-pack, application, provider, or renderer
  dependencies, and no second archive implementation may bypass their checks.
- Network-capable provisioning and network-denied building are distinct phases;
  no build callback, package manager, CMake graph, or helper may cross back into
  provisioning.
- The same manifests, materializers, profiles, and build controller must be
  reused unchanged by Task 31 and the later protected Task 28 builder path.
- CI reports contain only public component identities, bounded runner labels,
  manifest/tool/profile digests, and sanitized statuses. No token, private host
  path, environment dump, session, installer origin, or raw error is retained.
- Existing source-object, fixture-trust, runtime-catalog, and installation-
  origin boundaries remain unchanged.

## Expected Files Or Components

- Versioned hosted acquisition manifests and JSON Schema under the existing
  `runtime/local-whisper/toolchains` ownership boundary.
- Platform materializers, bounded GZIP/XZ/TAR/ZIP and signature verifiers, and
  focused fixtures under existing Local Whisper script/test boundaries.
- Closed Linux/Windows CPU/CUDA profiles, including captured Windows hashes and
  the Linux CUDA driver-stub versus real-driver split.
- `scripts/local-whisper/whisper-cpp-build-core.mjs`, disconnected-build audit
  tooling, runtime-pack orchestration seams, and their focused tests.
- One read-only preparation workflow, `package.json` command registration, and
  task-plan ownership artifacts, including
  `scripts/local-whisper/validate-task-plan.mjs` revision/task/owner constants.

## Acceptance Criteria

- Every external build or packaging executable/component is named by one
  validated official acquisition record with exact bytes, provenance/signature,
  extraction, component, and license identity; no active profile hash remains
  uncaptured.
- The exact reviewed WASM decoder record is verified before code loading,
  resolves no dependency or network request, streams official Linux CUDA XZ
  data into the strict TAR parser within declared limits, and is absent from all
  application/runtime outputs.
- Valid declared relative CUDA symlink chains materialize reproducibly, while
  escaping, dangling, cyclic, cross-component, hard-link, special-file,
  duplicate, undeclared, malformed XZ, and decompression-bomb fixtures fail
  before admission and leave no partial root.
- Linux and Windows independently materialize identical roots from identical
  manifests and reject changed, mirrored, moving, unsigned, incomplete,
  malformed, cross-platform, or cross-target inputs.
- Linux CUDA link fixtures succeed using only the verified toolkit driver stub,
  while the stub is absent from runtime outputs and no device/driver evidence is
  claimed.
- Windows and Linux network probes fail inside the same enforced boundary used
  by configure/build/test/pack, and every attempted generated fetch or ambient
  executable fails before output admission.
- The public-runner preparation workflow is read-only, retains no installer or
  runtime pack, receives no production secret, and emits only bounded
  non-installation reports.
- Existing source/profile, native build, packaging, fixture, type, lint, format,
  audit, and production-build checks remain passing.

## Verification

```bash
rtk npm run test:local-whisper:hosted-toolchains
rtk npm run verify:local-whisper:hosted-toolchains
rtk npm run test:local-whisper:native-sources
rtk npm run test:local-whisper:native-build-audits
rtk npm run test:local-whisper:packaging
rtk npm run verify:local-whisper:packaging:policy
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
rtk npm run test:local-whisper:hosted-toolchains
rtk npm run verify:local-whisper:hosted-toolchains
```

## Failure And Rollback

- An unavailable official object, unverifiable decoder/source/submodule/license
  provenance, malformed or unsupported official archive, mutable installer
  graph, uncaptured hash, missing isolation capability, or failed public-runner
  preparation row blocks Task 27 and Task 31. It does not authorize an ambient
  tool, mirror, synthetic digest, reduced platform matrix, network-capable
  build, or physical-driver substitution.
- Preserve only sanitized reports and exact public digests. Normal retention or
  an attempt-owned cleanup may remove ephemeral materialization roots; never
  delete shared caches or user data broadly.
- Roll back manifests, materializers, profile changes, and build isolation as
  one contract. Do not restore ambient Windows capture or weaken existing
  source/fixture/package gates.

## Manual Gates

- Primary-source research and downloading the exact public toolchain/packaging
  objects require separately authorized network access. Research already
  confirmed the NVIDIA CUDA 12.8.1 catalog records, CMake 3.31.8 release
  hashes, and the decoder candidate identity above; production acquisition and
  the remaining compiler/SDK/Ninja/packaging/license/provenance review are still
  gated. No credential, private repository, mirror, upload, or publication is
  implied.
- The exact decoder package's declared MIT license is accepted under decision
  `planning.hosted-tar-xz-materializer` revision 2. Its immutable package,
  source, and component provenance remains locked and reviewed; a failed
  identity or integrity check keeps its record `Pending` rather than
  authorizing substitution.
- Actual GitHub-hosted Linux and Windows preparation workflow execution is
  required before Task 27 completion. It requires a separately authorized
  commit/push/PR or other reviewed immutable workflow source, but no physical
  GPU or production secret.
- License/redistribution review may record component status but does not grant
  production redistribution approval.
- Commit, push, PR, Task 31 execution, signing, candidate freeze,
  qualification, merge, tag, upload, publication, support promotion, and
  release remain separately authorized.

## References

- Specification revision 20 Sections 12.1, 18.1–18.4, 19.1
  (`AC-AUTO-080`, `AC-AUTO-083`, `AC-AUTO-084`), and 22.
- Decisions `planning.hosted-toolchain-provisioning` and
  `planning.hosted-toolchain-packet-decomposition` revision 2, and
  `planning.hosted-tar-xz-materializer` revision 2.
- NVIDIA CUDA 12.8.1 redistribution catalog and the pinned
  `xz-decompress@0.2.3` npm/upstream records named in this packet.
- Existing toolchain profiles, native source/build audits, runtime-pack
  producer, application packaging workflows, and project release conventions.

## Completion And Handoff

After both public-runner preparation rows and all deterministic checks pass,
update `todo.md` and `handoff.md` with the reviewed decoder/source/license
identities, exact non-sensitive manifest/profile digests, runner labels/image
versions, workflow runs, and any blocker. Hand the unchanged acquisition/
materialization/disconnected-build contract to Task 31 and stop before commit,
hosted six-output execution, release preparation, protected environment use,
signing, candidate freeze, or Task 30.
