# Task 19: Cross-Platform Implementation Readiness

## Outcome

Finish and verify the complete Local Whisper production implementation for
Windows x64 and Linux x64 without executing representative platform
qualification. Both operating-system paths must provide the real managed
artifact pipeline, CPU/CUDA runtime selection, platform process ownership,
model authority, worker lifecycle, transcription, explicit load/unload, and
packaging contracts. Add one deterministic implementation-readiness gate that
reports Linux and Windows qualification as `Pending` and cannot emit a
Production verdict.

Preserve the existing Task 19 checkpoint work and fixes. Do not freeze or adopt
a shared candidate, platform graph, result, evidence index, predecessor result,
or interrupted private qualification run. Those operations belong to Tasks
20–22.

## Prerequisites

- Specification revision 11 and plan revision 17 are approved.
- Tasks 01–18 remain complete and committed; they are not reopened.
- Existing Task 19 checkpoint commits through `76549d87` remain the
  implementation baseline, including authenticated transfers, native model
  authority, deterministic inputs, the production environment, Linux
  qualification tooling, and qualification-discovered production fixes.
- Task 17 fixture bytes remain unchanged with SHA-256
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- No representative Windows host, Windows command, all-model Linux run,
  production private key, upload, or publication is required.
- Task 19 has separate execution authorization.

## Owned Requirements

- Primary implementation ownership: `IMPL-001`, `DL-004`, `ARCH-010`,
  `COMP-012`, `DIST-001`–`DIST-002`, `MODEL-011`, `PKG-011`, `SEC-014`,
  `REL-001`, `QUAL-001`, `QUAL-002`, `QUAL-003`, `QUAL-004`, `PRIV-005`, and
  `OPS-002`–`OPS-003` for deterministic cross-platform implementation
  behavior.
- Complete Windows/Linux production-path integration for all applicable
  architecture, catalog, transfer, filesystem, capability, worker, lifecycle,
  IPC, settings, UI, privacy, diagnostics, and packaging requirements already
  implemented by Tasks 01–18.
- Primary automated acceptance: `AC-AUTO-064`, `AC-AUTO-065`, `AC-AUTO-066`,
  `AC-AUTO-067`, `AC-AUTO-068`, `AC-AUTO-069`, `AC-AUTO-070`,
  `AC-AUTO-072`, and `AC-AUTO-073`.
- No manual platform qualification ownership. `AC-MAN-001`–`AC-MAN-008`,
  `AC-MAN-013`, and platform evidence for `AC-MAN-014` remain Tasks 20–22.

## In Scope

- Audit and finish the process-owned `ProductionLocalWhisperEnvironmentFactory`
  for both `linux` and `win32`, including strict packaged-resource resolution,
  runtime registry discovery, device discovery, launch leasing, model
  authority, coordinator, worker port, artifact commands, safe removal, and
  deterministic disposal.
- Finish both authenticated transfer profiles and strict catalog payload v2
  purpose/keyring/origin isolation. Preserve the unchanged Task 17 fixture.
- Ensure Linux and Windows helpers, CPU/CUDA worker roles, runtime-pack
  manifests, platform toolchain profiles, package resource mappings, and
  production/qualification catalog inputs are defined without ambient
  fallback or platform-dependent task-number assumptions.
- Verify Linux process-group and Windows Job Object ownership contracts,
  one-use authenticated launcher bootstrap, inherited model descriptor/handle
  authority, exact executable identity, process-tree cleanup, and non-secret
  arguments through deterministic native/source/fixture tests. Native Windows
  execution is deferred to Task 21.
- Preserve the corrected qualification-v2 DAG schemas and deterministic
  model/FLEURS/direct-engine/runtime producers as reusable later-test tooling.
- Add a fail-closed implementation-readiness verifier and package command. It
  must distinguish implementation evidence from platform evidence and report
  both platform qualifications as `Pending` when no result/index exists.
- Update the machine-readable task-plan validator and ownership registry for
  plan revision 17, Tasks 01–22, and all 72 canonical automated acceptance IDs
  (`AC-AUTO-001`–`054`, `056`–`073`).
