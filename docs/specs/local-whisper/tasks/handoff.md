# Local Whisper Handoff

## Authoritative State

- Specification revision **20** is Approved. RTX 50 / `sm_120a` remains the
  only active NVIDIA target on Linux and Windows; RTX 30/40 stay fail-closed
  and deferred. Release preparation and exact signed-byte Linux/Windows
  qualification now precede the preserving release-PR merge; the immutable tag
  is created afterward on the unchanged qualified head.
- Plan revision **26** is Approved. The active sequence is Task 25 → Task 27 →
  Task 30 → Task 28 → Task 29 → Task 21 → Task 22. Task 26 remains deferred
  and non-executable.
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

## Revision 26 Roadmap

- Task 25 closed main-owned cross-platform RTX 50 inventory, applicability,
  catalog, migration, renderer filtering, and pre-transfer acquisition
  enforcement.
- Task 27 implements read-only hosted Linux/Windows application plus CPU/RTX 50
  builders and reproducibility checks without production secrets.
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
- All application/native runtime installation origins must be immutable assets
  in the approved same-tag GitHub Release; pinned Hugging Face model objects are
  the sole exception.

## Planning Files Changed

- `docs/specs/local-whisper/decisions.yaml`
- `docs/specs/local-whisper/tasks/plan.md`, `todo.md`, and `handoff.md`
- Tasks 21, 22, 25, 26, 27, 28, 29, and 30 packets
- `acceptance-owners.json`, `acceptance-owners.schema.json`
- `scripts/local-whisper/validate-task-plan.mjs`

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

Task 27 is the next incremental-implementation packet and requires its own
authorization. Do not start it, release preparation, candidate freeze, signing,
hardware qualification, or external release action in this packet. Plan
revision 26 approval does not authorize Task 30, a release branch/PR,
repository-setting changes, merge, tag, or publication.
