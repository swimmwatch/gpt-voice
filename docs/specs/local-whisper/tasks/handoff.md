# Local Whisper Handoff

## Authoritative State

- Specification revision **20** is Approved. RTX 50 / `sm_120a` remains the
  only active NVIDIA target on Linux and Windows; RTX 30/40 stay fail-closed
  and deferred. Release preparation and exact signed-byte Linux/Windows
  qualification now precede the preserving release-PR merge; the immutable tag
  is created afterward on the unchanged qualified head.
- Plan revision **28** is Approved. The authoritative active sequence is Task
  27 → Task 31 → Task 30 → Task 28 → Task 29 → Task 21 → Task 22. Task 26
  remains deferred and non-executable.
- Tasks 01–20, 23, 24, and 25 are complete. Task 24 baseline `7ebb102` plus its
  authorized follow-up delivered deterministic Windows CPU/RTX 50 readiness and
  bounded Windows smoke without qualification or Production claims.
- Task 25 is verified. It adds a bounded,
  shell-free main-owned NVIDIA pre-install inventory, exact RTX 50
  `sm_120a-real` applicability, catalog/migration closure, renderer-safe
  acquisition filtering, and an artifact-acquisition guard. No physical-host
  observation, candidate, qualification, package, or release evidence was
  created.
- No final signed candidate, `candidateInputDigest`, platform branch, aggregate
  root, production upload, GitHub Release asset, publication, support promotion,
  tag, or release exists.

## Revision 28 Roadmap

- Task 25 closed main-owned cross-platform RTX 50 inventory, applicability,
  catalog, migration, renderer filtering, and pre-transfer acquisition
  enforcement.
- Task 27 has completed its authorized local automated scope: a strict hosted
  acquisition-lock schema, raw-object and deterministic ZIP fixture
  materializer/re-verifier, archive-entry preflight, Windows ambient-input
  fail-closed guard, and shared Linux/Windows OS-boundary command contract are
  in the worktree. Runtime-pack production now requests network denial on both
  platforms. Revision 28 selects one locked acquisition-only WASM XZ decoder
  plus strict streaming project-owned TAR parsing for Linux CUDA, both now
  implemented and locally verified. Decoder/source/submodule/license review,
  exact official acquisition records, closed active profiles, CUDA driver-stub
  separation, read-only hosted workflow, and actual Linux/Windows rows remain;
  no production object, pack, installer, or qualification evidence was
  produced.
- Task 31 consumes Task 27 unchanged and implements the read-only hosted
  Linux/Windows application plus CPU/RTX 50 builders and reproducibility checks
  without production secrets, installable artifact upload, or hardware claims.
- Task 30 implements canonical package/changelog/manual-registry preparation,
  deterministic release identity, read-only `release/v<SemVer>` PR checks, and
  repository merge-commit-only policy verification; it creates no release
  attempt.
- Task 28 consumes the exact Task 30-qualified release PR head in the protected
  reviewer-gated environment to freeze the final signed six-output candidate
  set and signed release manifest; it merges, tags, and publishes nothing.
- Task 29 qualifies exact Task 28 Linux candidates and seals the shared/Linux
  branch. Task 21 consumes it unchanged and seals Windows.
- Task 22 reconciles both branches into the required pre-merge status, verifies
  a separately authorized merge preserved the qualified head, and implements
  later protected exact-head tag creation plus non-clobbering GitHub Release
  delivery. Merge/tag/upload/publication and `AC-MAN-019` remain separately
  authorized manual gates.

## Stable Inputs And Gates

- Candidate SemVer: `2.4.0`; the later release branch must commit it in
  `package.json`, mirror it in `package-lock.json` and the changelog, use branch
  `release/v2.4.0`, and derive expected tag `v2.4.0`.
- Task 17 fixture digest:
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- Task 20 preflight remains advisory and must be revalidated after final source
  and candidate freeze.