- Repair stale source comments, tests, and scoped technical documentation that
  still assign Linux qualification to Task 19 or representative Windows work
  to Task 20.

## Out Of Scope

- Real public-model transcription, the all-six-model CPU/CUDA matrix, resource
  measurement, lifecycle repetition, predecessor execution, or platform
  evidence freeze on Linux or Windows.
- Representative Windows commands, Wine, cross-compilation as evidence, or a
  claim that source/contract checks prove Windows qualification.
- Production private-key use, legal approval, GitHub runtime upload, final
  origin parity, publication, tag, support-tier promotion, or release.
- Physical AMD qualification or executable macOS inference. AMD remains
  `Preview · Untested`; macOS remains `Planned · Unavailable`.
- Changing the all-six Production qualification matrix, evidence algorithms,
  acyclic graph, model identities, thresholds, or support claims.

## Task Contract

### Cross-platform production composition

One main-process composition root owns all privileged Local Whisper state and
resources. Renderer and preload expose only typed authenticated artifact and
provider actions; URLs, paths, executable arguments, model handles, device
identities, and mutable runtime services never cross into renderer authority.

For both Linux and Windows, the production factory must select the correct
filesystem adapter and process owner, authenticate packaged helpers, resolve
only catalog-declared runtime/model identities, reconstruct inventory, and
bind the coordinator to the real artifact and worker ports. Unsupported
platforms use the explicit macOS/other unavailable path and never reach an
executable pack.

CPU selection must initialize no GPU backend. CUDA selection must preserve the
exact selected opaque device and has no CPU/device/backend fallback. Settings,
capability, inventory, residency, and worker epochs remain authoritative;
stale operations start no work.

### Artifact, runtime, and model contracts

`restricted-tar-gzip-v1` runtime materialization and `pinned-raw-model-v1`
model materialization remain main-owned, bounded, streaming, no-follow,
checksum-verified, and atomically promoted. Qualification, fixture,
production, and disabled trust are non-substitutable. Public model downloads
remain anonymous and restricted to exact immutable `ggerganov/whisper.cpp`
objects and the approved redirect policy.

Windows and Linux CPU/CUDA runtime roles must be explicit in manifests and
packaging policy. Platform executable extensions, modes, dependency layout,
and packaged helper identities are data-driven and tested; remote metadata
cannot select a transfer profile, backend, path, executable, or fallback.

### Native ownership and lifecycle

Linux retains process-group/pidfd ownership. Windows retains suspended process
creation, restricted inherited handles, Job assignment before resume,
kill-on-close, nested-Job fail-closed behavior, and exact process-start
identity. Both paths map the one-use model authority to logical slot `3`,
validate executable/model size and SHA-256, complete the framed handshake, and
release leases only after confirmed exit.

Load, warm-up, transcription, cancellation, crash, unload, provider switch,
suspend/resume, and shutdown retain bounded typed results. Cleanup is
deterministic and non-throwing; failed ownership proof remains fail-closed and
never fabricates process or allocation cleanup.

### Implementation-readiness boundary

The new verifier must pass only when the complete Windows/Linux production
graph, platform mappings, deterministic artifact/schema producers, strict
trust policies, and automated contracts are present. It must accept missing
platform result/index inputs only by returning `implementationReady: true`,
`linuxQualification: Pending`, `windowsQualification: Pending`, and
`productionReady: false`. Missing implementation evidence must fail the gate;
missing qualification evidence must never be rewritten as an implementation
failure or Production pass.

No candidate SemVer/timestamp/source/package digest is frozen by this packet.
The existing `2.4.0` decision remains an input for Task 20, which creates a
fresh freeze after Task 19's final committed source identity exists.

## Contracts And Boundaries

- Windows and Linux production code is in scope; representative execution is
  not. Source/fixture checks never become hardware evidence.
- Main owns network, filesystem, process, runtime, device, model, and lifecycle
  authority. Renderer supplies only typed identities and explicit actions.
- Task 17 fixture bytes and the corrected v2 schemas remain compatible.
- Raw host paths, hardware IDs, private environment data, audio, transcripts,
  prompts, measurements, and key material never enter repository artifacts or
  chat.
- No platform branch, aggregate root, Production claim, signing, upload,
  publication, push, PR, tag, or release occurs.

## Expected Files Or Components

- `src/main/localWhisper/composition/` production factory, platform facts,
  launch/model/runtime authority, artifact/worker ports, and focused tests.
- `src/main/localWhisper/packaging/`, `artifacts/`, `filesystem/`, and
  `supervisor/` platform adapters and contract tests.
- `runtime/local-whisper/` helper/worker C++20 platform backends, build and
  staging profiles, manifests, READMEs, and native contract tests.
- `scripts/local-whisper/packaging/`, native-build/runtime-pack tooling, and
  qualification schema/producers used by later packets.
- A new implementation-readiness verifier and
  `verify:local-whisper:implementation-readiness` package command with focused
  tests.
- `scripts/local-whisper/validate-task-plan.mjs`,
  `tasks/acceptance-owners.schema.json`, `tasks/acceptance-owners.json`, stale
  task-boundary text, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-064`–`AC-AUTO-070` and `AC-AUTO-072` pass through deterministic
  transport, trust, production-port, DAG, model, corpus, runtime, and evidence-
  contract checks without representative hardware execution.
- `AC-AUTO-073` proves that complete Windows/Linux implementation readiness is
  independently true while Linux/Windows/aggregate qualification remains
  `Pending` and cannot produce Production.
- Both OS paths have explicit filesystem/process-owner, helper, CPU/CUDA
  runtime, model-authority, packaging, and lifecycle mappings with negative
  tests for absence, mismatch, fallback, and unsupported platforms.
- The plan registry validates Tasks 01–22 and exactly 72 unique automated
  acceptance owners after its validator is updated.
- No sanitized or private platform qualification evidence is frozen or
  adopted, and no Windows command is represented as executed.

## Verification

Run platform-independent and Linux-host checks only; do not run representative
qualification:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run verify:local-whisper:implementation-readiness
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:composition
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:qualification
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
```

The registered Task 19 command is:

```bash
rtk npm run verify:local-whisper:implementation-readiness
```

Do not run `run:local-whisper:qualification:linux`,
`verify:local-whisper:qualification:linux`, any Windows-only command, or
`verify:local-whisper:all` in this packet.

## Failure And Rollback

- Preserve completed Tasks 01–18 and all committed Task 19 checkpoints. Revert
  only the narrow Task 19 implementation delta if a contract cannot pass.
- A missing Windows or Linux production mapping, platform-specific fallback,
  unsafe trust/path/process behavior, or incomplete implementation-readiness
  gate keeps Task 19 incomplete.
- Missing representative hardware, models, measurements, predecessor, or
  platform evidence is expected `Pending` state and is not a Task 19 blocker.
- Never weaken validation, mark qualification passed, or adopt an interrupted
  private run to obtain completion.

## Manual Gates

- Representative Linux and Windows execution is explicitly deferred to Tasks
  20 and 21.
- Exact native Windows compilation/execution remains Task 21; Task 19 may only
  validate Windows source, manifests, and deterministic contract fixtures on
  the available host.
- Production signing, legal approval, upload, publication, commit, push, PR,
  tag, support promotion, and release remain outside this packet.

## References

- Specification revision 11 Sections 4, 5, 7, 9.6, 12, 18.3, 19.1–19.3,
  and 22.
- Task 17 fixture bundle and Tasks 01–18 committed contracts.
- Existing Task 19 checkpoint commits and current production-composition,
  native-quality, packaging, privacy, and provider conventions.

## Completion And Handoff

Mark Task 19 complete only when both Windows and Linux CPU/CUDA production
paths satisfy the implementation-readiness gate and all packet checks pass,
while both platform qualifications remain explicitly `Pending`.

Update `todo.md` and `handoff.md` with changed files, checks, the exact final
Task 19 commit/source identity when later committed, and Task 20 as the next
packet. State that no shared candidate, Linux/Windows branch, result, evidence
index, aggregate root, or Production verdict exists. Stop before Task 20,
commit, push, PR, signing, upload, publication, or release unless separately
authorized.