- Available representative hardware: Linux RTX 50 and Windows RTX 5090 only.
- Network/toolchain provisioning, protected reviewers, signing/legal inputs,
  private evidence storage, physical qualification, commit, push, release
  branch/PR creation or update, repository-wide merge-setting changes,
  release-PR merge, tag creation, GitHub Release staging/upload/publication,
  clean release installs, support promotion, and release are explicit manual
  gates.
- Public-runner Task 27 preparation and Task 31 six-output execution each
  require a separately authorized immutable commit/push/PR or approved main
  source; neither requires a physical GPU.
- The current Task 27 worktree updates `validate-task-plan.mjs` through plan
  revision 28, all 31 task packets, and Task 31 ownership of `AC-AUTO-080`,
  `AC-AUTO-083`, and `AC-AUTO-084`.
- All application/native runtime installation origins must be immutable assets
  in the approved same-tag GitHub Release; pinned Hugging Face model objects are
  the sole exception.

## Planning Files Changed

- `docs/specs/local-whisper/decisions.yaml`
- `docs/specs/local-whisper/tasks/plan.md`, `todo.md`, and `handoff.md`
- Tasks 21, 22, and 26–31 packets
- `acceptance-owners.json`, `acceptance-owners.schema.json`

## Task 27 Local Automated Scope

### Changed Components

- `hosted-toolchain-acquisition-lock.schema.json` defines strict, versioned
  exact-origin, exact-byte, provenance, license, role, target, and bounded
  materialization records without introducing a synthetic production lock.
- `hosted-toolchain-core.mjs` materializes identity-checked raw files and
  checksum-locked ZIP members plus streamed GZIP/XZ TAR entries into a fresh
  owned root. It re-verifies every file and canonical record, requires a prior
  locked XZ-decoder record, rejects mutation/undeclared entries, and preflights
  archive metadata against traversal, links, special files, case collisions,
  ZIP64/multi-disk/encryption/data descriptors, local/central disagreement,
  CRC mismatch, overlap, and size overflow.
- `network-denied-build-core.mjs` makes both platforms choose an OS boundary;
  Linux uses the reviewed user/network namespace path, while Windows routes to
  the attempt-scoped Windows Firewall runner and requires a same-boundary
  pinned probe. The runner always removes its own firewall rules in `finally`.
- `whisper-cpp-build-core.mjs` routes configure/build/test through that shared
  boundary when requested. Hosted Windows builds refuse static profiles with
  uncaptured identities instead of treating ambient MSVC/SDK bytes as trusted.
  `produce-runtime-packs.mjs` requests this boundary for Linux and Windows.
- Package commands, focused fixture tests, and task-plan validation wiring are
  present. The TAR fixtures include a regression for a truncated entry after
  its output descriptor is finalized. The active Windows profiles deliberately
  remain unclosed rather than receiving invented hashes.

### Local Verification

Passed:

- `rtk npm run test:local-whisper:hosted-toolchains`
- `rtk npm run verify:local-whisper:hosted-toolchains`
- `rtk npm run test:local-whisper:acceptance-ownership`
- `rtk npm run test:local-whisper:native-build-audits`
- `rtk npm run test:local-whisper:packaging`
- `rtk npm run verify:local-whisper:packaging:policy`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint` (passes with existing repository warnings)
- `rtk npm run format:check`
- `rtk npm run audit:prod`
- `rtk npm run build:prod` (passes with existing webpack entrypoint-size warnings)
- `rtk git diff --check`
- Direct Prettier for the hosted materializer, test, schema, validator, and
  revised task artifacts
- Direct ESLint for the hosted materializer, focused test, and validator

Blocked / not run:

- `rtk npm run test:local-whisper:native-sources` has one pre-existing failure:
  the unchanged native source importer hashes to
  `66ba3b34bef0df3624f5b1ff921557071e323391d798c10965e44426d9c554f1`,
  while the committed source locks expect
  `253a0320cb0b5960fdcdc2ec5a2eb6f7c09353351f153b37cea65c035f4f61cb`.
  Updating a reviewed source lock is outside this packet's authorization.
- No production acquisition manifest or active-profile hash was written, no
  Windows Firewall runner was executed, and no public GitHub workflow was
  added or run.

Revision 28 planning checks passed: JSON Schema/YAML parsing, all 31 packet
files and required headings, 30 active plus one deferred task, all registered
commands, 89 unique automated owners, unchanged acyclic active sequence, direct
Prettier for revised planning files, and `rtk git diff --check`.

### Remaining Manual Gates

- Research and review the complete official Linux/Windows compiler, SDK, CUDA
  12.8.1, packaging, Node/Electron, inspection, network-probe, license, and
  signature inputs; then create verified production locks and close all active
  profile hashes without using ambient machine observations.
- Official-source research verified CMake 3.31.8 Linux/Windows SHA-256 release
  records and NVIDIA's `redistrib_12.8.1.json`. Temporary Linux CUDA NVCC,
  CUDART, and CCCL downloads matched the vendor-published SHA-256 values. The
  CUDART component contains the build-only `lib/stubs/libcuda.so`; it confirms
  the required separation from the real host `libcuda.so.1`. Linux CUDA inputs
  are `.tar.xz`; revision 28 resolves the implementation choice with
  `xz-decompress@0.2.3` as a locked acquisition-only WASM candidate and a
  project-owned bounded GZIP/XZ/TAR path. Its exact npm bytes, upstream source,
  `xz-embedded`/`walloc` commits, npm-to-source correspondence, and license
  provenance must be reviewed before its record can leave `Pending`.
- Complete the CUDA toolkit driver-stub versus physical `libcuda.so.1`
  contract and verify that runtime outputs exclude the stub.
- Review exact commit pins for a read-only public preparation workflow, commit
  and push the reviewed source, then run both hosted preparation rows. Windows
  must prove the Firewall boundary and same-boundary probe with acquired tools.
- Resolve the unrelated native-source importer-lock mismatch before treating
  the full Task 27 verification set as green.

## Task 25 Completion

### Changed Components

- `NvidiaSmiHostInventory` and `NvidiaCudaRuntimeApplicability` provide bounded
  Linux/Windows pre-install discovery and fail-closed RTX 50 applicability.
- Production environment composition, device topology, artifact acquisition,
  catalog parsing/types, renderer option/artifact projection, and main-process
  NVIDIA inventory wiring enforce the result without exposing raw host data.
- Qualification and deterministic catalog fixtures define one CPU plus one
  `sm_120a-real` CUDA runtime per supported platform with authenticated driver,
  compute-capability, and VRAM requirements.
- Task 25 verification scripts, implementation-readiness registry validation,
  and deterministic catalog/capability/composition/migration tests cover the
  closed contract.

### Verification

Passed:

- `rtk npm run test:local-whisper:rtx50-applicability`
- `rtk npm run verify:local-whisper:rtx50-readiness`
- `rtk npm run test:local-whisper:catalog`
- `rtk npm run test:local-whisper:capability`
- `rtk npm run test:local-whisper:migration`
- `rtk npm run test:local-whisper:ipc`
- `rtk npm run test:local-whisper:ui`
- `rtk npm run test:local-whisper:composition`
- `rtk npm run verify:local-whisper:implementation-readiness`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint` (passes with existing repository warnings)
- `rtk npm run format:check`
- `rtk git diff --check`

### Remaining Gates

- Task 25's local commit is complete; push remains a separate manual gate.
- Continuous hardware refresh, hosted builders, release preparation, candidate
  freeze, platform qualification, packaging, signing, and publication are not
  part of Task 25. No physical GPU, network, package, or release gate was run.

## Next Packet

Task 27 remains the exact next packet for its external/manual gates; its local
XZ/TAR remediation is complete. Do not start Task 31, release preparation,
candidate freeze, signing, hardware qualification, or any external release
action. This packet is intentionally uncommitted; the local-scope authorization
does not authorize a commit, push, public-runner workflow, Task 30, release
branch/PR, repository-setting change, merge, tag, or publication.
